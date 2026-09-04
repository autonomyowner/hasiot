/**
 * Decisions the booking screens share, kept out of JSX so they are tested
 * once and rendered three times, rather than written three times.
 *
 * `t` is passed in rather than imported: these run under plain Node in tests,
 * where the language hook does not exist.
 */

type Translate = (key: "night" | "nights" | "guests") => string;

/** "3 nights · 2 guests" — the second half only when there is a count. */
export function nightsLabel(nights: number, t: Translate, guests?: number): string {
  const base = `${nights} ${nights === 1 ? t("night") : t("nights")}`;
  return guests ? `${base} · ${guests} ${t("guests")}` : base;
}

export type QuoteResult =
  | { ok: true; available: boolean; quote: { nights: number; pricePerNight: number; totalAmount: number } }
  | { ok: false; error: string };

export type LastGoodQuote = { nights: number; pricePerNight: number; totalAmount: number };

export type QuoteFooterState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "error"; message: string }
  | ({ kind: "total"; stale: boolean } & LastGoodQuote);

/**
 * What the pinned footer shows.
 *
 * The one rule worth the function: while a *re*-quote is in flight (the guest
 * bumped the guest count, or moved check-out by a day) keep the previous
 * total on screen, flagged stale, instead of collapsing to a spinner. The
 * number changes in place when the new one lands; the footer never jumps.
 */
export function quoteFooterState(input: {
  checkIn: string | null;
  checkOut: string | null;
  quote: QuoteResult | undefined;
  lastGood: LastGoodQuote | null;
}): QuoteFooterState {
  const { checkIn, checkOut, quote, lastGood } = input;
  if (!checkIn || !checkOut) return { kind: "idle" };

  if (quote === undefined) {
    return lastGood ? { kind: "total", stale: true, ...lastGood } : { kind: "loading" };
  }
  if (!quote.ok) return { kind: "error", message: quote.error };
  if (!quote.available) return { kind: "unavailable" };

  return { kind: "total", stale: false, ...quote.quote };
}

export type HostActionSet = "decide" | "close" | "none";

/**
 * Which pair of buttons a host card shows.
 *
 * "decide" is confirm/decline on a pending request. "close" is no-show /
 * completed, offered only once the arrival date is reached — marking someone
 * a no-show before they are due makes no sense. Mirrors the transitions in
 * convex/bookings/logic.ts; the server still has the last word.
 */
export function hostActionsFor(
  booking: { status: string; checkIn?: string; date?: string },
  todayISO: string
): HostActionSet {
  if (booking.status === "pending") return "decide";
  if (booking.status !== "confirmed") return "none";
  const arrival = booking.checkIn ?? booking.date;
  return arrival !== undefined && arrival <= todayISO ? "close" : "none";
}

/**
 * Where tapping a notification should land.
 *
 * Lives here rather than in a push module because it is pure routing and the
 * in-app inbox needs it whether or not push exists — push is only how a
 * notification reaches someone who is not already looking at the app.
 */
export function routeForNotificationData(
  data: { bookingId?: string; audience?: string } | undefined,
  isHost: boolean
): string {
  if (data?.audience === "owner" && isHost) return "/business/bookings";
  if (data?.bookingId) return `/bookings/${data.bookingId}`;
  return "/notifications";
}
