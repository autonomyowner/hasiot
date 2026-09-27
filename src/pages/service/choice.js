import { MAX_DAYS_AHEAD, addDays, riyadhToday } from '../../booking/dates'
import { parseServiceParams, serviceQuery } from '../../booking/params'
import { firstServiceDay, maxPeople, quantityRule, startTimes } from '../../booking/serviceRules'

/**
 * A traveller's choice on a service page — the day, the start time, how many
 * hours or days, how many people — and its round trip through the address bar
 * (design W4: a reload or a shared link comes back to the same choice).
 *
 * The URL is not trusted. A shared link can be a week old and a mail client
 * can cut one short, so each part is kept only if the page would offer it
 * right now — a day on the calendar, a start time that day still has, a count
 * inside the stepper's range. Anything else falls back to nothing picked, or
 * to the default count, rather than to an error.
 */

const OWN_PARAMS = ['date', 'time', 'quantity', 'people']

const within = (n, min, max) => Number.isInteger(n) && n >= min && n <= max

/** The choice to start from, read from the page's query string. */
export function initialChoice(search, service, now = Date.now()) {
  const parsed = parseServiceParams(search, riyadhToday(now))
  const rule = quantityRule(service?.priceUnit)
  const quantity = rule ? (within(parsed.quantity, rule.min, rule.max) ? parsed.quantity : rule.min) : null
  const people = within(parsed.people, 1, maxPeople(service)) ? parsed.people : 1
  return withClock({ date: parsed.date, time: parsed.time, quantity, people }, now)
}

/**
 * The choice as the clock allows it now. A page can sit open for an hour: a
 * start time that has come within the hour is let go, and so is a day with no
 * start left, rather than quoted into a refusal (the app's sheet does the
 * same). Only the day and the time age; the counts are left as they are.
 */
export function withClock(choice, now = Date.now()) {
  const first = firstServiceDay(now)
  const last = addDays(riyadhToday(now), MAX_DAYS_AHEAD)
  const date = choice.date && choice.date >= first && choice.date <= last ? choice.date : null
  const time = date && choice.time && startTimes(date, now).includes(choice.time) ? choice.time : null
  return { ...choice, date, time }
}

/** The same choice on another day. A start time that day does not offer is let go. */
export function withDay(choice, date, now = Date.now()) {
  const keep = Boolean(choice.time) && startTimes(date, now).includes(choice.time)
  return { ...choice, date, time: keep ? choice.time : null }
}

/** What is still to pick before there is anything to price: the day, then the start time. */
export function missingStep({ date, time }) {
  if (!date) return 'day'
  if (!time) return 'time'
  return null
}

/**
 * The page's query string with this choice in it. Parameters that are not the
 * choice's (a campaign's, say) stay as they were; the choice follows them in
 * one fixed order, without what is not picked yet and without the default
 * counts — so the address of a page nobody has touched stays clean, and
 * writing the same choice twice gives the same string.
 */
export function choiceSearch(search, choice, rule) {
  const params = new URLSearchParams(search ?? '')
  for (const key of OWN_PARAMS) params.delete(key)
  if (choice.date) params.set('date', choice.date)
  if (choice.date && choice.time) params.set('time', choice.time)
  if (rule && choice.quantity && choice.quantity !== rule.min) params.set('quantity', String(choice.quantity))
  if (choice.people && choice.people !== 1) params.set('people', String(choice.people))
  const query = params.toString()
  return query ? `?${query}` : ''
}

/**
 * Where "Request to book" goes: the checkout, carrying the whole choice. Every
 * count is spelled out here, defaults included, because the checkout reads the
 * request from its URL alone (params.js parseServiceParams).
 */
export function bookingPath(serviceId, { date, time, quantity, people }, rule) {
  const query = serviceQuery({ date, time, quantity: rule ? quantity : null, people })
  return `/book/service/${encodeURIComponent(serviceId)}${query}`
}
