import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { isPlaceholderEmail } from "../lib/contact";
import { renderEmail, type NotificationEvent, type TemplateInput } from "./templates";
import { closedAtStart } from "./internal";
import { bookingActionUrl, emailDeliveryOn, publicSiteUrl } from "./links";

/**
 * Fanning a notification out to push and email.
 *
 * Nothing here throws. A booking has already been written and the guest can
 * already see the update in the app; a push token that went stale over the
 * weekend or an email provider having a bad minute must not turn into a failed
 * scheduled function that retries and double-sends.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const RESEND_URL = "https://api.resend.com/emails";

// Events worth an email: everything a guest needs a durable record of, and —
// since hosts and travellers can use the website, where there is no push —
// the two a host must act on or hear about: a new request, which expires
// unanswered after 48 hours, and a cancellation, which frees their dates.
const EMAILED_EVENTS: NotificationEvent[] = [
  "booking.requested",
  "booking.confirmed",
  "booking.declined",
  "booking.expired",
  "booking.cancelled",
  "booking.cancelled_admin",
  "booking.reminder",
];

// A user keeps their newest five devices (users/push.ts); this only bounds
// the read should that ever be bypassed.
const MAX_DEVICES = 10;

/**
 * Booking emails one person may receive in a day. New requests and
 * cancellations email the host, and a traveller may send 30 requests a day
 * and cancel each — so without a cap a handful of cheap accounts could turn
 * one host's inbox into a way to burn the sending domain's reputation. A busy
 * host's real day is far below this; past it, push and the in-app inbox still
 * carry every event.
 */
export const EMAILS_PER_RECIPIENT_PER_DAY = 40;

type Guest = Pick<Doc<"users">, "firstName" | "lastName"> | null | undefined;

/**
 * What an email about a booking says, or null when there is nothing to name —
 * the place or service it was for no longer exists.
 *
 * A service booking is described by its service, its day and its start time,
 * rather than a place and a range of nights. `guest` is the traveller, whose
 * name the host's new-request email opens with, as the push does
 * (internal.ts notifyBookingEvent); without one it reads "A guest".
 */
export function emailInputFor(
  booking: Doc<"bookings"> | null,
  listing: Doc<"listings"> | null,
  service: Doc<"services"> | null,
  guest?: Guest
): TemplateInput | null {
  const reason = booking?.declineReason ?? booking?.cancellationReason;
  const guestName = [guest?.firstName, guest?.lastName].filter(Boolean).join(" ").trim() || undefined;

  if (booking?.kind === "service") {
    if (!service) return null;
    return {
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
      ...(guestName ? { guestName } : {}),
      reason,
      expiredAtStart: closedAtStart(booking),
    };
  }

  if (!listing) return null;
  return {
    listingName_en: listing.name_en,
    listingName_ar: listing.name_ar,
    checkIn: booking?.checkIn ?? booking?.date,
    checkOut: booking?.checkOut,
    nights: booking?.nights,
    guests: booking?.guests ?? booking?.partySize,
    totalAmount: booking?.totalAmount,
    currency: booking?.currency ?? "SAR",
    confirmationCode: booking?.confirmationCode,
    ...(guestName ? { guestName } : {}),
    reason,
    checkInTime: listing.checkInTime,
    address: listing.address,
  };
}

export const loadPayload = internalQuery({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return null;

    const user = await ctx.db.get(notification.userId);
    if (!user) return null;

    const booking = notification.data?.bookingId
      ? await ctx.db.get(notification.data.bookingId)
      : null;
    const listingId = notification.data?.listingId ?? booking?.listingId;
    const serviceId = notification.data?.serviceId ?? booking?.serviceId;
    const listing = listingId ? await ctx.db.get(listingId) : null;
    const service = serviceId ? await ctx.db.get(serviceId) : null;
    // The traveller, for the host's emails: only their name leaves this query.
    const traveller = booking ? await ctx.db.get(booking.userId) : null;

    // The devices come from the pushTokens table, which follows a phone to
    // whoever signed in on it last. users.pushTokens is never written.
    const devices = await ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(MAX_DEVICES);

    return {
      notification,
      user: {
        _id: user._id,
        email: user.email,
        preferredLanguage: user.preferredLanguage === "en" ? ("en" as const) : ("ar" as const),
        pushTokens: devices.map((d) => d.token),
      },
      booking,
      listing,
      service,
      guest: traveller ? { firstName: traveller.firstName, lastName: traveller.lastName } : null,
    };
  },
});

/**
 * Forget devices Expo reported as DeviceNotRegistered: the app was removed,
 * and the token will never work again for anyone, whoever it belonged to.
 */
