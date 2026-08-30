import { toast as sonner } from 'sonner'

/**
 * Toast feedback for every mutation in the panel.
 *
 * This is a thin shim over sonner rather than a context: the ten call sites all
 * use `const toast = useToast()` followed by `toast.success(...)` /
 * `toast.error(err)`, so keeping that shape meant the migration touched no tab
 * at all. `toast.error` still accepts a raw Convex error and digs the readable
 * sentence out of it.
 */
export function useToast() {
  return toastApi
}

export const toastApi = {
  success: (message) => sonner.success(message),
  info: (message) => sonner.info(message),
  error: (errorOrMessage) =>
    sonner.error(
      typeof errorOrMessage === 'string'
        ? errorOrMessage
        : formatConvexError(errorOrMessage)
    ),
}

/**
 * Turn a thrown Convex error into something an Arabic-speaking operator can act
 * on.
 *
 * There are two shapes to unwrap. An error thrown by a handler arrives as:
 *
 *   [CONVEX M(admin/mutations:createListing)] [Request ID: …] Server Error
 *   Uncaught Error: Listing not found
 *       at handler (../convex/admin/mutations.ts:81:13)
 *
 * while one raised by the platform itself — a function that is not deployed, a
 * bad argument — has no "Uncaught Error:" marker at all, just those bracketed
 * prefixes. Both have to be stripped, or the operator is shown a request id and
 * a module path. Backend messages that are already bilingual (the rate limiters)
 * come through unchanged.
 */
export function formatConvexError(error) {
  const raw =
    (typeof error?.data === 'string' && error.data) ||
    error?.data?.message ||
    error?.message ||
    String(error ?? '')

  if (!raw) return 'حدث خطأ غير متوقع.'

  let message = raw

  // A handler that threw carries its sentence after this marker.
  const uncaught = message.indexOf('Uncaught Error:')
  if (uncaught !== -1) message = message.slice(uncaught + 'Uncaught Error:'.length)

  // Drop the stack frames.
  message = message.split('\n    at ')[0]

  // Drop the bracketed platform prefixes and keep the first real line.
  message = (message
    .replace(/\[CONVEX [^\]]*\]/g, '')
    .replace(/\[Request ID: [^\]]*\]/g, '')
    .replace(/Server Error/gi, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0] || '').trim()

  if (/^Unauthorized: admin access required$/i.test(message)) {
    return 'انتهت صلاحية جلستك أو لم تعد تملك صلاحية المدير. أعد تسجيل الدخول.'
  }
  if (/not authenticated/i.test(message)) {
    return 'انتهت جلستك. أعد تسجيل الدخول.'
  }
  // Almost always a client running against a backend that has not been deployed
  // yet — worth saying plainly rather than showing a module path.
  if (/could not find public function|function not found/i.test(message)) {
    return 'هذه الميزة غير متوفرة على الخادم بعد. يلزم نشر الواجهة الخلفية.'
  }

  return message || 'حدث خطأ غير متوقع.'
}
