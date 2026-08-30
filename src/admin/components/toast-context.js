import { createContext, useContext } from 'react'

export const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}

/**
 * Turn a thrown Convex error into something an Arabic-speaking operator can act
 * on. Convex wraps handler errors as:
 *
 *   [CONVEX M(admin/mutations:createListing)] [Request ID: …] Server Error
 *   Uncaught Error: Listing not found
 *       at handler (../convex/admin/mutations.ts:81:13)
 *
 * so the useful sentence has to be dug out. Backend messages that are already
 * bilingual (the rate limiters) come through unchanged.
 */
export function formatConvexError(error) {
  const raw =
    (typeof error?.data === 'string' && error.data) ||
    error?.data?.message ||
    error?.message ||
    String(error ?? '')

  if (!raw) return 'حدث خطأ غير متوقع.'

  let message = raw
  const uncaught = message.indexOf('Uncaught Error:')
  if (uncaught !== -1) message = message.slice(uncaught + 'Uncaught Error:'.length)

  // Drop the stack frames and the Convex request preamble.
  message = message.split('\n    at ')[0].split('\n')[0].trim()

  if (/^Unauthorized: admin access required$/i.test(message)) {
    return 'انتهت صلاحية جلستك أو لم تعد تملك صلاحية المدير. أعد تسجيل الدخول.'
  }
  if (/not authenticated/i.test(message)) {
    return 'انتهت جلستك. أعد تسجيل الدخول.'
  }

  return message || 'حدث خطأ غير متوقع.'
}
