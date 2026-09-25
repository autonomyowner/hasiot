import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { getBlockedIds } from "../listings/queries";
import { MAX_RATED_REVIEWS, summariseRatings } from "./logic";

/** Ceiling for a single page of review text. The score's own bound is
 *  `MAX_RATED_REVIEWS`, which every reader of a listing's rating shares. */
const MAX_REVIEWS = 200;

/** How many completed bookings a "rate it" prompt looks through. */
const MAX_REVIEWABLE = 50;

/**
 * Reviews as a reader sees them: the blocked authors gone, each named author
 * with their name, and each anonymous one with no trace of who wrote it.
 *
 * An anonymous review has its `userId` stripped rather than merely unresolved:
 * spreading the row would ship the author's id to every client, which
 * de-anonymises it for anyone reading the network response. The cost is that
 * an anonymous review cannot be blocked from the UI — it can still be
 * reported, and an admin sees the author on the report.
 */
async function presentReviews(ctx: QueryCtx, reviews: Doc<"reviews">[]) {
  const blockedIds = await getBlockedIds(ctx);
  const visible = reviews.filter((r) => !blockedIds.has(r.userId as string));

  return await Promise.all(
    visible.map(async (review) => {
      if (review.isAnonymous) {
        const { userId: _userId, ...rest } = review;
        return { ...rest, user: null };
      }
      const user = await ctx.db.get(review.userId);
      return {
        ...review,
        user: user ? { firstName: user.firstName, lastName: user.lastName } : null,
      };
    })
  );
}

/** The reviews on one listing, newest first. */
export const listForListing = query({
  args: {
    listingId: v.id("listings"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(Math.min(args.limit ?? 20, MAX_REVIEWS));

    return await presentReviews(ctx, reviews);
  },
});

/** The reviews of one service, newest first — the same shape as a listing's. */
export const listForService = query({
  args: {
    serviceId: v.id("services"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .order("desc")
      .take(Math.min(args.limit ?? 20, MAX_REVIEWS));

    return await presentReviews(ctx, reviews);
  },
});

/**
 * A service's average, count and histogram, from the same bounded, newest-first
 * set recomputeServiceRating scores it from, so the two never disagree.
 */
export const getServiceSummary = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_serviceId", (q) => q.eq("serviceId", args.serviceId))
      .order("desc")
      .take(MAX_RATED_REVIEWS);

    return summariseRatings(reviews.map((r) => r.rating));
  },
});

/** A traveller's own review of one service, or null. */
export async function myServiceReview(
  ctx: QueryCtx,
  userId: Id<"users">,
  serviceId: Id<"services">
): Promise<Doc<"reviews"> | null> {
  return await ctx.db
    .query("reviews")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("serviceId"), serviceId))
    .first();
}

/** The signed-in traveller's own review of one service, or null. Drives edit vs. write. */
export const getMineForService = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return null;
    return await myServiceReview(ctx, user._id, args.serviceId);
  },
});

/**
 * Average, count and the 1..5 histogram.
 *
 * Recomputed from the rows rather than read off `listing.rating`, because the
 * histogram cannot be denormalised onto the listing and a summary that
 * disagreed with the bars beneath it would be worse than a slower query.
 */
export const getSummary = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    // Newest first, and bounded by the same constant the write path uses:
    // a listing that ever exceeds the cap should reflect its recent stays,
    // not the oldest ones, and must never disagree with its own card.
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(MAX_RATED_REVIEWS);

    return summariseRatings(reviews.map((r) => r.rating));
  },
});

/** The signed-in guest's own review of one listing, or null. Drives edit vs. write. */
export const getMine = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
  },
});

/**
 * Which completed bookings still owe a review of their place.
 *
 * Service bookings have no listing and are skipped: they are rated through
 * listMyReviewableServices, and the 1.0.2 app that reads this list renders a
 * place for every row.
 */
export function reviewablePlaceBookings<T extends Pick<Doc<"bookings">, "listingId">>(
  bookings: T[],
  reviewedListingIds: Set<string>
): Array<T & { listingId: Id<"listings"> }> {
  return bookings.filter(
    (b): b is T & { listingId: Id<"listings"> } =>
      b.listingId !== undefined && !reviewedListingIds.has(b.listingId as string)
  );
}

/**
 * Completed stays the guest has not reviewed yet.
 *
 * This is what lets the booking detail screen ask "How was your stay?" and
 * what carries the `bookingId` that earns the verified badge.
 */
export const listMyReviewablePlaces = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .order("desc")
      .take(50);

    const reviewed = new Set(
      (
        await ctx.db
          .query("reviews")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .collect()
      )
        .filter((r) => r.listingId !== undefined)
        .map((r) => r.listingId as string)
    );

    const pending = reviewablePlaceBookings(bookings, reviewed);

    return await Promise.all(
      pending.map(async (booking) => {
        const listing = await ctx.db.get(booking.listingId);
        return {
          bookingId: booking._id,
          listingId: booking.listingId,
          checkOut: booking.checkOut,
          name_en: listing?.name_en ?? "",
          name_ar: listing?.name_ar ?? "",
          image: listing?.images?.[0],
        };
      })
    );
  },
});

/**
 * Which completed bookings still owe a review of their service.
 *
 * Once per service: a traveller who went on the same tour twice reviews it
 * once (a second review is refused), so one prompt is all there is to offer.
 * Rows arrive newest first, so the prompt carries the latest booking — the
 * one whose `bookingId` earns the verified badge.
 */
export function reviewableServiceBookings<T extends Pick<Doc<"bookings">, "serviceId">>(
  bookings: T[],
  reviewedServiceIds: Set<string>
): Array<T & { serviceId: Id<"services"> }> {
  const offered = new Set<string>();
  return bookings.filter((b): b is T & { serviceId: Id<"services"> } => {
    if (b.serviceId === undefined) return false;
    if (reviewedServiceIds.has(b.serviceId) || offered.has(b.serviceId)) return false;
    offered.add(b.serviceId);
    return true;
  });
}

export async function reviewableServicesForUser(ctx: QueryCtx, user: Doc<"users">) {
  // The kind is filtered inside the query, so a traveller with many finished
  // stays still sees their service bookings.
  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_userId_and_status", (q) => q.eq("userId", user._id).eq("status", "completed"))
    .order("desc")
    .filter((q) => q.eq(q.field("kind"), "service"))
    .take(MAX_REVIEWABLE);

  const reviewed = new Set(
    (
      await ctx.db
        .query("reviews")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect()
    )
      .filter((r) => r.serviceId !== undefined)
      .map((r) => r.serviceId as string)
  );

  const rows = await Promise.all(
    reviewableServiceBookings(bookings, reviewed).map(async (booking) => {
      const service = await ctx.db.get(booking.serviceId);
      // Deleted since: a review of it would be refused, so it is not offered.
      if (!service) return null;
      return {
        bookingId: booking._id,
        serviceId: booking.serviceId,
        date: booking.date,
        title_en: service.title_en,
        title_ar: service.title_ar,
        image: service.images?.[0],
      };
    })
  );
  return rows.filter((row) => row !== null);
}

/**
 * Completed service bookings the traveller has not reviewed yet — what feeds
 * "How was it?" and carries the `bookingId` that earns the verified badge.
 */
export const listMyReviewableServices = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];
    return await reviewableServicesForUser(ctx, user);
  },
});
