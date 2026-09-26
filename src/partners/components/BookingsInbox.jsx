import { useEffect, useMemo, useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toastApi } from '../../admin/components/toast-context'
import { usePartnerLang, pick } from '../lang'
import { usePartnerConfirm } from '../confirm'
import { actionsFor, partitionBookings, shownStatus } from '../lib/bookings'
import { errorText } from '../lib/errors'
import { formatPhone } from '../lib/phone'
import { EmptyState, ErrorState, Icon, Ltr, PageSpinner, Spinner } from './Ui'

const translations = {
  en: {
    pending: 'Requests',
    upcoming: 'Upcoming',
    past: 'Past',
    emptyPending: 'No requests waiting',
    emptyPendingHint: 'New booking requests appear here. Answer within 48 hours.',
    emptyUpcoming: 'Nothing coming up',
    emptyPast: 'No past bookings yet',
    errorTitle: 'Bookings could not be loaded',
    retry: 'Try again',
    guest: 'Guest',
    confirm: 'Confirm',
    decline: 'Decline',
    complete: 'Mark completed',
    noShow: 'No-show',
    confirmTitle: 'Confirm this booking?',
    confirmBody: 'The guest is told straight away.',
    declineTitle: 'Decline this request?',
    declineBody: 'The guest sees your reason.',
    declineReason: 'Reason',
    declinePlaceholder: 'For example: fully booked on these dates',
    completeTitle: 'Mark as completed?',
    completeBody: 'The guest will be invited to leave a review.',
    noShowTitle: 'Mark as no-show?',
    noShowBody: 'Use this only if the guest did not arrive. It cannot be undone here.',
    confirmed: 'Booking confirmed.',
    declined: 'Request declined.',
    completed: 'Marked as completed.',
    noShowDone: 'Marked as no-show.',
    at: 'at',
    reasonLabel: 'Reason:',
    status: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      completed: 'Completed',
      declined: 'Declined',
      cancelled: 'Cancelled',
      expired: 'Expired',
      no_show: 'No-show',
    },
    counts: {
      nights: ['1 night', '2 nights', '{n} nights', '{n} nights'],
      guests: ['1 guest', '2 guests', '{n} guests', '{n} guests'],
      hours: ['1 hour', '2 hours', '{n} hours', '{n} hours'],
      days: ['1 day', '2 days', '{n} days', '{n} days'],
      people: ['1 person', '2 people', '{n} people', '{n} people'],
    },
  },
  ar: {
    pending: 'الطلبات',
    upcoming: 'القادمة',
    past: 'السابقة',
    emptyPending: 'لا توجد طلبات بانتظارك',
    emptyPendingHint: 'تظهر طلبات الحجز الجديدة هنا. ردّ عليها خلال 48 ساعة.',
    emptyUpcoming: 'لا حجوزات قادمة',
    emptyPast: 'لا حجوزات سابقة بعد',
    errorTitle: 'تعذّر تحميل الحجوزات',
    retry: 'حاول مرة أخرى',
    guest: 'ضيف',
    confirm: 'تأكيد',
    decline: 'رفض',
    complete: 'تم الإنجاز',
    noShow: 'لم يحضر',
    confirmTitle: 'تأكيد هذا الحجز؟',
    confirmBody: 'سيُبلَّغ الضيف فورًا.',
    declineTitle: 'رفض هذا الطلب؟',
    declineBody: 'سيرى الضيف السبب الذي تكتبه.',
    declineReason: 'السبب',
    declinePlaceholder: 'مثال: لا توجد غرف متاحة في هذه التواريخ',
    completeTitle: 'تعليم الحجز كمنجز؟',
    completeBody: 'سندعو الضيف لكتابة تقييم.',
    noShowTitle: 'تعليم الضيف كغائب؟',
    noShowBody: 'استخدم هذا فقط إن لم يحضر الضيف. لا يمكن التراجع عنه من هنا.',
    confirmed: 'تم تأكيد الحجز.',
    declined: 'تم رفض الطلب.',
    completed: 'تم تعليم الحجز كمنجز.',
    noShowDone: 'تم تعليم الضيف كغائب.',
    at: 'الساعة',
    reasonLabel: 'السبب:',
    status: {
      pending: 'بانتظار الرد',
      confirmed: 'مؤكد',
      completed: 'منجز',
      declined: 'مرفوض',
      cancelled: 'ملغى',
      expired: 'منتهي',
      no_show: 'لم يحضر',
    },
    counts: {
      nights: ['ليلة واحدة', 'ليلتان', '{n} ليالٍ', '{n} ليلة'],
      guests: ['ضيف واحد', 'ضيفان', '{n} ضيوف', '{n} ضيفًا'],
      hours: ['ساعة واحدة', 'ساعتان', '{n} ساعات', '{n} ساعة'],
      days: ['يوم واحد', 'يومان', '{n} أيام', '{n} يومًا'],
      people: ['شخص واحد', 'شخصان', '{n} أشخاص', '{n} شخصًا'],
    },
  },
}

