/**
 * The inbox rules, ported from hasio-mobile-app/lib/bookingDisplay.ts so the
 * web and the app split and act on bookings identically. Every day and start
 * time is Riyadh wall-clock (UTC+3, no DST), whatever zone the browser is in.
 */

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/

export function todayRiyadhISO(now = Date.now()) {
  return new Date(now + RIYADH_OFFSET_MS).toISOString().slice(0, 10)
}

export function riyadhMoment(date, time) {
  const d = ISO_DAY.exec(date ?? '')
  const c = HH_MM.exec(time ?? '')
  if (!d || !c) return NaN
  return Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(c[1]), Number(c[2])) - RIYADH_OFFSET_MS
}

/** A request past its expiry reads expired before the hourly job writes it. */
export function shownStatus(booking, now) {
  const expired = booking.status === 'pending' && booking.expiresAt !== undefined && booking.expiresAt <= now
  return expired ? 'expired' : booking.status
}

const startOf = (b) => b.checkIn ?? b.date ?? ''
const endOf = (b) => b.checkOut ?? b.date ?? ''
const beginsAt = (b) => `${startOf(b)} ${b.time ?? ''}`
const soonest = (a, b) => (beginsAt(a) < beginsAt(b) ? -1 : beginsAt(a) > beginsAt(b) ? 1 : 0)

/** pending (live requests) / upcoming (confirmed, not ended) / past (the rest). */
export function partitionBookings(bookings, now) {
  const today = todayRiyadhISO(now)
  const pending = []
  const upcoming = []
  const past = []
  for (const b of bookings ?? []) {
    const status = shownStatus(b, now)
    if (status === 'pending') pending.push(b)
    else if (status === 'confirmed' && endOf(b) >= today) upcoming.push(b)
    else past.push(b)
  }
  pending.sort(soonest)
  upcoming.sort(soonest)
  past.sort((a, b) => soonest(b, a))
  return { pending, upcoming, past }
}

/**
 * "decide" (confirm / decline), "close" (complete / no-show) or "none".
 * A stay can be closed from its arrival day; a service from its start time —
 * the server refuses earlier, so offering it would only earn an error.
 */
export function actionsFor(booking, kind, now) {
  const status = shownStatus(booking, now)
  if (status === 'pending') return 'decide'
  if (status !== 'confirmed') return 'none'
  if (kind === 'service') return riyadhMoment(booking.date, booking.time) <= now ? 'close' : 'none'
  const arrival = booking.checkIn ?? booking.date
  return arrival !== undefined && arrival <= todayRiyadhISO(now) ? 'close' : 'none'
}
