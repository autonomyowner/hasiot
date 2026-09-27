import { MAX_NIGHTS, daysBetween, isISODate, riyadhToday } from '../dates'
import { formatSAR } from '../money'
import { parseServiceParams, parseStayParams } from '../params'
import { quantityText } from '../text'

/**
 * The checkout's request, from its URL to the server and back.
 *
 * The choice (dates and guests, or a day, a time, hours and people) lives in
 * the URL (design W4) so a Google sign-in or a reload returns to the same
 * request. Nothing here is trusted: the server re-checks and re-prices it.
 */

export const MAX_NOTES = 500

/**
 * The server's own refusal for a full place (BOOKING_ERRORS.NO_AVAILABILITY in
 * convex/bookings/logic.ts, which a signed-in page may not import). A stay
 * quote says `available: false` rather than refusing; written as the refusal,
 * it reads and acts like one — errors.js gives the app's sentence and
 * refusalKind() offers "Change dates".
 */
export const NO_AVAILABILITY = 'لا توجد وحدات متاحة لهذه التواريخ. / No availability for those dates.'

/** The place or service page the request came from. */
export function itemPath(kind, id) {
  return `${kind === 'service' ? '/services' : '/places'}/${encodeURIComponent(id ?? '')}`
}

export function readChoice(kind, search, today = riyadhToday()) {
  return kind === 'service' ? parseServiceParams(search, today) : parseStayParams(search, today)
}

/**
 * The query string for a link back to the place or service page ("Change",
 * "Change dates"): every part of the choice that could still be booked, so
 * the page opens as the traveller left it. A past day, or a stay the server
 * would never quote, is dropped rather than handed back to a calendar.
 */
export function choiceQuery(kind, choice, today = riyadhToday()) {
  const params = new URLSearchParams()
  if (kind === 'service') {
    if (isISODate(choice?.date) && choice.date >= today) {
      params.set('date', choice.date)
      if (choice.time) params.set('time', choice.time)
    }
    if (choice?.quantity) params.set('quantity', String(choice.quantity))
    if (choice?.people) params.set('people', String(choice.people))
  } else {
    const checkIn = choice?.checkIn
    const checkOut = choice?.checkOut
    const nights = isISODate(checkIn) && isISODate(checkOut) ? daysBetween(checkIn, checkOut) : 0
    if (nights >= 1 && nights <= MAX_NIGHTS && checkIn >= today) {
      params.set('checkIn', checkIn)
      params.set('checkOut', checkOut)
    }
    if (choice?.guests) params.set('guests', String(choice.guests))
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** The live quote's arguments, or 'skip' while the choice is incomplete. */
export function quoteArgs(kind, id, choice) {
  if (!id || !choice?.valid) return 'skip'
  if (kind === 'service') {
    const args = { serviceId: id, date: choice.date, time: choice.time, partySize: choice.people }
    // Hours or days only for an hourly or daily price; the URL has none otherwise.
    if (choice.quantity) args.quantity = choice.quantity
    return args
  }
  return { listingId: id, checkIn: choice.checkIn, checkOut: choice.checkOut, guests: choice.guests }
}

/** createStayBooking / createServiceBooking's arguments; null while the choice is incomplete. */
export function bookingArgs(kind, id, choice, notes) {
  const args = quoteArgs(kind, id, choice)
  if (args === 'skip') return null
  const text = String(notes ?? '').trim().slice(0, MAX_NOTES).trim()
  return text ? { ...args, notes: text } : args
}

/**
 * What a quote query's result means: 'loading', 'ok' (with the quote and, for
 * a stay, the host's check-in and check-out times), or 'refused' with the
 * reason — the server's refusal text, or the query's own error.
 */
export function quoteState({ data, error } = {}) {
  if (error) return { status: 'refused', reason: error }
  if (data === undefined || data === null) return { status: 'loading' }
  if (!data.ok) return { status: 'refused', reason: data.error }
  if (data.available === false) return { status: 'refused', reason: NO_AVAILABILITY }
  return { status: 'ok', quote: data.quote, checkInTime: data.checkInTime, checkOutTime: data.checkOutTime }
}

/**
 * The line above the total: "3 × 450 SAR" for a stay, "3 hours × 150 SAR" for
 * an hourly or daily service. A fixed or per-event price has nothing to
 * multiply, so `label` is null and the page names it itself.
 */
export function breakdownLine(kind, quote, lang) {
  const amount = formatSAR(quote.totalAmount, lang)
  if (kind === 'service') {
    const count = quantityText(quote.priceUnit, quote.quantity, lang)
    return { label: count ? `${count} × ${formatSAR(quote.unitPrice, lang)}` : null, amount }
  }
  return { label: `${quote.nights} × ${formatSAR(quote.pricePerNight, lang)}`, amount }
}
