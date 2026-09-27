import { serverText } from '../errors'

/**
 * The phone a booking needs (design W5), decided the way the server decides
 * it (convex/lib/phoneRules.ts, users/contactPhone.ts).
 *
 * While Saudi SMS is off, a Saudi mobile is typed once and saved unconfirmed
 * (setContactPhone): the host sees it marked "not confirmed by SMS". Any other
 * number — and a Saudi one once SMS is live — is confirmed with a code, which
 * attaches it to the signed-in account (verify with updatePhoneNumber).
 *
 * Only `saudiSmsLive` counts here, not `demoAuth`: setContactPhone refuses on
 * that switch alone, so on the demo backend a Saudi number is still saved —
 * which is what keeps the "type once" path testable there. A config still
 * loading counts as SMS off, as in the app: saving is never wrong while it
 * is, and the server has the last word either way.
 */

const SAUDI_MOBILE = /^\+9665\d{8}$/

export function isSaudiMobile(phone) {
  return typeof phone === 'string' && SAUDI_MOBILE.test(phone)
}

/**
 * 'save' | 'verify' | 'invalid' for a normalised number (E.164, or null when
 * nothing usable is typed yet — then the country choice decides the copy).
 * A +966 number that is not a mobile can take neither path.
 */
export function phoneMode(e164, country, config) {
  const smsOff = config?.saudiSmsLive !== true
  if (e164) {
    if (e164.startsWith('+966') && !isSaudiMobile(e164)) return 'invalid'
    return isSaudiMobile(e164) && smsOff ? 'save' : 'verify'
  }
  return country === 'sa' && smsOff ? 'save' : 'verify'
}

/**
 * setContactPhone's "already verified" refusal: the account has a confirmed
 * number, which is all the booking needed, so the step carries on as if the
 * save had worked (the app does the same, lib/contactPhoneError.ts).
 */
export function alreadyVerified(err) {
  return /already verified/i.test(serverText(err))
}

/**
 * What a failed code means for the next move: 'taken' (the number belongs to
 * another account — only a different number helps), 'expired' (a new code is
 * needed, so the resend wait is lifted), 'wrong', or null.
 */
export function codeFailure(err) {
  const text = serverText(err)
  if (/Phone number already exists/i.test(text)) return 'taken'
  if (/OTP expired|OTP not found|Too many attempts/i.test(text)) return 'expired'
  if (/Invalid OTP/i.test(text)) return 'wrong'
  return null
}
