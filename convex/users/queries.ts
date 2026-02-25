import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthenticatedAppUser(ctx);
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
    return await ctx.storage.getUrl(args.fileId);
  },
});
