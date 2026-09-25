/**
 * Decisions the booking screens share, kept out of JSX so they are tested
 * once and rendered three times, rather than written three times.
 *
 * `t` is passed in rather than imported: these run under plain Node in tests,
 * where the language hook does not exist.
 */

import type { TranslationKey } from "@/constants/translations";
import type { Language } from "@/types";
import { getBookingErrorKey } from "./bookingError";
import { convertFromSar, SAR_PER_USD, type Currency } from "./currency";
import { formatISODate, todayRiyadhISO } from "./dates";
import { toLatinDigits } from "./digits";
import { serverErrorText } from "./serverError";

/**
 * What the app counts in words. Hours, days and people are a service
 * booking's: its hours or days when it is priced by them, and its group.
 */
export type CountUnit =
  | "nights"
  | "guests"
  | "reviews"
  | "stars"
  | "hours"
  | "days"
  | "people";

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

/** The fields a service booking's second line is written from. */
export type ServiceAmount = {
  priceUnit?: string;
  quantity?: number;
  partySize?: number;
  guests?: number;
};

/**
 * "3 hours · 4 people" — a service booking's line under its day, as a stay has
 * "3 nights · 2 guests".
 *
 * The hours or days only when the service is priced by them. A fixed-price
 * tour or a price per event is booked once: the server stores a quantity of 1
 * for it, and "1 hour" under a tour that is not sold by the hour would be
 * wrong. Then the group, which a row may carry as `partySize` or `guests` (the
 * server writes both). Empty when there is nothing to count.
 */
export function serviceAmountLabel(booking: ServiceAmount, t: CountTranslate): string {
  const parts: string[] = [];
  const { quantity, priceUnit } = booking;
  if (quantity && priceUnit === "per_hour") parts.push(countLabel(quantity, "hours", t));
  if (quantity && priceUnit === "per_day") parts.push(countLabel(quantity, "days", t));
  const people = booking.partySize ?? booking.guests;
  if (people) parts.push(countLabel(people, "people", t));
  return parts.join(" · ");
}

/**
 * The clock, floored to the minute.
 *
 * What a booking screen reads in render to decide what is still ahead: a
 * value that stays the same across the renders of one minute, so the lists
 * memoised on it are not recomputed on every keystroke or busy flag. The
 * screens call this rather than `Date.now()` for the same reason they call
 * todayRiyadhISO(): the clock is read in one place, and a test passes it.
 */
export function minuteNow(now: number = Date.now()): number {
  return Math.floor(now / 60_000) * 60_000;
}

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * A booking's day and start time as a moment, on the Riyadh clock.
 *
 * Every booking day and start time is Riyadh wall-clock time (UTC+3, no
 * daylight saving), whatever zone the phone is in — and the app ships to
 * Australia and Algeria as well as the Gulf. `new Date("2026-09-10T19:00")`
 * reads it in the phone's zone instead, which would move a Sydney traveller's
 * 19:00 tour seven hours earlier than it is. The same sum as the server's
 * riyadhDateTimeToTimestamp (convex/lib/dates.ts), so a booking goes to Past at
 * the moment the server stops letting it be cancelled. NaN when either part is
 * malformed, which compares false with everything.
 */
export function riyadhMoment(date: string, time: string): number {
  const day = ISO_DAY.exec(date);
  const clock = HH_MM.exec(time);
  if (!day || !clock) return NaN;
  return (
    Date.UTC(
      Number(day[1]),
      Number(day[2]) - 1,
      Number(day[3]),
      Number(clock[1]),
      Number(clock[2])
    ) - RIYADH_OFFSET_MS
  );
}

/**
 * "10 Sep at 19:00" — a service booking's day and its start time. The time is
 * the stored "HH:MM" as it is, never parsed into a Date (see riyadhMoment).
 */
