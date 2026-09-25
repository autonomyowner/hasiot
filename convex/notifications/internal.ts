import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { PENDING_TTL_MS } from "../bookings/logic";
import {
  renderAccountNotification,
  renderNotification,
  type AccountEvent,
  type NotificationEvent,
  type TemplateInput,
} from "./templates";

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

/** Where a tap on the notification lands in the app (lib/notificationRoute.ts). */
export type NotificationTarget =
  | "booking"
  | "host-inbox"
  | "provider-inbox"
  | "my-listings"
  | "my-services"
  | "verification";

type NotifyArgs = {
  userId: Id<"users">;
  type: NotificationEvent | AccountEvent;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  data?: {
    bookingId?: Id<"bookings">;
    listingId?: Id<"listings">;
    serviceId?: Id<"services">;
    audience?: "owner" | "tourist";
    target?: NotificationTarget;
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

  const guest = await ctx.db.get(booking.userId);
  const guestName = [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim();
  const reason = extra.reason ?? booking.declineReason ?? booking.cancellationReason;

  let input: TemplateInput;
  if (booking.serviceId) {
    const service = await ctx.db.get(booking.serviceId);
    if (!service) return;
    input = {
      kind: "service",
      listingName_en: service.title_en,
      listingName_ar: service.title_ar,
      checkIn: booking.date,
      startTime: booking.time,
      quantity: booking.quantity,
      priceUnit: booking.priceUnit,
      guests: booking.partySize ?? booking.guests,
      totalAmount: booking.totalAmount,
      currency: booking.currency ?? "SAR",
      confirmationCode: booking.confirmationCode,
      guestName: guestName || undefined,
      reason,
      expiredAtStart: closedAtStart(booking),
    };
  } else {
    const listing = booking.listingId ? await ctx.db.get(booking.listingId) : null;
    if (!listing) return;
    input = {
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
      reason,
      checkInTime: listing.checkInTime,
      address: listing.address,
    };
  }

  const target: NotificationTarget =
    audience === "tourist" ? "booking" : booking.serviceId ? "provider-inbox" : "host-inbox";

  await notify(
    ctx,
    {
      userId: recipientId,
      type: event,
      ...renderNotification(event, input),
      data: {
        bookingId: booking._id,
        listingId: booking.listingId,
        serviceId: booking.serviceId,
        audience,
        target,
      },
    },
    now
  );
}

/**
 * Whether a service request's deadline was its start time rather than the
 * usual 48 hours (createServiceForUser takes the earlier of the two), so the
 * expiry notice can say "before the start time" truthfully.
 */
export function closedAtStart(booking: Pick<Doc<"bookings">, "expiresAt" | "createdAt">): boolean {
  return booking.expiresAt !== undefined && booking.expiresAt < booking.createdAt + PENDING_TTL_MS;
}

/** Fall back to the listing or service when a booking predates the denormalised ownerId. */
async function ownerOf(ctx: MutationCtx, booking: Doc<"bookings">): Promise<Id<"users"> | undefined> {
  if (booking.serviceId) return (await ctx.db.get(booking.serviceId))?.ownerId;
  if (booking.listingId) return (await ctx.db.get(booking.listingId))?.ownerId;
  return undefined;
}

/**
 * Tell an owner that their listing, service or account was approved, turned
 * down or taken down. Written in the same transaction as the admin's action,
 * like every notification, so it exists exactly when the change does.
 */
export async function notifyUserEvent(
  ctx: MutationCtx,
  event: AccountEvent,
  input: {
    userId: Id<"users">;
    name_en?: string;
    name_ar?: string;
    reason?: string;
    listingId?: Id<"listings">;
    serviceId?: Id<"services">;
  },
  now: number = Date.now()
): Promise<void> {
  const target: NotificationTarget = event.startsWith("listing.")
    ? "my-listings"
    : event.startsWith("service.")
      ? "my-services"
      : "verification";

  await notify(
    ctx,
    {
      userId: input.userId,
      type: event,
      ...renderAccountNotification(event, {
        name_en: input.name_en,
        name_ar: input.name_ar,
        reason: input.reason?.trim() || undefined,
      }),
      data: { listingId: input.listingId, serviceId: input.serviceId, target },
    },
    now
  );
}
