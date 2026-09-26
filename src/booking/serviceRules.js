import { addDays, isISODate, riyadhTimestamp, riyadhToday } from './dates'

/**
 * When a service can start and how much of it can be asked for — the app's
 * sheet (lib/serviceDisplay.ts) and the server's limits
 * (convex/services/logic.ts). The server only refuses a start that has already
 * passed; the hour of lead time is the app's courtesy to the provider, kept
 * here so both clients offer the same times.
 */

export const SERVICE_START = '06:00'
export const SERVICE_END = '23:00'
export const STEP_MIN = 30
export const LEAD_MIN = 60

const pad = (n) => String(n).padStart(2, '0')
const minutes = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

const ALL_TIMES = (() => {
  const out = []
  for (let t = minutes(SERVICE_START); t <= minutes(SERVICE_END); t += STEP_MIN) {
    out.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`)
  }
  return out
})()

/** The start times on offer for a day, on the Riyadh clock. */
export function startTimes(date, now = Date.now()) {
  if (!isISODate(date)) return []
  const today = riyadhToday(now)
  if (date < today) return []
  if (date > today) return [...ALL_TIMES]
  const earliest = now + LEAD_MIN * 60_000
  return ALL_TIMES.filter((time) => riyadhTimestamp(date, time) >= earliest)
}

/** The first day a service can still be booked: today while a start is left. */
export function firstServiceDay(now = Date.now()) {
  const today = riyadhToday(now)
  return startTimes(today, now).length > 0 ? today : addDays(today, 1)
}

/** Hours (1–12) or days (1–14) for an hourly or daily price; nothing otherwise. */
export function quantityRule(priceUnit) {
  if (priceUnit === 'per_hour') return { kind: 'hours', min: 1, max: 12 }
  if (priceUnit === 'per_day') return { kind: 'days', min: 1, max: 14 }
  return null
}

/** People per booking: the provider's limit, or the server's default of 20. */
export function maxPeople(service) {
  return service?.maxGroupSize ?? 20
}
