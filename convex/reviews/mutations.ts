import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { addReviewForUser, deleteReviewForUser, updateReviewForUser } from "./service";

/**
 * Thin wrappers: resolve the guest, hand off to the seam. Every rule lives in
 * `service.ts` so it can be tested — `convex-test` cannot get past
 * `getAuthenticatedAppUser`.
 */

const NOT_AUTHENTICATED = "يجب تسجيل الدخول أولاً. / You need to be signed in.";

export const addReview = mutation({
  args: {
    listingId: v.id("listings"),
    rating: v.number(),
    content: v.optional(v.string()),
    bookingId: v.optional(v.id("bookings")),
    isAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(NOT_AUTHENTICATED);
    return await addReviewForUser(ctx, user, args);
  },
});

export const updateMyReview = mutation({
  args: {
    reviewId: v.id("reviews"),
    rating: v.number(),
    content: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(NOT_AUTHENTICATED);
    await updateReviewForUser(ctx, user, args);
  },
});

export const deleteMyReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(NOT_AUTHENTICATED);
    await deleteReviewForUser(ctx, user, args.reviewId);
  },
});
