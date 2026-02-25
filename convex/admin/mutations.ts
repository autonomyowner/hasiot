import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Create a new listing
export const createListing = mutation({
  args: {
    type: v.string(),
    name_en: v.string(),
    name_ar: v.string(),
    category: v.string(),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    region: v.optional(v.string()),
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("listings", {
      ...args,
      status: "approved",
      rating: 0,
      reviewCount: 0,
      isActive: args.isActive ?? true,
      isVerified: args.isVerified ?? false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Update a listing
export const updateListing = mutation({
  args: {
    id: v.id("listings"),
    type: v.optional(v.string()),
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    category: v.optional(v.string()),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Listing not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Delete a listing
export const deleteListing = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Create travel knowledge data
export const createKnowledgeData = mutation({
  args: {
    category: v.string(),
    title: v.string(),
    title_ar: v.optional(v.string()),
    content: v.string(),
    content_ar: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      lastReviewed: v.optional(v.string()),
      region: v.optional(v.string()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("travelKnowledge", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Update travel knowledge data
export const updateKnowledgeData = mutation({
  args: {
    id: v.id("travelKnowledge"),
    category: v.optional(v.string()),
    title: v.optional(v.string()),
    title_ar: v.optional(v.string()),
    content: v.optional(v.string()),
    content_ar: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      lastReviewed: v.optional(v.string()),
      region: v.optional(v.string()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Knowledge data not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Delete travel knowledge data
export const deleteKnowledgeData = mutation({
  args: { id: v.id("travelKnowledge") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Update booking status (admin)
export const updateBookingStatus = mutation({
  args: {
    id: v.id("bookings"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Booking not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Approve a pending content listing
export const approveContent = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");

    await ctx.db.patch(args.id, {
      status: "approved",
      rejectionReason: undefined,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Reject a pending content listing
export const rejectContent = mutation({
  args: {
    id: v.id("listings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");

    await ctx.db.patch(args.id, {
      status: "rejected",
      rejectionReason: args.reason,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Bulk import listings
export const bulkImportListings = mutation({
  args: {
    listings: v.array(v.object({
      type: v.string(),
      name_en: v.string(),
      name_ar: v.string(),
      category: v.string(),
      category_ar: v.optional(v.string()),
      address: v.string(),
      city: v.string(),
      region: v.optional(v.string()),
      coordinates: v.object({
        lat: v.number(),
        lng: v.number(),
      }),
      phone: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids = [];

    for (const listing of args.listings) {
      const id = await ctx.db.insert("listings", {
        ...listing,
        rating: 0,
        reviewCount: 0,
        isActive: true,
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }

    return { imported: ids.length, ids };
  },
});
