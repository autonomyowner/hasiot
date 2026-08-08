import { useState } from 'react'
import ReportModal from './ReportModal'

const LABELS = { ar: 'إبلاغ', en: 'Report' }

/**
 * Small flag affordance plus the dialog it opens. Kept together so a caller only
 * has to drop in one element.
 *
 * Cards are themselves click targets (they navigate, or expand), so every
 * handler here stops propagation — otherwise reporting a listing would also
 * open it.
 */
export default function ReportButton({
  targetType,
  targetId,
  ownerId = null,
  targetLabel,
  lang = 'ar',
  variant = 'icon', // 'icon' on cards, 'text' in detail/review contexts
}) {
  const [open, setOpen] = useState(false)
  const label = LABELS[lang] || LABELS.ar

  const openModal = (e) => {
    e.stopPropagation()
    e.preventDefault()
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        className={`report-btn report-btn--${variant}`}
        onClick={openModal}
        aria-label={label}
        title={label}
      >
        <span className="material-symbols-outlined" aria-hidden="true">flag</span>
        {variant === 'text' && <span>{label}</span>}
      </button>

      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReportModal
            isOpen={open}
            onClose={() => setOpen(false)}
            targetType={targetType}
            targetId={targetId}
            ownerId={ownerId}
            targetLabel={targetLabel}
            lang={lang}
          />
        </div>
      )}
    </>
  )
}
