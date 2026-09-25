import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedHotel, seedStay, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { deleteListingForOwner, updateListingForOwner } from "./mutations";

async function host(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "business_owner", isApproved: true });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const get = (t: TestT, id: Id<"listings">) => t.run((ctx) => ctx.db.get(id));

function refusedWith(pattern: RegExp) {
  return (error: unknown) => error instanceof ConvexError && pattern.test(String(error.data));
}

describe("updateListingForOwner", () => {
  it("clears the nightly price, and the currency with it, when sent null", async () => {
    // A host who stops taking bookings must be able to remove the rate; before
    // this the only way was to type another one.
    const t = makeT();
    const owner = await host(t);
    const listingId = await seedHotel(t, { ownerId: owner._id, pricePerNight: 450 });

    await t.run((ctx) =>
      updateListingForOwner(ctx, owner, { listingId, pricePerNight: null }, NOW)
    );

    const after = (await get(t, listingId))!;
    expect(after.pricePerNight).toBeUndefined();
    expect(after.currency).toBeUndefined();
    expect(after.status).toBe("pending");
  });

  it("sends an approved listing back for review and drops the old rejection note", async () => {
    const t = makeT();
    const owner = await host(t);
    const listingId = await seedHotel(t, { ownerId: owner._id });
    await t.run((ctx) => ctx.db.patch(listingId, { rejectionReason: "Blurry photos" }));

    await t.run((ctx) =>
      updateListingForOwner(ctx, owner, { listingId, name_en: "Oasis Inn", pricePerNight: 500 }, NOW)
    );

    const after = (await get(t, listingId))!;
    expect(after).toMatchObject({
      name_en: "Oasis Inn",
      pricePerNight: 500,
      currency: "SAR",
      status: "pending",
    });
    expect(after.rejectionReason).toBeUndefined();
  });

  it("keeps a suspended listing suspended, with the reason the admin gave", async () => {
    // Editing used to send a taken-down listing to the review queue with its
    // suspension note wiped, so a host could bring it back by retyping a word.
    const t = makeT();
    const owner = await host(t);
    const listingId = await seedHotel(t, { ownerId: owner._id, status: "suspended" });
    await t.run((ctx) => ctx.db.patch(listingId, { suspendedReason: "Licence expired" }));

    await t.run((ctx) =>
      updateListingForOwner(ctx, owner, { listingId, description_en: "Now licensed" }, NOW)
    );

    expect(await get(t, listingId)).toMatchObject({
      status: "suspended",
      suspendedReason: "Licence expired",
      description_en: "Now licensed",
    });
  });

  it("refuses someone else's listing", async () => {
    const t = makeT();
    const owner = await host(t);
    const other = await host(t);
    const listingId = await seedHotel(t, { ownerId: other._id });

    await expect(
      t.run((ctx) => updateListingForOwner(ctx, owner, { listingId, name_en: "Mine now" }, NOW))
    ).rejects.toSatisfy(refusedWith(/Not your listing/));
    expect((await get(t, listingId))!.name_en).toBe("Test Hotel");
  });

  it("refuses a listing that no longer exists, in both languages", async () => {
    const t = makeT();
    const owner = await host(t);
    const listingId = await seedHotel(t, { ownerId: owner._id });
    await t.run((ctx) => ctx.db.delete(listingId));

    await expect(
      t.run((ctx) => updateListingForOwner(ctx, owner, { listingId, name_en: "x" }, NOW))
    ).rejects.toSatisfy(refusedWith(/^المكان غير موجود\. \/ Listing not found\.$/));
  });

  it("refuses a bad price as a readable error", async () => {
    const t = makeT();
    const owner = await host(t);
    const listingId = await seedHotel(t, { ownerId: owner._id, pricePerNight: 450 });

    await expect(
      t.run((ctx) => updateListingForOwner(ctx, owner, { listingId, pricePerNight: -1 }, NOW))
    ).rejects.toSatisfy(refusedWith(/valid nightly price/));
    expect((await get(t, listingId))!.pricePerNight).toBe(450);
  });
});

describe("deleteListingForOwner", () => {
  async function withBooking(t: TestT, status: string) {
    const owner = await host(t);
    const guest = await seedUser(t, { phoneVerified: true });
    const listingId = await seedHotel(t, { ownerId: owner._id });
    await seedStay(t, {
      userId: guest,
      listingId,
      ownerId: owner._id,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      status,
    });
    return { owner, listingId };
  }

  it("refuses while a guest is waiting on an answer", async () => {
    const t = makeT();
    const { owner, listingId } = await withBooking(t, "pending");

    await expect(
      t.run((ctx) => deleteListingForOwner(ctx, owner, listingId))
    ).rejects.toSatisfy(
      refusedWith(
        /^لا يمكن حذف مكان لديه حجوزات قائمة\. \/ A listing with open bookings cannot be deleted\.$/
      )
    );
    expect(await get(t, listingId)).not.toBeNull();
  });

  it("refuses while a confirmed stay is still to come", async () => {
    const t = makeT();
    const { owner, listingId } = await withBooking(t, "confirmed");

    await expect(t.run((ctx) => deleteListingForOwner(ctx, owner, listingId))).rejects.toSatisfy(
      refusedWith(/open bookings/)
    );
  });

  it("deletes once every booking is closed", async () => {
    const t = makeT();
    const { owner, listingId } = await withBooking(t, "completed");

    await t.run((ctx) => deleteListingForOwner(ctx, owner, listingId));

    expect(await get(t, listingId)).toBeNull();
  });

  it("refuses someone else's listing", async () => {
    const t = makeT();
    const owner = await host(t);
    const other = await host(t);
    const listingId = await seedHotel(t, { ownerId: other._id });

    await expect(t.run((ctx) => deleteListingForOwner(ctx, owner, listingId))).rejects.toSatisfy(
      refusedWith(/Not your listing/)
    );
  });
});
