/**
 * Where a sign-in SMS can actually arrive.
 *
 * Production SMS does not reach Saudi (+966) numbers yet: the messaging
 * provider (Infobip) has not provisioned Saudi Arabia, so a Saudi partner who
 * asks for a code would wait for a text that never comes. Other countries work.
 *
 * Whether Saudi delivery works is one server setting, `SAUDI_SMS_LIVE` on the
 * Convex deployment, read through `getPublicConfig().saudiSmsLive` — the app
 * and the booking rule read the same switch, so flipping it needs no site
 * deploy. It used to be a constant here, which meant the site and the server
 * could disagree.
 */

/**
 * True when a code sent to a Saudi number would arrive, from the public config.
 *
 * - `undefined` (the config query still loading) counts as **not** live: a
 *   Saudi partner who presses Send in that first instant would otherwise get a
 *   code that never comes, while holding back for a moment costs nothing.
 * - `demoAuth` (the dev deployment, whose SMS provider accepts any code) counts
 *   as live, so phone sign-in stays testable with a Saudi number there.
 */
export function saudiSmsOpen(config) {
  if (!config) return false
  return config.demoAuth === true || config.saudiSmsLive === true
}

/** True when a code sent to this E.164 number would not arrive today. */
export function smsBlockedFor(e164, saudiLive) {
  if (saudiLive === true || typeof e164 !== 'string') return false
  return e164.startsWith('+966')
}
