import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedService, seedServiceBooking, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc } from "../_generated/dataModel";
import { SERVICE_ERRORS } from "./logic";
import { deleteServiceForUser, submitServiceForUser, updateServiceForUser } from "./service";

async function load(t: TestT, over: Parameters<typeof seedUser>[1] = {}): Promise<Doc<"users">> {
  const id = await seedUser(t, over);
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const provider = (t: TestT, over: Parameters<typeof seedUser>[1] = {}) =>
  load(t, { role: "service_provider", isApproved: true, ...over });

/** A refusal a person sees: a ConvexError carrying exactly this text. */
async function expectRefusal(promise: Promise<unknown>, message: string) {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ConvexError);
  expect((caught as ConvexError<string>).data).toBe(message);
}

const BASE = { serviceType: "tour_guide", title_en: "Oasis walk", title_ar: "جولة الواحة" };

describe("submitServiceForUser", () => {
  it("stores a pending service with its price and the canonical city", async () => {
    const t = makeT();
    const me = await provider(t);

    const id = await t.run((ctx) =>
      submitServiceForUser(
        ctx,
        me,
        {
          ...BASE,
          title_en: "  Oasis walk ",
          city: "Hofuf",
          price: 150,
          priceUnit: "per_hour",
          maxGroupSize: 8,
          contactPhone: "+966500000000",
          languages: ["ar", "en"],
        },
        NOW
      )
    );

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toMatchObject({
      ownerId: me._id,
      status: "pending",
      serviceType: "tour_guide",
      title_en: "Oasis walk",
      title_ar: "جولة الواحة",
      // Stored as one of the thirteen, so a city filter finds it.
      city: "Al Ahsa",
      price: 150,
      priceUnit: "per_hour",
      maxGroupSize: 8,
      contactPhone: "+966500000000",
      languages: ["ar", "en"],
      createdAt: NOW,
      updatedAt: NOW,
    });
    // No score until someone rates it: a 0 would render as a one-star service.
    expect(row?.rating).toBeUndefined();
    expect(row?.reviewCount).toBeUndefined();
  });

  it("does not require a city, which the live 1.0.2 and 1.0.0 apps never send", async () => {
    const t = makeT();
    const me = await provider(t);

    const id = await t.run((ctx) => submitServiceForUser(ctx, me, BASE, NOW));

    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row?.city).toBeUndefined();
    expect(row?.price).toBeUndefined();
  });

  it("is for approved service providers only", async () => {
    const t = makeT();
    const tourist = await load(t);
    const host = await load(t, { role: "business_owner", isApproved: true });
    const waiting = await provider(t, { isApproved: false });

    await expectRefusal(t.run((ctx) => submitServiceForUser(ctx, tourist, BASE, NOW)), SERVICE_ERRORS.NOT_A_PROVIDER);
    await expectRefusal(t.run((ctx) => submitServiceForUser(ctx, host, BASE, NOW)), SERVICE_ERRORS.NOT_A_PROVIDER);
    await expectRefusal(t.run((ctx) => submitServiceForUser(ctx, waiting, BASE, NOW)), SERVICE_ERRORS.NOT_APPROVED);
  });

  it("checks what it stores, and says why in words the provider can read", async () => {
    const t = makeT();
    const me = await provider(t);
    const submit = (over: Record<string, unknown>) =>
      t.run((ctx) => submitServiceForUser(ctx, me, { ...BASE, ...over }, NOW));

    await expectRefusal(submit({ serviceType: "juggler" }), SERVICE_ERRORS.INVALID_TYPE);
    await expectRefusal(submit({ title_ar: "  " }), SERVICE_ERRORS.TITLE_REQUIRED);
    await expectRefusal(submit({ price: 99.5 }), SERVICE_ERRORS.PRICE_NOT_WHOLE);
    await expectRefusal(submit({ price: 0 }), SERVICE_ERRORS.INVALID_PRICE);
    await expectRefusal(submit({ priceUnit: "per_moon" }), SERVICE_ERRORS.INVALID_UNIT);
    await expectRefusal(submit({ maxGroupSize: 101 }), SERVICE_ERRORS.INVALID_GROUP);
    await expectRefusal(submit({ city: "Riyadh" }), SERVICE_ERRORS.INVALID_CITY);

    // Nothing half-written.
    expect(await t.run((ctx) => ctx.db.query("services").collect())).toHaveLength(0);
  });

  it("keeps the daily limit on new services", async () => {
    const t = makeT();
    const me = await provider(t);
    await t.run((ctx) =>
      ctx.db.insert("rateLimits", { key: `service:${me._id}`, windowStart: Date.now(), count: 20 })
    );

    const caught = await t.run((ctx) => submitServiceForUser(ctx, me, BASE, NOW)).catch((e: unknown) => e);

    expect(caught).toBeInstanceOf(ConvexError);
    expect(String((caught as ConvexError<string>).data)).toMatch(/today's limit for new services/);
  });

  it("does not spend the daily allowance on a submission it refuses", async () => {
    const t = makeT();
    const me = await provider(t);

    await expectRefusal(
      t.run((ctx) => submitServiceForUser(ctx, me, { ...BASE, price: -1 }, NOW)),
      SERVICE_ERRORS.INVALID_PRICE
    );

    expect(await t.run((ctx) => ctx.db.query("rateLimits").collect())).toHaveLength(0);
  });
});

