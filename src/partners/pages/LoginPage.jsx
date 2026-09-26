import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { authClient } from '../../lib/auth-client'
import { usePartnerLang, pick } from '../lang'
import { usePartnerRoute } from '../usePartnerGate'
import { dashboardPath, safeNext } from '../lib/gate'
import { formatPhone, normalizePhone, toLatinDigits } from '../lib/phone'
import { SAUDI_SMS_LIVE, smsBlockedFor } from '../lib/smsAvailability'
import { errorText } from '../lib/errors'
import { Icon, Ltr, PageSpinner, Spinner } from '../components/Ui'

const CODE_LENGTH = 6
const RESEND_SECONDS = 60
const SUPPORT_EMAIL = 'support@hasio.xyz'

const translations = {
  en: {
    title: 'Partner sign in',
    subtitle: 'Hotels, places and service providers on Hasio. Same account as the app.',
    countryLabel: 'Where is your mobile number from?',
    saudi: 'Saudi Arabia',
    other: 'Another country',
    phoneLabel: 'Mobile number',
    saPlaceholder: '5X XXX XXXX',
    intlPlaceholder: '+213 6XX XX XX XX',
    saHintLead: 'As you usually write it:',
    or: 'or',
    intlHint: 'Include the country code.',
    phoneInvalid: 'Enter a valid mobile number.',
    send: 'Send code',
    noticeTitle: 'Saudi numbers are coming soon',
    noticeBody:
      "We're completing SMS activation for Saudi (+966) numbers with our messaging partner. Sign-in codes to Saudi numbers will be available shortly. Partners with a number from another country can sign in now.",
    noticeContact: 'Questions?',
    codeTitle: 'Enter the code',
    codeSentTo: 'We sent a 6-digit code to',
    edit: 'Edit',
    editLabel: 'Edit the mobile number',
    codeLabel: 'Verification code',
    digitLabel: 'Digit {n} of 6',
    codeInvalid: 'The code has 6 digits.',
    verify: 'Sign in',
    verifying: 'Checking the code…',
    resend: 'Resend code',
    resendIn: 'Resend in {s}s',
    resent: 'A new code is on its way.',
  },
  ar: {
    title: 'دخول الشركاء',
    subtitle: 'للفنادق والأماكن ومقدمي الخدمات على Hasio. نفس حسابك في التطبيق.',
    countryLabel: 'من أي دولة رقم جوالك؟',
    saudi: 'السعودية',
    other: 'دولة أخرى',
    phoneLabel: 'رقم الجوال',
    saPlaceholder: '5X XXX XXXX',
    intlPlaceholder: '+213 6XX XX XX XX',
    saHintLead: 'كما تكتبه عادة:',
    or: 'أو',
    intlHint: 'اكتب الرقم مع رمز الدولة.',
    phoneInvalid: 'أدخل رقم جوال صحيحًا.',
    send: 'إرسال الرمز',
    noticeTitle: 'أرقام السعودية قريبًا',
    noticeBody:
      'نعمل مع شريك الرسائل على تفعيل رسائل التحقق للأرقام السعودية (+966)، وستتوفر رموز الدخول لها قريبًا جدًا. يمكن للشركاء الذين لديهم رقم من دولة أخرى تسجيل الدخول الآن.',
    noticeContact: 'للاستفسار:',
    codeTitle: 'أدخل الرمز',
    codeSentTo: 'أرسلنا رمزًا من 6 أرقام إلى',
    edit: 'تعديل',
    editLabel: 'تعديل رقم الجوال',
    codeLabel: 'رمز التحقق',
    digitLabel: 'الرقم {n} من 6',
    codeInvalid: 'الرمز مكوّن من 6 أرقام.',
    verify: 'تسجيل الدخول',
    verifying: 'جارٍ التحقق من الرمز…',
    resend: 'إعادة إرسال الرمز',
    resendIn: 'إعادة الإرسال بعد {s} ث',
    resent: 'أرسلنا رمزًا جديدًا.',
  },
}

