import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { errorText } from '../lib/errors'
import { Icon, Spinner } from '../components/Ui'

const MAX_NAME = 60

const translations = {
  en: {
    title: 'Join Hasio as a partner',
    subtitle: 'Tell us what you offer. We review every partner before they go live.',
    hotelTitle: 'Hotel or place',
    hotelHint: 'Hotels, restaurants, attractions and events.',
    providerTitle: 'Service provider',
    providerHint: 'Guides, drivers, photographers and other local services.',
    firstName: 'First name',
    lastName: 'Last name',
    nameRequired: 'Enter your first name.',
    pickRole: 'Choose what you offer.',
    continue: 'Continue',
    next: 'Next you will upload a document (commercial registration or ID) for review.',
  },
  ar: {
    title: 'انضم إلى Hasio كشريك',
    subtitle: 'أخبرنا بما تقدمه. نراجع كل شريك قبل ظهوره للمسافرين.',
    hotelTitle: 'فندق أو مكان',
    hotelHint: 'فنادق ومطاعم ومعالم وفعاليات.',
    providerTitle: 'مقدم خدمة',
    providerHint: 'مرشدون وسائقون ومصورون وخدمات محلية أخرى.',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    nameRequired: 'أدخل اسمك الأول.',
    pickRole: 'اختر ما تقدمه.',
    continue: 'متابعة',
    next: 'بعدها ترفع مستندًا (سجل تجاري أو هوية) للمراجعة.',
  },
}

/**
 * Tourist -> business_owner or service_provider, the same `setUserRole` call
 * the app's upgrade sheet makes. The app sends the role alone; the names are
 * the one addition here (the server accepts and bounds them), because a web
 * partner who signed up by phone otherwise has none for the admin to see.
 * No businessType: the app does not ask for one either.
 */
export default function JoinPage() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate('join')
  const navigate = useNavigate()
  const setUserRole = useMutation(api.users.mutations.setUserRole)

  const [role, setRole] = useState(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  if (guard) return guard

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    if (!role) return setError(t.pickRole)
    if (!firstName.trim()) return setError(t.nameRequired)
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await setUserRole({
        role,
        firstName: firstName.trim().slice(0, MAX_NAME),
        lastName: lastName.trim().slice(0, MAX_NAME) || undefined,
      })
      navigate('/partners/verify', { replace: true })
    } catch (err) {
      setError(errorText(err, lang))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const choices = [
    { value: 'business_owner', icon: 'building', title: t.hotelTitle, hint: t.hotelHint },
    { value: 'service_provider', icon: 'briefcase', title: t.providerTitle, hint: t.providerHint },
  ]

  return (
    <div className="p-narrow" style={{ maxWidth: 560 }}>
      <form className="p-card p-stack" onSubmit={onSubmit} noValidate>
        <div>
          <h1 className="p-title">{t.title}</h1>
          <p className="p-subtitle" style={{ marginBottom: 0 }}>{t.subtitle}</p>
        </div>

        <div className="p-choices" role="radiogroup" aria-label={t.pickRole}>
          {choices.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={role === c.value}
              className={role === c.value ? 'p-choice is-selected' : 'p-choice'}
              onClick={() => {
                setRole(c.value)
                setError('')
              }}
            >
              <span className="p-choice-icon"><Icon name={c.icon} size={22} /></span>
              <span className="p-choice-body">
                <span className="p-choice-title">{c.title}</span>
                <span className="p-choice-hint">{c.hint}</span>
              </span>
              <Icon name={role === c.value ? 'check' : 'chevron'} size={18} className="p-chevron" />
            </button>
          ))}
        </div>

        <div className="p-grid-2">
          <div className="p-field">
            <label className="p-label" htmlFor="join-first">{t.firstName}</label>
            <input
              id="join-first"
              className="p-input"
              autoComplete="given-name"
              maxLength={MAX_NAME}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="p-field">
            <label className="p-label" htmlFor="join-last">{t.lastName}</label>
            <input
              id="join-last"
              className="p-input"
              autoComplete="family-name"
              maxLength={MAX_NAME}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="p-field-error" role="alert">{error}</p>}
        <p className="p-note">{t.next}</p>

        <button type="submit" className="p-btn p-btn-primary p-btn-block" disabled={busy}>
          {busy && <Spinner />}
          <span>{t.continue}</span>
        </button>
      </form>
    </div>
  )
}