export function serviceWhen(
  date: string,
  time: string,
  language: Language,
  t: (key: "dateAtTime") => string
): string {
  return t("dateAtTime").replace("{date}", formatISODate(date, language)).replace("{time}", time);
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

/** The money fields a stay or a service booking row carries. */
export type BookingMoney = {
  kind?: string;
  totalAmount: number;
  nights?: number;
  pricePerNight?: number;
  quantity?: number;
  unitPrice?: number;
};

/**
 * What displayTotalSar needs, for a booking of either kind.
 *
 * A service's hours or days stand where a stay's nights do, and its unit price
 * where the nightly rate does, so a service total in dollars is the product of
 * the rate as shown — SAR 125 an hour is $33, and three hours are $99, not the
 * $100 that 375 SAR converts to on its own. A fixed price has a quantity of 1,
 * where the two agree anyway.
 */
export function totalShownFor(booking: BookingMoney): StayTotal {
  if (booking.kind === "service") {
    return {
      totalAmount: booking.totalAmount,
      nights: booking.quantity,
      pricePerNight: booking.unitPrice,
    };
  }
  return {
    totalAmount: booking.totalAmount,
    nights: booking.nights,
    pricePerNight: booking.pricePerNight,
  };
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

/**
 * A row of any kind — a stay, a legacy slot, or a service — with the time it
 * begins: a stay's check-in time, a slot's time, a service's start time.
 */
export type BookingTiming = StayDates & { kind?: string; time?: string };

/** The first day of a stay, or a slot booking's date. */
const startOf = (b: StayDates) => b.checkIn ?? b.date;
/** The day a stay ends (check-out is exclusive), or a slot booking's date. */
const endOf = (b: StayDates) => b.checkOut ?? b.date;
// ISO days compare as strings.
const soonestFirst = (a: StayDates, b: StayDates) =>
  startOf(a) < startOf(b) ? -1 : startOf(a) > startOf(b) ? 1 : 0;
const latestFirst = (a: StayDates, b: StayDates) => soonestFirst(b, a);

/**
 * "YYYY-MM-DD HH:MM": the day a booking begins, then its time. It sorts as a
 * string, and it orders a service at 09:00 before a stay checking in at 15:00
 * on the same day, which comparing days alone left to the server's order.
 */
const beginsAt = (b: BookingTiming) => `${startOf(b)} ${b.time ?? ""}`;
const earliestFirst = (a: BookingTiming, b: BookingTiming) =>
  beginsAt(a) < beginsAt(b) ? -1 : beginsAt(a) > beginsAt(b) ? 1 : 0;
const mostRecentFirst = (a: BookingTiming, b: BookingTiming) => earliestFirst(b, a);

const isOpen = (b: StayDates) => b.status === "pending" || b.status === "confirmed";

/**
 * A guest's bookings, split the way "My bookings" shows them.
 *
 * Upcoming is every request or confirmed stay the guest has not checked out
 * of yet — on the middle night they are still living it — and every request
 * or confirmed service that has not started. A service is decided by its
 * start, on the Riyadh clock, not by its day: from the start it can no longer
 * be cancelled (the server refuses it), the provider is at the meeting point,
 * and it is under way or over. Soonest first, since the next thing ahead is
 * what the guest opens the list for; past most recent first. Both used to
 * keep the server's order, newest made first.
 *
 * `now` is the clock, passed in; "today" is its Riyadh date.
 */
export function partitionGuestBookings<T extends BookingTiming>(
  bookings: readonly T[],
  now: number
): { upcoming: T[]; past: T[] } {
  const today = todayRiyadhISO(now);
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const booking of bookings) {
    const ahead =
      booking.kind === "service"
        ? riyadhMoment(booking.date, booking.time ?? "") > now
        : endOf(booking) >= today;
    (isOpen(booking) && ahead ? upcoming : past).push(booking);
  }
  upcoming.sort(earliestFirst);
  past.sort(mostRecentFirst);
  return { upcoming, past };
}

/**
 * Whether the guest is offered Cancel.
 *
 * Only while the booking is open and has not begun. A stay can be cancelled
 * until its check-in day: from then the room was held and the night may be
 * owed, which is a conversation with the host. A service until its start
 * time on the Riyadh clock (design D11): from then the server refuses
 * (SERVICE_STARTED) and the provider is already at the meeting point. A
 * request nobody answered before its start is closing anyway — it expires at
 * the start — so it is not offered either. The screen adds the other half of
 * the rule: only the guest who made the booking may cancel it.
 */
export function guestCanCancel(booking: BookingTiming, now: number): boolean {
  if (!isOpen(booking)) return false;
  if (booking.kind === "service") return riyadhMoment(booking.date, booking.time ?? "") > now;
  return startOf(booking) > todayRiyadhISO(now);
}

/** A service booking as the provider's inbox reads it. */
export type ProviderTiming = BookingTiming & { expiresAt?: number };

/**
 * A request the provider can still answer. A service request expires at its
 * start time if that comes before the usual 48 hours, and the server refuses
 * to confirm one past its expiry even while the hourly job has not yet marked
 * it — so offering Confirm on it would only earn an error.
 */
const isLiveRequest = (b: ProviderTiming, now: number) =>
  b.status === "pending" && (b.expiresAt === undefined || b.expiresAt > now);

/**
 * A provider's inbox, split into its three tabs.
 *
 * Requests are the ones still alive; a request past its expiry is already
 * past, whatever the hourly job has had time to write on it. Upcoming is
 * confirmed work that has not ended — until the morning after the last day
 * (checkOut is exclusive), when the 04:00 job completes it — the same rule as
 * the dashboard's count (getProviderStats), so the tab and the tile agree.
 * Requests and upcoming soonest start first; past most recent first.
 */
export function partitionProviderBookings<T extends ProviderTiming>(
  bookings: readonly T[],
  now: number
): { requests: T[]; upcoming: T[]; past: T[] } {
  const today = todayRiyadhISO(now);
  const requests: T[] = [];
  const upcoming: T[] = [];
  const past: T[] = [];
  for (const booking of bookings) {
    if (isLiveRequest(booking, now)) requests.push(booking);
    else if (booking.status === "confirmed" && endOf(booking) >= today) upcoming.push(booking);
    else past.push(booking);
  }
  requests.sort(earliestFirst);
  upcoming.sort(earliestFirst);
  past.sort(mostRecentFirst);
  return { requests, upcoming, past };
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
 * Which pair of buttons a provider's card shows on a service booking.
 *
 * As hostActionsFor, with two differences a service needs. No-show and
 * completed come with the start time, not the start of the day: at 10:00 a
 * provider cannot know whether a 19:00 guest will turn up. And a request past
 * its expiry offers nothing — the server would refuse the confirm, and the
 * hourly job is about to close it and tell the guest.
 */
export function providerActionsFor(
  booking: { status: string; date: string; time: string; expiresAt?: number },
  now: number
): HostActionSet {
  if (booking.status === "pending") {
    return booking.expiresAt !== undefined && booking.expiresAt <= now ? "none" : "decide";
  }
  if (booking.status !== "confirmed") return "none";
  return riyadhMoment(booking.date, booking.time) <= now ? "close" : "none";
}

/**
 * The copy for a refused booking action — cancel, confirm, decline, complete,
 * no-show — in the words of the booking's own kind.
 *
 * getBookingErrorKey reads the English half of the server's refusal, and
 * predates what is settled here. The server now has two sign-in refusals:
 * the booking mutations' English-only "Not authenticated" and the newer
 * "… / You need to be signed in.", and both mean the session is gone. A
 * service that has started is refused in the provider's words, which the
 * stay's copy ("Contact the host") would misname. And a service is completed
 * only once it is confirmed and has started (SERVICE_NOT_STARTED) — the
 * provider's buttons follow the same rule (providerActionsFor), so this is
 * the server's word on a tap made just before the start time.
 */
export function bookingActionErrorKey(error: unknown, kind?: string): TranslationKey {
  const message = serverErrorText(error);
  if (/You need to be signed in/i.test(message)) return "errorSessionExpired";
  if (/only be completed once it is confirmed and has started/i.test(message)) {
    return "errorServiceNotStarted";
  }
  const key = getBookingErrorKey(error);
  return kind === "service" && key === "errorStayStarted" ? "errorServiceStarted" : key;
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
