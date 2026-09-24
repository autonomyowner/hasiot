/**
 * Date helpers for the app side.
 *
 * A near-twin of convex/lib/dates.ts, and deliberately so: the calendar has to
 * disable the same days the server would reject, and "today" has to mean the
 * same thing on both sides. A guest in London booking an Al-Ahsa hotel picks
 * dates in Saudi time, not their own — anything else lets them select a day
 * the server then refuses.
 *
 * Saudi Arabia has observed UTC+3 with no DST since 1990.
 */

import type { Language } from "@/types";

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

export function todayRiyadhISO(now: number = Date.now()): string {
  return new Date(now + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const ts = Date.parse(`${iso}T00:00:00Z`);
  return new Date(ts + days * 86_400_000).toISOString().slice(0, 10);
}

/** Nights between two dates. Check-out is exclusive: 10th → 13th is 3 nights. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000
  );
}

/** Every date from checkIn up to (not including) checkOut. */
export function datesBetween(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  for (let cursor = checkIn; cursor < checkOut; cursor = addDays(cursor, 1)) {
    out.push(cursor);
  }
  return out;
}

/**
 * The locale Arabic dates are written in: Saudi Arabic, on the Gregorian
 * calendar, with Latin digits.
 *
 * Gregorian, because `ar-SA` on its own is the Umm al-Qura (Hijri) calendar in
 * ICU's locale data, while the booking calendar the guest picks from is
 * Gregorian ("سبتمبر") and so are the server's dates — a stay picked as 10–13
 * September came back in the range card as its Hijri dates. Latin digits,
 * because the app sets dates beside prices, confirmation codes and phone
 * numbers, all Latin, and Arabic-Indic numerals next to them read as a
 * different alphabet mid-line.
 */
const AR_DATE_LOCALE = "ar-SA-u-ca-gregory-nu-latn";

const dateLocale = (language: Language) => (language === "ar" ? AR_DATE_LOCALE : "en-GB");

/**
 * "2026-09-10" → "10 Sep". `timeZone: "UTC"` keeps the parsed midnight from
 * drifting back a day.
 */
export function formatISODate(iso: string, language: Language): string {
  try {
    return new Intl.DateTimeFormat(dateLocale(language), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    // Hermes ships a trimmed ICU on some Android builds; a raw date beats a crash.
    return iso;
  }
}

/** A moment as its month and year — "Sep 2026", "سبتمبر 2026" — for reviews. */
export function formatMonthYear(ts: number, language: Language): string {
  try {
    return new Intl.DateTimeFormat(dateLocale(language), {
      year: "numeric",
      month: "short",
    }).format(new Date(ts));
  } catch {
    return new Date(ts).toISOString().slice(0, 7);
  }
}

export function formatDateRange(checkIn: string, checkOut: string, language: Language): string {
  return `${formatISODate(checkIn, language)} – ${formatISODate(checkOut, language)}`;
}

/** The days opening hours are stored under, in the order the week runs. */
const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type WeekdayKey = `day_${(typeof WEEKDAYS)[number]}`;

/**
 * The translation key for a day of opening hours, or null for anything else.
 *
 * Hours store the day as its lowercase English name because that is what
 * convex/bookings/queries.ts matches against getDay() when it builds booking
 * slots — an identifier, not a label. The listing sheet printed it as it was:
 * "sunday", in both languages. Older rows may be capitalised.
 */
export function weekdayLabelKey(day: string): WeekdayKey | null {
  const key = day.trim().toLowerCase();
  return (WEEKDAYS as readonly string[]).includes(key) ? (`day_${key}` as WeekdayKey) : null;
}

/** Relative time for the notification inbox: "3h", "2d". */
export function relativeTime(ts: number, language: Language, now: number = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - ts) / 1000));
  const ar = language === "ar";

  if (seconds < 60) return ar ? "الآن" : "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return ar ? `قبل ${minutes} د` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return ar ? `قبل ${hours} س` : `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return ar ? `قبل ${days} ي` : `${days}d`;

  return formatISODate(new Date(ts).toISOString().slice(0, 10), language);
}
