import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { authClient } from '../../lib/auth-client'
import { usePartnerLang, pick } from '../lang'
import { usePartnerRoute } from '../usePartnerGate'
import { dashboardPath, safeNext } from '../lib/gate'
import { formatPhone, normalizePhone, toLatinDigits } from '../lib/phone'
import { errorText } from '../lib/errors'
import { Icon, Ltr, PageSpinner, Spinner } from '../components/Ui'

const CODE_LENGTH = 6
const RESEND_SECONDS = 60

const translations = {
  en: {
    title: 'Partner sign in',
    subtitle: 'Hotels, places and service providers on Hasio. Same account as the app.',
    phoneLabel: 'Mobile number',
    phonePlaceholder: '05X XXX XXXX',
    phoneHint: 'Saudi numbers as you usually write them. Other countries: start with +.',
    phoneInvalid: 'Enter a valid mobile number.',
    send: 'Send code',
    codeTitle: 'Enter the code',
    codeSentTo: 'We sent a 6-digit code to',
    codeLabel: 'Verification code',
    codeInvalid: 'The code has 6 digits.',
    verify: 'Sign in',
    resend: 'Resend code',
    resendIn: 'Resend in {s}s',
    resent: 'A new code is on its way.',
    changeNumber: 'Change number',
  },
  ar: {
    title: 'دخول الشركاء',
    subtitle: 'للفنادق والأماكن ومقدمي الخدمات على Hasio. نفس حسابك في التطبيق.',
    phoneLabel: 'رقم الجوال',
    phonePlaceholder: '05X XXX XXXX',
    phoneHint: 'اكتب رقمك السعودي كما تكتبه عادة. للدول الأخرى ابدأ بـ +.',
    phoneInvalid: 'أدخل رقم جوال صحيحًا.',
    send: 'إرسال الرمز',
    codeTitle: 'أدخل الرمز',
    codeSentTo: 'أرسلنا رمزًا من 6 أرقام إلى',
    codeLabel: 'رمز التحقق',
    codeInvalid: 'الرمز مكوّن من 6 أرقام.',
    verify: 'تسجيل الدخول',
    resend: 'إعادة إرسال الرمز',
    resendIn: 'إعادة الإرسال بعد {s} ث',
    resent: 'أرسلنا رمزًا جديدًا.',
    changeNumber: 'تغيير الرقم',
  },
}

/**
 * Phone + SMS code, exactly as the app signs in (Better Auth's phone plugin).
 * The first verify of a new number creates the account; the auth trigger
 * writes its users row as a tourist, and the gate then sends them to /join.
 *
 * `verify` sets the session cookie on the Convex site and fires the client's
 * session signal, so ConvexBetterAuthProvider picks the session up without a
 * reload and this page's own gate redirects.
 */
