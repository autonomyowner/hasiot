import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { isPlaceholderEmail } from "../lib/contact";
import { renderEmail, type NotificationEvent } from "./templates";

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

// Events worth an email. A host watching their inbox for new requests gets
// those in-app and by push; email is reserved for the things a guest needs a
// durable record of, or needs to see when the app is not open.
const EMAILED_EVENTS: NotificationEvent[] = [
  "booking.confirmed",
  "booking.declined",
  "booking.expired",
  "booking.cancelled_admin",
  "booking.reminder",
];

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
    const listing = notification.data?.listingId
      ? await ctx.db.get(notification.data.listingId)
      : null;

    return {
      notification,
      user: {
        _id: user._id,
        email: user.email,
        preferredLanguage: user.preferredLanguage === "en" ? ("en" as const) : ("ar" as const),
        pushTokens: user.pushTokens ?? [],
      },
      booking,
      listing,
    };
  },
});

export const pruneTokens = internalMutation({
  args: { userId: v.id("users"), tokens: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user?.pushTokens?.length) return;

    const dead = new Set(args.tokens);
    const kept = user.pushTokens.filter((token) => !dead.has(token));
    if (kept.length === user.pushTokens.length) return;

    await ctx.db.patch(args.userId, { pushTokens: kept, updatedAt: Date.now() });
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

    const { notification, user, listing, booking } = payload;
    const isArabic = user.preferredLanguage === "ar";

    await sendPush(ctx, {
      userId: user._id,
      tokens: user.pushTokens,
      title: isArabic ? notification.title_ar : notification.title_en,
      body: isArabic ? notification.body_ar : notification.body_en,
      data: notification.data ?? {},
    });

    if (
      EMAILED_EVENTS.includes(notification.type as NotificationEvent) &&
      listing !== null &&
      // Phone sign-ups get a synthesised address on a domain that accepts no
      // mail. Sending there is a guaranteed bounce, and bounces are what cost
      // a sending domain its reputation.
      !isPlaceholderEmail(user.email)
    ) {
      await sendEmail({
        to: user.email,
        locale: user.preferredLanguage,
        event: notification.type as NotificationEvent,
        input: {
          listingName_en: listing.name_en,
          listingName_ar: listing.name_ar,
          checkIn: booking?.checkIn ?? booking?.date,
          checkOut: booking?.checkOut,
          nights: booking?.nights,
          guests: booking?.guests ?? booking?.partySize,
          totalAmount: booking?.totalAmount,
          currency: booking?.currency ?? "SAR",
          confirmationCode: booking?.confirmationCode,
          reason: booking?.declineReason ?? booking?.cancellationReason,
          checkInTime: listing.checkInTime,
          address: listing.address,
        },
      });
    }

    await ctx.runMutation(internal.notifications.deliver.markDelivered, {
      notificationId: args.notificationId,
    });
  },
});

async function sendPush(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
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
      await ctx.runMutation(internal.notifications.deliver.pruneTokens, {
        userId: args.userId,
        tokens: dead,
      });
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
