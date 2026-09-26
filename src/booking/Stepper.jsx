import { useId } from 'react'

const translations = {
  en: { less: 'Fewer', more: 'More' },
  ar: { less: 'أقل', more: 'أكثر' },
}

const Minus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
)
const Plus = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
)

/**
 * − value + for a small count (guests, people, hours, days). The value is
 * announced politely as it changes; the buttons stop at the bounds.
 */
export default function Stepper({ label, value, min, max, onChange, format, lang }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const labelId = useId()
  return (
    <div className="bk-stepper">
      <span className="bk-label" id={labelId}>{label}</span>
      <div className="bk-stepper-ctl" role="group" aria-labelledby={labelId}>
        <button
          type="button"
          className="bk-stepper-btn"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`${t.less}: ${label}`}
        >
          <Minus />
        </button>
        <output aria-live="polite">{format ? format(value) : value}</output>
        <button
          type="button"
          className="bk-stepper-btn"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${t.more}: ${label}`}
        >
          <Plus />
        </button>
      </div>
    </div>
  )
}
