import { MAX_NIGHTS, daysBetween, isISODate, riyadhToday } from './dates'

/**
 * A booking's choices live in the URL (design W4): the checkout is its own
 * page, and a Google sign-in, a reload or a shared link must come back to the
 * same request. These read and write that URL. Nothing read here is trusted —
 * the server re-checks and re-prices everything — but a malformed value is
 * dropped here so a page never sends it.
 */

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/
const WHOLE = /^[1-9]\d{0,3}$/

const paramsOf = (search) => (search instanceof URLSearchParams ? search : new URLSearchParams(search ?? ''))
const dateOf = (value) => (isISODate(value) ? value : null)
const countOf = (value) => (WHOLE.test(value ?? '') ? Number(value) : null)

/** `{checkIn, checkOut, guests, valid}`; `valid` is a stay the server could quote. */
export function parseStayParams(search, today = riyadhToday()) {
  const params = paramsOf(search)
  const checkIn = dateOf(params.get('checkIn'))
  const checkOut = dateOf(params.get('checkOut'))
  const guests = countOf(params.get('guests'))
  const nights = checkIn && checkOut ? daysBetween(checkIn, checkOut) : 0
  const valid = Boolean(checkIn && checkOut && guests && checkIn >= today && nights >= 1 && nights <= MAX_NIGHTS)
  return { checkIn, checkOut, guests, valid }
}

export function stayQuery({ checkIn, checkOut, guests }) {
  return `?${new URLSearchParams({ checkIn, checkOut, guests: String(guests) })}`
}

/** `{date, time, quantity, people, valid}`; `quantity` is null when the price has none. */
export function parseServiceParams(search, today = riyadhToday()) {
  const params = paramsOf(search)
  const date = dateOf(params.get('date'))
  const rawTime = params.get('time')
  const time = HH_MM.test(rawTime ?? '') ? rawTime : null
  const people = countOf(params.get('people'))
  const hasQuantity = params.has('quantity')
  const quantity = hasQuantity ? countOf(params.get('quantity')) : null
  const valid = Boolean(date && time && people && date >= today && (!hasQuantity || quantity))
  return { date, time, quantity, people, valid }
}

export function serviceQuery({ date, time, quantity, people }) {
  const params = new URLSearchParams({ date, time })
  if (quantity !== null && quantity !== undefined) params.set('quantity', String(quantity))
  params.set('people', String(people))
  return `?${params}`
}

const NEXT = /^\/(trips(?:[/?]|$)|book\/)/

/**
 * A `?next=` worth following after sign-in: a path inside My trips or the
 * checkout, and nothing else. Protocol-relative (`//host`) and backslash forms
 * are refused because browsers treat both as another host.
 */
export function safeNext(next) {
  if (typeof next !== 'string') return null
  if (next.startsWith('//') || next.includes('\\')) return null
  return NEXT.test(next) ? next : null
}
