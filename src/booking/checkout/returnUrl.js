import { readAuthReturn } from '../authReturn'

/**
 * Where Google sends the traveller back to — on success and on failure alike
 * (callbackURL = errorCallbackURL, contract §2). Always the page they started
 * on, with its choices: a checkout returns to the same request (design W4).
 */

const trimOrigin = (origin) => String(origin).replace(/\/+$/, '')

/**
 * This page's address for Google to return to. A failure from an earlier try
 * is left out: the page removes it from the address bar with
 * history.replaceState, which the router never hears of, so its own location
 * would still carry it — and a second failure would stack onto the first.
 */
export function returnTarget(origin, pathname, search) {
  return `${trimOrigin(origin)}${pathname}${readAuthReturn(search).search}`
}

/** /login, keeping the page to go on to once signed in (already checked by safeNext). */
export function loginReturnURL(origin, next) {
  const base = `${trimOrigin(origin)}/login`
  return next ? `${base}?next=${encodeURIComponent(next)}` : base
}
