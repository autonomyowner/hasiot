import { query } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { AUTH_ERRORS } from "../lib/errors";
import { withBookingReadiness } from "./contactPhone";

// Get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    // `canBook` carries the phone rule, so no client re-implements it.
    return withBookingReadiness(await getAuthenticatedAppUser(ctx));
  },
});

// Get user's favorite listings
export const getFavorites = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || !user.favoriteListingIds || user.favoriteListingIds.length === 0) {
      return [];
    }

    const listings = await Promise.all(
      user.favoriteListingIds.map((id) => ctx.db.get(id))
    );

    return listings.filter(Boolean);
  },
});

// Check if a listing is in favorites
export const isFavorite = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || !user.favoriteListingIds) {
      return false;
    }

    return user.favoriteListingIds.includes(args.listingId);
  },
});

// Get business doc download URL (for admin review)
export const getBusinessDocUrl = query({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || user.role !== "admin") {
      throw new ConvexError(AUTH_ERRORS.NOT_AUTHORIZED);
    }
    return await ctx.storage.getUrl(args.fileId);
  },
});

// Get public URL for a Convex storage ID (for image display)
export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      // English only: the app maps this exact text to "session expired".
      throw new ConvexError("Not authenticated");
    }
    return await ctx.storage.getUrl(args.storageId);
  },
});
