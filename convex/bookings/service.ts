import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { enforceRateLimit } from "../rateLimit";
import { isBookableStay } from "../listings/pricing";
import { isPublicListing } from "../listings/queries";
import { riyadhDateTimeToTimestamp, todayRiyadhISO } from "../lib/dates";
import { notifyBookingEvent } from "../notifications/internal";
import {
  ACTIVE_STAY_STATUSES,
  BOOKING_ERRORS,
  computeStayQuote,
  expiryFor,
  generateConfirmationCode,
  overlaps,
  TERMINAL_STATUSES,
  type BookingStatus,
} from "./logic";

/**
 * Booking operations against the database, with the caller already resolved.
 *
 * Split out from mutations.ts so the rules can be tested: convex-test cannot
 * stand up the Better Auth component, so anything that calls
 * getAuthenticatedAppUser is unreachable from a test. These functions take the
 * user as an argument, which makes every rule below directly exercisable.
 */

// One listing can hold a lot of history. This bounds the overlap scan; a
// property with more than this many bookings on file needs the real
// availability table that Phase 2 brings, not a bigger number here.
const OVERLAP_SCAN_LIMIT = 500;

type StayArgs = {
  listingId: Id<"listings">;
  checkIn: string;
  checkOut: string;
  guests: number;
  notes?: string;
};

/**
 * Create a stay request.
 *
 * Everything about the money is computed here from the listing, never taken
 * from the caller: the client sends dates and a guest count, and the server
 * decides what that costs. A client-supplied total is a client-supplied
 * discount.
 */
export async function createStayForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: StayArgs,
  now: number = Date.now()
): Promise<{ bookingId: Id<"bookings">; confirmationCode: string }> {
  // The host has to be able to reach the guest — a stay is someone arriving at
  // a physical building, possibly late at night.
  if (!user.phoneVerified) {
    throw new ConvexError(BOOKING_ERRORS.PHONE_REQUIRED);
  }

  await enforceRateLimit(
    ctx,
    `booking:${user._id}`,
    30,
    "لقد وصلت إلى الحد اليومي للحجوزات. يرجى المحاولة غدًا. / You've reached today's booking limit. Please try again tomorrow."
  );

  const listing = await ctx.db.get(args.listingId);
  if (!listing) throw new ConvexError(BOOKING_ERRORS.LISTING_UNAVAILABLE);
  if (!isBookableStay(listing)) throw new ConvexError(BOOKING_ERRORS.NOT_BOOKABLE);
  if (listing.ownerId && listing.ownerId === user._id) {
    throw new ConvexError(BOOKING_ERRORS.OWN_LISTING);
  }

  const quoted = computeStayQuote(listing, args, todayRiyadhISO(now));
  if (!quoted.ok) throw new ConvexError(quoted.error);
  const quote = quoted.quote;

  // Availability. Phase 1 counts concurrent stays against unitCount rather
  // than tracking individual rooms — enough to stop a one-room guesthouse
  // being double-booked, and replaced by real per-night inventory in Phase 2.
  const existing = await ctx.db
    .query("bookings")
    .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
    .order("desc")
    .take(OVERLAP_SCAN_LIMIT);

  let occupied = 0;
  for (const booking of existing) {
    if (booking.kind !== "stay") continue;
    if (!ACTIVE_STAY_STATUSES.includes(booking.status as BookingStatus)) continue;
    if (!booking.checkIn || !booking.checkOut) continue;
    if (!overlaps({ checkIn: booking.checkIn, checkOut: booking.checkOut }, quote)) continue;

    // A guest re-submitting the same dates is almost always a double tap or a
    // retry, and telling them "no availability" would be misleading.
    if (booking.userId === user._id) {
      throw new ConvexError(BOOKING_ERRORS.DUPLICATE);
    }
    occupied += 1;
  }

  if (listing.unitCount !== undefined && occupied >= listing.unitCount) {
    throw new ConvexError(BOOKING_ERRORS.NO_AVAILABILITY);
  }

  const confirmationCode = await uniqueConfirmationCode(ctx);

  const bookingId = await ctx.db.insert("bookings", {
    userId: user._id,
    listingId: args.listingId,
    ownerId: listing.ownerId,
    kind: "stay",
    type: "stay",
    // Mirror the legacy slot fields. by_listingId_and_date, getUpcomingCount
    // and the admin panel's today/upcoming/past grouping all read them, and a
    // stay that left them stale would sort into the wrong bucket.
    date: quote.checkIn,
    time: listing.checkInTime ?? "15:00",
    checkIn: quote.checkIn,
    checkOut: quote.checkOut,
    nights: quote.nights,
    guests: quote.guests,
    partySize: quote.guests,
    pricePerNight: quote.pricePerNight,
    totalAmount: quote.totalAmount,
    currency: quote.currency,
    confirmationCode,
    status: "pending",
    notes: args.notes?.trim() || undefined,
    expiresAt: expiryFor(now),
    createdAt: now,
    updatedAt: now,
  });

  const booking = await ctx.db.get(bookingId);
  if (booking) await notifyBookingEvent(ctx, "booking.requested", booking);

  return { bookingId, confirmationCode };
}

/**
 * The original restaurant-style reservation: one date, one time slot.
 *
 * Kept working because the live 1.0.2 binaries can still call it, and because
 * a restaurant table genuinely is a different shape from a hotel room.
 */
