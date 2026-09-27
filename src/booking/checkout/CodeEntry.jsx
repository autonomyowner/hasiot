import CodeBoxes, { CODE_LENGTH } from '../../components/auth/CodeBoxes'
import ResendRing from '../../components/auth/ResendRing'
import { formatPhone } from '../../partners/lib/phone'

const translations = {
  en: {
    sentTo: 'We sent a 6-digit code to',
    codeLabel: 'Verification code',
    digitLabel: 'Digit {n} of 6',
    verifying: 'Checking the code…',
    resend: 'Resend code',
    resendIn: 'Resend in {s}s',
  },
  ar: {
    sentTo: 'أرسلنا رمزًا من 6 أرقام إلى',
    codeLabel: 'رمز التحقق',
    digitLabel: 'الرقم {n} من 6',
    verifying: 'جارٍ التحقق من الرمز…',
    resend: 'إعادة إرسال الرمز',
    resendIn: 'إعادة الإرسال بعد {s} ث',
  },
}

/**
 * The code half of a phone step: where it went (with a way back to the
 * number), the six boxes, and the resend countdown. The page owns the state
 * and the calls; the boxes send themselves at the sixth digit (`onCodeChange`
 * → the page's verify), and the button is there for anyone who pastes or
 * edits a digit.
 */
export default function CodeEntry({
  lang,
  phone,
  code,
  onCodeChange,
  onSubmit,
  busy,
  error,
  info,
  secondsLeft,
  onResend,
  onEdit,
  editLabel,
  editAria,
  submitLabel,
}) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const digits = code.join('')
  const verifying = busy && digits.length === CODE_LENGTH

  return (
    <form
      className="bk-stack co-code"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(digits)
      }}
      noValidate
    >
      <p className="co-code-sent">
        {t.sentTo} <bdi dir="ltr"><strong>{formatPhone(phone)}</strong></bdi>{' '}
        <button type="button" className="bk-link" aria-label={editAria} onClick={onEdit} disabled={busy}>
          {editLabel}
        </button>
      </p>

      <div className="bk-field">
        <span className="bk-label" aria-hidden="true">{t.codeLabel}</span>
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
          <span className="co-status" role="status">
            <span className="bk-spinner" aria-hidden="true" />
            <span>{t.verifying}</span>
          </span>
        )}
        {error && <p className="bk-error" role="alert">{error}</p>}
        {info && <p className="bk-hint" role="status">{info}</p>}
      </div>

      <button type="submit" className="bk-btn bk-btn-primary bk-btn-block" disabled={busy} aria-busy={busy || undefined}>
        {busy && <span className="bk-spinner" aria-hidden="true" />}
        <span>{submitLabel}</span>
      </button>

      <div className="co-resend">
        {secondsLeft > 0 ? (
          <span className="bk-hint co-countdown">
            <ResendRing seconds={secondsLeft} />
            <span aria-live="off">{t.resendIn.replace('{s}', String(secondsLeft))}</span>
          </span>
        ) : (
          <button type="button" className="bk-link" onClick={onResend} disabled={busy}>
            {t.resend}
          </button>
        )}
      </div>
    </form>
  )
}