export default function LoginPage() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { route } = usePartnerRoute()
  const [params] = useSearchParams()

  const [step, setStep] = useState('phone')
  const [rawPhone, setRawPhone] = useState('')
  const [phone, setPhone] = useState(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const busyRef = useRef(false)
  // Once the partner has started, a session flicker must not unmount the form.
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const id = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(id)
  }, [secondsLeft])

  if (route !== 'login' && route !== 'loading') {
    const next = safeNext(params.get('next'))
    return <Navigate to={next ?? dashboardPath(route)} replace />
  }
  if (route === 'loading' && !started) return <PageSpinner />

  // Asks for the SMS in the page's language (localeFromAcceptLanguage on the server).
  const localeOptions = { headers: { 'Accept-Language': lang } }

  const sendCode = async (target) => {
    const result = await authClient.phoneNumber.sendOtp({ phoneNumber: target, fetchOptions: localeOptions })
    if (result?.error) throw result
    setSecondsLeft(RESEND_SECONDS)
  }

  const onSend = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    const normalized = normalizePhone(rawPhone)
    if (!normalized) {
      setError(t.phoneInvalid)
      return
    }
    busyRef.current = true
    setStarted(true)
    setBusy(true)
    setError('')
    try {
      await sendCode(normalized)
      setPhone(normalized)
      setCode('')
      setStep('code')
    } catch (err) {
      setError(errorText(err, lang))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const onResend = async () => {
    if (busyRef.current || secondsLeft > 0 || !phone) return
    busyRef.current = true
    setBusy(true)
    setError('')
    setInfo('')
    try {
      await sendCode(phone)
      setInfo(t.resent)
    } catch (err) {
      setError(errorText(err, lang))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const verify = async (digits) => {
    if (busyRef.current) return
    if (digits.length !== CODE_LENGTH) {
      setError(t.codeInvalid)
      return
    }
    busyRef.current = true
    setBusy(true)
    setError('')
    setInfo('')
    try {
      const result = await authClient.phoneNumber.verify({ phoneNumber: phone, code: digits, fetchOptions: localeOptions })
      if (result?.error) throw result
      // The session signal re-renders this page through the gate above.
    } catch (err) {
      setError(errorText(err, lang))
      setCode('')
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const onCodeChange = (value) => {
    const digits = toLatinDigits(value).replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    if (error) setError('')
    if (digits.length === CODE_LENGTH) void verify(digits)
  }

  return (
    <div className="p-narrow">
      <div className="p-card p-stack">
        {step === 'phone' ? (
          <form className="p-stack" onSubmit={onSend} noValidate>
            <div>
              <h1 className="p-title">{t.title}</h1>
              <p className="p-subtitle" style={{ marginBottom: 0 }}>{t.subtitle}</p>
            </div>
            <div className="p-field">
              <label className="p-label" htmlFor="partner-phone">{t.phoneLabel}</label>
              <input
                id="partner-phone"
                className="p-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder={t.phonePlaceholder}
                value={rawPhone}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby="partner-phone-hint"
                onChange={(e) => {
                  setRawPhone(e.target.value)
                  if (error) setError('')
                }}
                autoFocus
              />
              <span id="partner-phone-hint" className="p-muted p-small">{t.phoneHint}</span>
              {error && <span className="p-field-error" role="alert">{error}</span>}
            </div>
            <button type="submit" className="p-btn p-btn-primary p-btn-block" disabled={busy}>
              {busy ? <Spinner /> : <Icon name="phone" size={18} />}
              <span>{t.send}</span>
            </button>
          </form>
        ) : (
          <form
            className="p-stack"
            onSubmit={(e) => {
              e.preventDefault()
              void verify(code)
            }}
            noValidate
          >
            <div>
              <h1 className="p-title">{t.codeTitle}</h1>
              <p className="p-subtitle" style={{ marginBottom: 0 }}>
                {t.codeSentTo} <Ltr>{formatPhone(phone)}</Ltr>
              </p>
            </div>
            <div className="p-field">
              <label className="p-label" htmlFor="partner-code">{t.codeLabel}</label>
              <input
                id="partner-code"
                className="p-input p-input-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH * 2}
                value={code}
                aria-invalid={error ? 'true' : undefined}
                onChange={(e) => onCodeChange(e.target.value)}
                autoFocus
              />
              {error && <span className="p-field-error" role="alert">{error}</span>}
              {info && <span className="p-muted p-small" role="status">{info}</span>}
            </div>
            <button type="submit" className="p-btn p-btn-primary p-btn-block" disabled={busy}>
              {busy && <Spinner />}
              <span>{t.verify}</span>
            </button>
            <div className="p-row" style={{ justifyContent: 'space-between' }}>
              <button
                type="button"
                className="p-link"
                onClick={() => {
                  setStep('phone')
                  setError('')
                  setInfo('')
                }}
                disabled={busy}
              >
                {t.changeNumber}
              </button>
              <button type="button" className="p-link" onClick={onResend} disabled={busy || secondsLeft > 0}>
                {secondsLeft > 0 ? t.resendIn.replace('{s}', String(secondsLeft)) : t.resend}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
