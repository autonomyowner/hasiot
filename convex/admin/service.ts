import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { logAdminAction, labelFor } from "./activity";
import { isPlaceholderEmail } from "../lib/contact";
import { notifyBookingEvent } from "../notifications/internal";
import {
  BOOKING_STATUSES,
  canTransition,
  TERMINAL_STATUSES,
  type BookingStatus,
} from "../bookings/logic";

/**
 * Admin operations, with the acting admin already resolved.
 *
 * Same reasoning as bookings/service.ts: convex-test cannot reach anything
 * behind requireAdmin, so the rules live here where a test can call them
 * directly and the mutations stay thin.
 */

/** Shape the admin panel's user table renders. */
export function toAdminUserRow(user: Doc<"users">) {
  return {
    _id: user._id,
    email: user.email,
    // The panel shows "signed up by phone" instead of a synthesised address
    // that would look like a real inbox somebody could write to.
    isPlaceholderEmail: isPlaceholderEmail(user.email),
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    phoneVerified: user.phoneVerified ?? false,
    role: user.role ?? "tourist",
    isApproved: user.isApproved,
    isSuspended: user.isSuspended ?? false,
    suspendedReason: user.suspendedReason,
    suspendedAt: user.suspendedAt,
    createdAt: user.createdAt,
  };
}

export async function suspendUserRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  reason: string,
  now: number = Date.now()
): Promise<void> {
  const target = await ctx.db.get(userId);
  if (!target) throw new Error("User not found");

  // Locking yourself out of the panel is unrecoverable without database
  // access, and one admin suspending another is a fight the product should
  // not host.
  if (target._id === admin._id) {
    throw new Error("لا يمكنك إيقاف حسابك. / You cannot suspend your own account.");
  }
  if (target.role === "admin") {
    throw new Error("لا يمكن إيقاف حساب مسؤول. / An admin account cannot be suspended.");
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("سبب الإيقاف مطلوب. / A suspension reason is required.");
  }

  await ctx.db.patch(userId, {
    isSuspended: true,
    suspendedReason: trimmed.slice(0, 500),
    suspendedAt: now,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "user.suspend",
    targetType: "user",
    targetId: userId,
    summary: labelFor(target),
    details: trimmed,
  });
}

export async function unsuspendUserRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  now: number = Date.now()
): Promise<void> {
  const target = await ctx.db.get(userId);
  if (!target) throw new Error("User not found");

  await ctx.db.patch(userId, {
    isSuspended: false,
    suspendedReason: undefined,
    suspendedAt: undefined,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "user.unsuspend",
    targetType: "user",
    targetId: userId,
    summary: labelFor(target),
  });
}

export async function suspendListingRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  reason: string,
  now: number = Date.now()
): Promise<void> {
  const listing = await ctx.db.get(listingId);
  if (!listing) throw new Error("Listing not found");

  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("سبب الإيقاف مطلوب. / A suspension reason is required.");
  }

  // isPublicListing is an allow-list on "approved", so this alone removes the
  // listing from search, the directory and the booking flow.
  await ctx.db.patch(listingId, {
    status: "suspended",
    suspendedReason: trimmed.slice(0, 500),
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "listing.suspend",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
    details: trimmed,
  });
}

export async function reinstateListingRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  now: number = Date.now()
): Promise<void> {
  const listing = await ctx.db.get(listingId);
  if (!listing) throw new Error("Listing not found");
  if (listing.status !== "suspended") {
    throw new Error("هذا المكان ليس موقوفًا. / This listing is not suspended.");
  }

  await ctx.db.patch(listingId, {
    status: "approved",
    suspendedReason: undefined,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "listing.reinstate",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
  });
}

/**
 * Move a booking to any status, as support.
 *
 * Deliberately unconstrained — the whole point of an admin override is fixing
 * a booking that reached a state the normal flow cannot get it out of. What it
 * does insist on is that the status is real, that something actually changes,
 * and that reopening a closed booking is logged as the exceptional act it is.
 */
export async function applyBookingStatusAsAdmin(
  ctx: MutationCtx,
  admin: Doc<"users">,
  args: { bookingId: Id<"bookings">; status: string; reason?: string },
  now: number = Date.now()
): Promise<void> {
  if (!BOOKING_STATUSES.includes(args.status as BookingStatus)) {
    throw new Error("Invalid booking status: " + args.status);
  }

  const booking = await ctx.db.get(args.bookingId);
  if (!booking) throw new Error("Booking not found");

  const from = booking.status as BookingStatus;
  const to = args.status as BookingStatus;
  const transition = canTransition(from, to, "admin");
  if (!transition.allowed) throw new Error(transition.reason);

  const reason = args.reason?.trim().slice(0, 500) || undefined;

  await ctx.db.patch(args.bookingId, {
    status: to,
    ...(to === "confirmed" || to === "declined" ? { respondedAt: now } : {}),
    ...(to === "declined" ? { declineReason: reason ?? booking.declineReason } : {}),
    ...(to === "cancelled" ? { cancellationReason: reason ?? booking.cancellationReason } : {}),
    ...(to === "completed" ? { completedAt: now } : {}),
    updatedAt: now,
  });

  const listing = await ctx.db.get(booking.listingId);
  await logAdminAction(ctx, admin, {
    action: transition.forced ? "booking.force" : `booking.${to}`,
    targetType: "booking",
    targetId: args.bookingId,
    summary: `${labelFor(listing) ?? "booking"} - ${booking.checkIn ?? booking.date}`,
    details: `${from} → ${to}${reason ? ` — ${reason}` : ""}`,
  });

  await notifyAdminBookingChange(ctx, args.bookingId, to, reason, now);
}

/**
 * Tell whoever is affected that support changed their booking.
 *
 * A cancellation reaches both sides, because a host who has blocked a room and
 * a guest who thinks they have one both need to know.
 */
async function notifyAdminBookingChange(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
  status: BookingStatus,
  reason: string | undefined,
  now: number
): Promise<void> {
  const booking = await ctx.db.get(bookingId);
  if (!booking) return;

  if (status === "cancelled") {
    await notifyBookingEvent(ctx, "booking.cancelled_admin", booking, { reason }, now);
    if (booking.ownerId) {
      await notifyBookingEvent(ctx, "booking.cancelled", booking, { reason }, now);
    }
    return;
  }

  if (status === "confirmed" || status === "declined" || status === "expired") {
    await notifyBookingEvent(ctx, `booking.${status}` as const, booking, { reason }, now);
  }
  // completed and no_show are bookkeeping, not news the guest needs pushed.
}

export { TERMINAL_STATUSES };
