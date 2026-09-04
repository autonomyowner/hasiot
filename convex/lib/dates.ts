/**
 * Date helpers for a product that lives in one timezone.
 *
 * Every date a guest or host sees is a Saudi calendar date: a stay booked for
 * "2026-09-10" starts on the 10th in Al-Ahsa regardless of where the server
 * runs. Convex runs in UTC, so `new Date().toISOString().slice(0,10)` is wrong
 * for three hours every night — between 21:00 and 24:00 UTC it returns
 * yesterday's Riyadh date, which is how a booking for "today" ends up rejected
 * as being in the past.
 *
 * Saudi Arabia has observed UTC+3 with no DST since 1990, so a fixed offset is
 * correct here and avoids pulling in a timezone database.
 */

export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The Riyadh calendar date ("YYYY-MM-DD") for a UTC timestamp. */
export function toRiyadhISODate(ts: number): string {
  return new Date(ts + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/** Today's date in Riyadh. Pass `now` in tests so assertions are stable. */
export function todayRiyadhISO(now: number = Date.now()): string {
  return toRiyadhISODate(now);
}

/** True for a well-formed calendar date that actually exists (rejects 2026-02-30). */
export function isISODate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const ts = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ts)) return false;
  // Date.parse normalises overflow (2026-02-30 -> 2026-03-02), so round-trip
  // it and require the same string back.
  return new Date(ts).toISOString().slice(0, 10) === value;
}

export function isHHMM(value: unknown): value is string {
  return typeof value === "string" && HH_MM.test(value);
}

/** Shift a calendar date by whole days. Pure string arithmetic, no timezone. */
export function addDays(iso: string, days: number): string {
  const ts = Date.parse(`${iso}T00:00:00Z`);
  return new Date(ts + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Nights between two dates, i.e. how many times you sleep there.
 * Check-out is exclusive: 10th -> 13th is 3 nights.
 * May return 0 or negative for bad input; callers validate.
 */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round(
    (Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000
  );
}

/** The UTC timestamp of a Riyadh wall-clock date and time. */
export function riyadhDateTimeToTimestamp(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - RIYADH_OFFSET_MS;
}

/** "YYYY-MM" in Riyadh — used to bucket a host's revenue by month. */
export function riyadhMonthKey(ts: number): string {
  return toRiyadhISODate(ts).slice(0, 7);
}
