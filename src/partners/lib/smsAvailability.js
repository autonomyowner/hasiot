/**
 * Where a sign-in SMS can actually arrive.
 *
 * Production SMS does not reach Saudi (+966) numbers yet: the messaging
 * provider (Infobip) has not provisioned Saudi Arabia, so a Saudi partner who
 * asks for a code would wait for a text that never comes. Other countries work.
 *
 * Flip SAUDI_SMS_LIVE to true once Saudi delivery is confirmed end to end
 * (the Infobip sender ID is registered and a real +966 phone received a code).
 * Nothing else needs to change: the login page reads only smsBlockedFor().
 */
export const SAUDI_SMS_LIVE = false

/** True when a code sent to this E.164 number would not arrive today. */
export function smsBlockedFor(e164, saudiLive = SAUDI_SMS_LIVE) {
  if (saudiLive || typeof e164 !== 'string') return false
  return e164.startsWith('+966')
}
