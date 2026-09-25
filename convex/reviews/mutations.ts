import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { AUTH_ERRORS } from "../lib/errors";
import { addReviewForUser, deleteReviewForUser, updateReviewForUser } from "./service";

/**
 * Thin wrappers: resolve the guest, hand off to the seam. Every rule lives in
 * `service.ts` so it can be tested — `convex-test` cannot get past
 * `getAuthenticatedAppUser`.
 */

const NOT_AUTHENTICATED = AUTH_ERRORS.NOT_AUTHENTICATED;

/**
 * Review a place or a service: exactly one of `listingId` / `serviceId`.
 * `listingId` was required before 1.1.0; the apps that send it alone are
 * unaffected.
 */
export const addReview = mutation({
  args: {
    listingId: v.optional(v.id("listings")),
    serviceId: v.optional(v.id("services")),
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
