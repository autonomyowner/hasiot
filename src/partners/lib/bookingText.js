import { partitionBookings } from './bookings'

/**
 * How a booking's day and price read, shared by the inbox and the overview's
 * short lists so both say "6 Oct" and "SAR 1,440" the same way.
 */

/** "2026-10-06" -> "6 Oct"; Latin digits in Arabic too, like every price and code. */
export function formatDay(iso, lang) {
  const ts = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(ts)) return iso ?? ''
  const locale = lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(ts)
}

export function formatMoney(amount, currency, lang) {
  if (typeof amount !== 'number') return ''
  const locale = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US'
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'SAR', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${amount} ${currency || 'SAR'}`
  }
}

/** Which greeting an hour of the day gets. */
export function dayPart(hour) {
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  return 'evening'
}

/**
 * The overview's two short lists: the requests waiting for an answer and the
 * confirmed bookings coming up, soonest first — the same split the inbox's
 * tabs make (lib/bookings.js), cut to `size` with the full counts kept.
 */
export function previewOf(bookings, now, size = 3) {
  if (!bookings) return { pending: [], upcoming: [], pendingTotal: 0, upcomingTotal: 0 }
  const { pending, upcoming } = partitionBookings(bookings, now)
  return {
    pending: pending.slice(0, size),
    upcoming: upcoming.slice(0, size),
    pendingTotal: pending.length,
    upcomingTotal: upcoming.length,
  }
}
