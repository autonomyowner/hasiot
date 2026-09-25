/**
 * Where tapping a notification lands — the same answer for a row in the
 * in-app inbox and for a push notification, because both carry the same
 * `data` (convex/notifications/internal.ts writes it once, and delivery sends
 * it on unchanged).
 *
 * Pure, so it runs under plain Node in the tests. The inbox screen and the
 * push tap handler in the root layout both go through it.
 */

/** What the router reads from a notification's data. */
export type NotificationData = {
  target?: string;
  bookingId?: string;
  audience?: string;
};

/**
 * The route for a notification, or `null` when there is nowhere better to go
 * than where the person already is.
 *
 * From 1.1.0 the server says where a tap lands (`data.target`). The role is
 * only needed for `verification`, the one target with a screen per account
 * type — and for rows written before 1.1.0, which carry no target: those fall
 * back to the rule the inbox used then (an owner's booking event opens the
 * inbox, anything else with a booking opens the booking), except that a
 * provider is sent to the provider inbox rather than the host one. That rule
 * used to ask only "is this a business owner?", so a provider's request was
 * opened as a booking detail they could not act on.
 *
 * A target this version does not know is treated like a missing one, so a
 * later server can add targets without an old app tapping into nowhere.
 */
export function routeForNotification(
  data: NotificationData | undefined,
  role: string | undefined
): string | null {
  const bookingRoute = data?.bookingId ? `/bookings/${data.bookingId}` : null;

  switch (data?.target) {
    case "booking":
      return bookingRoute;
    case "host-inbox":
      return "/business/bookings";
    case "provider-inbox":
      return "/provider/bookings";
    case "my-listings":
      return "/business/my-listings";
    case "my-services":
      return "/provider/my-services";
    case "verification":
      if (role === "business_owner") return "/business/verification";
      if (role === "service_provider") return "/provider/verification";
      return null;
  }

  if (data?.audience === "owner") {
    if (role === "business_owner") return "/business/bookings";
    if (role === "service_provider") return "/provider/bookings";
  }
  return bookingRoute;
}

const ROUTED_FIELDS = ["target", "bookingId", "audience"] as const;

/**
 * The routing fields of a push notification's data, whatever shape it came in.
 *
 * A push arrives as `Record<string, unknown>` — nothing guarantees a field is
 * a string — and some delivery paths hand the payload over as JSON text under
 * `dataString` instead of as an object. Only strings are kept, so the router
 * never builds a route out of a number or an object.
 */
export function notificationDataOf(raw: unknown): NotificationData | undefined {
  if (!raw || typeof raw !== "object") return undefined;

  let source = raw as Record<string, unknown>;
  if (typeof source.dataString === "string") {
    try {
      const parsed: unknown = JSON.parse(source.dataString);
      source = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      source = {};
    }
  }

  const data: NotificationData = {};
  for (const field of ROUTED_FIELDS) {
    const value = source[field];
    if (typeof value === "string" && value.length > 0) data[field] = value;
  }
  return data;
}
