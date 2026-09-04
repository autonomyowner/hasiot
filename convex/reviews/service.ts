import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { enforceRateLimit } from "../rateLimit";
import {
  MAX_RATED_REVIEWS,
  REVIEW_ERRORS,
  REVIEWS_PER_DAY,
  summariseRatings,
  validateReviewInput,
} from "./logic";

/**
 * Review writes, over an already-resolved user.
 *
 * Same seam pattern as `bookings/service.ts`: the public mutations resolve the
 * user and call in here, so every rule below is reachable from a test.
 */

/**
 * Recompute a listing's score from the reviews that actually exist.
 *
 * Clears both fields when there are none. The version this replaced returned
 * early at zero, which left the last deleted review's average sitting on the
 * listing forever — and is also how the seeded catalogue came to show a 4.8
 * with no reviews behind it.
 */
export async function recomputeListingRating(
  ctx: MutationCtx,
  listingId: Id<"listings">
): Promise<void> {
  // Bounded and ordered identically to `getSummary`, so the star on a card and
  // the average above the reviews are always the same number.
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
    .order("desc")
    .take(MAX_RATED_REVIEWS);

  const summary = summariseRatings(reviews.map((r) => r.rating));

  await ctx.db.patch(listingId, {
    rating: summary.average ?? undefined,
    reviewCount: summary.count === 0 ? undefined : summary.count,
    updatedAt: Date.now(),
  });
}

/**
 * Whether a review may claim to come from a real stay.
 *
 * All three conditions are checked here rather than trusted from the client:
 * the booking must be this guest's, at this listing, and finished.
 */
async function isVerifiedStay(
  ctx: QueryCtx,
  bookingId: Id<"bookings"> | undefined,
  userId: Id<"users">,
  listingId: Id<"listings">
): Promise<boolean> {
  if (!bookingId) return false;
  const booking = await ctx.db.get(bookingId);
  return (
    !!booking &&
    booking.userId === userId &&
    booking.listingId === listingId &&
    booking.status === "completed"
  );
}

export async function addReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    listingId: Id<"listings">;
    rating: number;
    content?: string;
    bookingId?: Id<"bookings">;
    isAnonymous?: boolean;
  }
): Promise<Id<"reviews">> {
  const { content } = validateReviewInput(args);

  const listing = await ctx.db.get(args.listingId);
  if (!listing) throw new Error(REVIEW_ERRORS.LISTING_NOT_FOUND);

  const existing = await ctx.db
    .query("reviews")
    .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
    .filter((q) => q.eq(q.field("userId"), user._id))
    .first();
  if (existing) throw new Error(REVIEW_ERRORS.DUPLICATE);

  await enforceRateLimit(ctx, `review:${user._id}`, REVIEWS_PER_DAY);

  const now = Date.now();
  const reviewId = await ctx.db.insert("reviews", {
    userId: user._id,
    listingId: args.listingId,
    bookingId: args.bookingId,
    rating: args.rating,
    content,
    isAnonymous: args.isAnonymous ?? false,
    isVerified: await isVerifiedStay(ctx, args.bookingId, user._id, args.listingId),
    createdAt: now,
    updatedAt: now,
  });

  await recomputeListingRating(ctx, args.listingId);
  return reviewId;
}

export async function updateReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    reviewId: Id<"reviews">;
    rating: number;
    content?: string;
    isAnonymous?: boolean;
  }
): Promise<void> {
  const { content } = validateReviewInput(args);

  const review = await ctx.db.get(args.reviewId);
  if (!review) throw new Error(REVIEW_ERRORS.NOT_FOUND);
  if (review.userId !== user._id) throw new Error(REVIEW_ERRORS.NOT_YOURS);

  await ctx.db.patch(args.reviewId, {
    rating: args.rating,
    content,
    isAnonymous: args.isAnonymous ?? review.isAnonymous,
    updatedAt: Date.now(),
  });

  await recomputeListingRating(ctx, review.listingId);
}

export async function deleteReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  reviewId: Id<"reviews">
): Promise<void> {
  const review = await ctx.db.get(reviewId);
  if (!review) throw new Error(REVIEW_ERRORS.NOT_FOUND);
  if (review.userId !== user._id) throw new Error(REVIEW_ERRORS.NOT_YOURS);

  const listingId = review.listingId;
  await ctx.db.delete(reviewId);
  await recomputeListingRating(ctx, listingId);
}
