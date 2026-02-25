import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Create a new trip
export const createTrip = mutation({
  args: {
    title: v.string(),
    title_ar: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("trips", {
      userId: user._id,
      title: args.title,
      title_ar: args.title_ar,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "planning",
      stops: [],
      createdAt: now,
      updatedAt: now,
    });
  },
});

// Add a stop to a trip
export const addStopToTrip = mutation({
  args: {
    tripId: v.id("trips"),
    listingId: v.id("listings"),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user._id) throw new Error("Trip not found");

    const newStop = {
      listingId: args.listingId,
      date: args.date,
      time: args.time,
      notes: args.notes,
      order: trip.stops.length,
    };

    await ctx.db.patch(args.tripId, {
      stops: [...trip.stops, newStop],
      updatedAt: Date.now(),
    });
  },
});

// Update a stop's details
export const updateStop = mutation({
  args: {
    tripId: v.id("trips"),
    stopIndex: v.number(),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user._id) throw new Error("Trip not found");
    if (args.stopIndex < 0 || args.stopIndex >= trip.stops.length)
      throw new Error("Invalid stop index");

    const stops = [...trip.stops];
    stops[args.stopIndex] = {
      ...stops[args.stopIndex],
      ...(args.date !== undefined && { date: args.date }),
      ...(args.time !== undefined && { time: args.time }),
      ...(args.notes !== undefined && { notes: args.notes }),
    };

    await ctx.db.patch(args.tripId, { stops, updatedAt: Date.now() });
  },
});

// Remove a stop and re-index
export const removeStop = mutation({
  args: {
    tripId: v.id("trips"),
    stopIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user._id) throw new Error("Trip not found");
    if (args.stopIndex < 0 || args.stopIndex >= trip.stops.length)
      throw new Error("Invalid stop index");

    const stops = trip.stops
      .filter((_, i) => i !== args.stopIndex)
      .map((stop, i) => ({ ...stop, order: i }));

    await ctx.db.patch(args.tripId, { stops, updatedAt: Date.now() });
  },
});

// Reorder stops (move from one index to another)
export const reorderStops = mutation({
  args: {
    tripId: v.id("trips"),
    fromIndex: v.number(),
    toIndex: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user._id) throw new Error("Trip not found");

    const { fromIndex, toIndex } = args;
    if (
      fromIndex < 0 || fromIndex >= trip.stops.length ||
      toIndex < 0 || toIndex >= trip.stops.length
    )
      throw new Error("Invalid index");

    const stops = [...trip.stops];
    const [moved] = stops.splice(fromIndex, 1);
    stops.splice(toIndex, 0, moved);
    const reindexed = stops.map((stop, i) => ({ ...stop, order: i }));

    await ctx.db.patch(args.tripId, { stops: reindexed, updatedAt: Date.now() });
  },
});

// Update trip metadata
export const updateTrip = mutation({
  args: {
    tripId: v.id("trips"),
    title: v.optional(v.string()),
    title_ar: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user._id) throw new Error("Trip not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.title_ar !== undefined) updates.title_ar = args.title_ar;
    if (args.startDate !== undefined) updates.startDate = args.startDate;
    if (args.endDate !== undefined) updates.endDate = args.endDate;
    if (args.status !== undefined) updates.status = args.status;

    await ctx.db.patch(args.tripId, updates);
  },
});

// Delete a trip
export const deleteTrip = mutation({
  args: {
    tripId: v.id("trips"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const trip = await ctx.db.get(args.tripId);
    if (!trip || trip.userId !== user._id) throw new Error("Trip not found");

    await ctx.db.delete(args.tripId);
  },
});

// Convert an AI travel plan to an editable trip
export const convertPlanToTrip = mutation({
  args: {
    planId: v.id("travelPlans"),
    title: v.string(),
    title_ar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found");

    // Best-effort: match plan destinations to listings via search
    const stops = [];
    if (plan.plan.suggestedDestinations) {
      for (let i = 0; i < plan.plan.suggestedDestinations.length; i++) {
        const dest = plan.plan.suggestedDestinations[i];
        const destName = typeof dest === "string" ? dest : dest.name;

        // Try to find a matching listing
        const results = await ctx.db
          .query("listings")
          .withSearchIndex("search_listings", (q) =>
            q.search("name_en", destName)
          )
          .take(1);

        if (results.length > 0) {
          stops.push({
            listingId: results[0]._id,
            date: undefined,
            time: undefined,
            notes: typeof dest === "string" ? undefined : dest.description,
            order: i,
          });
        }
      }
    }

    const now = Date.now();
    return await ctx.db.insert("trips", {
      userId: user._id,
      title: args.title,
      title_ar: args.title_ar,
      status: "planning",
      sourcePlanId: args.planId,
      stops,
      createdAt: now,
      updatedAt: now,
    });
  },
});
