import { mutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { enforceRateLimit } from "../rateLimit";

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

    // Without a cap, one account can enumerate every listing × date × time and
    // reserve the whole calendar.
    await enforceRateLimit(
      ctx,
      `booking:${user._id}`,
      30,
      "لقد وصلت إلى الحد اليومي للحجوزات. يرجى المحاولة غدًا. / You've reached today's booking limit. Please try again tomorrow."
    );

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

// Confirm a booking (listing owner or admin)
export const confirmBooking = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await requireBookingManager(ctx, args.bookingId);

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

// Mark booking as completed (listing owner or admin)
export const completeBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await requireBookingManager(ctx, args.bookingId);

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

/**
 * Resolve a booking for a caller allowed to move it through the flow: an admin,
 * or the owner of the listing it belongs to.
 *
 * `confirmBooking` and `completeBooking` previously ran no auth check at all, so
 * any caller holding a booking id could confirm or complete it. The tourist who
 * made the booking is deliberately not included — they cancel and reschedule
 * through their own mutations above, but they do not get to confirm themselves.
 */
async function requireBookingManager(ctx: MutationCtx, bookingId: Id<"bookings">) {
  const user = await getAuthenticatedAppUser(ctx);
  if (!user) {
    throw new Error("Not authenticated");
  }

  const booking = await ctx.db.get(bookingId);
  if (!booking) {
    throw new Error("Booking not found");
  }

  if (user.role !== "admin") {
    const listing = await ctx.db.get(booking.listingId);
    if (!listing || listing.ownerId !== user._id) {
      throw new Error("Not authorized to manage this booking");
    }
  }

  return booking;
}