describe("updateServiceForUser", () => {
  async function owned(t: TestT, status = "approved") {
    const me = await provider(t);
    const serviceId = await seedService(t, { ownerId: me._id, status });
    return { me, serviceId };
  }

  it("sends a live service back to review with the change applied", async () => {
    const t = makeT();
    const { me, serviceId } = await owned(t, "approved");

    await t.run((ctx) =>
      updateServiceForUser(ctx, me, { serviceId, title_en: " Longer walk ", price: 200, city: "Dhahran" }, NOW + 1)
    );

    expect(await t.run((ctx) => ctx.db.get(serviceId))).toMatchObject({
      status: "pending",
      title_en: "Longer walk",
      price: 200,
      city: "Al Khobar",
      updatedAt: NOW + 1,
    });
  });

  it("puts a rejected service back in the queue and clears the old reason", async () => {
    const t = makeT();
    const { me, serviceId } = await owned(t, "rejected");
    await t.run((ctx) => ctx.db.patch(serviceId, { rejectionReason: "Blurry photos" }));

    // Resubmitted as it is — the app offers exactly that for a rejected one.
    await t.run((ctx) => updateServiceForUser(ctx, me, { serviceId }, NOW));

    const row = await t.run((ctx) => ctx.db.get(serviceId));
    expect(row?.status).toBe("pending");
    expect(row?.rejectionReason).toBeUndefined();
  });

  it("keeps a suspended service suspended, whatever the provider edits", async () => {
    const t = makeT();
    const { me, serviceId } = await owned(t, "suspended");
    await t.run((ctx) => ctx.db.patch(serviceId, { suspendedReason: "Reported twice" }));

    await t.run((ctx) => updateServiceForUser(ctx, me, { serviceId, title_en: "Renamed" }, NOW));

    // An edit is not a way out of a takedown: only an admin reinstates.
    expect(await t.run((ctx) => ctx.db.get(serviceId))).toMatchObject({
      status: "suspended",
      suspendedReason: "Reported twice",
      title_en: "Renamed",
    });
  });

  it("clears the price and the group size with null", async () => {
    const t = makeT();
    const { me, serviceId } = await owned(t);
    await t.run((ctx) => ctx.db.patch(serviceId, { maxGroupSize: 6 }));

    await t.run((ctx) => updateServiceForUser(ctx, me, { serviceId, price: null, maxGroupSize: null }, NOW));

    const row = await t.run((ctx) => ctx.db.get(serviceId));
    expect(row?.price).toBeUndefined();
    expect(row?.maxGroupSize).toBeUndefined();
  });

  it("leaves alone what the update does not mention", async () => {
    const t = makeT();
    const { me, serviceId } = await owned(t);

    await t.run((ctx) => updateServiceForUser(ctx, me, { serviceId, description_en: "Two hours on foot" }, NOW));

    expect(await t.run((ctx) => ctx.db.get(serviceId))).toMatchObject({
      price: 150,
      priceUnit: "per_hour",
      city: "Al Ahsa",
      description_en: "Two hours on foot",
    });
  });

  it("validates in update mode", async () => {
    const t = makeT();
    const { me, serviceId } = await owned(t);

    await expectRefusal(
      t.run((ctx) => updateServiceForUser(ctx, me, { serviceId, title_ar: "" }, NOW)),
      SERVICE_ERRORS.TITLE_REQUIRED
    );
    await expectRefusal(
      t.run((ctx) => updateServiceForUser(ctx, me, { serviceId, city: "Jeddah" }, NOW)),
      SERVICE_ERRORS.INVALID_CITY
    );
    // Refused before anything moved.
    expect(await t.run((ctx) => ctx.db.get(serviceId))).toMatchObject({ status: "approved" });
  });

  it("refuses a service that is gone, or someone else's", async () => {
    const t = makeT();
    const { me, serviceId } = await owned(t);
    const stranger = await provider(t);

    await expectRefusal(
      t.run((ctx) => updateServiceForUser(ctx, stranger, { serviceId, title_en: "Mine now" }, NOW)),
      SERVICE_ERRORS.NOT_YOURS
    );

    await t.run((ctx) => ctx.db.delete(serviceId));
    await expectRefusal(
      t.run((ctx) => updateServiceForUser(ctx, me, { serviceId, title_en: "Too late" }, NOW)),
      SERVICE_ERRORS.NOT_FOUND
    );
  });
});

