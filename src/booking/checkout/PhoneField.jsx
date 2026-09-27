import CountrySeg from './CountrySeg'

const translations = {
  en: {
    label: 'Mobile number',
    saPlaceholder: '5X XXX XXXX',
    intlPlaceholder: '+971 5X XXX XXXX',
    saHintLead: 'As you usually write it:',
    or: 'or',
    intlHint: 'Include the country code.',
  },
  ar: {
    label: 'رقم الجوال',
    saPlaceholder: '5X XXX XXXX',
    intlPlaceholder: '+971 5X XXX XXXX',
    saHintLead: 'كما تكتبه عادة:',
    or: 'أو',
    intlHint: 'اكتب الرقم مع رمز الدولة.',
  },
}

/**
 * The country choice and the number, shared by the sign-in and the phone
 * step. The number reads left to right in both languages, prefix included,
 * as it is dialled. Whatever is typed goes through normalizePhone, so 05…,
 * 5…, +966… and Arabic-Indic digits all land on the same E.164 number.
 */
export default function PhoneField({ id, lang, country, onCountry, value, onChange, error, describedBy, inputRef }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const saudi = country === 'sa'
  const describe = [`${id}-hint`, error ? `${id}-error` : null, describedBy].filter(Boolean).join(' ')

  return (
    <>
      <CountrySeg value={country} onChange={onCountry} lang={lang} />
      <div className="bk-field">
        <label className="bk-label" htmlFor={id}>{t.label}</label>
        <div className="bk-phone" dir="ltr">
          {saudi && <span className="bk-phone-prefix" aria-hidden="true">+966</span>}
          <input
            ref={inputRef}
            id={id}
            className="bk-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            dir="ltr"
            placeholder={saudi ? t.saPlaceholder : t.intlPlaceholder}
            value={value}
            aria-invalid={error ? 'true' : undefined}
            aria-describedby={describe}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <span id={`${id}-hint`} className="bk-hint">
          {saudi ? (
            <>
              {t.saHintLead} <bdi dir="ltr">05…</bdi>{lang === 'ar' ? '،' : ','} <bdi dir="ltr">5…</bdi> {t.or} <bdi dir="ltr">+966…</bdi>
            </>
          ) : t.intlHint}
        </span>
        {error && <p id={`${id}-error`} className="bk-error" role="alert">{error}</p>}
      </div>
    </>
  )
}
