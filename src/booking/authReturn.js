/**
 * What a return from Google means, for the traveller pages.
 *
 * Google (through Better Auth) sends the traveller back to the page that
 * started it, with `?error=<code>` when something went wrong. A press of
 * Cancel on Google's screen is `access_denied` and deserves no alarm. When the
 * sign-in state was lost before its return address could be read, Better Auth
 * sends the traveller to /login (convex/auth.ts, design W20) with either an
 * `error` or `?state=state_not_found` instead.
 *
 * `search` is the query string with those removed, ready for
 * `history.replaceState`, so a reload or a copied link does not repeat the
 * message. The partner portal's readGoogleReturn is the same idea for
 * /partners, which never receives the lost-state return.
 */
export function readAuthReturn(search) {
  const params = new URLSearchParams(search ?? '')
  const code = params.get('error')
  const lostState = params.get('state') === 'state_not_found'
  if (code === null && !lostState) {
    return { kind: null, search: params.toString() ? `?${params}` : '' }
  }
  params.delete('error')
  params.delete('error_description')
  if (lostState) params.delete('state')
  const rest = params.toString()
  return {
    kind: code === 'access_denied' ? 'cancelled' : 'failed',
    search: rest ? `?${rest}` : '',
  }
}