/** One / two / few (3–10) / many — the four Arabic forms, as the app counts. */
function count(n, forms) {
  const i = n === 1 ? 0 : n === 2 ? 1 : n >= 3 && n <= 10 ? 2 : 3
  return forms[i].replace('{n}', String(n))
}

function formatDay(iso, lang) {
  const ts = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(ts)) return iso ?? ''
  // Latin digits in Arabic too, like every other number beside prices and codes.
  const locale = lang === 'ar' ? 'ar-SA-u-nu-latn-ca-gregory' : 'en-GB'
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(ts)
}

function formatMoney(amount, currency, lang) {
  if (typeof amount !== 'number') return ''
  const locale = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US'
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: currency || 'SAR', maximumFractionDigits: 0 }).format(amount)
  } catch {
    return `${amount} ${currency || 'SAR'}`
  }
}

function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

/**
 * The booking inbox for a host (`kind="stay"`, rows from getBusinessBookings)
 * or a provider (`kind="service"`, rows from getProviderBookings).
 *
 * Same tabs, statuses and actions as the app's inboxes (lib/bookingDisplay.ts
 * ported to lib/bookings.js): pending -> confirm / decline with a reason;
 * confirmed and started -> complete / no-show. Every action asks first and
 * reports through a toast; refusals show the server's own sentence.
 *
 * `bookings` is the query result: undefined while loading. Pass `error` (and
 * `onRetry`) when the caller caught a failed query.
 */
export default function BookingsInbox({ bookings, kind = 'stay', error, onRetry }) {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const confirm = usePartnerConfirm()
  const now = useMinuteClock()
  const [tab, setTab] = useState('pending')
  const [busy, setBusy] = useState({})

  const confirmBooking = useMutation(api.bookings.mutations.confirmBooking)
  const declineBooking = useMutation(api.bookings.mutations.declineBooking)
  const completeBooking = useMutation(api.bookings.mutations.completeBooking)
  const markNoShow = useMutation(api.bookings.mutations.markNoShow)

  const groups = useMemo(() => partitionBookings(bookings ?? [], now), [bookings, now])

  if (error) return <ErrorState title={t.errorTitle} retryLabel={t.retry} onRetry={onRetry} />
  if (bookings === undefined) return <PageSpinner />

  const run = async (booking, action) => {
    if (busy[booking._id]) return
    const bookingId = booking._id
    const plan = {
      confirm: { title: t.confirmTitle, message: t.confirmBody, label: t.confirm, done: t.confirmed },
      decline: {
        title: t.declineTitle,
        message: t.declineBody,
        label: t.decline,
        done: t.declined,
        destructive: true,
        reason: { label: t.declineReason, placeholder: t.declinePlaceholder, required: true },
      },
      complete: { title: t.completeTitle, message: t.completeBody, label: t.complete, done: t.completed },
      noShow: { title: t.noShowTitle, message: t.noShowBody, label: t.noShow, done: t.noShowDone, destructive: true },
    }[action]

    const answer = await confirm({
      title: plan.title,
      message: plan.message,
      confirmLabel: plan.label,
      destructive: plan.destructive,
      reason: plan.reason,
    })
    if (!answer) return

    setBusy((b) => ({ ...b, [bookingId]: action }))
    try {
      if (action === 'confirm') await confirmBooking({ bookingId })
      else if (action === 'decline') await declineBooking({ bookingId, reason: answer.reason })
      else if (action === 'complete') await completeBooking({ bookingId })
      else await markNoShow({ bookingId })
      toastApi.success(plan.done)
    } catch (err) {
      toastApi.error(errorText(err, lang))
    } finally {
      setBusy((b) => {
        const next = { ...b }
        delete next[bookingId]
        return next
      })
    }
  }

  const shown = groups[tab]
  const empty = {
    pending: { title: t.emptyPending, hint: t.emptyPendingHint },
    upcoming: { title: t.emptyUpcoming },
    past: { title: t.emptyPast },
  }[tab]

  return (
    <div>
      <div className="p-chips" role="tablist">
        {['pending', 'upcoming', 'past'].map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'p-chip is-active' : 'p-chip'}
            onClick={() => setTab(key)}
          >
            {t[key]}
            {key !== 'past' && groups[key].length > 0 && <span className="p-chip-count">{groups[key].length}</span>}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="p-card">
          <EmptyState title={empty.title} hint={empty.hint} />
        </div>
      ) : (
        <ul className="p-bookings" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {shown.map((b) => (
            <BookingRow key={b._id} booking={b} kind={kind} now={now} lang={lang} t={t} busy={busy[b._id]} onAction={run} />
          ))}
        </ul>
      )}
    </div>
  )
}

