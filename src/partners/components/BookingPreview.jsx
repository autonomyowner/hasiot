import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePartnerLang, pick } from '../lang'
import { formatDay, formatMoney, previewOf } from '../lib/bookingText'
import { Icon } from './Ui'

const translations = {
  en: {
    waiting: 'Waiting for your reply',
    waitingHint: 'Answer within 48 hours or the request expires.',
    caughtUp: 'You are all caught up — no requests waiting.',
    upcoming: 'Coming up',
    noUpcoming: 'No confirmed bookings coming up yet.',
    seeAll: 'See all {n}',
    open: 'Open bookings',
    guest: 'Guest',
    at: 'at',
  },
  ar: {
    waiting: 'بانتظار ردك',
    waitingHint: 'رد خلال 48 ساعة وإلا انتهى الطلب.',
    caughtUp: 'لا توجد طلبات بانتظارك.',
    upcoming: 'القادم',
    noUpcoming: 'لا توجد حجوزات مؤكدة قادمة بعد.',
    seeAll: 'عرض الكل ({n})',
    open: 'فتح الحجوزات',
    guest: 'ضيف',
    at: 'الساعة',
  },
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
 * The overview's "what needs me" — the first requests waiting for an answer
 * and the next confirmed bookings, for a host (`kind="stay"`) or a provider
 * (`kind="service"`). Every row opens the Bookings page, where the actions are:
 * one place to confirm or decline, so the rules and confirmations live once.
 */
export default function BookingPreview({ bookings, kind, path }) {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const now = useMinuteClock()
  const p = previewOf(bookings, now)

  const row = (b) => {
    const what =
      kind === 'service'
        ? (lang === 'ar' ? b.service?.title_ar : b.service?.title_en) || b.service?.title_en || b.service?.title_ar
        : (lang === 'ar' ? b.listing?.name_ar : b.listing?.name_en) || b.listing?.name_en || b.listing?.name_ar
    const when =
      b.checkIn && b.checkOut && kind !== 'service'
        ? `${formatDay(b.checkIn, lang)} – ${formatDay(b.checkOut, lang)}`
        : `${formatDay(b.date ?? b.checkIn, lang)}${b.time ? ` ${t.at} ${b.time}` : ''}`
    const who = [b.tourist?.firstName, b.tourist?.lastName].filter(Boolean).join(' ') || t.guest
    return (
      <li key={b._id}>
        <Link to={path} className="p-preview-row">
          <span className="p-preview-when">{when}</span>
          <span className="p-preview-main">
            <strong>{who}</strong>
            <span className="p-muted p-small">{what}</span>
          </span>
          <span className="p-preview-total">{formatMoney(b.totalAmount, b.currency, lang)}</span>
        </Link>
      </li>
    )
  }

  const section = (key, title, list, total, empty, hint) => (
    <section className="p-card p-preview" aria-labelledby={`preview-${key}`}>
      <div className="p-preview-head">
        <h2 id={`preview-${key}`} className="p-h2" style={{ margin: 0 }}>
          {title}
          {total > 0 && <span className={`p-badge ${key === 'waiting' ? 'p-badge-pending' : ''}`}>{total}</span>}
        </h2>
        {total > list.length && (
          <Link to={path} className="p-link p-small">{t.seeAll.replace('{n}', String(total))}</Link>
        )}
      </div>
      {hint && total > 0 && <p className="p-muted p-small" style={{ margin: 0 }}>{hint}</p>}
      {bookings === undefined ? (
        <span className="p-skel" style={{ height: 96 }} aria-hidden="true" />
      ) : list.length === 0 ? (
        <p className="p-preview-empty">
          <Icon name={key === 'waiting' ? 'check' : 'calendar'} size={18} />
          <span>{empty}</span>
        </p>
      ) : (
        <ul className="p-preview-list">{list.map(row)}</ul>
      )}
    </section>
  )

  return (
    <div className="p-preview-grid">
      {section('waiting', t.waiting, p.pending, p.pendingTotal, t.caughtUp, t.waitingHint)}
      {section('upcoming', t.upcoming, p.upcoming, p.upcomingTotal, t.noUpcoming)}
    </div>
  )
}
