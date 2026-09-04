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
 * "2026-09-10" → "10 Sep".
 *
 * Arabic uses Latin digits (ar-SA-u-nu-latn) deliberately: the app mixes dates
 * with prices, confirmation codes and phone numbers, all of which are Latin,
 * and Arabic-Indic numerals next to them read as a different alphabet mid-line.
 * `timeZone: "UTC"` keeps the parsed midnight from drifting back a day.
 */
export function formatISODate(iso: string, language: Language): string {
  try {
    return new Intl.DateTimeFormat(language === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  } catch {
    // Hermes ships a trimmed ICU on some Android builds; a raw date beats a crash.
    return iso;
  }
}

export function formatDateRange(checkIn: string, checkOut: string, language: Language): string {
  return `${formatISODate(checkIn, language)} – ${formatISODate(checkOut, language)}`;
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
