/**
 * One sentence a partner can read, in their language, from anything thrown.
 *
 * Server refusals are `ConvexError("عربي / English")` (the English half is an
 * API the app matches on). Better Auth errors carry `{ message }`, sometimes in
 * the same format (the SMS rate limit) and sometimes English only. Anything
 * else — a stack, production's redacted "Server Error" — is not for a person
 * and becomes the generic line; the detail goes to the console.
 */
export const GENERIC_ERROR = {
  en: 'Something went wrong. Please try again.',
  ar: 'حدث خطأ غير متوقع. حاول مرة أخرى.',
}

const SESSION_EXPIRED = {
  en: 'Your session has ended. Please sign in again.',
  ar: 'انتهت جلستك. سجّل الدخول مرة أخرى.',
}

const ARABIC = /[؀-ۿ]/
const INTERNAL = /\[CONVEX|Server Error|Uncaught|at [\w$.]+ \(|could not find public function/i

function textOf(err) {
  if (!err) return null
  const data = err.data
  if (typeof data === 'string') return data
  if (typeof data?.message === 'string') return data.message
  // better-auth client results: { error: { message, code } }
  if (typeof err.error?.message === 'string') return err.error.message
  if (typeof err.message === 'string') return err.message
  if (typeof err === 'string') return err
  return null
}

export function errorText(err, lang = 'ar') {
  const language = lang === 'en' ? 'en' : 'ar'
  const text = textOf(err)?.trim()
  if (!text || INTERNAL.test(text)) {
    if (err) console.error('[partners] unexpected error:', err)
    return GENERIC_ERROR[language]
  }
  if (/not authenticated|signed in/i.test(text) && !ARABIC.test(text)) return SESSION_EXPIRED[language]

  const parts = text.split(' / ')
  if (parts.length >= 2) {
    const arabic = parts[0].trim()
    const english = parts.slice(1).join(' / ').trim()
    if (ARABIC.test(arabic)) return language === 'ar' ? arabic : english
  }

  const isArabic = ARABIC.test(text)
  if (isArabic === (language === 'ar')) return text
  return GENERIC_ERROR[language]
}
