import { nextRadio, radioStep } from './radio'

const translations = {
  en: { label: 'Where is your mobile number from?', saudi: 'Saudi Arabia', other: 'Another country' },
  ar: { label: 'من أي دولة رقم جوالك؟', saudi: 'السعودية', other: 'دولة أخرى' },
}

/**
 * Saudi Arabia (+966) or another country, as a radio group: the choice sets
 * the +966 prefix and the hint under the number. Arrow keys move the choice,
 * pointing the way the focus goes in either language.
 */
export default function CountrySeg({ value, onChange, lang }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const options = [
    { value: 'sa', label: t.saudi, sub: '+966' },
    { value: 'intl', label: t.other },
  ]
  const values = options.map((o) => o.value)

  const onKeyDown = (e) => {
    const step = radioStep(e.key, lang === 'ar')
    if (!step) return
    e.preventDefault()
    const next = nextRadio(values, value, step)
    onChange(next)
    e.currentTarget.closest('[role="radiogroup"]')?.querySelector(`[data-value="${next}"]`)?.focus()
  }

  return (
    <div className="bk-seg" role="radiogroup" aria-label={t.label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          data-value={o.value}
          aria-checked={value === o.value}
          tabIndex={value === o.value ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={onKeyDown}
        >
          <span>{o.label}</span>
          {o.sub && <small>{o.sub}</small>}
        </button>
      ))}
    </div>
  )
}
