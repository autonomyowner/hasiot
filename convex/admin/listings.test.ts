import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedHotel, seedStay, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { createListingAsAdmin, deleteListingAsAdmin, updateListingAsAdmin } from "./service";

async function admin(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "admin", email: "admin@hasio.test" });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const activity = (t: TestT) => t.run((ctx) => ctx.db.query("adminActivity").collect());
const listing = (t: TestT, id: Id<"listings">) => t.run((ctx) => ctx.db.get(id));

const HOTEL = {
  type: "hotel",
  name_en: "Oasis Inn",
  name_ar: "نزل الواحة",
  category: "boutique_hotel",
  address: "King Faisal Road",
  city: "Al Ahsa",
  coordinates: { lat: 25.38, lng: 49.58 },
};

describe("createListingAsAdmin", () => {
  it("saves a hotel with its nightly price, which the panel could not do", async () => {
    // The form has sent these since 2449fbf and the validator rejected every
    // hotel save, so the panel could not create or edit a hotel at all.
    const t = makeT();
    const acting = await admin(t);

    const id = await t.run((ctx) =>
      createListingAsAdmin(
        ctx,
        acting,
        {
          ...HOTEL,
          pricePerNight: 480,
          maxGuests: 3,
          unitCount: 6,
          checkInTime: "15:00",
          checkOutTime: "12:00",
        },
        NOW
      )
    );

    expect(await listing(t, id)).toMatchObject({
      status: "approved",
      pricePerNight: 480,
      currency: "SAR",
      maxGuests: 3,
      unitCount: 6,
      checkInTime: "15:00",
      checkOutTime: "12:00",
      isActive: true,
      isVerified: false,
    });
    expect((await activity(t))[0]).toMatchObject({
      action: "listing.create",
      targetId: id,
      summary: "نزل الواحة",
    });
  });

  it("refuses a bad price in words the panel can show, and saves nothing", async () => {
    const t = makeT();
    const acting = await admin(t);

    await expect(
      t.run((ctx) => createListingAsAdmin(ctx, acting, { ...HOTEL, pricePerNight: 450.5 }, NOW))
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ConvexError && /whole number/.test(String(error.data))
    );
    expect(await t.run((ctx) => ctx.db.query("listings").collect())).toHaveLength(0);
    expect(await activity(t)).toHaveLength(0);
  });
});

describe("updateListingAsAdmin", () => {
  it("sets a price and attaches the currency with it", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedHotel(t, { pricePerNight: null });

    await t.run((ctx) => updateListingAsAdmin(ctx, acting, { id, pricePerNight: 520 }, NOW));

    expect(await listing(t, id)).toMatchObject({ pricePerNight: 520, currency: "SAR" });
    expect((await activity(t))[0]).toMatchObject({ action: "listing.update", targetId: id });
  });

  it("clears a field sent as null and leaves the ones not sent alone", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedHotel(t, { pricePerNight: 450, maxGuests: 4, unitCount: 2 });
    await t.run((ctx) =>
      ctx.db.patch(id, {
        phone: "+966135800000",
        email: "desk@oasis.example",
        website: "https://oasis.example",
        priceRange: "$$",
        description_en: "Old text",
        description_ar: "نص قديم",
      })
    );

    await t.run((ctx) =>
      updateListingAsAdmin(
        ctx,
        acting,
        {
          id,
          phone: null,
          email: null,
          website: null,
          priceRange: null,
          description_en: null,
          description_ar: null,
          pricePerNight: null,
          maxGuests: null,
          unitCount: null,
          checkInTime: null,
          checkOutTime: null,
        },
        NOW
      )
    );

    const after = (await listing(t, id))!;
    for (const key of [
      "phone",
      "email",
      "website",
      "priceRange",
      "description_en",
      "description_ar",
      "pricePerNight",
      "maxGuests",
      "unitCount",
      "checkInTime",
      "checkOutTime",
    ] as const) {
      expect(after[key], key).toBeUndefined();
    }
    // A cleared price takes its currency with it, or the two drift apart.
    expect(after.currency).toBeUndefined();
    // Untouched: not sent.
    expect(after).toMatchObject({ name_en: "Test Hotel", address: "Hofuf", status: "approved" });
  });

  it("refuses a bad value and changes nothing", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedHotel(t, { pricePerNight: 450 });

    await expect(
      t.run((ctx) => updateListingAsAdmin(ctx, acting, { id, pricePerNight: 0, name_en: "Renamed" }, NOW))
    ).rejects.toThrow(ConvexError);

    expect(await listing(t, id)).toMatchObject({ pricePerNight: 450, name_en: "Test Hotel" });
    expect(await activity(t)).toHaveLength(0);
  });

  it("says in both languages when the listing is gone", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedHotel(t);
    await t.run((ctx) => ctx.db.delete(id));

    await expect(
      t.run((ctx) => updateListingAsAdmin(ctx, acting, { id, name_en: "x" }, NOW))
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConvexError && String(error.data) === "المكان غير موجود. / Listing not found."
    );
  });
});

describe("deleteListingAsAdmin", () => {
  it("refuses while a booking is still open, as the owner's delete does", async () => {
    // Design 6.7: deleting it would leave a guest holding a booking for a place
    // that no longer exists. Support cancels the booking first.
    const t = makeT();
    const acting = await admin(t);
    const guest = await seedUser(t, { phoneVerified: true });
    const id = await seedHotel(t);
    await seedStay(t, { userId: guest, listingId: id, checkIn: "2026-09-10", checkOut: "2026-09-11" });

    await expect(t.run((ctx) => deleteListingAsAdmin(ctx, acting, id))).rejects.toSatisfy(
      (error: unknown) => error instanceof ConvexError && /open bookings/.test(String(error.data))
    );
    expect(await listing(t, id)).not.toBeNull();
    expect(await activity(t)).toHaveLength(0);
  });

  it("deletes and logs what went", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedHotel(t);

    await t.run((ctx) => deleteListingAsAdmin(ctx, acting, id));

    expect(await listing(t, id)).toBeNull();
    expect((await activity(t))[0]).toMatchObject({
      action: "listing.delete",
      targetId: id,
      summary: "فندق تجريبي",
    });
  });
});
