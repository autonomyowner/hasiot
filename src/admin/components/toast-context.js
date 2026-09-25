import { toast as sonner } from 'sonner'

/**
 * Toast feedback for every mutation in the panel.
 *
 * This is a thin shim over sonner rather than a context: every call site does
 * `const toast = useToast()` followed by `toast.success(...)` /
 * `toast.error(err)`, so keeping that shape meant the migration touched no tab
 * at all. `toast.error` accepts a plain sentence or a thrown error; an error is
 * turned into a sentence by `readableError` below.
 */
export function useToast() {
  return toastApi
}

export const toastApi = {
  success: (message) => sonner.success(message),
  info: (message) => sonner.info(message),
  warning: (message) => sonner.warning(message),
  error: (errorOrMessage) =>
    sonner.error(
      typeof errorOrMessage === 'string'
        ? errorOrMessage
        : readableError(errorOrMessage)
    ),
}

export const UNEXPECTED_ERROR = 'حدث خطأ غير متوقع'
const SESSION_EXPIRED = 'انتهت جلستك. أعد تسجيل الدخول.'
const ADMIN_SESSION = 'انتهت صلاحية جلستك أو لم تعد تملك صلاحية المدير. أعد تسجيل الدخول.'
const NOT_DEPLOYED = 'هذه الميزة غير متوفرة على الخادم بعد. يلزم نشر الواجهة الخلفية.'

const ARABIC_LETTER = /[؀-ۿ]/

/**
 * The Arabic half of a refusal in the house format, "عربي / English" — or
 * null when the text has no Arabic half to show.
 */
export function arabicHalf(text) {
  const first = String(text).split(' / ')[0].trim()
  return ARABIC_LETTER.test(first) ? first : null
}

/**
 * Turn a thrown error into one Arabic sentence an operator can act on.
 *
 * A refusal the server meant a person to read arrives as a ConvexError, with
 * its text in `error.data` — Arabic first, " / ", then English (BOOKING_ERRORS
 * in convex/bookings/logic.ts is the model). Only the Arabic half is shown:
 * the panel is Arabic, and the English half is an API the app matches on.
 *
 * Anything else is not a sentence for a person. Production redacts a plain
 * Error to "Server Error", and in development its message is a module path and
 * a stack, so it is never shown as-is. Three cases are common enough to name —
 * an expired session, an account that lost admin rights, and a panel running
 * against a backend that has not been deployed yet. The rest read
 * «حدث خطأ غير متوقع», and the detail goes to the console for whoever
 * debugs it.
 */
export function readableError(error, { log = true } = {}) {
  const data = error?.data
  const text =
    typeof data === 'string' ? data
      : typeof data?.message === 'string' ? data.message
        : null

  if (text) {
    // English only, from the oldest functions; the app maps it the same way.
    if (/^not authenticated$/i.test(text.trim())) return SESSION_EXPIRED
    const arabic = arabicHalf(text)
    if (arabic) return arabic
  }

  const message = String(error?.message ?? '')
  if (/Unauthorized: admin access required/i.test(message)) return ADMIN_SESSION
  if (/not authenticated/i.test(message)) return SESSION_EXPIRED
  if (/could not find public function|function not found/i.test(message)) return NOT_DEPLOYED

  if (log) console.error('[admin] unexpected error:', error)
  return UNEXPECTED_ERROR
}
