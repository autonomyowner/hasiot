import { useEffect, useId, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'

/**
 * A small confirmation, in the page (never window.confirm). Focus moves into
 * it on open and stays inside while it is up; Escape and the backdrop cancel;
 * focus goes back to whatever opened it. The confirm button spins while
 * `busy`, and Escape does nothing then — the request is already on its way.
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  busy = false,
  tone = 'default',
}) {
  const panelRef = useRef(null)
  const titleId = useId()
  const bodyId = useId()
  // Read by the key handler without re-running the effect on every change.
  const state = useRef({ busy, onCancel })
  useEffect(() => {
    state.current = { busy, onCancel }
  })

  useEffect(() => {
    if (!open) return undefined
    const panel = panelRef.current
    const returnTo = document.activeElement
    // The safe choice takes focus first.
    panel?.querySelector('[data-autofocus]')?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (!state.current.busy) state.current.onCancel?.()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = [...panel.querySelectorAll(FOCUSABLE)]
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (returnTo instanceof HTMLElement) returnTo.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="bk-dialog-root">
      <div className="bk-dialog-backdrop" onClick={busy ? undefined : onCancel} aria-hidden="true" />
      <div className="bk-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={body ? bodyId : undefined} ref={panelRef}>
        <h2 id={titleId}>{title}</h2>
        {body && <p id={bodyId}>{body}</p>}
        <div className="bk-dialog-actions">
          <button type="button" className="bk-btn bk-btn-ghost" onClick={onCancel} disabled={busy} data-autofocus>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`bk-btn ${tone === 'danger' ? 'bk-btn-danger' : 'bk-btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy && <span className="bk-spinner" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
