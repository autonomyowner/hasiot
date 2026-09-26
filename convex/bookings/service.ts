import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { enforceRateLimit } from "../rateLimit";
import { isBookableStay } from "../listings/pricing";
import { isPublicListing, withoutSuspendedOwners } from "../listings/queries";
import { riyadhDateTimeToTimestamp, todayRiyadhISO } from "../lib/dates";
import { notifyBookingEvent } from "../notifications/internal";
import { canBookWithPhone } from "../lib/phoneRules";
import {
  computeServiceQuote,
  isBookableService,
  isPublicService,
  SERVICE_ERRORS,
} from "../services/logic";
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

// Shared by stays, slots and services: 30 requests a day per traveller,
// whatever they are for.
const DAILY_BOOKINGS = 30;
const DAILY_BOOKINGS_MESSAGE =
  "لقد وصلت إلى الحد اليومي للحجوزات. يرجى المحاولة غدًا. / You've reached today's booking limit. Please try again tomorrow.";

const MAX_NOTES = 500;

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
  // Confirmed by SMS, or a Saudi mobile while Saudi SMS is down (lib/phoneRules.ts).
  if (!canBookWithPhone(user)) {
    throw new ConvexError(BOOKING_ERRORS.PHONE_REQUIRED);
  }

  await enforceRateLimit(ctx, `booking:${user._id}`, DAILY_BOOKINGS, DAILY_BOOKINGS_MESSAGE);

  const listing = await ctx.db.get(args.listingId);
  if (!listing) throw new ConvexError(BOOKING_ERRORS.LISTING_UNAVAILABLE);
  if (!isBookableStay(listing)) throw new ConvexError(BOOKING_ERRORS.NOT_BOOKABLE);
  // A suspended host's places are hidden from every list, but a guest holding
  // the id (an open sheet, a link, the old app's cache) could still book one
  // the host can no longer honour.
  if ((await withoutSuspendedOwners(ctx, [listing])).length === 0) {
    throw new ConvexError(BOOKING_ERRORS.LISTING_UNAVAILABLE);
  }
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
  await enforceRateLimit(ctx, `booking:${user._id}`, DAILY_BOOKINGS, DAILY_BOOKINGS_MESSAGE);

  const listing = await ctx.db.get(args.listingId);
  // Previously this checked only isActive, so a pending or rejected listing
  // could be booked by anyone who knew its id.
  if (
    !listing ||
    !isPublicListing(listing) ||
    (await withoutSuspendedOwners(ctx, [listing])).length === 0
  ) {
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

/**
 * Why a traveller may not book this service, or null when they may.
 *
 * "No price" is said only when a price is all that is missing — an unpriced
 * service of an approved provider, which shows Contact (design D16). When the
 * provider is not an approved provider, pricing it would not help, and saying
 * so would send the traveller to wait for something that is not coming.
 */
export function serviceBookingRefusal(
  service: Doc<"services"> | null,
  owner: Pick<Doc<"users">, "role" | "isApproved" | "isSuspended"> | null
): string | null {
  if (!service || !isPublicService(service, owner)) return SERVICE_ERRORS.SERVICE_UNAVAILABLE;
  if (isBookableService(service, owner)) return null;
  return isBookableService({ ...service, price: 1 }, owner)
    ? SERVICE_ERRORS.NO_PRICE
    : SERVICE_ERRORS.NOT_BOOKABLE;
}

/**
 * Request a service: one day, a start time, and hours or days when the price
 * unit asks for them.
 *
 * As for stays, the money is computed here from the service, never taken from
 * the caller. The provider confirms or declines; nothing is paid in the app.
 */
export async function createServiceForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    serviceId: Id<"services">;
    date: string;
    time: string;
    quantity?: number;
    partySize?: number;
    notes?: string;
  },
  now: number = Date.now()
): Promise<{ bookingId: Id<"bookings">; confirmationCode: string }> {
  // The provider has to be able to reach the traveller: a guide waiting at a
  // meeting point, a driver outside a hotel.
  // Confirmed by SMS, or a Saudi mobile while Saudi SMS is down (lib/phoneRules.ts).
  if (!canBookWithPhone(user)) {
    throw new ConvexError(BOOKING_ERRORS.PHONE_REQUIRED);
  }

  await enforceRateLimit(ctx, `booking:${user._id}`, DAILY_BOOKINGS, DAILY_BOOKINGS_MESSAGE);

  const service = await ctx.db.get(args.serviceId);
  if (!service) throw new ConvexError(SERVICE_ERRORS.SERVICE_UNAVAILABLE);
  const refusal = serviceBookingRefusal(service, await ctx.db.get(service.ownerId));
  if (refusal) throw new ConvexError(refusal);

  if (service.ownerId === user._id) {
    throw new ConvexError(SERVICE_ERRORS.OWN_SERVICE);
  }

  const quoted = computeServiceQuote(service, args, todayRiyadhISO(now), now);
  if (!quoted.ok) throw new ConvexError(quoted.error);
  const quote = quoted.quote;

  // A double tap or a retry, not a second group: the same traveller asking for
  // the same service on the same day while the first request is still alive.
  // Other travellers are not blocked — there is no availability calendar, and
  // two groups on one tour is normal (design D10).
  if (await hasActiveRequest(ctx, user._id, service._id, quote.date)) {
    throw new ConvexError(SERVICE_ERRORS.DUPLICATE);
  }

  const confirmationCode = await uniqueConfirmationCode(ctx);

  const bookingId = await ctx.db.insert("bookings", {
    userId: user._id,
    serviceId: service._id,
    ownerId: service.ownerId,
    kind: "service",
    type: "service",
    // date/time for everything that reads a slot; checkIn/checkOut (the day
    // after the last day, exclusive) for the expiry, reminder and completion
    // jobs, which then run over service bookings unchanged.
    date: quote.date,
    time: quote.time,
    checkIn: quote.checkIn,
    checkOut: quote.checkOut,
    quantity: quote.quantity,
    unitPrice: quote.unitPrice,
    priceUnit: quote.priceUnit,
    totalAmount: quote.totalAmount,
    currency: quote.currency,
    guests: quote.partySize,
    partySize: quote.partySize,
    confirmationCode,
    status: "pending",
    notes: args.notes?.trim().slice(0, MAX_NOTES) || undefined,
    // A request must not outlive the service it asks for. For a day far off
    // the provider gets the usual 48 hours; for one sooner, the request closes
    // at the start time, when an unanswered request can only be a no.
    expiresAt: Math.min(expiryFor(now), riyadhDateTimeToTimestamp(quote.date, quote.time)),
    createdAt: now,
    updatedAt: now,
  });

  const booking = await ctx.db.get(bookingId);
  if (booking) await notifyBookingEvent(ctx, "booking.requested", booking, {}, now);

  return { bookingId, confirmationCode };
}

