import { addDays, daysBetween, formatDay, formatDayLong, formatRange } from '../booking/dates'
import { formatSAR } from '../booking/money'
import { guestsText, nightsText, peopleText, quantityText } from '../booking/text'
import { formatPhone } from '../partners/lib/phone'

/**
 * What My trips shows for a booking, kept out of JSX so it is tested once —
 * the web's half of the app's lib/bookingDisplay.ts.
 *
 * A row is one of three things: a stay (dates, nights, guests), a service (a
 * day and a start time, hours or days, a group) or a reservation made by the
 * 1.0.x apps at a restaurant or an event (a day, a time and a party, with no
 * total and no code — design W25). The server names the kind on every stay and
 * service; a row with no kind predates both and is a reservation.
 */

export const STORE_LINKS = {
  appStore: 'https://apps.apple.com/app/id6800297588',
  googlePlay: 'https://play.google.com/store/apps/details?id=com.hasio.travel',
}

export function tripKind(booking) {
  if (booking.kind === 'service') return 'service'
  if (booking.kind !== 'slot' && booking.checkIn && booking.checkOut) return 'stay'
  return 'slot'
}

const pick = (en, ar, lang) => {
  const first = lang === 'ar' ? ar : en
  const second = lang === 'ar' ? en : ar
  return (typeof first === 'string' && first.trim()) || (typeof second === 'string' && second.trim()) || null
}

/** What was booked, where the row carries it; null once it has been deleted. */
const subject = (booking) => (tripKind(booking) === 'service' ? booking.service : booking.listing) ?? null

/** The place's or the service's name in the page's language; null when it is gone. */
export function tripName(booking, lang) {
  const item = subject(booking)
  if (!item) return null
  return tripKind(booking) === 'service' ? pick(item.title_en, item.title_ar, lang) : pick(item.name_en, item.name_ar, lang)
}

/** The first photo. Hosts' content is not trusted, so only an http(s) address is used. */
export function tripImage(booking) {
  const src = subject(booking)?.images?.[0]
  return typeof src === 'string' && /^https?:\/\//i.test(src) ? src : null
}

/** A service priced by the day covers its quantity of days; anything else is one day. */
const serviceDays = (booking) => (booking.priceUnit === 'per_day' ? Math.max(1, booking.quantity ?? 1) : 1)

// The start time is shown exactly as stored — Riyadh wall-clock time — never
// re-read in the visitor's zone, which would move a 19:00 tour for someone
// browsing from abroad.
const atTime = (day, time, lang) => {
  if (!time) return day
  return lang === 'ar' ? `${day} الساعة ${time}` : `${day} at ${time}`
}

/** "3 Oct – 6 Oct" for a stay; "10 Oct at 19:00" for a service or a reservation. */
export function tripWhen(booking, lang) {
  const kind = tripKind(booking)
  if (kind === 'stay') return formatRange(booking.checkIn, booking.checkOut, lang)
  if (kind === 'service') {
    const days = serviceDays(booking)
    // Three days from the 10th end on the 12th; the stored checkOut is the
    // exclusive 13th, so the last day is counted from the start instead.
    const day = days > 1 ? formatRange(booking.date, addDays(booking.date, days - 1), lang) : formatDay(booking.date, lang)
    return atTime(day, booking.time, lang)
  }
  return atTime(formatDay(booking.date, lang), booking.time, lang)
}

const nightsOf = (booking) => booking.nights ?? daysBetween(booking.checkIn, booking.checkOut)
const peopleOf = (booking) => booking.partySize ?? booking.guests

// Hours or days only when the service is sold by them: a fixed-price tour is
// stored with a quantity of 1, and "1 hour" under it would be wrong.
const durationOf = (booking, lang) => (booking.quantity ? quantityText(booking.priceUnit, booking.quantity, lang) : '')

/** "3 nights · 2 guests", "3 hours · 4 people", "4 people" — whatever the row can count. */
export function tripWhat(booking, lang) {
  const kind = tripKind(booking)
  const parts = []
  if (kind === 'stay') {
    parts.push(nightsText(nightsOf(booking), lang))
    if (booking.guests) parts.push(guestsText(booking.guests, lang))
  } else {
    if (kind === 'service') parts.push(durationOf(booking, lang))
    const people = peopleOf(booking)
    if (people) parts.push(peopleText(people, lang))
  }
  return parts.filter(Boolean).join(' · ')
}

/** The total in riyals; a reservation had no price, so it has none. */
export function tripTotal(booking, lang) {
  if (tripKind(booking) === 'slot' || typeof booking.totalAmount !== 'number') return null
  return formatSAR(booking.totalAmount, lang)
}

const withTime = (day, time) => (time ? `${day} · ${time}` : day)

