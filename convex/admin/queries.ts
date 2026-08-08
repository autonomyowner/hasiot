import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../auth";

// Hard ceilings so no admin query can scan an unbounded number of documents.
// Convex fails a query outright past ~16k reads, and this dashboard used to
// collect seven whole tables on every page load.
const MAX_LIST = 200;
const MAX_SCAN = 1000;
const STATS_CAP = 5000;

// Get dashboard statistics
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // Counts are exact below STATS_CAP. Past it the query reports `truncated`
    // so the UI can render "5000+" rather than a silently wrong number.
    const listings = await ctx.db.query("listings").take(STATS_CAP);
    const bookings = await ctx.db.query("bookings").take(STATS_CAP);
    const users = await ctx.db.query("users").take(STATS_CAP);
    const knowledgeData = await ctx.db.query("travelKnowledge").take(STATS_CAP);
    const travelPlans = await ctx.db.query("travelPlans").take(STATS_CAP);
    const emailCaptures = await ctx.db.query("emailCaptures").take(STATS_CAP);
    const services = await ctx.db.query("services").take(STATS_CAP);

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
      statsCap: STATS_CAP,
      truncated: [listings, bookings, users, knowledgeData, travelPlans, emailCaptures, services]
        .some((t) => t.length >= STATS_CAP),
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
      totalServices: services.length,
      pendingServices: services.filter(s => s.status === "pending").length,
    };
  },
});

// List all listings for admin management
export const listAllListings = query({
  args: {
    type: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const buildQuery = () => {
      if (args.type) {
        return ctx.db.query("listings").withIndex("by_type", (q) => q.eq("type", args.type!));
      }
      return ctx.db.query("listings");
    };

    const listings = await buildQuery()
      .order("desc")
      .take(Math.min(args.limit ?? MAX_LIST, MAX_LIST));

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
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const buildQuery = () => {
      if (args.category) {
        return ctx.db.query("travelKnowledge").withIndex("by_category", (q) => q.eq("category", args.category!));
      }
      return ctx.db.query("travelKnowledge");
    };

    const data = await buildQuery()
      .order("desc")
      .take(Math.min(args.limit ?? MAX_LIST, MAX_LIST));

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
    await requireAdmin(ctx);
    return await ctx.db.get(args.id);
  },
});

// Get single listing
export const getListing = query({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
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
    await requireAdmin(ctx);
    const take = Math.min(args.limit ?? 50, MAX_LIST);

    // Filter by status on the index rather than scanning every booking.
    let bookings = args.status
      ? await ctx.db
          .query("bookings")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(take)
      : await ctx.db.query("bookings").order("desc").take(take);

    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
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
    await requireAdmin(ctx);
    const listings = await ctx.db.query("listings").take(MAX_SCAN);
    const cities = [...new Set(listings.map(l => l.city))].sort();
    return cities;
  },
});

// Get all categories (for dropdown)
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const listings = await ctx.db.query("listings").take(MAX_SCAN);
    const categories = [...new Set(listings.map(l => l.category))].sort();
    return categories;
  },
});

// List pending content (listings awaiting approval)
export const listPendingContent = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(MAX_LIST);

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

// List pending services awaiting approval
export const listPendingServices = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const services = await ctx.db
      .query("services")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(MAX_LIST);

    const enriched = await Promise.all(
      services.map(async (service) => {
        const owner = await ctx.db.get(service.ownerId);
        return {
          ...service,
          ownerName: owner ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email : "",
          ownerEmail: owner?.email || "",
        };
      })
    );

    return enriched;
  },
});

// List pending business accounts awaiting approval
export const listPendingBusinesses = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const pendingOwners = await ctx.db
      .query("users")
      .withIndex("by_role_and_approval", (q) =>
        q.eq("role", "business_owner").eq("isApproved", false)
      )
      .take(MAX_LIST);

    const pendingProviders = await ctx.db
      .query("users")
      .withIndex("by_role_and_approval", (q) =>
        q.eq("role", "service_provider").eq("isApproved", false)
      )
      .take(MAX_LIST);

    return [...pendingOwners, ...pendingProviders];
  },
});
