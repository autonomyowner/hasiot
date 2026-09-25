import { ConvexError } from "convex/values";
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

/** The same rule for a service's score: from its reviews, cleared at zero. */
export async function recomputeServiceRating(
  ctx: MutationCtx,
  serviceId: Id<"services">
): Promise<void> {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_serviceId", (q) => q.eq("serviceId", serviceId))
    .order("desc")
    .take(MAX_RATED_REVIEWS);

  const summary = summariseRatings(reviews.map((r) => r.rating));

  await ctx.db.patch(serviceId, {
    rating: summary.average ?? undefined,
    reviewCount: summary.count === 0 ? undefined : summary.count,
    updatedAt: Date.now(),
  });
}

/**
 * Recompute whatever a review scores — its listing or its service.
 *
 * Callers that change or delete a review (the author, or an admin removing a
 * reported one) go through here so none of them has to know which kind of
 * target it was.
 */
export async function recomputeReviewTarget(
  ctx: MutationCtx,
  review: Pick<Doc<"reviews">, "listingId" | "serviceId">
): Promise<void> {
  if (review.serviceId) {
    if (await ctx.db.get(review.serviceId)) await recomputeServiceRating(ctx, review.serviceId);
    return;
  }
  if (review.listingId) {
    if (await ctx.db.get(review.listingId)) await recomputeListingRating(ctx, review.listingId);
  }
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

/**
 * The same rule for a service: the booking must be this traveller's, of this
 * service, and completed — which the morning job does the day after.
 */
async function isVerifiedService(
  ctx: QueryCtx,
  bookingId: Id<"bookings"> | undefined,
  userId: Id<"users">,
  serviceId: Id<"services">
): Promise<boolean> {
  if (!bookingId) return false;
  const booking = await ctx.db.get(bookingId);
  return (
    !!booking &&
    booking.userId === userId &&
    booking.serviceId === serviceId &&
    booking.status === "completed"
  );
}

type ReviewArgs = {
  rating: number;
  content?: string;
  bookingId?: Id<"bookings">;
  isAnonymous?: boolean;
};

/**
 * Review a place (`listingId`) or, since 1.1.0, a service (`serviceId`) —
 * exactly one of them. Anyone signed in may review; the verified badge needs
 * a completed booking of that very place or service (design D12).
 */
export async function addReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: ReviewArgs & { listingId?: Id<"listings">; serviceId?: Id<"services"> }
): Promise<Id<"reviews">> {
  // Both, or neither, is a client that does not know what it is reviewing;
  // storing it would put one rating on two scores, or on none.
  if ((args.listingId === undefined) === (args.serviceId === undefined)) {
    throw new ConvexError(REVIEW_ERRORS.TARGET_REQUIRED);
  }

  const { content } = validateReviewInput(args);

  if (args.serviceId !== undefined) {
    return await addServiceReview(ctx, user, { ...args, serviceId: args.serviceId }, content);
  }

  const listingId = args.listingId!;
  const listing = await ctx.db.get(listingId);
  if (!listing) throw new ConvexError(REVIEW_ERRORS.LISTING_NOT_FOUND);

  const existing = await ctx.db
    .query("reviews")
    .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
    .filter((q) => q.eq(q.field("userId"), user._id))
    .first();
  if (existing) throw new ConvexError(REVIEW_ERRORS.DUPLICATE);

  await enforceRateLimit(ctx, `review:${user._id}`, REVIEWS_PER_DAY);

  const now = Date.now();
  const reviewId = await ctx.db.insert("reviews", {
    userId: user._id,
    listingId,
    bookingId: args.bookingId,
    rating: args.rating,
    content,
    isAnonymous: args.isAnonymous ?? false,
    isVerified: await isVerifiedStay(ctx, args.bookingId, user._id, listingId),
    createdAt: now,
    updatedAt: now,
  });

  await recomputeReviewTarget(ctx, { listingId });
  return reviewId;
}

async function addServiceReview(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: ReviewArgs & { serviceId: Id<"services"> },
  content: string | undefined
): Promise<Id<"reviews">> {
  const service = await ctx.db.get(args.serviceId);
  if (!service) throw new ConvexError(REVIEW_ERRORS.SERVICE_NOT_FOUND);

  // Looked up among the traveller's own reviews, which stay few, rather than
  // among a popular service's.
  const existing = await ctx.db
    .query("reviews")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .filter((q) => q.eq(q.field("serviceId"), args.serviceId))
    .first();
  if (existing) throw new ConvexError(REVIEW_ERRORS.DUPLICATE_SERVICE);

  await enforceRateLimit(ctx, `review:${user._id}`, REVIEWS_PER_DAY);

  const now = Date.now();
  const reviewId = await ctx.db.insert("reviews", {
    userId: user._id,
    serviceId: args.serviceId,
    bookingId: args.bookingId,
    rating: args.rating,
    content,
    isAnonymous: args.isAnonymous ?? false,
    isVerified: await isVerifiedService(ctx, args.bookingId, user._id, args.serviceId),
    createdAt: now,
    updatedAt: now,
  });

  await recomputeReviewTarget(ctx, { serviceId: args.serviceId });
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
  if (!review) throw new ConvexError(REVIEW_ERRORS.NOT_FOUND);
  if (review.userId !== user._id) throw new ConvexError(REVIEW_ERRORS.NOT_YOURS);

  await ctx.db.patch(args.reviewId, {
    rating: args.rating,
    content,
    isAnonymous: args.isAnonymous ?? review.isAnonymous,
    updatedAt: Date.now(),
  });

  await recomputeReviewTarget(ctx, review);
}

export async function deleteReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  reviewId: Id<"reviews">
): Promise<void> {
  const review = await ctx.db.get(reviewId);
  if (!review) throw new ConvexError(REVIEW_ERRORS.NOT_FOUND);
  if (review.userId !== user._id) throw new ConvexError(REVIEW_ERRORS.NOT_YOURS);

  await ctx.db.delete(reviewId);
  await recomputeReviewTarget(ctx, review);
}
