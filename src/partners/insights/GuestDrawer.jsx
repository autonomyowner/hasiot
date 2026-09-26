import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog as DialogPrimitive } from 'radix-ui'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useQuerySafe } from '../../admin/useQuerySafe'
import { toastApi } from '../../admin/components/toast-context'
import { usePartnerLang, pick } from '../lang'
import { usePartnerConfirm } from '../confirm'
import { ErrorState, Icon, Ltr, Spinner } from '../components/Ui'
import { errorText } from '../lib/errors'
import { formatPhone } from '../lib/phone'
import { InsightIcon } from './InsightsUi'
import {
  addTag,
  DEFAULT_TAGS,
  formatDay,
  formatMoney,
  formatTimestamp,
  NOTE_MAX_LENGTH,
  TAG_MAX_COUNT,
  TAG_MAX_LENGTH,
  tagLabel,
} from './format'

const translations = {
  en: {
    loading: 'Loading guest',
    close: 'Close',
    unnamed: 'Guest',
    contact: 'Contact',
    phone: 'Phone',
    phoneUnconfirmed: 'not confirmed by SMS',
    email: 'Email',
    noContact: 'No contact details.',
    bookings: 'Bookings with you',
    noBookings: 'No bookings.',
    note: 'Private note',
    noteHint: 'Only you see this. The guest never does.',
    notePlaceholder: 'For example: prefers a ground-floor room',
    tags: 'Tags',
    addTag: 'Add a tag',
    addTagButton: 'Add',
    removeTag: 'Remove tag',
    tagLimit: `Up to ${TAG_MAX_COUNT} tags, ${TAG_MAX_LENGTH} characters each.`,
    save: 'Save',
    saved: 'Note saved.',
    updated: 'Last saved',
    leaveTitle: 'Discard your changes?',
    leaveBody: 'The note and tags you edited have not been saved.',
    leave: 'Discard',
    errorTitle: 'This guest could not be loaded',
    retry: 'Try again',
    status: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      declined: 'Declined',
      cancelled: 'Cancelled',
      expired: 'Expired',
      no_show: 'No-show',
    },
    at: 'at',
  },
  ar: {
    loading: 'جارٍ تحميل الضيف',
    close: 'إغلاق',
    unnamed: 'ضيف',
    contact: 'التواصل',
    phone: 'الجوال',
    phoneUnconfirmed: 'غير موثّق برسالة',
    email: 'البريد',
    noContact: 'لا توجد بيانات تواصل.',
    bookings: 'حجوزاته لديك',
    noBookings: 'لا توجد حجوزات.',
    note: 'ملاحظة خاصة',
    noteHint: 'لا يراها أحد غيرك، ولا يراها الضيف أبدًا.',
    notePlaceholder: 'مثال: يفضّل غرفة في الطابق الأرضي',
    tags: 'الوسوم',
    addTag: 'أضف وسمًا',
    addTagButton: 'إضافة',
    removeTag: 'إزالة الوسم',
    tagLimit: `حتى ${TAG_MAX_COUNT} وسوم، ${TAG_MAX_LENGTH} حرفًا لكل وسم.`,
    save: 'حفظ',
    saved: 'تم حفظ الملاحظة.',
    updated: 'آخر حفظ',
    leaveTitle: 'تجاهل التعديلات؟',
    leaveBody: 'لم تُحفظ الملاحظة والوسوم التي عدّلتها.',
    leave: 'تجاهل',
    errorTitle: 'تعذّر تحميل هذا الضيف',
    retry: 'حاول مرة أخرى',
    status: {
      pending: 'بانتظار الرد',
      confirmed: 'مؤكد',
      completed: 'مكتمل',
      declined: 'مرفوض',
      cancelled: 'ملغى',
      expired: 'منتهٍ',
      no_show: 'لم يحضر',
    },
    at: 'الساعة',
  },
}

const sameTags = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

