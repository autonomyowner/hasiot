import { query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAdmin } from "../auth";

// Hard ceilings so no admin query can scan an unbounded number of documents.
// Convex fails a query outright past ~16k reads, and this dashboard used to
// collect seven whole tables on every page load.
const MAX_LIST = 200;
const MAX_SCAN = 1000;
const STATS_CAP = 5000;
const MAX_SEARCH = 100;

const DAY_MS = 24 * 60 * 60 * 1000;

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

    // Everything below is derived from the rows already fetched above, apart
    // from the two indexed counts — the point is to add the numbers the operator
    // acts on without adding table scans.
    const pendingReports = await ctx.db
      .query("contentReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .take(MAX_LIST);

    const bookingsByStatus = {
      pending: bookings.filter(b => b.status === "pending").length,
      confirmed: bookings.filter(b => b.status === "confirmed").length,
      completed: bookings.filter(b => b.status === "completed").length,
      cancelled: bookings.filter(b => b.status === "cancelled").length,
      no_show: bookings.filter(b => b.status === "no_show").length,
    };

    const listingsByType = {
      hotel: listings.filter(l => l.type === "hotel").length,
      restaurant: listings.filter(l => l.type === "restaurant").length,
      attraction: listings.filter(l => l.type === "attraction").length,
      event: listings.filter(l => l.type === "event").length,
      tour: listings.filter(l => l.type === "tour").length,
    };

    const weekAgo = Date.now() - 7 * DAY_MS;
    const today = new Date().toISOString().split("T")[0];
    const inAWeek = new Date(Date.now() + 7 * DAY_MS).toISOString().split("T")[0];

    // Daily buckets for the dashboard's trend charts. Built from the rows
    // already fetched above by bucketing createdAt, so the charts cost nothing:
    // no extra query, no extra document read.
    const TREND_DAYS = 14;
    const dayKeys: string[] = [];
    for (let i = TREND_DAYS - 1; i >= 0; i--) {
      dayKeys.push(new Date(Date.now() - i * DAY_MS).toISOString().split("T")[0]);
    }
    const bucket = (rows: { createdAt: number }[]) => {
      const counts = new Map(dayKeys.map((d) => [d, 0]));
      for (const row of rows) {
        const key = new Date(row.createdAt).toISOString().split("T")[0];
        const current = counts.get(key);
        if (current !== undefined) counts.set(key, current + 1);
      }
      return dayKeys.map((d) => counts.get(d) ?? 0);
    };

    const trend = {
      days: dayKeys,
      listings: bucket(listings),
      bookings: bucket(bookings),
      users: bucket(users),
    };

    const pendingBusinesses = users.filter(
      u => (u.role === "business_owner" || u.role === "service_provider") && u.isApproved === false
    ).length;

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

      // Work waiting on the operator, which is what the dashboard leads with.
      pendingBusinesses,
      pendingReports: pendingReports.length,
      pendingBookings: bookingsByStatus.pending,

      // Content quality: a listing with no photo renders as a blank card in the
      // app, and one with no working hours can never offer a booking slot.
      listingsMissingImages: listings.filter(l => !l.images || l.images.length === 0).length,
      listingsMissingHours: listings.filter(l => !l.workingHours || l.workingHours.length === 0).length,

      // Momentum
      newUsersThisWeek: users.filter(u => u.createdAt >= weekAgo).length,
      newListingsThisWeek: listings.filter(l => l.createdAt >= weekAgo).length,
      upcomingBookings: bookings.filter(
        b => b.date >= today && b.date <= inAWeek && b.status !== "cancelled"
      ).length,

      trend,
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

/**
 * `status` in the UI has a fourth value the database does not: seed listings
 * carry no status at all and are treated as approved everywhere. "seed" selects
 * exactly those.
 */
function matchesStatus(listing: { status?: string }, status?: string) {
  if (!status) return true;
  if (status === "seed") return listing.status === undefined;
  return listing.status === status;
}

function matchesFlags(
  listing: { images?: string[]; workingHours?: unknown[] },
  args: { hasImages?: boolean; hasWorkingHours?: boolean }
) {
  if (args.hasImages !== undefined) {
    const has = (listing.images?.length ?? 0) > 0;
    if (has !== args.hasImages) return false;
  }
  if (args.hasWorkingHours !== undefined) {
    const has = (listing.workingHours?.length ?? 0) > 0;
    if (has !== args.hasWorkingHours) return false;
  }
  return true;
}

/**
 * Cursor-paginated listings for the admin table.
 *
 * `listAllListings` above caps at 200 rows with no way to reach row 201, which
 * was survivable at 56 seeded listings and will not be. Filtering happens per
 * page, so a page can come back shorter than requested — `isDone` still
 * terminates correctly.
 */
export const adminListListings = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.string()),
    city: v.optional(v.string()),
    status: v.optional(v.string()),
    hasImages: v.optional(v.boolean()),
    hasWorkingHours: v.optional(v.boolean()),
    order: v.optional(v.string()), // "newest" (default) | "oldest"
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Use the narrowest index the filters allow. Status wins over type because
    // the pending queue is the one that grows unboundedly.
    const build = () => {
      if (args.status && args.status !== "seed") {
        return ctx.db.query("listings").withIndex("by_status", (q) => q.eq("status", args.status!));
      }
      if (args.type) {
        return ctx.db.query("listings").withIndex("by_type", (q) => q.eq("type", args.type!));
      }
      if (args.city) {
        return ctx.db.query("listings").withIndex("by_city", (q) => q.eq("city", args.city!));
      }
      return ctx.db.query("listings");
    };

    const result = await build()
      .order(args.order === "oldest" ? "asc" : "desc")
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: result.page.filter(
        (l) =>
          (!args.type || l.type === args.type) &&
          (!args.city || l.city === args.city) &&
          matchesStatus(l, args.status) &&
          matchesFlags(l, args)
      ),
    };
  },
});

