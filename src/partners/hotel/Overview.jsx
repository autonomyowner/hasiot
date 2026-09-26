import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { Icon, PageSpinner } from '../components/Ui'
import { ownerStatusOf } from './placePayload'

const translations = {
  en: {
    title: 'Overview',
    subtitle: 'Your places and bookings at a glance.',
    pending: 'Requests waiting',
    upcoming: 'Upcoming stays',
    revenue: 'Revenue this month',
    places: 'Places',
    answer: 'Answer requests',
    placesTitle: 'Your places',
    approved: 'Live',
    pendingReview: 'In review',
    rejected: 'Not approved',
    suspended: 'Suspended',
    manage: 'Manage places',
    add: 'Add a place',
    none: 'You have not posted a place yet.',
  },
  ar: {
    title: 'نظرة عامة',
    subtitle: 'أماكنك وحجوزاتك في لمحة.',
    pending: 'طلبات بانتظارك',
    upcoming: 'إقامات قادمة',
    revenue: 'إيرادات هذا الشهر',
    places: 'الأماكن',
    answer: 'الرد على الطلبات',
    placesTitle: 'أماكنك',
    approved: 'منشور',
    pendingReview: 'قيد المراجعة',
    rejected: 'مرفوض',
    suspended: 'موقوف',
    manage: 'إدارة الأماكن',
    add: 'أضف مكانًا',
    none: 'لم تنشر أي مكان بعد.',
  },
}

const STATUS_ORDER = [
  ['approved', 'approved'],
  ['pending', 'pendingReview'],
  ['rejected', 'rejected'],
  ['suspended', 'suspended'],
]

/** getOwnerStats (pending, upcoming, revenueMonth, listings) and places by status. */
export default function Overview() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate('hotel')
  const stats = useQuery(api.bookings.queries.getOwnerStats, guard ? 'skip' : {})
  const listings = useQuery(api.listings.queries.getMyListings, guard ? 'skip' : {})
  if (guard) return guard
  if (stats === undefined || listings === undefined) return <PageSpinner />

  const counts = {}
  for (const l of listings) {
    const s = ownerStatusOf(l.status)
    counts[s] = (counts[s] ?? 0) + 1
  }
  const number = (n) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US').format(n ?? 0)
  const currency = stats?.currency === 'SAR' || !stats?.currency ? (lang === 'ar' ? 'ر.س' : 'SAR') : stats.currency

  return (
    <div>
      <h1 className="p-title">{t.title}</h1>
      <p className="p-subtitle">{t.subtitle}</p>

      <div className="h-stats">
        <div className="p-card h-stat">
          <span className="p-muted p-small">{t.pending}</span>
          <strong className="h-stat-value">{number(stats?.pending)}</strong>
          {stats?.pending > 0 && (
            <Link className="p-link p-small" to="/partners/hotel/bookings">{t.answer}</Link>
          )}
        </div>
        <div className="p-card h-stat">
          <span className="p-muted p-small">{t.upcoming}</span>
          <strong className="h-stat-value">{number(stats?.upcoming)}</strong>
        </div>
        <div className="p-card h-stat">
          <span className="p-muted p-small">{t.revenue}</span>
          <strong className="h-stat-value">{number(stats?.revenueMonth)} <span className="p-small">{currency}</span></strong>
        </div>
        <div className="p-card h-stat">
          <span className="p-muted p-small">{t.places}</span>
          <strong className="h-stat-value">{number(stats?.listings ?? listings.length)}</strong>
        </div>
      </div>

      <div className="p-card h-section">
        <h2 className="p-h">{t.placesTitle}</h2>
        {listings.length === 0 ? (
          <p className="p-muted">{t.none}</p>
        ) : (
          <div className="p-row">
            {STATUS_ORDER.filter(([s]) => counts[s]).map(([s, label]) => (
              <span key={s} className={`p-badge h-badge-${s}`}>{t[label]}: {number(counts[s])}</span>
            ))}
          </div>
        )}
        <div className="p-row h-section-actions">
          <Link className="p-btn p-btn-outline p-btn-sm" to="/partners/hotel/places">{t.manage}</Link>
          <Link className="p-btn p-btn-primary p-btn-sm" to="/partners/hotel/places/new">
            <Icon name="building" size={16} /> {t.add}
          </Link>
        </div>
      </div>
    </div>
  )
}
