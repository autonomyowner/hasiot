import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

/**
 * The panel's one modal shell. Every dialog used to hand-roll the overlay, the
 * stopPropagation and the framer transitions, which is why some of them closed
 * on Escape and some did not.
 *
 * Render it inside an <AnimatePresence> so the exit animation runs:
 *   <AnimatePresence>{open && <Modal …>…</Modal>}</AnimatePresence>
 */
export default function Modal({ title, subtitle, onClose, children, footer, width = '640px' }) {
  const cardRef = useRef(null)

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)

    // Stop the page behind the overlay from scrolling with the dialog open.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the dialog, but to its first field rather than to the card
    // itself: focusing the card stole focus from an `autoFocus` textarea, so an
    // operator who opened the reject dialog and started typing had their
    // keystrokes go nowhere — and their spaces scroll the page — until they
    // clicked the box. Fall back to the card only when there is nothing to type
    // into, so a plain confirm dialog still traps focus.
    const card = cardRef.current
    const field = card?.querySelector(
      'textarea, input:not([type="hidden"]), select, [autofocus]'
    )
    ;(field || card)?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="admin-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        ref={cardRef}
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.16 }}
        className="admin-modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        {title && (
          <div className="admin-modal-header">
            <h3 className="admin-modal-title">{title}</h3>
            {subtitle && <p className="admin-modal-subtitle">{subtitle}</p>}
          </div>
        )}
        {children}
        {footer && <div className="admin-modal-footer">{footer}</div>}
      </motion.div>
    </motion.div>
  )
}
