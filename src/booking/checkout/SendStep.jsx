import { useId, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { bookingErrorText, refusalKind } from '../errors'
import { MAX_NOTES, bookingArgs } from './choice'

const translations = {
  en: {
    notesLabel: {
      stay: 'Notes for the host (optional)',
      service: 'Anything the provider should know? (optional)',
    },
    notesPlaceholder: {
      stay: 'Arriving late, travelling with family…',
      service: 'Meeting point, languages, special requests…',
    },
    termsLead: 'By sending this request you agree to the ',
    terms: 'Terms of Service',
    termsTail: '.',
    send: 'Send booking request',
    trips: 'Open My trips',
    change: { stay: 'Change dates', service: 'Change day or time' },
    back: { stay: 'Back to the place', service: 'Back to the service' },
  },
  ar: {
    notesLabel: {
      stay: 'ملاحظات للمضيف (اختياري)',
      service: 'هل هناك ما يجب أن يعرفه مقدم الخدمة؟ (اختياري)',
    },
    notesPlaceholder: {
      stay: 'وصول متأخر، سفر مع العائلة…',
      service: 'نقطة اللقاء، اللغات، طلبات خاصة…',
    },
    termsLead: 'بإرسال هذا الطلب فإنك توافق على ',
    terms: 'شروط الخدمة',
    termsTail: '.',
    send: 'إرسال طلب الحجز',
    trips: 'افتح رحلاتي',
    change: { stay: 'تغيير التواريخ', service: 'تغيير اليوم أو الوقت' },
    back: { stay: 'العودة إلى المكان', service: 'العودة إلى الخدمة' },
  },
}

/**
 * The last step: notes, the terms, and the request itself.
 *
 * Before the request, the page's language is saved as the account's when it
 * differs (design W21), so the host's answer is emailed in the language the
 * booking was made in; a failure there never holds the booking up. Success
 * replaces the checkout with the trip page (`?sent=1` shows the banner), so
 * Back does not return to a form that has already been sent.
 *
 * A refusal is said under the button in the app's words (errors.js), with the
 * way forward it calls for: My trips for a duplicate, "Change dates" when the
 * choice is the problem. A missing phone or an ended session goes back to the
 * step that fixes it (`onNeedPhone`, `onNeedSignIn`) — the notes live on the
 * page, so they survive the detour. While the live quote says the request
 * cannot be made, the button is replaced by the reason and "Change dates".
 */
export default function SendStep({
  kind,
  lang,
  id,
  choice,
  user,
  quote,
  quoteText,
  notes,
  onNotes,
  changeHref,
  onNeedPhone,
  onNeedSignIn,
}) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const who = kind === 'service' ? 'service' : 'stay'
  const fieldId = useId()
  const navigate = useNavigate()
  const createStay = useMutation(api.bookings.mutations.createStayBooking)
  const createService = useMutation(api.bookings.mutations.createServiceBooking)
  const updateProfile = useMutation(api.users.mutations.updateProfile)
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState(null)
  const busyRef = useRef(false)

  const onSubmit = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    const args = bookingArgs(who, id, choice, notes)
    if (!args) return
    busyRef.current = true
    setBusy(true)
    setRefusal(null)
    try {
      if (user?.preferredLanguage !== lang) {
        try {
          await updateProfile({ preferredLanguage: lang })
        } catch (err) {
          console.error('[booking] the language was not saved:', err)
        }
      }
      const { bookingId } = who === 'service' ? await createService(args) : await createStay(args)
      // The spinner stays until the trip page takes over.
      navigate(`/trips/${encodeURIComponent(bookingId)}?sent=1`, { replace: true })
    } catch (err) {
      const next = refusalKind(err)
      const text = bookingErrorText(err, lang, who)
      busyRef.current = false
      setBusy(false)
      if (next === 'phone' && onNeedPhone) onNeedPhone(text)
      else if (next === 'auth' && onNeedSignIn) onNeedSignIn(text)
      else setRefusal({ text, kind: next })
    }
  }

  const blocked = quote.status === 'refused'
  // Both go back to the place or service page; the words say why. When the
  // place itself is not taking bookings, the dates are not the problem.
  const backLabel = (kindOfRefusal) => (kindOfRefusal === 'unavailable' ? t.back[who] : t.change[who])

  return (
    <form className="bk-stack" onSubmit={onSubmit} noValidate>
      <div className="bk-field">
        <label className="bk-label" htmlFor={fieldId}>{t.notesLabel[who]}</label>
        <textarea
          id={fieldId}
          className="bk-textarea"
          dir="auto"
          maxLength={MAX_NOTES}
          placeholder={t.notesPlaceholder[who]}
          value={notes}
          aria-describedby={`${fieldId}-count`}
          onChange={(e) => onNotes(e.target.value)}
        />
        <span id={`${fieldId}-count`} className="bk-counter">
          <bdi dir="ltr">{notes.length} / {MAX_NOTES}</bdi>
        </span>
      </div>

      <p className="bk-note">
        {t.termsLead}
        {/* A static page, not a route; a new tab keeps the notes typed here. */}
        <a className="bk-link" href="/terms-of-service.html" target="_blank" rel="noopener noreferrer">{t.terms}</a>
        {t.termsTail}
      </p>

      {blocked ? (
        <div className="co-blocked">
          <p className="bk-alert" role="status">{quoteText}</p>
          <Link className="bk-btn bk-btn-ghost" to={changeHref}>{backLabel(refusalKind(quote.reason))}</Link>
        </div>
      ) : (
        <>
          <button type="submit" className="bk-btn bk-btn-primary bk-btn-block" disabled={busy} aria-busy={busy || undefined}>
            {busy && <span className="bk-spinner" aria-hidden="true" />}
            <span>{t.send}</span>
          </button>
          {refusal && (
            <div className="co-refusal" role="alert">
              <p className="bk-error">{refusal.text}</p>
              {refusal.kind === 'duplicate' && <Link className="bk-link" to="/trips">{t.trips}</Link>}
              {(refusal.kind === 'dates' || refusal.kind === 'unavailable') && (
                <Link className="bk-link" to={changeHref}>{backLabel(refusal.kind)}</Link>
              )}
            </div>
          )}
        </>
      )}
    </form>
  )
}
