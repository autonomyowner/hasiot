import { useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ToastContext, formatConvexError } from './toast-context'

/**
 * Feedback for every mutation in the panel.
 *
 * Before this, a failed approval logged to the console and the row simply did
 * not change — the operator had no way to tell a rejection from a network error.
 * `toast.error(err)` accepts a raw Convex error and renders the sentence inside
 * it; the hook and that formatter live in ./toast-context so this file exports
 * only a component.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(0)

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback((tone, message) => {
    const id = nextId.current++
    setToasts((prev) => [...prev, { id, tone, message }])
    // Errors linger: the operator may need to read a backend message twice.
    window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4000)
  }, [dismiss])

  const value = useMemo(() => ({
    success: (message) => push('success', message),
    error: (errorOrMessage) =>
      push('error', typeof errorOrMessage === 'string'
        ? errorOrMessage
        : formatConvexError(errorOrMessage)),
    info: (message) => push('info', message),
  }), [push])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="admin-toasts" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className={`admin-toast ${toast.tone}`}
              onClick={() => dismiss(toast.id)}
            >
              <span className="admin-toast-dot" aria-hidden="true" />
              <span className="admin-toast-text">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