const EMPTY_CODE = Array.from({ length: CODE_LENGTH }, () => '')

/** Only digits, Arabic-Indic folded to Latin. */
const digitsOf = (value) => toLatinDigits(value).replace(/\D/g, '')

/**
 * Arrow keys move the choice in a radio group, as a native radio set does.
 * `rtl` flips left/right so the arrow points where the focus goes.
 */
function onRadioKeys(e, values, current, select, rtl) {
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl ? 'ArrowRight' : 'ArrowLeft'
  let step = 0
  if (e.key === forward || e.key === 'ArrowDown') step = 1
  else if (e.key === back || e.key === 'ArrowUp') step = -1
  else return
  e.preventDefault()
  const i = Math.max(0, values.indexOf(current))
  const next = values[(i + step + values.length) % values.length]
  select(next)
  const group = e.currentTarget.closest('[role="radiogroup"]')
  group?.querySelector(`[data-value="${next}"]`)?.focus()
}

/**
 * Six boxes for the SMS code. Always left-to-right, even in Arabic: a code is
 * read digit by digit in the order it arrived. Typing moves on, Backspace on
 * an empty box goes back, a paste or an SMS autofill of the whole code fills
 * every box at once.
 */
function CodeBoxes({ value, onChange, disabled, invalid, verifying, label, digitLabel }) {
  const refs = useRef([])
  const focusAt = (i) => {
    const el = refs.current[Math.max(0, Math.min(CODE_LENGTH - 1, i))]
    el?.focus()
    el?.select()
  }

  // Writes `digits` starting at box `from`, then focuses the next empty box.
  const fill = (from, digits) => {
    const next = [...value]
    let i = from
    for (const d of digits) {
      if (i >= CODE_LENGTH) break
      next[i] = d
      i += 1
    }
    onChange(next)
    focusAt(i >= CODE_LENGTH ? CODE_LENGTH - 1 : i)
  }

  const onInput = (i, raw) => {
    const digits = digitsOf(raw)
    if (!digits) {
      const next = [...value]
      next[i] = ''
      onChange(next)
      return
    }
    // A whole code arriving in one box (iOS/Android autofill) fills from the start.
    if (digits.length >= CODE_LENGTH) return fill(0, digits.slice(0, CODE_LENGTH))
    // The box already held a digit: keep the one just typed.
    const typed = digits.length > 1 && value[i] ? digits.replace(value[i], '') || digits.slice(-1) : digits
    fill(i, typed)
  }

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      e.preventDefault()
      const next = [...value]
      next[i - 1] = ''
      onChange(next)
      focusAt(i - 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      focusAt(i + 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      focusAt(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      focusAt(CODE_LENGTH - 1)
    }
  }

  const onPaste = (i, e) => {
    const digits = digitsOf(e.clipboardData.getData('text'))
    if (!digits) return
    e.preventDefault()
    fill(digits.length >= CODE_LENGTH ? 0 : i, digits.slice(0, CODE_LENGTH))
  }

  // After a wrong code the boxes are emptied; put the caret back in the first.
  const empty = value.every((d) => !d)
  useEffect(() => {
    if (empty && !disabled) refs.current[0]?.focus()
  }, [empty, disabled])

  return (
    <div
      className={`p-otp${verifying ? ' is-verifying' : ''}`}
      role="group"
      aria-label={label}
      dir="ltr"
    >
      {value.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el }}
          className="p-otp-box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={digitLabel.replace('{n}', String(i + 1))}
          aria-invalid={invalid ? 'true' : undefined}
          value={d}
          disabled={disabled}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKeyDown(i, e)}
          onPaste={(e) => onPaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}

/** The resend countdown as a thin ring that empties, with the seconds beside it. */
function ResendRing({ seconds }) {
  const r = 8
  const c = 2 * Math.PI * r
  return (
    <svg className="p-ring" width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r={r} className="p-ring-track" />
      <circle
        cx="10"
        cy="10"
        r={r}
        className="p-ring-fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - seconds / RESEND_SECONDS)}
      />
    </svg>
  )
}

/**
 * Phone + SMS code, exactly as the app signs in (Better Auth's phone plugin).
 * The first verify of a new number creates the account; the auth trigger
 * writes its users row as a tourist, and the gate then sends them to /join.
 *
 * `verify` sets the session cookie on the Convex site and fires the client's
 * session signal, so ConvexBetterAuthProvider picks the session up without a
 * reload and this page's own gate redirects.
 *
 * Saudi numbers: production SMS cannot reach +966 yet (smsAvailability.js).
 * The page says so up front and never sends to a Saudi number while that
 * holds, rather than leaving a partner waiting for a text that never comes.
 */
export default function LoginPage() {
  const { lang, isRtl } = usePartnerLang()
  const t = pick(translations, lang)
  const { route } = usePartnerRoute()
  const [params] = useSearchParams()

  const [step, setStep] = useState('phone')
  const [country, setCountry] = useState('sa')
  const [rawPhone, setRawPhone] = useState('')
  const [phone, setPhone] = useState(null)
  const [code, setCode] = useState(EMPTY_CODE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [pulse, setPulse] = useState(0)
  const busyRef = useRef(false)
  const phoneRef = useRef(null)
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

  const typed = normalizePhone(rawPhone)
  const showNotice = !SAUDI_SMS_LIVE && (country === 'sa' || smsBlockedFor(typed))

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
      phoneRef.current?.focus()
      return
    }
    // A code to a Saudi number would never arrive: point at the notice instead.
    if (smsBlockedFor(normalized)) {
      setError('')
      setPulse((n) => n + 1)
      phoneRef.current?.focus()
      return
    }
    busyRef.current = true
    setStarted(true)
    setBusy(true)
    setError('')
    try {
      await sendCode(normalized)
      setPhone(normalized)
      setCode(EMPTY_CODE)
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
      setCode(EMPTY_CODE)
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const onCodeChange = (next) => {
    setCode(next)
    if (error) setError('')
    const digits = next.join('')
    if (digits.length === CODE_LENGTH) void verify(digits)
  }

  const selectCountry = (value) => {
    setCountry(value)
    setError('')
  }
  const countries = [
    { value: 'sa', label: t.saudi, sub: '+966' },
    { value: 'intl', label: t.other },
  ]

  const codeString = code.join('')
  const verifying = busy && codeString.length === CODE_LENGTH

  return (
    <div className="p-auth-card">
      {step === 'phone' ? (
        <form key="phone" className="p-stack p-auth-step" onSubmit={onSend} noValidate>
          <div>
            <h1 className="p-title">{t.title}</h1>
            <p className="p-subtitle" style={{ marginBottom: 0 }}>{t.subtitle}</p>
          </div>

          <div
            className="p-seg"
            role="radiogroup"
            aria-label={t.countryLabel}
            style={{ '--seg-n': countries.length, '--seg-i': Math.max(0, countries.findIndex((c) => c.value === country)) }}
          >
            {countries.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                data-value={c.value}
                aria-checked={country === c.value}
                tabIndex={country === c.value ? 0 : -1}
                className={country === c.value ? 'p-seg-opt is-selected' : 'p-seg-opt'}
                onClick={() => selectCountry(c.value)}
                onKeyDown={(e) => onRadioKeys(e, countries.map((x) => x.value), country, selectCountry, isRtl)}
              >
                <span>{c.label}</span>
                {c.sub && <span className="p-seg-sub" dir="ltr">{c.sub}</span>}
              </button>
            ))}
          </div>

          <div className="p-field">
            <label className="p-label" htmlFor="partner-phone">{t.phoneLabel}</label>
            <div className={`p-phone${country === 'sa' ? ' has-prefix' : ''}`} dir="ltr">
              {country === 'sa' && <span className="p-phone-prefix" aria-hidden="true">+966</span>}
              <input
                ref={phoneRef}
                id="partner-phone"
                className="p-input"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                placeholder={country === 'sa' ? t.saPlaceholder : t.intlPlaceholder}
                value={rawPhone}
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={`partner-phone-hint${showNotice ? ' partner-sms-notice' : ''}`}
                onChange={(e) => {
                  setRawPhone(e.target.value)
                  if (error) setError('')
                }}
                autoFocus
              />
            </div>
            <span id="partner-phone-hint" className="p-muted p-small">
              {country === 'sa' ? (
                <>
                  {t.saHintLead} <bdi dir="ltr">05…</bdi>{lang === 'en' ? ',' : '،'} <bdi dir="ltr">5…</bdi> {t.or} <bdi dir="ltr">+966…</bdi>
                </>
              ) : t.intlHint}
            </span>
            {error && <span className="p-field-error" role="alert">{error}</span>}
          </div>

          {showNotice && (
            <div
              key={pulse}
              id="partner-sms-notice"
              className={`p-callout${pulse > 0 ? ' is-pulse' : ''}`}
              role="note"
            >
              <span className="p-callout-icon"><Icon name="info" size={20} /></span>
              <div>
                <p className="p-callout-title">{t.noticeTitle}</p>
                <p className="p-callout-body">{t.noticeBody}</p>
                <p className="p-callout-body">
                  {t.noticeContact}{' '}
                  <a className="p-link" href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">{SUPPORT_EMAIL}</a>
                </p>
              </div>
            </div>
          )}

          <button type="submit" className="p-btn p-btn-primary p-btn-block p-btn-lg" disabled={busy}>
            {busy ? <Spinner /> : <Icon name="phone" size={18} />}
            <span>{t.send}</span>
          </button>
        </form>
      ) : (
        <form
          key="code"
          className="p-stack p-auth-step"
          onSubmit={(e) => {
            e.preventDefault()
            void verify(codeString)
          }}
          noValidate
        >
          <div>
            <h1 className="p-title">{t.codeTitle}</h1>
            <p className="p-subtitle" style={{ marginBottom: 0 }}>
              {t.codeSentTo} <Ltr><strong className="p-auth-number">{formatPhone(phone)}</strong></Ltr>{' '}
              <button
                type="button"
                className="p-link p-auth-edit"
                aria-label={t.editLabel}
                onClick={() => {
                  setStep('phone')
                  setError('')
                  setInfo('')
                }}
                disabled={busy}
              >
                {t.edit}
              </button>
            </p>
          </div>

          <div className="p-field">
            <span className="p-label" aria-hidden="true">{t.codeLabel}</span>
            <CodeBoxes
              value={code}
              onChange={onCodeChange}
              disabled={busy}
              invalid={Boolean(error)}
              verifying={verifying}
              label={t.codeLabel}
              digitLabel={t.digitLabel}
            />
            {verifying && (
              <span className="p-otp-status" role="status">
                <span className="p-spinner" aria-hidden="true" />
                <span>{t.verifying}</span>
              </span>
            )}
            {error && <span className="p-field-error" role="alert">{error}</span>}
            {info && <span className="p-muted p-small" role="status">{info}</span>}
          </div>

          <button type="submit" className="p-btn p-btn-primary p-btn-block p-btn-lg" disabled={busy}>
            {busy && <Spinner />}
            <span>{t.verify}</span>
          </button>

          <div className="p-auth-resend">
            {secondsLeft > 0 ? (
              <span className="p-muted p-small p-auth-countdown">
                <ResendRing seconds={secondsLeft} />
                <span aria-live="off">{t.resendIn.replace('{s}', String(secondsLeft))}</span>
              </span>
            ) : (
              <button type="button" className="p-link" onClick={onResend} disabled={busy}>
                {t.resend}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