/**
 * Whether this traveller already has a pending or confirmed booking of this
 * service on this day.
 *
 * Read from the traveller's own active bookings, which stay few, rather than
 * from `by_serviceId`, which is the service's whole history and only grows.
 */
async function hasActiveRequest(
  ctx: MutationCtx,
  userId: Id<"users">,
  serviceId: Id<"services">,
  date: string
): Promise<boolean> {
  for (const status of ACTIVE_STAY_STATUSES) {
    const match = await ctx.db
      .query("bookings")
      .withIndex("by_userId_and_status", (q) => q.eq("userId", userId).eq("status", status))
      .filter((q) => q.and(q.eq(q.field("serviceId"), serviceId), q.eq(q.field("date"), date)))
      .first();
    if (match) return true;
  }
  return false;
}

export async function confirmAsManager(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  now: number = Date.now()
): Promise<void> {
  if (booking.status !== "pending") throw new ConvexError(BOOKING_ERRORS.NOT_PENDING);
  // Past its expiry the request is dead, even if the hourly job has not marked
  // it yet: a service request expires at its start time, and confirming one
  // after that would promise the traveller something already under way — and,
  // being confirmed and started, it could no longer be cancelled. Same text as
  // "no longer pending", which the app already maps.
  if (booking.expiresAt !== undefined && booking.expiresAt <= now) {
    throw new ConvexError(BOOKING_ERRORS.NOT_PENDING);
  }

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
  // For a service, "completed" is what earns the traveller's review its
  // verified mark and counts as the provider's revenue, so it has to mean the
  // service happened: confirmed, and its start time passed. Completing a
  // request nobody confirmed is support's call, through the admin panel.
  if (
    booking.kind === "service" &&
    (booking.status !== "confirmed" || riyadhDateTimeToTimestamp(booking.date, booking.time) > now)
  ) {
    throw new ConvexError(BOOKING_ERRORS.SERVICE_NOT_STARTED);
  }

  await ctx.db.patch(booking._id, {
    status: "completed",
    completedAt: now,
    notes: notes ?? booking.notes,
    updatedAt: now,
  });
}

export async function markNoShowAsManager(
  ctx: MutationCtx,
  booking: Doc<"bookings">,
  now: number = Date.now()
): Promise<void> {
  // A closed booking is the race a host actually meets: the inbox still shows
  // it confirmed when the guest cancels, or the nightly job completes it. That
  // used to be refused as "not allowed", which no app maps, so the host read
  // "Please try again" and got the same on every retry. "Already closed" is
  // what both apps already explain.
  if (TERMINAL_STATUSES.includes(booking.status as BookingStatus)) {
    throw new ConvexError(BOOKING_ERRORS.ALREADY_CLOSED);
  }
  // A request nobody confirmed promised nothing to miss; no screen offers a
  // no-show on one, so this keeps the refusal it always had.
  if (booking.status !== "confirmed") {
    throw new ConvexError(BOOKING_ERRORS.NOT_AUTHORIZED);
  }

  await ctx.db.patch(booking._id, { status: "no_show", updatedAt: now });
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

  // The same for a service the provider confirmed: from its start time they
  // are at the meeting point, and it is a conversation with them (design
  // D11). A request nobody confirmed promised nothing, so the traveller may
  // always withdraw it — even one whose start time passed before the expiry
  // job got to it.
  if (
    booking.kind === "service" &&
    booking.status === "confirmed" &&
    riyadhDateTimeToTimestamp(booking.date, booking.time) <= now
  ) {
    throw new ConvexError(SERVICE_ERRORS.SERVICE_STARTED);
  }

  await ctx.db.patch(booking._id, {
    status: "cancelled",
    cancellationReason: reason?.trim().slice(0, MAX_NOTES) || undefined,
    updatedAt: now,
  });

  // Stays and services tell whoever was holding the day for them. A legacy
  // slot booking never did, and its 1.0.2 host screens do not expect it.
  if (booking.kind === "stay" || booking.kind === "service") {
    const updated = await ctx.db.get(booking._id);
    if (updated) await notifyBookingEvent(ctx, "booking.cancelled", updated, {}, now);
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
