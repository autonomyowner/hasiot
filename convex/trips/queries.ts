import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get all trips for current user, with hydrated listing data for stops
export const getMyTrips = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    let trips;
    if (args.status) {
      trips = await ctx.db
        .query("trips")
        .withIndex("by_userId_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .collect();
    } else {
      trips = await ctx.db
        .query("trips")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect();
    }

    // Hydrate stops with listing data
    const hydratedTrips = await Promise.all(
      trips.map(async (trip) => {
        const hydratedStops = await Promise.all(
          trip.stops.map(async (stop) => {
            const listing = await ctx.db.get(stop.listingId);
            return {
              ...stop,
              listing: listing
                ? {
                    _id: listing._id,
                    name_en: listing.name_en,
                    name_ar: listing.name_ar,
                    type: listing.type,
                    city: listing.city,
                    coordinates: listing.coordinates,
                    category: listing.category,
                    category_ar: listing.category_ar,
                  }
                : null,
            };
          })
        );
        return { ...trip, stops: hydratedStops };
      })
    );

    return hydratedTrips.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

// Get single trip with hydrated stops + ownership check
export const getTrip = query({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return null;

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user._id) return null;

    const hydratedStops = await Promise.all(
      trip.stops.map(async (stop) => {
        const listing = await ctx.db.get(stop.listingId);
        return {
          ...stop,
          listing: listing
            ? {
                _id: listing._id,
                name_en: listing.name_en,
                name_ar: listing.name_ar,
                type: listing.type,
                city: listing.city,
                coordinates: listing.coordinates,
                category: listing.category,
                category_ar: listing.category_ar,
              }
            : null,
        };
      })
    );

    return { ...trip, stops: hydratedStops };
  },
});

// Lightweight trip summaries for "Save to Trip" picker
export const getMyTripSummaries = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const trips = await ctx.db
      .query("trips")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "planning")
      )
      .collect();

    return trips
      .map((trip) => ({
        _id: trip._id,
        title: trip.title,
        title_ar: trip.title_ar,
        stopCount: trip.stops.length,
        startDate: trip.startDate,
        endDate: trip.endDate,
      }))
      .sort((a, b) => b._id.localeCompare(a._id));
  },
});