/**
 * The booking page's rows as `{key, value}` — the page supplies the labels.
 * `ltr` marks a bare time, kept in one piece inside an Arabic line; `strong`
 * the total.
 */
export function detailRows(booking, lang) {
  const kind = tripKind(booking)
  const rows = []
  const total = tripTotal(booking, lang)

  if (kind === 'stay') {
    const listing = booking.listing ?? {}
    rows.push({ key: 'checkIn', value: withTime(formatDayLong(booking.checkIn, lang), listing.checkInTime) })
    rows.push({ key: 'checkOut', value: withTime(formatDayLong(booking.checkOut, lang), listing.checkOutTime) })
    rows.push({ key: 'stay', value: tripWhat(booking, lang) })
  } else {
    const days = kind === 'service' ? serviceDays(booking) : 1
    const date =
      days > 1
        ? `${formatDayLong(booking.date, lang)} – ${formatDayLong(addDays(booking.date, days - 1), lang)}`
        : formatDayLong(booking.date, lang)
    rows.push({ key: 'date', value: date })
    if (booking.time) rows.push({ key: kind === 'service' ? 'startTime' : 'time', value: booking.time, ltr: true })
    if (kind === 'service') {
      const duration = durationOf(booking, lang)
      if (duration) rows.push({ key: 'duration', value: duration })
    }
    const people = peopleOf(booking)
    if (people) rows.push({ key: 'people', value: peopleText(people, lang) })
  }

  if (total) rows.push({ key: 'total', value: total, strong: true })
  return rows
}

const ARABIC = /[؀-ۿ]/
const LATIN = /[A-Za-z]/

/**
 * The page's half of a text the server wrote in both languages
 * ("عربي / English"). Anything else is a person's own words, shown as typed.
 */
export function bilingualHalf(text, lang) {
  const parts = text.split(' / ')
  if (parts.length >= 2) {
    const ar = parts[0].trim()
    const en = parts.slice(1).join(' / ').trim()
    if (ARABIC.test(ar) && LATIN.test(en) && !ARABIC.test(en)) return lang === 'ar' ? ar : en
  }
  return text
}

/**
 * Why a booking closed, when someone said. A decline is always the host's or
 * the provider's. A cancellation's reason cannot be placed: the traveller's
 * own cancel sends none from either client, but the row does not record who
 * cancelled, so it is not credited to anyone (`from: 'unknown'`).
 */
export function reasonFor(booking, lang) {
  const read = (value) => (typeof value === 'string' && value.trim() ? bilingualHalf(value.trim(), lang) : null)
  if (booking.status === 'declined') {
    const text = read(booking.declineReason)
    return text ? { from: tripKind(booking) === 'service' ? 'provider' : 'host', text } : null
  }
  if (booking.status === 'cancelled') {
    const text = read(booking.cancellationReason)
    return text ? { from: 'unknown', text } : null
  }
  return null
}

/**
 * What a completed booking can be rated as: the place of a stay, the service
 * of a service booking. Nothing for a reservation — the server rates places
 * from stays only — and nothing once the place or service is gone, which the
 * server would refuse.
 */
export function reviewTarget(booking) {
  if (booking.status !== 'completed') return null
  const kind = tripKind(booking)
  if (kind === 'stay' && booking.listing && booking.listingId) return { listingId: booking.listingId }
  if (kind === 'service' && booking.service?._id) return { serviceId: booking.service._id }
  return null
}

export function personName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim()
}

/**
 * An address someone can write to. Phone sign-ups carry a made-up one on the
 * placeholder domain (convex/lib/contact.ts), which no mail reaches.
 */
export function emailOf(user) {
  const email = typeof user?.email === 'string' ? user.email.trim() : ''
  if (!email || email.toLowerCase().endsWith('@phone.hasio.xyz')) return null
  return email
}

/** How the account is named at the foot of My trips: a name, else the phone, else a real email. */
export function accountLabel(user) {
  if (!user) return null
  const name = personName(user)
  if (name) return { kind: 'name', text: name }
  if (user.phone) return { kind: 'phone', text: formatPhone(user.phone) }
  const email = emailOf(user)
  return email ? { kind: 'email', text: email } : null
}

/** "1 star", "5 stars"; Arabic in its own forms, as the app's star labels. */
export function starsText(n, lang) {
  if (lang !== 'ar') return `${n} ${n === 1 ? 'star' : 'stars'}`
  if (n === 1) return 'نجمة واحدة'
  if (n === 2) return 'نجمتان'
  if (n >= 3 && n <= 10) return `${n} نجوم`
  return `${n} نجمة`
}

/** My trips opens on Upcoming, unless there is nothing ahead and something behind. */
export function defaultTab({ upcoming, past }) {
  return upcoming.length === 0 && past.length > 0 ? 'past' : 'upcoming'
}
