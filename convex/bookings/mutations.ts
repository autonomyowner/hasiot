import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Create a booking
export const createBooking = mutation({
  args: {
    listingId: v.id("listings"),
    date: v.string(),
    time: v.string(),
    type: v.optional(v.string()),
    partySize: v.optional(v.number()),
    notes: v.optional(v.string()),
    travelPlanId: v.optional(v.id("travelPlans")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing || listing.isActive === false) {
      throw new Error("Listing not found or inactive");
    }

    const existingBooking = await ctx.db
      .query("bookings")
      .withIndex("by_listingId_and_date", (q) =>
        q.eq("listingId", args.listingId).eq("date", args.date)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("time"), args.time),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .first();

    if (existingBooking) {
      throw new Error("This time slot is no longer available");
    }

    const bookingDate = new Date(`${args.date}T${args.time}`);
    if (bookingDate < new Date()) {
      throw new Error("Cannot book in the past");
    }

    const bookingId = await ctx.db.insert("bookings", {
      userId: user._id,
      listingId: args.listingId,
      date: args.date,
      time: args.time,
      status: "pending",
      type: args.type || "reservation",
      partySize: args.partySize,
      notes: args.notes,
      travelPlanId: args.travelPlanId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return bookingId;
  },
});

// Cancel a booking
export const cancelBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const booking = await ctx.db.get(args.bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.userId !== user._id) {
      throw new Error("Not authorized to cancel this booking");
    }

    if (booking.status === "cancelled") {
      throw new Error("Booking is already cancelled");
    }

    if (booking.status === "completed") {
      throw new Error("Cannot cancel a completed booking");
    }

    await ctx.db.patch(args.bookingId, {
      status: "cancelled",
      cancellationReason: args.reason,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Reschedule a booking
export const rescheduleBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    newDate: v.string(),
    newTime: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const booking = await ctx.db.get(args.bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.userId !== user._id) {
      throw new Error("Not authorized to reschedule this booking");
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      throw new Error("Cannot reschedule this booking");
    }

    const existingBooking = await ctx.db
      .query("bookings")
      .withIndex("by_listingId_and_date", (q) =>
        q.eq("listingId", booking.listingId).eq("date", args.newDate)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("time"), args.newTime),
          q.neq(q.field("status"), "cancelled"),
          q.neq(q.field("_id"), args.bookingId)
        )
      )
      .first();

    if (existingBooking) {
      throw new Error("This time slot is not available");
    }

    const bookingDate = new Date(`${args.newDate}T${args.newTime}`);
    if (bookingDate < new Date()) {
      throw new Error("Cannot reschedule to a past date");
    }

    await ctx.db.patch(args.bookingId, {
      date: args.newDate,
      time: args.newTime,
      status: "pending",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Confirm a booking (business/admin action)
export const confirmBooking = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status !== "pending") {
      throw new Error("Can only confirm pending bookings");
    }

    await ctx.db.patch(args.bookingId, {
      status: "confirmed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Mark booking as completed (business/admin action)
export const completeBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await ctx.db.get(args.bookingId);

    if (!booking) {
      throw new Error("Booking not found");
    }

    if (booking.status === "cancelled") {
      throw new Error("Cannot complete a cancelled booking");
    }

    await ctx.db.patch(args.bookingId, {
      status: "completed",
      notes: args.notes || booking.notes,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
