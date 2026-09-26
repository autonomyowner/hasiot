/**
 * The pieces of "Continue with Google" that are plain string work, kept out of
 * the page so they can be tested.
 *
 * The flow (contract 2026-09-26, "Auth HTTP"): the page asks the auth server
 * for Google's consent URL with `disableRedirect`, then navigates the whole tab
 * to the server's `/oauth-start`, which sets the OAuth state cookie
 * first-party on the Convex site before hopping to Google. Letting the
 * `/sign-in/social` fetch set that cookie instead would make it a third-party
 * cookie, which Safari drops — and the callback would then fail its state check.
 */

/** Where Google sends the partner back to, on success and on failure alike. */
export function googleReturnURL(origin) {
  return `${String(origin).replace(/\/+$/, '')}/partners`
}

/** The top-level page that starts the Google hop on the Convex site. */
export function oauthStartURL(convexSiteURL, authorizationURL) {
  if (!convexSiteURL) throw new Error('VITE_CONVEX_SITE_URL is not set')
  if (typeof authorizationURL !== 'string' || !authorizationURL) {
    throw new Error('No Google authorization URL in the sign-in response')
  }
  const base = String(convexSiteURL).replace(/\/+$/, '')
  return `${base}/api/auth/oauth-start?authorizationURL=${encodeURIComponent(authorizationURL)}`
}

/**
 * What a return to `/partners?error=<code>` means.
 *
 * - `kind`: `null` (no error), `'cancelled'` (Google's `access_denied` — the
 *   person pressed Cancel, which deserves no alarm) or `'failed'` (anything
 *   else, including server-level failures Better Auth sends to the same URL).
 * - `search`: the query string with `error` (and Better Auth's companion
 *   `error_description`) removed, ready for `history.replaceState`, so a reload
 *   or a shared link does not repeat the message. `''` when nothing is left.
 */
export function readGoogleReturn(search) {
  const params = new URLSearchParams(search ?? '')
  const code = params.get('error')
  if (code === null) return { kind: null, search: params.toString() ? `?${params}` : '' }
  params.delete('error')
  params.delete('error_description')
  const rest = params.toString()
  return {
    kind: code === 'access_denied' ? 'cancelled' : 'failed',
    search: rest ? `?${rest}` : '',
  }
}
