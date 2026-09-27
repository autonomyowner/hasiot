import { useEffect, useId, useRef, useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { AUTH_BASE_URL, authClient } from '../../lib/auth-client'
import { normalizePhone } from '../../partners/lib/phone'
import { saudiSmsOpen, smsBlockedFor } from '../../partners/lib/smsAvailability'
import { oauthStartURL } from '../../partners/lib/googleSignIn'
import { CODE_LENGTH } from '../../components/auth/CodeBoxes'
import GoogleMark from '../../components/auth/GoogleMark'
import { RESEND_SECONDS } from '../../components/auth/ResendRing'
import { phoneErrorText } from '../errors'
import CodeEntry from './CodeEntry'
import PhoneField from './PhoneField'
import { InfoIcon } from './icons'
import { codeFailure } from './phoneStep'
import { useCountdown } from './useCountdown'
import './checkout.css'

const EMPTY_CODE = Array.from({ length: CODE_LENGTH }, () => '')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const translations = {
  en: {
    google: 'Continue with Google',
    googleFailed: "Google sign-in didn't complete. Please try again.",
    or: 'or',
    send: 'Send code',
    phoneInvalid: 'Enter a valid mobile number.',
    noticeTitle: "SMS codes can't reach Saudi numbers yet.",
    noticeGoogle: 'Continue with Google instead.',
    noticeOther: 'Use a number from another country, or sign in with email if you already have an account.',
    edit: 'Edit',
    editLabel: 'Edit the mobile number',
    codeInvalid: 'The code has 6 digits.',
    verify: 'Sign in',
    resent: 'A new code is on its way.',
    withEmail: 'Sign in with email',
    withPhone: 'Use a mobile number instead',
    emailNote: 'Email sign-in is for existing accounts. New accounts start with Google or a phone number.',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    emailMissing: 'Enter your email address.',
    emailInvalid: 'Enter a valid email address.',
    passwordMissing: 'Enter your password.',
    signIn: 'Sign in',
  },
  ar: {
    // "Google" stays in Latin script: it is the brand the button leads to.
    google: 'المتابعة باستخدام Google',
    googleFailed: 'لم يكتمل تسجيل الدخول عبر Google. حاول مرة أخرى.',
    or: 'أو',
    send: 'إرسال الرمز',
    phoneInvalid: 'أدخل رقم جوال صحيحًا.',
    noticeTitle: 'رسائل الرمز لا تصل إلى الأرقام السعودية حاليًا.',
    noticeGoogle: 'تابع باستخدام Google.',
    noticeOther: 'استخدم رقمًا من دولة أخرى، أو سجّل الدخول بالبريد الإلكتروني إن كان لديك حساب.',
    edit: 'تعديل',
    editLabel: 'تعديل رقم الجوال',
    codeInvalid: 'الرمز مكوّن من 6 أرقام.',
    verify: 'تسجيل الدخول',
    resent: 'أرسلنا رمزًا جديدًا.',
    withEmail: 'الدخول بالبريد الإلكتروني',
    withPhone: 'استخدم رقم الجوال بدلًا من ذلك',
    emailNote: 'الدخول بالبريد للحسابات الحالية فقط. الحسابات الجديدة تبدأ بـ Google أو رقم الجوال.',
    emailLabel: 'البريد الإلكتروني',
    passwordLabel: 'كلمة المرور',
    emailMissing: 'أدخل بريدك الإلكتروني.',
    emailInvalid: 'أدخل بريدًا إلكترونيًا صحيحًا.',
    passwordMissing: 'أدخل كلمة المرور.',
    signIn: 'تسجيل الدخول',
  },
}

/**
 * The traveller's sign-in, for /login and the checkout's first step: Google,
 * a phone code, or email for accounts that already have a password (design
 * W1) — the app's three ways in. A first phone code or a first Google sign-in
 * creates the account; there is no separate sign-up.
 *
 * Google is a top-level navigation to /oauth-start, never a fetch (the
 * login-CSRF fix, partners/lib/googleSignIn.js), and returns to `returnTo` on
 * success and failure alike. The page reads a failure from the address once
 * and passes it in as `errorFromReturn`; a Cancel on Google's screen says
 * nothing. The button only appears once the server says Google is set up.
 *
 * Saudi numbers: SMS cannot reach +966 yet, so no code is sent to one while
 * getPublicConfig says so — the notice points at Google instead of leaving a
 * traveller waiting for a text that never comes.
 *
 * A successful phone or email sign-in fires Better Auth's session signal, and
 * the page re-renders as signed in by itself; `onSignedIn` is for a page that
 * was already signed in and asked to sign in again.
 */
export default function SignInPanel({ returnTo, lang, errorFromReturn = false, onSignedIn }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const id = useId()
  const config = useQuery(api.config.queries.getPublicConfig, {})
  const saudiLive = saudiSmsOpen(config)
  // Hidden while the config loads: a button that appears and then fails is
  // worse than one that appears a moment late.
  const googleOn = config?.googleAuth === true

  const [mode, setMode] = useState('phone')
  const [country, setCountry] = useState('sa')
  const [rawPhone, setRawPhone] = useState('')
  const [phone, setPhone] = useState(null)
  const [code, setCode] = useState(EMPTY_CODE)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  // true = back from Google with a failure, a string = the start itself failed.
  const [googleError, setGoogleError] = useState(() => Boolean(errorFromReturn))
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [pulse, setPulse] = useState(0)
  const [secondsLeft, setSecondsLeft] = useCountdown()
  // Two taps can land in one frame, before `busy` has re-rendered anything.
  const busyRef = useRef(false)
  const phoneRef = useRef(null)
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  // Back from Google's page restores this one from the back/forward cache
  // with the button still spinning. Un-stick it.
  useEffect(() => {
    const onShow = (e) => {
      if (!e.persisted) return
      busyRef.current = false
      setGoogleBusy(false)
      setBusy(false)
    }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  // The SMS comes in the page's language (the server reads Accept-Language).
  const localeOptions = { headers: { 'Accept-Language': lang } }
  const typed = normalizePhone(rawPhone)
  const showNotice = !saudiLive && (country === 'sa' || smsBlockedFor(typed, saudiLive))
  const noticeId = `${id}-notice`

  const begin = () => {
    busyRef.current = true
    setBusy(true)
    setError('')
    setInfo('')
  }
  const end = () => {
    busyRef.current = false
    setBusy(false)
  }

  // After a sign-in succeeds the page swaps this panel out, but only once the
  // session has reached Convex, a moment later. Re-enabling the form in that
  // moment would invite a second tap on a code already used ("This code has
  // expired…" under a form about to vanish), so it stays busy — released
  // after a while only in case the session never arrives.
  const holdTimer = useRef(null)
  useEffect(() => () => clearTimeout(holdTimer.current), [])
  const holdAfterSuccess = () => {
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(end, 15000)
  }

  const onGoogle = () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setGoogleBusy(true)
    setError('')
    setGoogleError(false)
    try {
      // Leaves the page; busy holds until it does (or pageshow resets it).
      window.location.assign(oauthStartURL(AUTH_BASE_URL, returnTo))
    } catch (err) {
      // Under the Google button: the number is not what failed.
      setGoogleError(phoneErrorText(err, lang))
      busyRef.current = false
      setBusy(false)
      setGoogleBusy(false)
    }
  }

  const sendCode = async (target) => {
    const result = await authClient.phoneNumber.sendOtp({ phoneNumber: target, fetchOptions: localeOptions })
    if (result?.error) throw result
    setSecondsLeft(RESEND_SECONDS)
  }

  const onSend = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    const target = normalizePhone(rawPhone)
    if (!target) {
      setError(t.phoneInvalid)
      phoneRef.current?.focus()
      return
    }
    // A code to a Saudi number would never arrive: point at the notice instead.
    if (smsBlockedFor(target, saudiLive)) {
      setError('')
      setPulse((n) => n + 1)
      phoneRef.current?.focus()
      return
    }
    begin()
    setGoogleError(false)
    try {
      await sendCode(target)
      setPhone(target)
      setCode(EMPTY_CODE)
      setMode('code')
    } catch (err) {
      setError(phoneErrorText(err, lang))
    } finally {
      end()
    }
  }

  const onResend = async () => {
    if (busyRef.current || secondsLeft > 0 || !phone) return
    begin()
    try {
      await sendCode(phone)
      setInfo(t.resent)
    } catch (err) {
      setError(phoneErrorText(err, lang))
    } finally {
      end()
    }
  }

  const verify = async (digits) => {
    if (busyRef.current) return
    if (digits.length !== CODE_LENGTH) {
      setError(t.codeInvalid)
      return
    }
    begin()
    try {
      const result = await authClient.phoneNumber.verify({ phoneNumber: phone, code: digits, fetchOptions: localeOptions })
      if (result?.error) throw result
      onSignedIn?.()
      holdAfterSuccess()
    } catch (err) {
      setError(phoneErrorText(err, lang))
      setCode(EMPTY_CODE)
      // An expired or exhausted code needs a new one: no reason to wait.
      if (codeFailure(err) === 'expired') setSecondsLeft(0)
      end()
    }
  }

  const onCodeChange = (next) => {
    setCode(next)
    if (error) setError('')
    const digits = next.join('')
    if (digits.length === CODE_LENGTH) void verify(digits)
  }

  const onEmail = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    const address = email.trim()
    if (!address || !EMAIL.test(address)) {
      setError(address ? t.emailInvalid : t.emailMissing)
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setError(t.passwordMissing)
      passwordRef.current?.focus()
      return
    }
    begin()
    setGoogleError(false)
    try {
      const result = await authClient.signIn.email({ email: address, password })
      if (result?.error) throw result
      onSignedIn?.()
      holdAfterSuccess()
    } catch (err) {
      setError(phoneErrorText(err, lang))
      end()
    }
  }

  const switchTo = (next) => {
    setMode(next)
    setError('')
    setInfo('')
  }

  return (
    <div className="co-signin">
      {mode !== 'code' && (googleOn || googleError) && (
        <div className="co-google">
          {googleOn && (
            <button
              type="button"
              className="bk-btn bk-btn-ghost bk-btn-block"
              onClick={onGoogle}
              disabled={busy}
              aria-busy={googleBusy || undefined}
              aria-describedby={googleError ? `${id}-google-error` : undefined}
            >
              {googleBusy ? <span className="bk-spinner" aria-hidden="true" /> : <GoogleMark />}
              <span>{t.google}</span>
            </button>
          )}
          {googleError && (
            <p id={`${id}-google-error`} className="bk-error" role="alert">
              {googleError === true ? t.googleFailed : googleError}
            </p>
          )}
          {googleOn && <div className="co-or"><span>{t.or}</span></div>}
        </div>
      )}

      {mode === 'code' ? (
        <CodeEntry
          lang={lang}
          phone={phone}
          code={code}
          onCodeChange={onCodeChange}
          onSubmit={(digits) => void verify(digits)}
          busy={busy}
          error={error}
          info={info}
          secondsLeft={secondsLeft}
          onResend={onResend}
          onEdit={() => switchTo('phone')}
          editLabel={t.edit}
          editAria={t.editLabel}
          submitLabel={t.verify}
        />
      ) : mode === 'email' ? (
        <form className="bk-stack" onSubmit={onEmail} noValidate>
          <p className="bk-note">{t.emailNote}</p>
          <div className="bk-field">
            <label className="bk-label" htmlFor={`${id}-email`}>{t.emailLabel}</label>
            <input
              ref={emailRef}
              id={`${id}-email`}
              className="bk-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError('')
              }}
            />
          </div>
          <div className="bk-field">
            <label className="bk-label" htmlFor={`${id}-password`}>{t.passwordLabel}</label>
            <input
              ref={passwordRef}
              id={`${id}-password`}
              className="bk-input"
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError('')
              }}
            />
          </div>
          {error && <p className="bk-error" role="alert">{error}</p>}
          <button type="submit" className="bk-btn bk-btn-primary bk-btn-block" disabled={busy} aria-busy={(busy && !googleBusy) || undefined}>
            {busy && !googleBusy && <span className="bk-spinner" aria-hidden="true" />}
            <span>{t.signIn}</span>
          </button>
          <button type="button" className="bk-link co-switch" onClick={() => switchTo('phone')} disabled={busy}>
            {t.withPhone}
          </button>
        </form>
      ) : (
        <form className="bk-stack" onSubmit={onSend} noValidate>
          <PhoneField
            id={`${id}-phone`}
            lang={lang}
            country={country}
            onCountry={(value) => {
              setCountry(value)
              setError('')
            }}
            value={rawPhone}
            onChange={(value) => {
              setRawPhone(value)
              if (error) setError('')
            }}
            error={error}
            describedBy={showNotice ? noticeId : null}
            inputRef={phoneRef}
          />

          {showNotice && (
            <div key={pulse} id={noticeId} className={`bk-callout${pulse > 0 ? ' bk-shake' : ''}`} role="note">
              <InfoIcon />
              <div>
                <p><strong>{t.noticeTitle}</strong></p>
                {/* With Google on, that is the way in; without it, a number from
                    elsewhere or an existing email account. */}
                <p>{googleOn ? t.noticeGoogle : t.noticeOther}</p>
              </div>
            </div>
          )}

          <button type="submit" className="bk-btn bk-btn-primary bk-btn-block" disabled={busy} aria-busy={(busy && !googleBusy) || undefined}>
            {busy && !googleBusy && <span className="bk-spinner" aria-hidden="true" />}
            <span>{t.send}</span>
          </button>
          <button type="button" className="bk-link co-switch" onClick={() => switchTo('email')} disabled={busy}>
            {t.withEmail}
          </button>
        </form>
      )}
    </div>
  )
}
