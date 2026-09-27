import { MAX_NIGHTS, daysBetween } from '../../booking/dates'
import { parseStayParams } from '../../booking/params'

/**
 * The stay booking section's state, kept in the page's URL.
 *
 * The URL is the only copy (design W4): a reload, a shared link or the
 * checkout's "Change" link comes back to the same dates and guests, and there
 * is no second copy in React state to drift out of step with it. These turn
 * that URL into the stay on screen and back, and say what the summary card and
 * "Request to book" should do with the live quote.
 */

const STAY_KEYS = ['checkIn', 'checkOut', 'guests']

/** Two guests, or fewer when the place takes fewer — the app's default. */
export const defaultGuests = (maxGuests) => Math.min(2, maxGuests)

/**
 * `{checkIn, checkOut, guests}` from the URL, keeping only what the calendar
 * itself could have picked: a check-in from `today` to `maxDay`, and a
 * check-out 1–30 nights after it, no later than `maxDay`. A check-in whose
 * check-out is missing or wrong is kept on its own — the traveller was half
 * way through choosing. Guests are held to the place's limit.
 */
export function readStay(search, { today, maxDay, maxGuests }) {
  const parsed = parseStayParams(search, today)
  const checkIn = parsed.checkIn && parsed.checkIn >= today && parsed.checkIn <= maxDay ? parsed.checkIn : null
  const nights = checkIn && parsed.checkOut ? daysBetween(checkIn, parsed.checkOut) : 0
  const checkOut = nights >= 1 && nights <= MAX_NIGHTS && parsed.checkOut <= maxDay ? parsed.checkOut : null
  const guests = parsed.guests ? Math.min(parsed.guests, maxGuests) : defaultGuests(maxGuests)
  return { checkIn, checkOut, guests }
}

/**
 * The URL's query after a change: whatever else it carried (a campaign tag)
 * first and untouched, then the stay's keys in stayQuery's order, leaving out
 * the ones not chosen yet — so a complete stay reads exactly like the checkout
 * link built from it. params.js writes complete stays only; this also writes
 * the half-chosen ones, so a reload mid-choice keeps the check-in.
 */
export function writeStay(search, stay) {
  const params = new URLSearchParams(search ?? '')
  for (const key of STAY_KEYS) params.delete(key)
  for (const key of STAY_KEYS) {
    const value = stay[key]
    if (value !== null && value !== undefined) params.append(key, String(value))
  }
  return params
}

/**
 * The URL after one change (a calendar pick, the guests, "Clear dates"): the
 * stay as the page was showing it, with the change laid over it. Starting
 * from what readStay kept means a stale date left in an old link is dropped
 * the first time the traveller touches anything.
 */
export function changeStay(search, change, limits) {
  return writeStay(search, { ...readStay(search, limits), ...change })
}

/**
 * What the summary card shows, from the stay and the live quote (the
 * `{data, error, stale}` of useConvexQuery):
 * - `empty`       both dates not chosen yet, so nothing is asked for;
 * - `loading`     the first quote for this choice is on its way;
 * - `failed`      the quote could not be fetched at all (network, server);
 * - `refused`     the server will not quote it — `error` is its reason;
 * - `unavailable` quoted, but every unit is taken on one of those nights;
 * - `ok`          quoted and free.
 * `stale` marks figures kept from the previous choice while the next loads.
 */
export function quoteView({ checkIn, checkOut }, { data, error, stale }) {
  if (!checkIn || !checkOut) return { state: 'empty', stale: false }
  if (error) return { state: 'failed', error, stale: false }
  if (data === undefined) return { state: 'loading', stale: false }
  const kept = Boolean(stale)
  if (data?.ok !== true || typeof data.quote?.totalAmount !== 'number') {
    return { state: 'refused', error: data?.error, stale: kept }
  }
  if (data.available === false) return { state: 'unavailable', quote: data.quote, stale: kept }
  return { state: 'ok', quote: data.quote, stale: kept }
}

/**
 * Why "Request to book" cannot go ahead yet, or null when it can: missing
 * dates first, then a quote still loading (or one that belongs to the previous
 * choice), then the quote's own answer. The button is never faded for any of
 * these (contract §5); pressed early, it says this reason instead.
 */
export function blockReason({ checkIn, checkOut }, view) {
  if (!checkIn) return 'dates'
  if (!checkOut) return 'checkout'
  if (view.state === 'loading' || view.stale) return 'calculating'
  if (view.state === 'failed' || view.state === 'refused' || view.state === 'unavailable') return view.state
  return null
}

/**
 * What a press of "Request to book" does, given blockReason: go to the
 * checkout; or say what stands in the way (`say`, a blockReason). A quote
 * that failed to arrive is asked for again (`reload`) and the wait is what is
 * said. The calendar is scrolled to and shaken (`point`) only when the dates
 * are what must change — waiting for a total is not the traveller's mistake.
 */
export function pressOutcome(reason) {
  if (!reason) return { go: true, reload: false, say: null, point: false }
  if (reason === 'failed') return { go: false, reload: true, say: 'calculating', point: false }
  return { go: false, reload: false, say: reason, point: reason !== 'calculating' }
}
