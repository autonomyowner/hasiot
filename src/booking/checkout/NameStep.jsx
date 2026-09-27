import { useId, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { phoneErrorText } from '../errors'
import { NAME_MAX, splitName } from './account'

const translations = {
  en: {
    label: 'Your name',
    hint: {
      stay: 'The host sees your name on your request.',
      service: 'The provider sees your name on your request.',
    },
    save: 'Save name',
    required: 'Enter your name.',
    tooLong: `Your name can be up to ${NAME_MAX} characters.`,
  },
  ar: {
    label: 'اسمك',
    hint: {
      stay: 'يرى المضيف اسمك في طلبك.',
      service: 'يرى مقدم الخدمة اسمك في طلبك.',
    },
    save: 'حفظ الاسم',
    required: 'أدخل اسمك.',
    tooLong: `يمكن أن يصل اسمك إلى ${NAME_MAX} حرفًا.`,
  },
}

/**
 * The name, for an account that has none (design W6) — a phone sign-up, whose
 * host would otherwise read "A guest". One field, split into first and last
 * name at the first space (account.js), and saved together with the page's
 * language (W21): every web account starts Arabic, and the emails about this
 * booking should speak the language it is made in.
 *
 * On success the button keeps spinning: getCurrentUser brings the name back
 * (Convex reflects a mutation before it resolves) and the page moves on.
 */
export default function NameStep({ kind, lang }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const who = kind === 'service' ? 'service' : 'stay'
  const id = useId()
  const updateProfile = useMutation(api.users.mutations.updateProfile)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const busyRef = useRef(false)
  const inputRef = useRef(null)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    const name = splitName(value)
    if (!name) {
      setError(value.trim() ? t.tooLong : t.required)
      inputRef.current?.focus()
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await updateProfile({ ...name, preferredLanguage: lang })
    } catch (err) {
      setError(phoneErrorText(err, lang))
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <form className="bk-stack" onSubmit={onSubmit} noValidate>
      <div className="bk-field">
        <label className="bk-label" htmlFor={`${id}-name`}>{t.label}</label>
        <input
          ref={inputRef}
          id={`${id}-name`}
          className="bk-input"
          type="text"
          autoComplete="name"
          dir="auto"
          maxLength={NAME_MAX}
          value={value}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError('')
          }}
        />
        <span id={`${id}-hint`} className="bk-hint">{t.hint[who]}</span>
        {error && <p id={`${id}-error`} className="bk-error" role="alert">{error}</p>}
      </div>
      <div className="co-actions">
        <button type="submit" className="bk-btn bk-btn-primary" disabled={busy} aria-busy={busy || undefined}>
          {busy && <span className="bk-spinner" aria-hidden="true" />}
          <span>{t.save}</span>
        </button>
      </div>
    </form>
  )
}
