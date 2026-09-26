import { riyadhTimestamp, riyadhToday } from './dates'

/**
 * A booking's status as a traveller reads it, and what they may still do.
 *
 * Mirrors the app (components/booking/BookingStatusChip.tsx, app/bookings/)
 * and the server's rules (convex/bookings/service.ts cancelAsTourist), so the
 * site never offers a button the server refuses.
 */

const LABELS = {
  pending: { en: 'Awaiting host', ar: 'بانتظار المضيف' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغى' },
  declined: { en: 'Declined', ar: 'مرفوض' },
  expired: { en: 'Expired', ar: 'منتهي الصلاحية' },
  no_show: { en: 'No-show', ar: 'لم يحضر' },
}
const PENDING_SERVICE = { en: 'Awaiting provider', ar: 'بانتظار مقدم الخدمة' }

const isService = (b) => b.kind === 'service'
const OPEN = ['pending', 'confirmed']

/**
 * The status to show. The hourly job marks lapsed requests expired, but for up
 * to an hour a request past its deadline still reads `pending` — and the host
 * can no longer confirm it (confirmAsManager refuses), so it is expired.
 */
export function effectiveStatus(booking, now = Date.now()) {
  if (booking.status === 'pending' && typeof booking.expiresAt === 'number' && booking.expiresAt <= now) {
    return 'expired'
  }
  return booking.status
}

export function statusLabel(status, kind, lang) {
  const label = status === 'pending' && kind === 'service' ? PENDING_SERVICE : LABELS[status]
  if (!label) return status
  return lang === 'ar' ? label.ar : label.en
}

export function statusTone(status) {
  if (status === 'pending') return 'wait'
  if (status === 'confirmed') return 'ok'
  if (status === 'completed') return 'done'
  return 'bad'
}

/** When the booking starts, as a sortable "YYYY-MM-DDTHH:MM". */
function startKey(booking) {
  if (isService(booking)) return `${booking.date}T${booking.time ?? '00:00'}`
  return `${booking.checkIn ?? booking.date}T${booking.time ?? '00:00'}`
}

/**
 * Still ahead of the traveller: open, and for a stay not yet checked out (the
 * check-out day itself counts, as on the server's dashboards), for a service
 * not yet started.
 */
export function isUpcoming(booking, now = Date.now()) {
  if (!OPEN.includes(effectiveStatus(booking, now))) return false
  if (isService(booking)) return riyadhTimestamp(booking.date, booking.time ?? '00:00') > now
  return (booking.checkOut ?? booking.date) >= riyadhToday(now)
}

/** Upcoming soonest first; everything else newest first. */
export function splitTrips(rows, now = Date.now()) {
  const upcoming = []
  const past = []
  for (const row of rows) (isUpcoming(row, now) ? upcoming : past).push(row)
  upcoming.sort((a, b) => startKey(a).localeCompare(startKey(b)))
  past.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
  return { upcoming, past }
}

/**
 * Whether the traveller may cancel (design W9, server cancelAsTourist): an
 * open booking; a stay only before its check-in day; a service request any
 * time before the provider confirms it, and a confirmed one only before it
 * starts. An old restaurant reservation has no such limit.
 */
export function canCancel(booking, now = Date.now()) {
  if (!OPEN.includes(effectiveStatus(booking, now))) return false
  if (isService(booking)) {
    if (booking.status === 'pending') return true
    return riyadhTimestamp(booking.date, booking.time ?? '00:00') > now
  }
  if (booking.kind === 'stay') return (booking.checkIn ?? booking.date) > riyadhToday(now)
  return true
}