export const pruneTokens = internalMutation({
  args: { tokens: v.array(v.string()) },
  handler: async (ctx, args) => {
    for (const token of new Set(args.tokens)) {
      const rows = await ctx.db
        .query("pushTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    }
  },
});

export const markDelivered = internalMutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.deliveredAt) return;
    await ctx.db.patch(args.notificationId, { deliveredAt: Date.now() });
  },
});

export const send = internalAction({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args): Promise<void> => {
    const payload = await ctx.runQuery(internal.notifications.deliver.loadPayload, {
      notificationId: args.notificationId,
    });
    if (!payload) return;

    const { notification, user, listing, service, booking, guest } = payload;
    const isArabic = user.preferredLanguage === "ar";

    await sendPush(ctx, {
      tokens: user.pushTokens,
      title: isArabic ? notification.title_ar : notification.title_en,
      body: isArabic ? notification.body_ar : notification.body_en,
      data: notification.data ?? {},
    });

    // A service booking has no listing; it used to be skipped here for that
    // reason alone.
    const baseInput = emailInputFor(booking, listing, service, guest);
    // Rows written before `audience` existed were all to the traveller.
    const audience = notification.data?.audience === "owner" ? "owner" : "tourist";
    const emailInput: TemplateInput | null =
      baseInput && booking
        ? {
            ...baseInput,
            audience,
            actionUrl: bookingActionUrl(audience, booking, publicSiteUrl()),
          }
        : baseInput;
    if (
      EMAILED_EVENTS.includes(notification.type as NotificationEvent) &&
      emailInput !== null &&
      // Phone sign-ups get a synthesised address on a domain that accepts no
      // mail. Sending there is a guaranteed bounce, and bounces are what cost
      // a sending domain its reputation.
      !isPlaceholderEmail(user.email) &&
      // Checked before counting, so a deployment without email writes no
      // rate-limit rows for every booking event.
      emailDeliveryOn()
    ) {
      const quota = await ctx.runMutation(internal.rateLimit.checkAndIncrement, {
        key: `email:${user._id}`,
        limit: EMAILS_PER_RECIPIENT_PER_DAY,
      });
      if (quota.allowed) {
        await sendEmail({
          to: user.email,
          locale: user.preferredLanguage,
          event: notification.type as NotificationEvent,
          input: emailInput,
        });
      } else {
        console.warn(`Booking email skipped: ${user._id} reached ${EMAILS_PER_RECIPIENT_PER_DAY} today`);
      }
    }

    await ctx.runMutation(internal.notifications.deliver.markDelivered, {
      notificationId: args.notificationId,
    });
  },
});

async function sendPush(
  ctx: ActionCtx,
  args: {
    tokens: string[];
    title: string;
    body: string;
    data: Record<string, unknown>;
  }
): Promise<void> {
  if (args.tokens.length === 0) return;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  // Only needed when the Expo project has push security enabled.
  const accessToken = process.env.EXPO_ACCESS_TOKEN;
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(
        args.tokens.map((to) => ({
          to,
          title: args.title,
          body: args.body,
          data: args.data,
          sound: "default",
          // Deliver now rather than when the phone next wakes on its own: a
          // request is answered within hours, and a same-day one expires at
          // its start time.
          priority: "high",
          // The Android channel the app creates at high importance, so the
          // notice shows as a banner. Without one, Android files it silently
          // under a default channel.
          channelId: "default",
        }))
      ),
    });

    if (!res.ok) {
      console.error("Expo push failed:", res.status, await res.text());
      return;
    }

    // Expo answers per-token, in request order. A token belonging to an app
    // that was uninstalled comes back DeviceNotRegistered and will never work
    // again — keeping it means sending into the void on every future event.
    const json = (await res.json()) as {
      data?: Array<{ status?: string; details?: { error?: string } }>;
    };
    const dead = (json.data ?? [])
      .map((entry, index) =>
        entry?.details?.error === "DeviceNotRegistered" ? args.tokens[index] : null
      )
      .filter((token): token is string => token !== null);

    if (dead.length > 0) {
      await ctx.runMutation(internal.notifications.deliver.pruneTokens, { tokens: dead });
    }
  } catch (error) {
    console.error("Expo push error:", error);
  }
}

async function sendEmail(args: {
  to: string;
  locale: "ar" | "en";
  event: NotificationEvent;
  input: Parameters<typeof renderEmail>[1];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return; // Email is optional; the in-app inbox is the source of truth.

  const from = process.env.RESEND_FROM || "Hasio <bookings@hasio.xyz>";
  const { subject, html, text } = renderEmail(args.event, args.input, args.locale);

  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [args.to], subject, html, text }),
    });
    if (!res.ok) {
      console.error("Resend failed:", res.status, await res.text());
    }
  } catch (error) {
    console.error("Resend error:", error);
  }
}
