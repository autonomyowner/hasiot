import { describe, expect, it } from "vitest";
import { makeT, seedHotel, seedStay, seedUser } from "../test.utils";
import { REVIEW_ERRORS } from "./logic";
import {
  addReviewForUser,
  deleteReviewForUser,
  recomputeListingRating,
  updateReviewForUser,
} from "./service";

async function setup() {
  const t = makeT();
  const guestId = await seedUser(t, { firstName: "Sara" });
  const listingId = await seedHotel(t);
  return { t, guestId, listingId };
}

describe("addReviewForUser", () => {
  it("stores the review and scores the listing", async () => {
    const { t, guestId, listingId } = await setup();

    await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      await addReviewForUser(ctx, user, { listingId, rating: 4, content: "Lovely" });
    });

    const listing = await t.run(async (ctx) => ctx.db.get(listingId));
    expect(listing?.rating).toBe(4);
    expect(listing?.reviewCount).toBe(1);
  });

  it("refuses a second review of the same listing", async () => {
    const { t, guestId, listingId } = await setup();

    await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      await addReviewForUser(ctx, user, { listingId, rating: 4 });
      await expect(
        addReviewForUser(ctx, user, { listingId, rating: 2 })
      ).rejects.toThrow(REVIEW_ERRORS.DUPLICATE);
    });
  });

  it("marks a review verified when it carries the guest's completed stay", async () => {
    const { t, guestId, listingId } = await setup();
    const bookingId = await seedStay(t, {
      userId: guestId,
      listingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "completed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(true);
  });

  it("does not verify against a stay that has not finished", async () => {
    const { t, guestId, listingId } = await setup();
    const bookingId = await seedStay(t, {
      userId: guestId,
      listingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "confirmed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(false);
  });

  it("does not verify against someone else's booking", async () => {
    const { t, guestId, listingId } = await setup();
    const strangerId = await seedUser(t, { firstName: "Omar" });
    const bookingId = await seedStay(t, {
      userId: strangerId,
      listingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "completed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(false);
  });

  it("does not verify against a completed stay at a different listing", async () => {
    const { t, guestId, listingId } = await setup();
    const otherListingId = await seedHotel(t, { name_en: "Other Hotel" });
    const bookingId = await seedStay(t, {
      userId: guestId,
      listingId: otherListingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "completed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(false);
  });

  it("rejects a review of a listing that does not exist", async () => {
    const { t, guestId, listingId } = await setup();
    await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      await ctx.db.delete(listingId);
      await expect(
        addReviewForUser(ctx, user, { listingId, rating: 4 })
      ).rejects.toThrow(REVIEW_ERRORS.LISTING_NOT_FOUND);
    });
  });
});

describe("updateReviewForUser", () => {
  it("changes the score and rescores the listing", async () => {
    const { t, guestId, listingId } = await setup();

    const listing = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5 });
      await updateReviewForUser(ctx, user, { reviewId: id, rating: 2, content: "Changed my mind" });
      return ctx.db.get(listingId);
    });

    expect(listing?.rating).toBe(2);
    expect(listing?.reviewCount).toBe(1);
  });

  it("refuses to touch someone else's review", async () => {
    const { t, guestId, listingId } = await setup();
    const strangerId = await seedUser(t, { firstName: "Omar" });

    await t.run(async (ctx) => {
      const owner = (await ctx.db.get(guestId))!;
      const stranger = (await ctx.db.get(strangerId))!;
      const id = await addReviewForUser(ctx, owner, { listingId, rating: 5 });
      await expect(
        updateReviewForUser(ctx, stranger, { reviewId: id, rating: 1 })
      ).rejects.toThrow(REVIEW_ERRORS.NOT_YOURS);
    });
  });
});

describe("deleteReviewForUser", () => {
  it("clears the listing's score when the last review goes", async () => {
    const { t, guestId, listingId } = await setup();

    const listing = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5 });
      await deleteReviewForUser(ctx, user, id);
      return ctx.db.get(listingId);
    });

    // Undefined, not 0 and not the stale 5 — the card shows no star at all.
    expect(listing?.rating).toBeUndefined();
    expect(listing?.reviewCount).toBeUndefined();
  });

  it("leaves the average of the survivors behind", async () => {
    const { t, guestId, listingId } = await setup();
    const otherId = await seedUser(t, { firstName: "Omar" });

    const listing = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const other = (await ctx.db.get(otherId))!;
      const mine = await addReviewForUser(ctx, user, { listingId, rating: 1 });
      await addReviewForUser(ctx, other, { listingId, rating: 5 });
      await deleteReviewForUser(ctx, user, mine);
      return ctx.db.get(listingId);
    });

    expect(listing?.rating).toBe(5);
    expect(listing?.reviewCount).toBe(1);
  });
});

describe("recomputeListingRating", () => {
  it("clears a fabricated score that has no reviews behind it", async () => {
    const t = makeT();
    const listingId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("listings", {
        type: "hotel",
        name_en: "Seeded Hotel",
        name_ar: "فندق",
        category: "luxury_hotel",
        address: "Hofuf",
        city: "Hofuf",
        coordinates: { lat: 25.3854, lng: 49.5683 },
        rating: 4.8,
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      });
      await recomputeListingRating(ctx, id);
      return id;
    });

    const listing = await t.run(async (ctx) => ctx.db.get(listingId));
    expect(listing?.rating).toBeUndefined();
  });
});
