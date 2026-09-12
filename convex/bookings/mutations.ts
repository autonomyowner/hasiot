import { mutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { riyadhDateTimeToTimestamp } from "../lib/dates";
import { BOOKING_ERRORS } from "./logic";
import {
  cancelAsTourist,
  completeAsManager,
  confirmAsManager,
  createSlotForUser,
  createStayForUser,
  declineAsManager,
} from "./service";

/**
 * Book a slot: one date, one time. Restaurants, tours, event tickets.
 *
 * Unchanged in shape because the 1.0.2 binaries on both stores can call it.
 * Stays go through createStayBooking below.
 */
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
      throw new ConvexError("Not authenticated");
    }

    const { bookingId } = await createSlotForUser(ctx, user, args);
    return bookingId;
  },
});

/**
 * Request a stay: a date range, a guest count, and a total the server computes.
 *
 * Separate from createBooking rather than folded into it because the two have
 * genuinely different arguments and different rules, and overloading one
 * mutation with "if checkIn is present, ignore date" would make both harder to
 * read and neither easier to call.
 */
export const createStayBooking = mutation({
  args: {
    listingId: v.id("listings"),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new ConvexError("Not authenticated");
    }

    return await createStayForUser(ctx, user, args);
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
      throw new ConvexError("Not authenticated");
    }

    const booking = await ctx.db.get(args.bookingId);

    if (!booking) {
      throw new ConvexError("Booking not found");
    }

    if (booking.userId !== user._id) {
      throw new ConvexError("Not authorized to cancel this booking");
    }

    await cancelAsTourist(ctx, booking, args.reason);

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
      throw new ConvexError("Not authenticated");
    }

    const booking = await ctx.db.get(args.bookingId);

    if (!booking) {
      throw new ConvexError("Booking not found");
    }

    if (booking.userId !== user._id) {
      throw new ConvexError("Not authorized to reschedule this booking");
    }

    // Moving a stay means re-checking availability and re-pricing it against
    // whatever the host charges for the new dates — that is a new booking, not
    // an edit. The app cancels and rebooks instead.
    if (booking.kind === "stay") {
      throw new ConvexError(BOOKING_ERRORS.STAY_NO_RESCHEDULE);
    }

    if (booking.status === "cancelled" || booking.status === "completed") {
      throw new ConvexError("Cannot reschedule this booking");
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
      throw new ConvexError("This time slot is not available");
    }

    // Riyadh wall clock, not UTC: `new Date("2026-09-10T19:00")` parses as UTC
    // on the server, which puts an evening slot three hours further away than
    // it really is.
    if (riyadhDateTimeToTimestamp(args.newDate, args.newTime) < Date.now()) {
      throw new ConvexError("Cannot reschedule to a past date");
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
    await confirmAsManager(ctx, booking);
    return { success: true };
  },
});

/**
 * Turn a request down, with a reason the guest sees.
 *
 * The gap this fills: a host could confirm or complete a booking but had no
 * way to say no. Their only options were to leave the guest waiting or to ask
 * an admin to cancel it — so a request the host had already decided against
 * still held a unit until it expired.
 */
export const declineBooking = mutation({
  args: {
    bookingId: v.id("bookings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const booking = await requireBookingManager(ctx, args.bookingId);
    await declineAsManager(ctx, booking, args.reason);
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
    await completeAsManager(ctx, booking, args.notes);
    return { success: true };
  },
});

/**
 * Mark a confirmed guest as a no-show.
 *
 * Distinct from cancelling: the host held the room and the guest never
 * arrived, which is a different fact about the same booking and one the host
 * will want to see in their history.
 */
export const markNoShow = mutation({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const booking = await requireBookingManager(ctx, args.bookingId);

    if (booking.status !== "confirmed") {
      throw new ConvexError(BOOKING_ERRORS.NOT_AUTHORIZED);
    }

    await ctx.db.patch(args.bookingId, {
      status: "no_show",
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
    throw new ConvexError("Not authenticated");
  }

  const booking = await ctx.db.get(bookingId);
  if (!booking) {
    throw new ConvexError("Booking not found");
  }

  if (user.role !== "admin") {
    const listing = await ctx.db.get(booking.listingId);
    if (!listing || listing.ownerId !== user._id) {
      throw new ConvexError("Not authorized to manage this booking");
    }
  }

  return booking;
}
