/**
 * Dates for booking, on the Riyadh clock.
 *
 * A stay booked for "2026-10-03" starts on the 3rd in the Eastern Province
 * wherever the visitor's computer is, so "today" is Riyadh's today — the same
 * rule the server applies (convex/lib/dates.ts). Saudi Arabia is UTC+3 with no
 * daylight saving, so a fixed offset is exact. Every other calculation here is
 * UTC arithmetic on calendar dates, which no local timezone can shift.
 *
 * Names follow the app (lib/dates.ts, lib/calendarLocale.ts): Gregorian months
 * with Latin digits in both languages — plain `ar-SA` would print Hijri dates —
 * and weeks that start on Sunday.
 */

export const MAX_NIGHTS = 30
export const MAX_DAYS_AHEAD = 365

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000
const DAY_MS = 86_400_000
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const LOCALE = { en: 'en-GB', ar: 'ar-SA-u-ca-gregory-nu-latn' }
const locale = (lang) => (lang === 'ar' ? LOCALE.ar : LOCALE.en)
const utc = (iso) => Date.parse(`${iso}T00:00:00Z`)
const toISO = (ts) => new Date(ts).toISOString().slice(0, 10)

/** Today's calendar date in Riyadh. */
export function riyadhToday(now = Date.now()) {
  return toISO(now + RIYADH_OFFSET_MS)
}

/** A real calendar day written YYYY-MM-DD (rejects 2026-02-29). */
export function isISODate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const ts = utc(value)
  return !Number.isNaN(ts) && toISO(ts) === value
}

export function addDays(iso, days) {
  return toISO(utc(iso) + days * DAY_MS)
}

/** Whole days from `a` to `b` (negative when `b` is earlier). Nights, for a stay. */
export function daysBetween(a, b) {
  return Math.round((utc(b) - utc(a)) / DAY_MS)
}

/** The instant a Riyadh wall-clock date and time happens. */
export function riyadhTimestamp(date, time) {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) - RIYADH_OFFSET_MS
}

export function monthOf(iso) {
  const [year, month] = iso.split('-').map(Number)
  return { year, month }
}

export function addMonths({ year, month }, n) {
  const index = year * 12 + (month - 1) + n
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

const pad = (n) => String(n).padStart(2, '0')

/**
 * The month as weeks of seven cells, Sunday first. Cells outside the month are
 * `null`, so a grid can be drawn without a date library.
 */
export function monthGrid({ year, month }) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells = Array.from({ length: first.getUTCDay() }, () => null)
  for (let d = 1; d <= days; d += 1) cells.push(`${year}-${pad(month)}-${pad(d)}`)
  while (cells.length % 7) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

// Intl's Arabic short weekday is the full name ("الأحد"), too wide for a
// calendar column; these are the app's calendar headings.
const WEEKDAYS_AR = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

export function weekdayNames(lang) {
  if (lang === 'ar') return WEEKDAYS_AR
  // 4 January 2026 is a Sunday.
  const fmt = new Intl.DateTimeFormat(LOCALE.en, { weekday: 'short', timeZone: 'UTC' })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2026, 0, 4 + i))))
}

export function monthLabel({ year, month }, lang) {
  return new Intl.DateTimeFormat(locale(lang), { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)))
}

/** "3 Oct" / "3 أكتوبر". */
export function formatDay(iso, lang) {
  return new Intl.DateTimeFormat(locale(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(utc(iso))
}

/** "Sat, 3 Oct 2026" / "السبت، 3 أكتوبر 2026" — also the calendar's accessible day name. */
export function formatDayLong(iso, lang) {
  return new Intl.DateTimeFormat(locale(lang), {
    weekday: lang === 'ar' ? 'long' : 'short',
    day: 'numeric',
    month: lang === 'ar' ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(utc(iso))
}

export function formatRange(a, b, lang) {
  return `${formatDay(a, lang)} – ${formatDay(b, lang)}`
}

/**
 * The next check-in/check-out pair after a tap, as the app's calendar does it:
 * the first tap picks check-in, a later one check-out; a tap on or before
 * check-in, one that would make the stay longer than `maxNights`, or any tap
 * after a complete range starts again from the tapped day.
 */
export function nextRange({ start, end }, clicked, maxNights = MAX_NIGHTS) {
  if (!start || end) return { start: clicked, end: null }
  const nights = daysBetween(start, clicked)
  if (nights < 1 || nights > maxNights) return { start: clicked, end: null }
  return { start, end: clicked }
}