function bookingWhen(b, t, lang) {
  if (b.checkIn) return `${formatDay(b.checkIn, lang)} – ${formatDay(b.checkOut, lang)}`
  if (b.date) return b.time ? `${formatDay(b.date, lang)} ${t.at} ${b.time}` : formatDay(b.date, lang)
  return formatTimestamp(b.createdAt, lang)
}

/** The note and tag editor; mounted once the guest has loaded, keyed by guest. */
function GuestEditor({ guest, t, lang, onDirtyChange }) {
  const save = useMutation(api.partners.mutations.saveGuestNote)
  const [saved, setSaved] = useState({ note: guest.note ?? '', tags: guest.tags ?? [] })
  const [note, setNote] = useState(saved.note)
  const [tags, setTags] = useState(saved.tags)
  const [draftTag, setDraftTag] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)

  const dirty = note !== saved.note || !sameTags(tags, saved.tags)
  useEffect(() => { onDirtyChange(dirty) }, [dirty, onDirtyChange])

  const toggleDefault = (tag) =>
    setTags((prev) => (prev.includes(tag) ? prev.filter((x) => x !== tag) : addTag(prev, tag)))
  const addDraft = () => {
    setTags((prev) => addTag(prev, draftTag))
    setDraftTag('')
  }
  const extraTags = tags.filter((x) => !DEFAULT_TAGS.includes(x))
  const canAddDraft = draftTag.trim().length > 0 && tags.length < TAG_MAX_COUNT

  const onSave = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await save({ guestId: guest.guestId, note, tags })
      const clean = { note: note.trim(), tags }
      setNote(clean.note)
      setSaved(clean)
      toastApi.success(t.saved)
    } catch (err) {
      toastApi.error(errorText(err, lang))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <>
      <section className="p-ins-drawer-section">
        <h3 className="p-ins-h3">{t.contact}</h3>
        {guest.phone || guest.email ? (
          <dl className="p-ins-facts">
            {guest.phone && (
              <div>
                <dt>{t.phone}</dt>
                <dd>
                  <a href={`tel:${guest.phone}`} dir="ltr"><Ltr>{formatPhone(guest.phone)}</Ltr></a>
                  {/* Typed without an SMS code while Saudi SMS is down (design G7). */}
                  {guest.phoneVerified === false && <span className="p-muted p-small"> ({t.phoneUnconfirmed})</span>}
                </dd>
              </div>
            )}
            {guest.email && (
              <div>
                <dt>{t.email}</dt>
                <dd><a href={`mailto:${guest.email}`} dir="ltr">{guest.email}</a></dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="p-muted" style={{ margin: 0 }}>{t.noContact}</p>
        )}
      </section>

      <section className="p-ins-drawer-section">
        <h3 className="p-ins-h3">{t.bookings}</h3>
        {guest.bookings.length === 0 ? (
          <p className="p-muted" style={{ margin: 0 }}>{t.noBookings}</p>
        ) : (
          <ul className="p-ins-guest-bookings">
            {guest.bookings.map((b) => (
              <li key={b._id}>
                <span className="p-ins-guest-booking-head">
                  <strong>{lang === 'en' ? b.itemName_en || b.itemName_ar : b.itemName_ar || b.itemName_en}</strong>
                  <span className={`p-badge p-badge-${b.status}`}>{t.status[b.status] ?? b.status}</span>
                </span>
                <span className="p-muted p-small">
                  <bdi dir="ltr">{b.confirmationCode}</bdi> · {bookingWhen(b, t, lang)} · {formatMoney(b.totalAmount, lang)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="p-ins-drawer-section">
        <label className="p-field">
          <span className="p-ins-h3">{t.note}</span>
          <span className="p-muted p-small">{t.noteHint}</span>
          <textarea className="p-input p-ins-note" rows={5} value={note} maxLength={NOTE_MAX_LENGTH}
            placeholder={t.notePlaceholder} onChange={(e) => setNote(e.target.value)} />
          <span className="p-muted p-small p-ins-counter">
            <bdi dir="ltr">{note.length} / {NOTE_MAX_LENGTH}</bdi>
          </span>
        </label>
        {guest.noteUpdatedAt && (
          <p className="p-muted p-small" style={{ margin: 0 }}>{t.updated}: {formatTimestamp(guest.noteUpdatedAt, lang)}</p>
        )}
      </section>

      <section className="p-ins-drawer-section">
        <h3 className="p-ins-h3">{t.tags}</h3>
        <div className="p-chips" style={{ marginBottom: 0 }}>
          {DEFAULT_TAGS.map((x) => (
            <button key={x} type="button" className={tags.includes(x) ? 'p-chip is-active' : 'p-chip'}
              aria-pressed={tags.includes(x)} onClick={() => toggleDefault(x)}>
              {tagLabel(x, lang)}
            </button>
          ))}
          {extraTags.map((x) => (
            <span key={x} className="p-chip is-active">
              {x}
              <button type="button" className="p-ins-chip-x" aria-label={`${t.removeTag}: ${x}`}
                onClick={() => setTags((prev) => prev.filter((y) => y !== x))}>
                <InsightIcon name="close" size={14} />
              </button>
            </span>
          ))}
        </div>
        <form className="p-ins-add-tag" onSubmit={(e) => { e.preventDefault(); if (canAddDraft) addDraft() }}>
          <input className="p-input" value={draftTag} maxLength={TAG_MAX_LENGTH} placeholder={t.addTag}
            aria-label={t.addTag} onChange={(e) => setDraftTag(e.target.value)} />
          <button type="submit" className="p-btn p-btn-outline p-btn-sm" disabled={!canAddDraft}>{t.addTagButton}</button>
        </form>
        <p className="p-muted p-small" style={{ margin: 0 }}>{t.tagLimit}</p>
      </section>

      <footer className="p-ins-drawer-foot">
        <button type="button" className="p-btn p-btn-primary" onClick={onSave} disabled={busy || !dirty}>
          {busy ? <Spinner /> : <Icon name="check" size={18} />}
          <span>{t.save}</span>
        </button>
      </footer>
    </>
  )
}

/**
 * One guest: contact, their bookings with this partner, and the partner's
 * private note and tags. Closing with unsaved edits asks first.
 */
export default function GuestDrawer({ guestId, onClose }) {
  const { lang, isRtl } = usePartnerLang()
  const t = pick(translations, lang)
  const confirm = usePartnerConfirm()
  const result = useQuerySafe(api.partners.queries.getGuest, { guestId })
  const dirtyRef = useRef(false)
  const onDirtyChange = useCallback((dirty) => { dirtyRef.current = dirty }, [])

  const requestClose = async () => {
    if (dirtyRef.current) {
      const answer = await confirm({ title: t.leaveTitle, message: t.leaveBody, confirmLabel: t.leave, destructive: true })
      if (!answer) return
    }
    onClose()
  }

  const guest = result.data
  const title = guest ? guest.name || t.unnamed : t.loading

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => { if (!open) requestClose() }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="p-ins-overlay" />
        <DialogPrimitive.Content className="partners p-ins-drawer" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
          <header className="p-ins-drawer-head">
            <DialogPrimitive.Title className="p-ins-drawer-title">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            <DialogPrimitive.Close className="p-btn p-btn-ghost p-btn-sm" aria-label={t.close}>
              <InsightIcon name="close" size={18} />
            </DialogPrimitive.Close>
          </header>
          <div className="p-ins-drawer-body">
            {result.error ? (
              <ErrorState title={t.errorTitle} hint={errorText(result.error, lang)} />
            ) : guest === undefined ? (
              <div className="p-page-spinner"><Spinner label={t.loading} /></div>
            ) : (
              <GuestEditor key={guestId} guest={guest} t={t} lang={lang} onDirtyChange={onDirtyChange} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
