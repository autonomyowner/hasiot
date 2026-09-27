import { useId, useRef, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { authClient } from '../../lib/auth-client'
import { normalizePhone } from '../../partners/lib/phone'
import { CODE_LENGTH } from '../../components/auth/CodeBoxes'
import { RESEND_SECONDS } from '../../components/auth/ResendRing'
import { phoneErrorText } from '../errors'
import CodeEntry from './CodeEntry'
import PhoneField from './PhoneField'
import { alreadyVerified, codeFailure, phoneMode } from './phoneStep'
import { useCountdown } from './useCountdown'

const EMPTY_CODE = Array.from({ length: CODE_LENGTH }, () => '')

const translations = {
  en: {
    addTitle: 'Add your phone number',
    addBody: {
      stay: "SMS to Saudi numbers isn't available yet. Your host will see this number, marked as not confirmed.",
      service: "SMS to Saudi numbers isn't available yet. The provider will see this number, marked as not confirmed.",
    },
    verifyTitle: 'Verify your phone',
    verifyBody: {
      stay: 'Booking needs a verified number so your host can reach you.',
      service: 'Booking needs a verified number so the provider can reach you.',
    },
    codeTitle: 'Enter the code',
    save: 'Save number',
    send: 'Send code',
    verify: 'Verify',
    change: 'Change number',
    changeLabel: 'Change the mobile number',
    cancel: 'Cancel',
    phoneInvalid: 'Enter a valid mobile number.',
    saudiInvalid: 'Enter a valid Saudi mobile number (05XXXXXXXX)',
    codeInvalid: 'The code has 6 digits.',
    resent: 'A new code is on its way.',
  },
  ar: {
    addTitle: 'أضف رقم جوالك',
    addBody: {
      stay: 'رسائل SMS لا تصل إلى الأرقام السعودية بعد. سيرى المضيف هذا الرقم مع إشارة أنه غير موثّق.',
      service: 'رسائل SMS لا تصل إلى الأرقام السعودية بعد. سيرى مقدم الخدمة هذا الرقم مع إشارة أنه غير موثّق.',
    },
    verifyTitle: 'وثّق رقم جوالك',
    verifyBody: {
      stay: 'يحتاج الحجز إلى رقم موثّق ليتمكن المضيف من التواصل معك.',
      service: 'يحتاج الحجز إلى رقم موثّق ليتمكن مقدم الخدمة من التواصل معك.',
    },
    codeTitle: 'أدخل الرمز',
    save: 'حفظ الرقم',
    send: 'إرسال الرمز',
    verify: 'تحقق',
    change: 'تغيير الرقم',
    changeLabel: 'تغيير رقم الجوال',
    cancel: 'إلغاء',
    phoneInvalid: 'أدخل رقم جوال صحيحًا.',
    saudiInvalid: 'أدخل رقم جوال سعودي صحيح (05XXXXXXXX)',
    codeInvalid: 'الرمز مكوّن من 6 أرقام.',
    resent: 'أرسلنا رمزًا جديدًا.',
  },
}

/** A stored number back into the field: the local part under the +966 prefix. */
const fieldValueOf = (phone) => (phone ? (phone.startsWith('+966') ? phone.slice(4) : phone) : '')

/**
 * The phone a booking needs, for a signed-in account without one the server
 * accepts (`canBook === false`), or to change an unconfirmed one. The app's
 * VerifyPhoneSheet on the web (design W5): the number typed decides the path
 * (phoneStep.js) — a Saudi mobile is saved unconfirmed while Saudi SMS is
 * off, anything else gets a code that attaches it to this account.
 *
 * On success the button keeps spinning: the page closes this panel itself,
 * when getCurrentUser's `canBook` turns true (at once after a save, which
 * Convex reflects before the mutation resolves; a moment later after a
 * verify, which reaches the users row through Better Auth's trigger), or
 * straight away through `onDone` when it was opened to change a number.
 * busyRef stays set, so nothing is sent twice in that moment.
 */
export default function PhonePanel({ kind, lang, config, titleRef, initialPhone, onDone, onCancel }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const who = kind === 'service' ? 'service' : 'stay'
  const id = useId()
  const setContactPhone = useMutation(api.users.mutations.setContactPhone)

  const [step, setStep] = useState('phone')
  const [country, setCountry] = useState(() => (initialPhone && !initialPhone.startsWith('+966') ? 'intl' : 'sa'))
  const [rawPhone, setRawPhone] = useState(() => fieldValueOf(initialPhone))
  const [phone, setPhone] = useState(null)
  const [code, setCode] = useState(EMPTY_CODE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [secondsLeft, setSecondsLeft] = useCountdown()
  const busyRef = useRef(false)
  const phoneRef = useRef(null)

  const localeOptions = { headers: { 'Accept-Language': lang } }
  const typedMode = phoneMode(normalizePhone(rawPhone), country, config)
  // The words follow the path the number will take; a number neither path
  // takes keeps the country's words until it is fixed.
  const saving = (typedMode === 'invalid' ? phoneMode(null, country, config) : typedMode) === 'save'

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

  const save = async (target) => {
    begin()
    try {
      await setContactPhone({ phone: target })
    } catch (err) {
      if (!alreadyVerified(err)) {
        setError(phoneErrorText(err, lang))
        end()
        phoneRef.current?.focus()
        return
      }
    }
    onDone?.()
  }

  const sendCode = async (target) => {
    const result = await authClient.phoneNumber.sendOtp({ phoneNumber: target, fetchOptions: localeOptions })
    if (result?.error) throw result
    setSecondsLeft(RESEND_SECONDS)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    const target = normalizePhone(rawPhone)
    if (!target) {
      setError(t.phoneInvalid)
      phoneRef.current?.focus()
      return
    }
    const how = phoneMode(target, country, config)
    if (how === 'invalid') {
      setError(t.saudiInvalid)
      phoneRef.current?.focus()
      return
    }
    if (how === 'save') {
      await save(target)
      return
    }
    begin()
    try {
      await sendCode(target)
      setPhone(target)
      setCode(EMPTY_CODE)
      setStep('code')
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
      // updatePhoneNumber attaches the number to the signed-in account rather
      // than signing in as whoever owns it.
      const result = await authClient.phoneNumber.verify({
        phoneNumber: phone,
        code: digits,
        updatePhoneNumber: true,
        fetchOptions: localeOptions,
      })
      if (result?.error) throw result
    } catch (err) {
      const failure = codeFailure(err)
      setError(phoneErrorText(err, lang))
      setCode(EMPTY_CODE)
      if (failure === 'expired') setSecondsLeft(0)
      // The code was right, and is spent, but the number belongs to another
      // account: only a different number helps, so back to it, reason below.
      if (failure === 'taken') setStep('phone')
      end()
      return
    }
    onDone?.()
  }

  const onCodeChange = (next) => {
    setCode(next)
    if (error) setError('')
    const digits = next.join('')
    if (digits.length === CODE_LENGTH) void verify(digits)
  }

  const title = step === 'code' ? t.codeTitle : saving ? t.addTitle : t.verifyTitle

  return (
    <div className="bk-stack co-phone">
      <div className="co-sub-head">
        <h3 ref={titleRef} tabIndex={-1} className="co-sub-title">{title}</h3>
        {step === 'phone' && <p className="bk-note">{saving ? t.addBody[who] : t.verifyBody[who]}</p>}
      </div>

      {step === 'code' ? (
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
          onEdit={() => {
            setStep('phone')
            setError('')
            setInfo('')
          }}
          editLabel={t.change}
          editAria={t.changeLabel}
          submitLabel={t.verify}
        />
      ) : (
        <form className="bk-stack" onSubmit={onSubmit} noValidate>
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
            inputRef={phoneRef}
          />
          <div className="co-actions">
            <button type="submit" className="bk-btn bk-btn-primary" disabled={busy} aria-busy={busy || undefined}>
              {busy && <span className="bk-spinner" aria-hidden="true" />}
              <span>{saving ? t.save : t.send}</span>
            </button>
            {onCancel && (
              <button type="button" className="bk-btn bk-btn-ghost" onClick={onCancel} disabled={busy}>
                {t.cancel}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
