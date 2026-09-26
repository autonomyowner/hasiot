/**
 * The pieces of "Continue with Google" that are plain string work, kept out of
 * the page so they can be tested.
 *
 * The flow (contract 2026-09-26, "Auth HTTP"): the whole tab navigates to the
 * auth server's `/oauth-start`, which creates the OAuth state there — in this
 * browser, first-party on the Convex site — and hops to Google. There is no
 * fetch first: a state minted by a separate request could be minted by
 * anyone and planted in someone else's browser (login CSRF), and a cookie set
 * by a cross-site fetch is third-party, which Safari drops.
 */

/** Where Google sends the partner back to, on success and on failure alike. */
export function googleReturnURL(origin) {
  return `${String(origin).replace(/\/+$/, '')}/partners`
}

/** The top-level page that starts Google sign-in on the Convex site. */
export function oauthStartURL(convexSiteURL, returnURL) {
  if (!convexSiteURL) throw new Error('VITE_CONVEX_SITE_URL is not set')
  if (typeof returnURL !== 'string' || !returnURL) throw new Error('No return address for Google sign-in')
  const base = String(convexSiteURL).replace(/\/+$/, '')
  const params = new URLSearchParams({ provider: 'google', callbackURL: returnURL, errorCallbackURL: returnURL })
  return `${base}/api/auth/oauth-start?${params}`
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