describe("deleteServiceForUser", () => {
  it("deletes a service whose bookings are all closed", async () => {
    const t = makeT();
    const me = await provider(t);
    const guest = await load(t);
    const serviceId = await seedService(t, { ownerId: me._id });
    for (const status of ["completed", "cancelled", "declined", "expired", "no_show"]) {
      await seedServiceBooking(t, { userId: guest._id, serviceId, ownerId: me._id, date: "2026-08-20", status });
    }

    await t.run((ctx) => deleteServiceForUser(ctx, me, serviceId));

    expect(await t.run((ctx) => ctx.db.get(serviceId))).toBeNull();
  });

  it("refuses while a request or a confirmed booking is open", async () => {
    const t = makeT();
    const me = await provider(t);
    const guest = await load(t);

    for (const status of ["pending", "confirmed"]) {
      const serviceId = await seedService(t, { ownerId: me._id });
      await seedServiceBooking(t, { userId: guest._id, serviceId, ownerId: me._id, date: "2026-09-20", status });

      // A traveller holding a confirmed day would be left with a booking of
      // nothing, and nobody to call about it.
      await expectRefusal(
        t.run((ctx) => deleteServiceForUser(ctx, me, serviceId)),
        SERVICE_ERRORS.HAS_OPEN_BOOKINGS
      );
      expect(await t.run((ctx) => ctx.db.get(serviceId))).not.toBeNull();
    }
  });

  it("refuses a service that is gone, or someone else's", async () => {
    const t = makeT();
    const me = await provider(t);
    const stranger = await provider(t);
    const serviceId = await seedService(t, { ownerId: me._id });

    await expectRefusal(t.run((ctx) => deleteServiceForUser(ctx, stranger, serviceId)), SERVICE_ERRORS.NOT_YOURS);

    await t.run((ctx) => ctx.db.delete(serviceId));
    await expectRefusal(t.run((ctx) => deleteServiceForUser(ctx, me, serviceId)), SERVICE_ERRORS.NOT_FOUND);
  });
});
