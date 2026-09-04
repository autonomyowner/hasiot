import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { getBlockedIds } from "../listings/queries";
import { summariseRatings } from "./logic";

/** Hard ceiling, as everywhere else in this backend: Convex fails a query past ~16k reads. */
const MAX_REVIEWS = 200;

/**
 * The reviews on one listing, newest first.
 *
 * An anonymous review has its `userId` stripped rather than merely unresolved:
 * spreading the row would ship the author's id to every client, which
 * de-anonymises it for anyone reading the network response. The cost is that
 * an anonymous review cannot be blocked from the UI — it can still be
 * reported, and an admin sees the author on the report.
 */
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
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .take(MAX_REVIEWS);

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
      ).map((r) => r.listingId as string)
    );

    const pending = bookings.filter((b) => !reviewed.has(b.listingId as string));

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