/**
 * Search listings by name for the admin table.
 *
 * A Convex search index covers one field, and this panel is Arabic-first while
 * the seed data is named in both languages — so both indexes are queried and the
 * results merged. Search results are narrow by nature, so this returns a plain
 * capped array rather than a page.
 */
export const adminSearchListings = query({
  args: {
    searchQuery: v.string(),
    type: v.optional(v.string()),
    city: v.optional(v.string()),
    status: v.optional(v.string()),
    hasImages: v.optional(v.boolean()),
    hasWorkingHours: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const term = args.searchQuery.trim();
    if (!term) return [];

    const [byEnglish, byArabic] = await Promise.all([
      ctx.db
        .query("listings")
        .withSearchIndex("search_listings", (q) => {
          let search = q.search("name_en", term);
          if (args.type) search = search.eq("type", args.type);
          if (args.city) search = search.eq("city", args.city);
          return search;
        })
        .take(MAX_SEARCH),
      ctx.db
        .query("listings")
        .withSearchIndex("search_listings_ar", (q) => {
          let search = q.search("name_ar", term);
          if (args.type) search = search.eq("type", args.type);
          if (args.city) search = search.eq("city", args.city);
          return search;
        })
        .take(MAX_SEARCH),
    ]);

    // Relevance order is per-index, so merge with the English hits first and
    // drop duplicates rather than interleaving two incomparable scores.
    const seen = new Set<string>();
    const merged = [];
    for (const listing of [...byEnglish, ...byArabic]) {
      if (seen.has(listing._id)) continue;
      seen.add(listing._id);
      if (!matchesStatus(listing, args.status)) continue;
      if (!matchesFlags(listing, args)) continue;
      merged.push(listing);
    }

    return merged.slice(0, MAX_SEARCH);
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
    const bookings = args.status
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
        // The owner is who the admin has to phone when confirming on a
        // business's behalf, so it travels with the row.
        const owner = listing?.ownerId ? await ctx.db.get(listing.ownerId) : null;
        return {
          ...booking,
          listingName: listing?.name_en || "Unknown",
          listingName_ar: listing?.name_ar || "غير معروف",
          listingPhone: listing?.phone,
          listingHasHours: (listing?.workingHours?.length ?? 0) > 0,
          ownerName: owner
            ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email
            : null,
          ownerPhone: owner?.phone ?? null,
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown",
          userEmail: user?.email,
          userPhone: user?.phone,
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

/**
 * The admin action log, newest first. Rows are append-only, so the default
 * `_creationTime` ordering is the chronology — no extra index needed.
 */
export const listAdminActivity = query({
  args: {
    paginationOpts: paginationOptsValidator,
    action: v.optional(v.string()),
    targetType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const build = () => {
      if (args.action) {
        return ctx.db.query("adminActivity").withIndex("by_action", (q) => q.eq("action", args.action!));
      }
      return ctx.db.query("adminActivity");
    };

    const result = await build().order("desc").paginate(args.paginationOpts);

    return {
      ...result,
      page: args.targetType
        ? result.page.filter((row) => row.targetType === args.targetType)
        : result.page,
    };
  },
});

/**
 * Everything the log knows about one listing or service, for the "history"
 * affordance on a row. Kept separate from the paginated feed so opening a
 * history panel never re-reads the whole log.
 */
export const listActivityForTarget = query({
  args: { targetType: v.string(), targetId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("adminActivity")
      .withIndex("by_target", (q) =>
        q.eq("targetType", args.targetType).eq("targetId", args.targetId)
      )
      .order("desc")
      .take(50);
  },
});
