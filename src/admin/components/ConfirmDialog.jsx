import { useCallback, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Modal from './Modal'

/**
 * Promise-based confirmation, so a destructive handler reads top to bottom:
 *
 *   const ok = await confirm({ title, message, destructive: true })
 *   if (!ok) return
 *
 * With `reason` it doubles as the reject/cancel prompt and resolves
 * `{ reason }`; without it, it resolves `{ reason: '' }`. Cancelling always
 * resolves `null`, so `if (!ok) return` is the single guard either way.
 *
 * This replaces window.confirm(), which cannot be styled, is not RTL, and in
 * this panel appeared in Latin-default browser chrome above an Arabic page.
 */
export function useConfirm() {
  const [request, setRequest] = useState(null)
  const [reason, setReason] = useState('')

  const confirm = useCallback((options) => new Promise((resolve) => {
    setReason('')
    setRequest({ options, resolve })
  }), [])

  const settle = useCallback((value) => {
    setRequest((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  const options = request?.options
  const reasonRequired = options?.reason?.required && !reason.trim()

  const confirmDialog = (
    <AnimatePresence>
      {request && (
        <Modal
          title={options.title}
          onClose={() => settle(null)}
          width="480px"
          footer={
            <>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={() => settle(null)}
              >
                {options.cancelLabel || 'إلغاء'}
              </button>
              <button
                type="button"
                className={`admin-btn ${options.destructive ? 'admin-btn-danger' : 'admin-btn-primary'}`}
                onClick={() => settle({ reason: reason.trim() })}
                disabled={reasonRequired}
              >
                {options.confirmLabel || 'تأكيد'}
              </button>
            </>
          }
        >
          <div className="admin-modal-body">
            {options.message && <p className="admin-confirm-message">{options.message}</p>}
            {options.reason && (
              <div className="admin-form-group" style={{ marginTop: '1rem' }}>
                <label className="admin-form-label">{options.reason.label}</label>
                <textarea
                  className="admin-form-textarea"
                  rows={3}
                  autoFocus
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={options.reason.placeholder || ''}
                />
              </div>
            )}
          </div>
        </Modal>
      )}
    </AnimatePresence>
  )

  return { confirm, confirmDialog }
}

export default useConfirm
