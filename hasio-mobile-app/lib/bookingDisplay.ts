/**
 * Decisions the booking screens share, kept out of JSX so they are tested
 * once and rendered three times, rather than written three times.
 *
 * `t` is passed in rather than imported: these run under plain Node in tests,
 * where the language hook does not exist.
 */

import { convertFromSar, SAR_PER_USD, type Currency } from "./currency";
import { toLatinDigits } from "./digits";

/** What the app counts in words. */
export type CountUnit = "nights" | "guests" | "reviews" | "stars";

/**
 * The form a count takes.
 *
 * English needs two, and the translations say "2 nights" for both Two and
 * Few. Arabic needs four, and a number glued to one noun gets three of them
 * wrong: one is a word ("ليلة واحدة"), two is the dual ("ليلتان"), three to ten
 * take the plural ("3 ليالٍ"), and from eleven the noun goes back to the
 * singular ("11 ليلة"). The app used to write "{n} ليالٍ" for every stay, and
 * "2 الضيوف" — "2 the guests" — on the guest stepper.
 */
export type PluralForm = "One" | "Two" | "Few" | "Many";

/** One form of one unit, e.g. `nightsFew` — a key in `constants/translations`. */
export type CountKey = `${CountUnit}${PluralForm}`;

type CountTranslate = (key: CountKey) => string;

export function pluralForm(n: number): PluralForm {
  if (n === 1) return "One";
  if (n === 2) return "Two";
  if (n >= 3 && n <= 10) return "Few";
  return "Many";
}

/**
 * A count in words: "1 night", "ليلتان", "11 ضيفًا". The digits stay Latin in
 * Arabic, like every other number the app shows beside prices and codes.
 */
export function countLabel(n: number, unit: CountUnit, t: CountTranslate): string {
  const key = `${unit}${pluralForm(n)}` as const;
  return t(key).replace("{n}", String(n));
}

/** "3 nights · 2 guests" — the second half only when there is a count. */
export function nightsLabel(nights: number, t: CountTranslate, guests?: number): string {
  const stay = countLabel(nights, "nights", t);
  return guests ? `${stay} · ${countLabel(guests, "guests", t)}` : stay;
}

/**
 * A `tel:` link any dialer will take, for a listing's or a guest's number.
 *
 * Stored numbers carry spaces, dashes and brackets ("+966 50 123 4567"),
 * which iOS forgives inside a `tel:` URL and some Android dialers do not; and a
 * number typed on an Arabic keypad arrives in Arabic-Indic digits, which no
 * dialer reads. Only the digits and a leading plus are kept.
 */
export function telUrl(phone: string): string {
  return `tel:${toLatinDigits(phone).replace(/[^\d+]/g, "")}`;
}

/** What a stay's total is made of, as stored on a quote or a booking. */
export type StayTotal = { totalAmount: number; nights?: number; pricePerNight?: number };

/**
 * The riyal amount to hand the display formatter for a stay's total, so the
 * total agrees with "nights × the nightly rate" as the guest reads them.
 *
 * Prices are stored in riyals and converted only for display, each rounded
 * to a whole dollar. Converting the rate and the total separately showed
 * "3 × $127" beside "$380" — 1,425 SAR is $380, but three of the $127 the
 * guest was shown make $381 — a sum that visibly does not add up. In dollars
 * the total is therefore the product of the rate as shown, handed back in
 * riyals so the one formatter still renders it; in riyals nothing is rounded
 * and the stored total is returned as it is. Every screen that shows a stay's
 * total goes through this, so the quote, the list and the booking agree.
 */
export function displayTotalSar(stay: StayTotal, currency: Currency): number {
  const { totalAmount, nights, pricePerNight } = stay;
  if (currency !== "USD" || !nights || !pricePerNight) return totalAmount;
  return nights * convertFromSar(pricePerNight, "USD") * SAR_PER_USD;
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

/** What the booking lists sort and split on. */
export type StayDates = { status: string; date: string; checkIn?: string; checkOut?: string };

/** The first day of a stay, or a slot booking's date. */
const startOf = (b: StayDates) => b.checkIn ?? b.date;
/** The day a stay ends (check-out is exclusive), or a slot booking's date. */
const endOf = (b: StayDates) => b.checkOut ?? b.date;
// ISO days compare as strings.
const soonestFirst = (a: StayDates, b: StayDates) =>
  startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0;
const latestFirst = (a: StayDates, b: StayDates) => soonestFirst(b, a);

/**
 * A guest's bookings, split the way "My bookings" shows them.
 *
 * Upcoming is every request or confirmed stay the guest has not checked out
 * of yet — on the middle night they are still living it — soonest first,
 * since the next arrival is what they open the list for. Past is everything
 * else, most recent stay first. Both used to keep the server's order, newest
 * made first.
 */
export function partitionGuestBookings<T extends StayDates>(
  bookings: readonly T[],
  todayISO: string
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const booking of bookings) {
    const open = booking.status === "pending" || booking.status === "confirmed";
    (open && endOf(booking) >= todayISO ? upcoming : past).push(booking);
  }
  upcoming.sort(soonestFirst);
  past.sort(latestFirst);
  return { upcoming, past };
}

/**
 * A host's inbox, split into its three tabs.
 *
 * Requests and upcoming stays are soonest first — the nearest arrival is the
 * one to act on — and past ones most recent first. The server returns
 * bookings newest-made first, which put a request made today for next spring
 * above one arriving tomorrow.
 */
export function partitionHostBookings<T extends StayDates>(
  bookings: readonly T[],
  todayISO: string
): { requests: T[]; upcoming: T[]; past: T[] } {
  const requests: T[] = [];
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const booking of bookings) {
    if (booking.status === "pending") requests.push(booking);
    else if (booking.status === "confirmed" && endOf(booking) >= todayISO) upcoming.push(booking);
    else past.push(booking);
  }
  requests.sort(soonestFirst);
  upcoming.sort(soonestFirst);
  past.sort(latestFirst);
  return { requests, upcoming, past };
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
