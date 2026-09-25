import { query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAdmin } from "../auth";
import { matchesCity } from "../lib/cities";
import { isPlaceholderEmail } from "../lib/contact";
import {
  computeDashboardStats,
  getServiceForAdmin,
  getUserForAdmin,
  listActivityPage,
  listBookingsPage,
  listListingsPage,
  listServicesPage,
  pendingBusinessRows,
  searchBookingsForAdmin,
  searchServicesForAdmin,
} from "./views";

// Hard ceilings so no admin query can scan an unbounded number of documents.
// Convex fails a query outright past ~16k reads.
const MAX_LIST = 200;
const MAX_SCAN = 1000;
const MAX_SEARCH = 100;

/**
 * Dashboard statistics (computeDashboardStats). Additive since 1.1.0: every
 * field the production panel reads keeps its name and meaning; `queues` /
 * `queueTotal` count each piece of waiting work once, and `capped` says when
 * a count stopped at its read cap.
 */
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await computeDashboardStats(ctx);
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
 * was survivable at 56 seeded listings and will not be. The filters run inside
 * the query (listListingsPage): applied to a page after it was fetched they
 * could empty it while matches remained, and the panel said "no results".
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
    return await listListingsPage(ctx, args);
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
          // City is filtered after the merge instead: the index can only match
          // one exact string, and a city stands for its old sub-areas too.
          return search;
        })
        .take(MAX_SEARCH),
      ctx.db
        .query("listings")
        .withSearchIndex("search_listings_ar", (q) => {
          let search = q.search("name_ar", term);
          if (args.type) search = search.eq("type", args.type);
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
      if (args.city && !matchesCity(listing.city, args.city)) continue;
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
        const listing = booking.listingId ? await ctx.db.get(booking.listingId) : null;
        // A service booking has no listing; the panel (including the build
        // already on hasio.net) shows the service's title in the same column.
        const service = booking.serviceId ? await ctx.db.get(booking.serviceId) : null;
        const user = await ctx.db.get(booking.userId);
        // The owner is who the admin has to phone when confirming on a
        // business's behalf, so it travels with the row.
        const ownerId = service?.ownerId ?? listing?.ownerId;
        const owner = ownerId ? await ctx.db.get(ownerId) : null;
        return {
          ...booking,
          listingName: service?.title_en || listing?.name_en || "Unknown",
          listingName_ar: service?.title_ar || listing?.name_ar || "غير معروف",
          listingPhone: service?.contactPhone ?? listing?.phone,
          listingHasHours: (listing?.workingHours?.length ?? 0) > 0,
          ownerName: owner
            ? `${owner.firstName || ""} ${owner.lastName || ""}`.trim() || owner.email
            : null,
          ownerPhone: owner?.phone ?? null,
          listingImage: service?.images?.[0] ?? listing?.images?.[0] ?? null,
          listingType: service ? "service" : (listing?.type ?? null),
          userName: user
            ? `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
              // A phone sign-up has a synthesised address; showing it as a name
              // would put "966501234567@phone.hasio.xyz" in the table.
              (isPlaceholderEmail(user.email) ? (user.phone ?? "Unknown") : user.email)
            : "Unknown",
          userEmail: user && isPlaceholderEmail(user.email) ? null : user?.email,
          userPhone: user?.phone,
          userPhoneVerified: user?.phoneVerified ?? false,
        };
      })
    );

    return enrichedBookings;
  },
});

/**
 * The bookings tab: every booking, newest first, paginated. `kind` is "stay",
 * "service" or "slot" (legacy rows with no kind, or "slot"). Filters run inside
 * the query, so a page is never empty while matches remain. Each row carries
 * listing / service / guest / owner summaries.
 */
export const adminListBookings = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
    kind: v.optional(v.union(v.literal("stay"), v.literal("service"), v.literal("slot"))),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await listBookingsPage(ctx, args);
  },
});

/**
 * Find bookings by confirmation code (any case, prefix optional) or by the
 * guest's phone number (local or international form). The same rows as
 * adminListBookings, at most 50.
 */
export const adminSearchBookings = query({
  args: { search: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await searchBookingsForAdmin(ctx, args);
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

// === Live services (the services tab) ===

/**
 * Every service, newest first, whatever its status — the pending queue has
 * its own query. Each row carries its owner. Filters run inside the query, so
 * a page is never empty while matches remain.
 */
export const adminListServices = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await listServicesPage(ctx, args);
  },
});

/** Search services by English or Arabic title: one ranked array of up to 50 rows. */
export const adminSearchServices = query({
  args: {
    search: v.string(),
    status: v.optional(v.string()),
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await searchServicesForAdmin(ctx, args);
  },
});

/** One service for the detail drawer: owner, recent bookings, open reports. Null when gone. */
export const adminGetService = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await getServiceForAdmin(ctx, args.serviceId);
  },
});

/**
 * One account for the user drawer: the table row plus its rejection reason,
 * its last 20 bookings as a guest, what it owns (50 each) and the last 20
 * reports against its content. Null when the account is gone.
 */
export const adminGetUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await getUserForAdmin(ctx, args.userId);
  },
});

// List business accounts not yet approved. Each row says whether it has a
// document (hasDocument) and, when an admin turned it down, why.
export const listPendingBusinesses = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await pendingBusinessRows(ctx);
  },
});

/**
 * The admin action log, newest first. Rows are append-only, so the default
 * `_creationTime` ordering is the chronology — no extra index needed. The
 * target-type filter runs inside the query (listActivityPage).
 */
export const listAdminActivity = query({
  args: {
    paginationOpts: paginationOptsValidator,
    action: v.optional(v.string()),
    targetType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await listActivityPage(ctx, args);
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
