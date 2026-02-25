import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Helper: check if listing is publicly visible (approved or no status = seed data)
function isPublicListing(listing: { isActive?: boolean; status?: string }) {
  if (listing.isActive === false) return false;
  if (listing.status && listing.status !== "approved") return false;
  return true;
}

// List all listings with optional filters
export const listListings = query({
  args: {
    type: v.optional(v.string()),
    category: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("listings");

    if (args.city && args.category) {
      q = q.withIndex("by_city_and_category", (q) =>
        q.eq("city", args.city!).eq("category", args.category!)
      );
    } else if (args.type && args.category) {
      q = q.withIndex("by_type_and_category", (q) =>
        q.eq("type", args.type!).eq("category", args.category!)
      );
    } else if (args.type) {
      q = q.withIndex("by_type", (q) => q.eq("type", args.type!));
    } else if (args.category) {
      q = q.withIndex("by_category", (q) => q.eq("category", args.category!));
    } else if (args.city) {
      q = q.withIndex("by_city", (q) => q.eq("city", args.city!));
    }

    const listings = await q.collect();

    const publicListings = listings.filter(isPublicListing);

    if (args.limit) {
      return publicListings.slice(0, args.limit);
    }

    return publicListings;
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

    const results = await searchBuilder.collect();

    const publicListings = results.filter(isPublicListing);

    if (args.limit) {
      return publicListings.slice(0, args.limit);
    }

    return publicListings;
  },
});

// Get a single listing by ID
export const getListing = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.listingId);
  },
});

// Get all unique categories
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();

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
    const listings = await ctx.db.query("listings").collect();

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

    let listings = await ctx.db.query("listings").collect();

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

    if (args.limit) {
      return listingsWithDistance.slice(0, args.limit);
    }

    return listingsWithDistance;
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
      .collect();

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
      .collect();

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

    if (args.limit) {
      return reviewsWithUsers.slice(0, args.limit);
    }

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
