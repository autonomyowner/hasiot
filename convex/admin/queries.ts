import { query } from "../_generated/server";
import { v } from "convex/values";

// Get dashboard statistics
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    const bookings = await ctx.db.query("bookings").collect();
    const users = await ctx.db.query("users").collect();
    const knowledgeData = await ctx.db.query("travelKnowledge").collect();
    const travelPlans = await ctx.db.query("travelPlans").collect();
    const emailCaptures = await ctx.db.query("emailCaptures").collect();

    const bookingsByStatus = {
      pending: bookings.filter(b => b.status === "pending").length,
      confirmed: bookings.filter(b => b.status === "confirmed").length,
      completed: bookings.filter(b => b.status === "completed").length,
      cancelled: bookings.filter(b => b.status === "cancelled").length,
    };

    const listingsByType = {
      hotel: listings.filter(l => l.type === "hotel").length,
      restaurant: listings.filter(l => l.type === "restaurant").length,
      attraction: listings.filter(l => l.type === "attraction").length,
      event: listings.filter(l => l.type === "event").length,
      tour: listings.filter(l => l.type === "tour").length,
    };

    return {
      totalListings: listings.length,
      totalBookings: bookings.length,
      totalUsers: users.length,
      totalKnowledgeData: knowledgeData.length,
      totalTravelPlans: travelPlans.length,
      bookingsByStatus,
      listingsByType,
      totalEmailCaptures: emailCaptures.length,
      activeListings: listings.filter(l => l.isActive !== false).length,
      verifiedListings: listings.filter(l => l.isVerified === true).length,
      pendingContent: listings.filter(l => l.status === "pending").length,
    };
  },
});

// List all listings for admin management
export const listAllListings = query({
  args: {
    type: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("listings");

    if (args.type) {
      q = q.withIndex("by_type", (q) => q.eq("type", args.type!));
    }

    const listings = await q.order("desc").collect();

    if (args.city) {
      return listings.filter(l => l.city === args.city);
    }

    return listings;
  },
});

// List all travel knowledge data
export const listKnowledgeData = query({
  args: {
    category: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("travelKnowledge");

    if (args.category) {
      q = q.withIndex("by_category", (q) => q.eq("category", args.category!));
    }

    const data = await q.order("desc").collect();

    if (args.activeOnly) {
      return data.filter(d => d.isActive);
    }

    return data;
  },
});

// Get single knowledge data item
export const getKnowledgeData = query({
  args: { id: v.id("travelKnowledge") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get single listing
export const getListing = query({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all bookings for admin
export const listAllBookings = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let bookings = await ctx.db
      .query("bookings")
      .order("desc")
      .collect();

    if (args.status) {
      bookings = bookings.filter(b => b.status === args.status);
    }

    const enrichedBookings = await Promise.all(
      bookings.slice(0, args.limit || 50).map(async (booking) => {
        const listing = await ctx.db.get(booking.listingId);
        const user = await ctx.db.get(booking.userId);
        return {
          ...booking,
          listingName: listing?.name_en || "Unknown",
          listingName_ar: listing?.name_ar || "غير معروف",
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown",
          userEmail: user?.email,
        };
      })
    );

    return enrichedBookings;
  },
});

// Get all cities (for dropdown)
export const getCities = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    const cities = [...new Set(listings.map(l => l.city))].sort();
    return cities;
  },
});

// Get all categories (for dropdown)
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    const categories = [...new Set(listings.map(l => l.category))].sort();
    return categories;
  },
});

// List pending content (listings awaiting approval)
export const listPendingContent = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      listings.map(async (listing) => {
        let ownerName = "";
        let ownerEmail = "";
        if (listing.ownerId) {
          const owner = await ctx.db.get(listing.ownerId);
          if (owner) {
            ownerName = `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email;
            ownerEmail = owner.email;
          }
        }
        return { ...listing, ownerName, ownerEmail };
      })
    );

    return enriched;
  },
});

// List pending business accounts awaiting approval
export const listPendingBusinesses = query({
  args: {},
  handler: async (ctx) => {
    const pendingOwners = await ctx.db
      .query("users")
      .withIndex("by_role_and_approval", (q) =>
        q.eq("role", "business_owner").eq("isApproved", false)
      )
      .collect();

    const pendingProviders = await ctx.db
      .query("users")
      .withIndex("by_role_and_approval", (q) =>
        q.eq("role", "service_provider").eq("isApproved", false)
      )
      .collect();

    return [...pendingOwners, ...pendingProviders];
  },
});