export async function createSlotForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    listingId: Id<"listings">;
    date: string;
    time: string;
    type?: string;
    partySize?: number;
    notes?: string;
    travelPlanId?: Id<"travelPlans">;
  },
  now: number = Date.now()
): Promise<{ bookingId: Id<"bookings">; confirmationCode: null }> {
  await enforceRateLimit(
    ctx,
    `booking:${user._id}`,
    30,
    "لقد وصلت إلى الحد اليومي للحجوزات. يرجى المحاولة غدًا. / You've reached today's booking limit. Please try again tomorrow."
  );

  const listing = await ctx.db.get(args.listingId);
  // Previously this checked only isActive, so a pending or rejected listing
  // could be booked by anyone who knew its id.
  if (!listing || !isPublicListing(listing)) {
    throw new ConvexError(BOOKING_ERRORS.LISTING_UNAVAILABLE);
  }

  const clash = await ctx.db
    .query("bookings")
    .withIndex("by_listingId_and_date", (q) =>
      q.eq("listingId", args.listingId).eq("date", args.date)
    )
    .filter((q) =>
      q.and(q.eq(q.field("time"), args.time), q.neq(q.field("status"), "cancelled"))
    )
    .first();
  if (clash) throw new ConvexError("This time slot is no longer available");

  // The old check built a Date from `${date}T${time}` and compared it to now,
  // which parses as UTC on the server — so an evening slot in Riyadh looked
  // three hours further away than it was.
  if (riyadhDateTimeToTimestamp(args.date, args.time) < now) {
    throw new ConvexError(BOOKING_ERRORS.PAST_CHECK_IN);
  }

  const bookingId = await ctx.db.insert("bookings", {
    userId: user._id,
    listingId: args.listingId,
    ownerId: listing.ownerId,
    kind: "slot",
    date: args.date,
    time: args.time,
    status: "pending",
    type: args.type || "reservation",
    partySize: args.partySize,
    notes: args.notes,
    travelPlanId: args.travelPlanId,
    createdAt: now,
    updatedAt: now,
  });

  return { bookingId, confirmationCode: null };
}

export async function confirmAsManager(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  now: number = Date.now()
): Promise<void> {
  if (booking.status !== "pending") throw new ConvexError(BOOKING_ERRORS.NOT_PENDING);

  await ctx.db.patch(booking._id, {
    status: "confirmed",
    respondedAt: now,
    updatedAt: now,
  });

  const updated = await ctx.db.get(booking._id);
  if (updated) await notifyBookingEvent(ctx, "booking.confirmed", updated);
}

export async function declineAsManager(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  reason: string | undefined,
  now: number = Date.now()
): Promise<void> {
  if (booking.status !== "pending") throw new ConvexError(BOOKING_ERRORS.NOT_PENDING);

  await ctx.db.patch(booking._id, {
    status: "declined",
    declineReason: reason?.trim().slice(0, 500) || undefined,
    respondedAt: now,
    updatedAt: now,
  });

  const updated = await ctx.db.get(booking._id);
  if (updated) await notifyBookingEvent(ctx, "booking.declined", updated);
}

export async function completeAsManager(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  notes: string | undefined,
  now: number = Date.now()
): Promise<void> {
  if (TERMINAL_STATUSES.includes(booking.status as BookingStatus)) {
    throw new ConvexError(BOOKING_ERRORS.ALREADY_CLOSED);
  }

  await ctx.db.patch(booking._id, {
    status: "completed",
    completedAt: now,
    notes: notes ?? booking.notes,
    updatedAt: now,
  });
}

export async function cancelAsTourist(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  reason: string | undefined,
  now: number = Date.now()
): Promise<void> {
  if (TERMINAL_STATUSES.includes(booking.status as BookingStatus)) {
    throw new ConvexError(BOOKING_ERRORS.ALREADY_CLOSED);
  }

  // Once the guest has arrived, cancelling is a conversation with the host,
  // not a button — the room was held and the night may already be owed.
  if (booking.kind === "stay" && booking.checkIn && booking.checkIn <= todayRiyadhISO(now)) {
    throw new ConvexError(BOOKING_ERRORS.STAY_STARTED);
  }

  await ctx.db.patch(booking._id, {
    status: "cancelled",
    cancellationReason: reason?.trim().slice(0, 500) || undefined,
    updatedAt: now,
  });

  if (booking.kind === "stay") {
    const updated = await ctx.db.get(booking._id);
    if (updated) await notifyBookingEvent(ctx, "booking.cancelled", updated);
  }
}

/**
 * A confirmation code nobody else is holding.
 *
 * 32^5 is ~34 million, so a collision is remote, but the code is what a guest
 * reads out at a front desk — two live bookings sharing one would send someone
 * to the wrong room.
 */
async function uniqueConfirmationCode(ctx: MutationCtx): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateConfirmationCode();
    const taken = await ctx.db
      .query("bookings")
      .withIndex("by_confirmationCode", (q) => q.eq("confirmationCode", code))
      .first();
    if (!taken) return code;
  }
  throw new ConvexError("تعذّر إنشاء رمز تأكيد. حاول مرة أخرى. / Could not allocate a confirmation code.");
}