function BookingRow({ booking: b, kind, now, lang, t, busy, onAction }) {
  const status = shownStatus(b, now)
  const actions = actionsFor(b, kind, now)
  const guest = b.tourist
  const guestName = [guest?.firstName, guest?.lastName].filter(Boolean).join(' ') || t.guest
  const phone = guest?.phone

  let what
  let when
  const amount = []
  if (kind === 'service') {
    what = (lang === 'ar' ? b.service?.title_ar : b.service?.title_en) || b.service?.title_en || b.service?.title_ar
    const days = b.priceUnit === 'per_day' ? Math.max(1, b.quantity ?? 1) : 1
    const last = days > 1 && b.checkOut ? isoMinusOne(b.checkOut) : null
    when = `${formatDay(b.date, lang)}${last ? ` – ${formatDay(last, lang)}` : ''} ${t.at} ${b.time ?? ''}`.trim()
    if (b.quantity && b.priceUnit === 'per_hour') amount.push(count(b.quantity, t.counts.hours))
    if (b.quantity && b.priceUnit === 'per_day') amount.push(count(b.quantity, t.counts.days))
    const people = b.partySize ?? b.guests
    if (people) amount.push(count(people, t.counts.people))
  } else {
    what = (lang === 'ar' ? b.listing?.name_ar : b.listing?.name_en) || b.listing?.name_en || b.listing?.name_ar
    if (b.checkIn && b.checkOut) {
      when = `${formatDay(b.checkIn, lang)} – ${formatDay(b.checkOut, lang)}`
      if (b.nights) amount.push(count(b.nights, t.counts.nights))
    } else {
      // A 1.0.2 slot booking: a day and a time.
      when = `${formatDay(b.date, lang)} ${b.time ? `${t.at} ${b.time}` : ''}`.trim()
    }
    const people = b.guests ?? b.partySize
    if (people) amount.push(count(people, t.counts.guests))
  }

  const reason = b.declineReason || b.cancellationReason

  return (
    <li className="p-booking">
      <div>
        <div className="p-booking-head">
          <span className={`p-badge p-badge-${status}`}>{t.status[status] ?? status}</span>
          {b.confirmationCode && <span className="p-booking-code">{b.confirmationCode}</span>}
        </div>
        {what && <div className="p-booking-what" style={{ marginTop: 6 }}>{what}</div>}
        <div className="p-booking-meta">
          <span><Icon name="calendar" size={16} />{when}</span>
          {amount.length > 0 && <span>{amount.join(' · ')}</span>}
        </div>
        <div className="p-booking-meta">
          <span><Icon name="user" size={16} />{guestName}</span>
          {phone && (
            <span>
              <Icon name="phone" size={16} />
              <a href={`tel:${phone}`}><Ltr>{formatPhone(phone)}</Ltr></a>
            </span>
          )}
        </div>
      </div>
      <div className="p-booking-side">
        <span className="p-booking-total">{formatMoney(b.totalAmount, b.currency, lang)}</span>
        {actions !== 'none' && (
          <div className="p-booking-actions">
            {actions === 'decide' ? (
              <>
                <button type="button" className="p-btn p-btn-danger p-btn-sm" disabled={!!busy} onClick={() => onAction(b, 'decline')}>
                  {busy === 'decline' && <Spinner />}
                  {t.decline}
                </button>
                <button type="button" className="p-btn p-btn-primary p-btn-sm" disabled={!!busy} onClick={() => onAction(b, 'confirm')}>
                  {busy === 'confirm' && <Spinner />}
                  {t.confirm}
                </button>
              </>
            ) : (
              <>
                <button type="button" className="p-btn p-btn-danger p-btn-sm" disabled={!!busy} onClick={() => onAction(b, 'noShow')}>
                  {busy === 'noShow' && <Spinner />}
                  {t.noShow}
                </button>
                <button type="button" className="p-btn p-btn-primary p-btn-sm" disabled={!!busy} onClick={() => onAction(b, 'complete')}>
                  {busy === 'complete' && <Spinner />}
                  {t.complete}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {reason && (status === 'declined' || status === 'cancelled') && (
        <div className="p-booking-reason">{t.reasonLabel} {reason}</div>
      )}
    </li>
  )
}

/** The last day of a multi-day service: checkOut is exclusive. */
function isoMinusOne(iso) {
  const ts = Date.parse(`${iso}T00:00:00Z`)
  return Number.isNaN(ts) ? iso : new Date(ts - 86_400_000).toISOString().slice(0, 10)
}
