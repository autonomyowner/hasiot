import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { renderNotification, type NotificationEvent, type TemplateInput } from "./templates";

/**
 * Writing notifications.
 *
 * The inbox row is inserted in the same transaction as the booking change that
 * caused it, and delivery (push, email) is scheduled afterwards. That ordering
 * is the point: if the transaction rolls back there is no notification, and if
 * delivery fails the guest still sees the update in the app. A notification
 * that promised something the database never recorded would be worse than no
 * notification at all.
 */

type NotifyArgs = {
  userId: Id<"users">;
  type: NotificationEvent;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  data?: {
    bookingId?: Id<"bookings">;
    listingId?: Id<"listings">;
    audience?: "owner" | "tourist";
  };
};

export async function notify(
  ctx: MutationCtx,
  args: NotifyArgs,
  now: number = Date.now()
): Promise<Id<"notifications">> {
  const notificationId = await ctx.db.insert("notifications", {
    ...args,
    createdAt: now,
  });

  // runAfter(0) rather than an inline call: delivery talks to Expo and Resend
  // over the network, and a mutation cannot do that. It also means a slow or
  // failing provider never holds up the booking write.
  await ctx.scheduler.runAfter(0, internal.notifications.deliver.send, { notificationId });

  return notificationId;
}

/** Who hears about each kind of event. */
const AUDIENCE: Record<NotificationEvent, "owner" | "tourist"> = {
  "booking.requested": "owner",
  "booking.cancelled": "owner",
  "booking.confirmed": "tourist",
  "booking.declined": "tourist",
  "booking.expired": "tourist",
  "booking.cancelled_admin": "tourist",
  "booking.reminder": "tourist",
};

/**
 * Render and send the notification for a booking event.
 *
 * Silently does nothing when there is no recipient — the seeded Al-Ahsa
 * listings have no owner, so a booking against one has nobody to notify. That
 * is a normal state for demo data, not an error worth failing a booking over.
 */
export async function notifyBookingEvent(
  ctx: MutationCtx,
  event: NotificationEvent,
  booking: Doc<"bookings">,
  extra: { reason?: string } = {},
  now: number = Date.now()
): Promise<void> {
  const audience = AUDIENCE[event];
  const recipientId =
    audience === "owner" ? (booking.ownerId ?? (await ownerOf(ctx, booking))) : booking.userId;
  if (!recipientId) return;

  const listing = await ctx.db.get(booking.listingId);
  if (!listing) return;

  const guest = await ctx.db.get(booking.userId);
  const guestName = [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim();

  const input: TemplateInput = {
    listingName_en: listing.name_en,
    listingName_ar: listing.name_ar,
    checkIn: booking.checkIn ?? booking.date,
    checkOut: booking.checkOut,
    nights: booking.nights,
    guests: booking.guests ?? booking.partySize,
    totalAmount: booking.totalAmount,
    currency: booking.currency ?? "SAR",
    confirmationCode: booking.confirmationCode,
    guestName: guestName || undefined,
    reason: extra.reason ?? booking.declineReason ?? booking.cancellationReason,
    checkInTime: listing.checkInTime,
    address: listing.address,
  };

  await notify(
    ctx,
    {
      userId: recipientId,
      type: event,
      ...renderNotification(event, input),
      data: { bookingId: booking._id, listingId: booking.listingId, audience },
    },
    now
  );
}

/** Fall back to the listing when a booking predates the denormalised ownerId. */
async function ownerOf(ctx: MutationCtx, booking: Doc<"bookings">): Promise<Id<"users"> | undefined> {
  const listing = await ctx.db.get(booking.listingId);
  return listing?.ownerId;
}
