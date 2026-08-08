import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedAppUser } from "../auth";
import { QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Hard ceilings so no query can ever scan an unbounded number of documents.
// Convex fails a query outright past ~16k reads, so these must stay well under.
const MAX_SCAN = 1000;
const MAX_LIST = 200;

// Helper: check if listing is publicly visible (approved or no status = seed data)
function isPublicListing(listing: { isActive?: boolean; status?: string }) {
  if (listing.isActive === false) return false;
  if (listing.status && listing.status !== "approved") return false;
  return true;
}

// Helper: fetch blocked user IDs for the current user (empty set if anonymous)
async function getBlockedIds(ctx: QueryCtx): Promise<Set<string>> {
  const user = await getAuthenticatedAppUser(ctx);
  if (!user) return new Set();
  const blocks = await ctx.db
    .query("userBlocks")
    .withIndex("by_blocker", (q) => q.eq("blockerId", user._id))
    .collect();
  return new Set(blocks.map((b) => b.blockedUserId as string));
}

// Shared index selection for both the capped and paginated list queries.
function buildListingQuery(
  ctx: QueryCtx,
  args: { type?: string; category?: string; city?: string }
) {
  if (args.city && args.category) {
    return ctx.db.query("listings").withIndex("by_city_and_category", (q) =>
      q.eq("city", args.city!).eq("category", args.category!)
    );
  } else if (args.type && args.category) {
    return ctx.db.query("listings").withIndex("by_type_and_category", (q) =>
      q.eq("type", args.type!).eq("category", args.category!)
    );
  } else if (args.type) {
    return ctx.db.query("listings").withIndex("by_type", (q) => q.eq("type", args.type!));
  } else if (args.category) {
    return ctx.db.query("listings").withIndex("by_category", (q) => q.eq("category", args.category!));
  } else if (args.city) {
    return ctx.db.query("listings").withIndex("by_city", (q) => q.eq("city", args.city!));
  }
  return ctx.db.query("listings");
}

/**
 * Cursor-paginated browse listing. Used by /listings ("load more").
 * Filtering happens per page, so a page may come back shorter than numItems —
 * that's expected and `isDone` still terminates correctly.
 */
export const listListingsPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await buildListingQuery(ctx, args).paginate(args.paginationOpts);
    const blockedIds = await getBlockedIds(ctx);

    return {
      ...result,
      page: result.page
        .filter(isPublicListing)
        .filter((l) => !(l.ownerId && blockedIds.has(l.ownerId as string))),
    };
  },
});

// List listings with optional filters, hard-capped. Used where a full set is
// needed at once (map markers, related listings, booking pickers).
export const listListings = query({
  args: {
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Scan a bounded window rather than the whole index, then filter within it.
    const listings = await buildListingQuery(ctx, args).take(MAX_SCAN);

    const blockedIds = await getBlockedIds(ctx);
    const publicListings = listings
      .filter(isPublicListing)
      .filter((l) => !(l.ownerId && blockedIds.has(l.ownerId as string)));

    return publicListings.slice(0, Math.min(args.limit ?? 500, MAX_SCAN));
  },
});

// Search listings by name
export const searchListings = query({
  args: {
    searchQuery: v.string(),
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let searchBuilder = ctx.db
      .query("listings")
      .withSearchIndex("search_listings", (q) => {
        let search = q.search("name_en", args.searchQuery);
        if (args.type) search = search.eq("type", args.type);
        if (args.category) search = search.eq("category", args.category);
        if (args.city) search = search.eq("city", args.city);
        return search;
      });

    // Search indexes already return relevance-ranked results, so a bounded
    // take is enough — no pagination needed for a search box.
    const results = await searchBuilder.take(MAX_LIST);

    const blockedIds = await getBlockedIds(ctx);
    const publicListings = results
      .filter(isPublicListing)
      .filter((l) => !(l.ownerId && blockedIds.has(l.ownerId as string)));

    return publicListings.slice(0, Math.min(args.limit ?? 50, MAX_LIST));
  },
});

// Get a single listing by ID (public — only returns approved/seed listings)
export const getListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing || !isPublicListing(listing)) return null;
    return listing;
  },
});

// Get all unique categories
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").take(MAX_SCAN);

    const categoryMap = new Map<string, { category: string; category_ar?: string; count: number }>();

    for (const listing of listings) {
      if (!isPublicListing(listing)) continue;

      const existing = categoryMap.get(listing.category);
      if (existing) {
        existing.count += 1;
      } else {
        categoryMap.set(listing.category, {
          category: listing.category,
          category_ar: listing.category_ar,
          count: 1,
        });
      }
    }

    return Array.from(categoryMap.values()).sort((a, b) => b.count - a.count);
  },
});

// Get all unique cities
export const getCities = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").take(MAX_SCAN);

    const cityMap = new Map<string, number>();

    for (const listing of listings) {
      if (!isPublicListing(listing)) continue;

      const count = cityMap.get(listing.city) || 0;
      cityMap.set(listing.city, count + 1);
    }

    return Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => a.city.localeCompare(b.city));
  },
});

// Get listings near a location
export const getListingsNearLocation = query({
  args: {
    lat: v.number(),
    lng: v.number(),
    radiusKm: v.optional(v.number()),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const radiusKm = args.radiusKm || 10;

    let listings = await ctx.db.query("listings").take(MAX_SCAN);

    listings = listings.filter(isPublicListing);

    if (args.category) {
      listings = listings.filter((l) => l.category === args.category);
    }

    const listingsWithDistance = listings
      .map((listing) => {
        const distance = calculateDistance(
          args.lat,
          args.lng,
          listing.coordinates.lat,
          listing.coordinates.lng
        );
        return { ...listing, distance };
      })
      .filter((l) => l.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    return listingsWithDistance.slice(0, Math.min(args.limit ?? MAX_LIST, MAX_LIST));
  },
});

// Get authenticated user's own listings
export const getMyListings = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const listings = await ctx.db
      .query("listings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(MAX_LIST);

    if (args.status) {
      return listings.filter((l) => l.status === args.status);
    }

    return listings;
  },
});

// Get listing reviews
export const getListingReviews = query({
  args: {
    listingId: v.id("listings"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(Math.min(args.limit ?? MAX_LIST, MAX_LIST));

    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        if (review.isAnonymous) {
          return { ...review, user: null };
        }
        const user = await ctx.db.get(review.userId);
        return {
          ...review,
          user: user
            ? { firstName: user.firstName, lastName: user.lastName }
            : null,
        };
      })
    );

    return reviewsWithUsers;
  },
});

// Haversine formula to calculate distance between two coordinates
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
