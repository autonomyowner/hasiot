import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Generate an upload URL for business document
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Save business document reference to user record
export const saveBusinessDoc = mutation({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (user.role !== "business_owner" && user.role !== "service_provider") {
      throw new Error("Only business accounts can upload documents");
    }

    await ctx.db.patch(user._id, {
      cvFileId: args.fileId,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.preferredLanguage !== undefined) updates.preferredLanguage = args.preferredLanguage;
    if (args.city !== undefined) updates.city = args.city;

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

// Toggle favorite listing
export const toggleFavorite = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    const currentFavorites = user.favoriteListingIds || [];
    const isFavorite = currentFavorites.includes(args.listingId);

    let newFavorites: typeof currentFavorites;
    if (isFavorite) {
      newFavorites = currentFavorites.filter((id) => id !== args.listingId);
    } else {
      newFavorites = [...currentFavorites, args.listingId];
    }

    await ctx.db.patch(user._id, {
      favoriteListingIds: newFavorites,
      updatedAt: Date.now(),
    });

    return { isFavorite: !isFavorite };
  },
});

// Set user role after signup
export const setUserRole = mutation({
  args: {
    role: v.string(), // "tourist" | "business_owner" | "service_provider"
    businessType: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const updates: Record<string, unknown> = {
      role: args.role,
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;

    if (args.role === "business_owner" || args.role === "service_provider") {
      updates.businessType = args.businessType;
      updates.isApproved = false;
    }

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

// Admin approves a business account
export const approveBusinessAccount = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.role !== "business_owner" && targetUser.role !== "service_provider") {
      throw new Error("User is not a business account");
    }

    await ctx.db.patch(args.userId, {
      isApproved: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Create user record
export const createUser = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.string(),
    businessType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      phone: args.phone,
      role: args.role,
      businessType: args.role === "business_owner" || args.role === "service_provider" ? args.businessType : undefined,
      isApproved: args.role === "tourist" ? undefined : false,
      preferredLanguage: "ar",
      favoriteListingIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return userId;
  },
});
