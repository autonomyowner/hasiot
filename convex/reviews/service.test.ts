import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  makeT,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedStay,
  seedUser,
} from "../test.utils";
import type { TestT } from "../test.utils";
import type { Id } from "../_generated/dataModel";
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

describe("addReviewForUser, by an owner", () => {
  it("refuses a host rating their own place", async () => {
    const t = makeT();
    const hostId = await seedUser(t, { role: "business_owner", isApproved: true });
    const listingId = await seedHotel(t, { ownerId: hostId });

    await expect(
      t.run(async (ctx) => {
        const host = (await ctx.db.get(hostId))!;
        await addReviewForUser(ctx, host, { listingId, rating: 5 });
      })
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ConvexError && error.data === REVIEW_ERRORS.OWN_ITEM
    );
    const listing = await t.run((ctx) => ctx.db.get(listingId));
    expect(listing?.reviewCount).toBeUndefined();
  });

  it("refuses a provider rating their own service", async () => {
    const t = makeT();
    const providerId = await seedUser(t, { role: "service_provider", isApproved: true });
    const serviceId = await seedService(t, { ownerId: providerId });

    await expect(
      t.run(async (ctx) => {
        const provider = (await ctx.db.get(providerId))!;
        await addReviewForUser(ctx, provider, { serviceId, rating: 5 });
      })
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ConvexError && error.data === REVIEW_ERRORS.OWN_ITEM
    );
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

// --- reviews of services (1.1.0) --------------------------------------------

async function serviceSetup() {
  const t = makeT();
  const guestId = await seedUser(t, { firstName: "Sara" });
  const providerId = await seedUser(t, { role: "service_provider", isApproved: true });
  const serviceId = await seedService(t, { ownerId: providerId });
  return { t, guestId, providerId, serviceId };
}

function reviewService(
  t: TestT,
  userId: Id<"users">,
  args: { serviceId?: Id<"services">; listingId?: Id<"listings">; rating: number; bookingId?: Id<"bookings"> }
) {
  return t.run(async (ctx) => {
    const user = (await ctx.db.get(userId))!;
    const id = await addReviewForUser(ctx, user, args);
    return (await ctx.db.get(id))!;
  });
}

async function refusalOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    return String((error as ConvexError<string>).data);
  }
  throw new Error("expected a refusal");
}

describe("addReviewForUser, for a service", () => {
  it("stores the review against the service and scores it", async () => {
    const { t, guestId, serviceId } = await serviceSetup();

    const review = await reviewService(t, guestId, { serviceId, rating: 4 });

    expect(review).toMatchObject({ serviceId, rating: 4, isVerified: false });
    expect(review.listingId).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.get(serviceId))).toMatchObject({ rating: 4, reviewCount: 1 });
  });

  it("reviews exactly one thing: a place or a service", async () => {
    const { t, guestId, serviceId } = await serviceSetup();
    const listingId = await seedHotel(t);

    expect(await refusalOf(reviewService(t, guestId, { rating: 4 }))).toBe(REVIEW_ERRORS.TARGET_REQUIRED);
    expect(await refusalOf(reviewService(t, guestId, { rating: 4, serviceId, listingId }))).toBe(
      REVIEW_ERRORS.TARGET_REQUIRED
    );
  });

  it("refuses a service that does not exist", async () => {
    const { t, guestId, serviceId } = await serviceSetup();
    await t.run((ctx) => ctx.db.delete(serviceId));

    expect(await refusalOf(reviewService(t, guestId, { serviceId, rating: 4 }))).toBe(REVIEW_ERRORS.SERVICE_NOT_FOUND);
  });

  it("refuses a second review of the same service, in service words", async () => {
    const { t, guestId, serviceId } = await serviceSetup();
    await reviewService(t, guestId, { serviceId, rating: 4 });

    expect(await refusalOf(reviewService(t, guestId, { serviceId, rating: 1 }))).toBe(REVIEW_ERRORS.DUPLICATE_SERVICE);
  });

  it("lets the same traveller review a place and a service independently", async () => {
    const { t, guestId, serviceId } = await serviceSetup();
    const listingId = await seedHotel(t);

    await reviewService(t, guestId, { listingId, rating: 5 });
    await expect(reviewService(t, guestId, { serviceId, rating: 3 })).resolves.toBeTruthy();
  });

  it("verifies a review carrying the traveller's completed booking of that service", async () => {
    const { t, guestId, providerId, serviceId } = await serviceSetup();
    const bookingId = await seedServiceBooking(t, {
      userId: guestId,
      serviceId,
      ownerId: providerId,
      date: "2026-08-20",
      status: "completed",
    });

    const review = await reviewService(t, guestId, { serviceId, rating: 5, bookingId });

    expect(review).toMatchObject({ isVerified: true, bookingId });
  });

  it("does not verify against an unfinished booking, another service's, someone else's, or a stay", async () => {
    const { t, guestId, providerId, serviceId } = await serviceSetup();
    const strangerId = await seedUser(t, { firstName: "Omar" });
    const otherService = await seedService(t, { ownerId: providerId, title_en: "Sunset photos" });
    const listingId = await seedHotel(t);

    const bookings = {
      pending: await seedServiceBooking(t, { userId: guestId, serviceId, ownerId: providerId, date: "2026-08-20" }),
      otherService: await seedServiceBooking(t, {
        userId: guestId,
        serviceId: otherService,
        ownerId: providerId,
        date: "2026-08-20",
        status: "completed",
      }),
      someoneElses: await seedServiceBooking(t, {
        userId: strangerId,
        serviceId,
        ownerId: providerId,
        date: "2026-08-20",
        status: "completed",
      }),
      stay: await seedStay(t, {
        userId: guestId,
        listingId,
        checkIn: "2026-08-01",
        checkOut: "2026-08-04",
        status: "completed",
      }),
    };

    for (const [name, bookingId] of Object.entries(bookings)) {
      await t.run(async (ctx) => {
        for (const r of await ctx.db.query("reviews").collect()) await ctx.db.delete(r._id);
      });
      const review = await reviewService(t, guestId, { serviceId, rating: 5, bookingId });
      expect(review.isVerified, name).toBe(false);
    }
  });

  it("rescores the service on edit, and clears the score when the last review goes", async () => {
    const { t, guestId, serviceId } = await serviceSetup();
    const review = await reviewService(t, guestId, { serviceId, rating: 5 });

    const service = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      await updateReviewForUser(ctx, user, { reviewId: review._id, rating: 2 });
      const edited = await ctx.db.get(serviceId);
      expect(edited).toMatchObject({ rating: 2, reviewCount: 1 });
      await deleteReviewForUser(ctx, user, review._id);
      return ctx.db.get(serviceId);
    });

    expect(service?.rating).toBeUndefined();
    expect(service?.reviewCount).toBeUndefined();
  });
});

describe("the seeded-rating sweep", () => {
  it("clears invented scores but leaves earned ones alone", async () => {
    const t = makeT();
    const guestId = await seedUser(t, {});
    const seeded = await seedHotel(t, { name_en: "Seeded" });
    const reviewed = await seedHotel(t, { name_en: "Reviewed" });

    await t.run(async (ctx) => {
      // A fabricated score, with nothing behind it.
      await ctx.db.patch(seeded, { rating: 4.8 });
      // A real one.
      const user = (await ctx.db.get(guestId))!;
      await addReviewForUser(ctx, user, { listingId: reviewed, rating: 3 });
      // The sweep is `recomputeListingRating` over every listing.
      for (const listing of await ctx.db.query("listings").collect()) {
        await recomputeListingRating(ctx, listing._id);
      }
    });

    const after = await t.run(async (ctx) => ({
      seeded: await ctx.db.get(seeded),
      reviewed: await ctx.db.get(reviewed),
    }));

    expect(after.seeded?.rating).toBeUndefined();
    expect(after.reviewed?.rating).toBe(3);
  });
});
