import { Link } from 'react-router-dom'
import { api } from '../../../convex/_generated/api'
import { useQuerySafe } from '../../admin/useQuerySafe'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { ErrorState, Icon, Kpi, SkeletonKpis } from '../components/Ui'
import { ownerStatusOf } from './servicePayload'
import { STATUS_LABELS, cityName, priceText, serviceTitle } from './labels'
import BookingPreview from '../components/BookingPreview'
import { dayPart } from '../lib/bookingText'

const translations = {
  en: {
    title: 'Overview',
    greet: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    subtitle: 'Your services and bookings at a glance.',
    noPrice: 'No price — shows Contact, not Book',
    pending: 'Requests waiting',
    upcoming: 'Upcoming',
    completedMonth: 'Completed this month',
    revenueMonth: 'Earned this month',
    services: 'Services',
    byStatus: 'Your services',
    manage: 'Manage services',
    add: 'Add a service',
    none: 'You have not posted a service yet.',
    priceHint: 'A service without a price shows "Contact" instead of "Book" in the app. Add a price to take bookings.',
    errorTitle: 'The overview could not be loaded',
    retry: 'Try again',
  },
  ar: {
    title: 'نظرة عامة',
    greet: { morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير' },
    subtitle: 'خدماتك وحجوزاتك في لمحة.',
    noPrice: 'بلا سعر — يظهر «تواصل» بدل «احجز»',
    pending: 'طلبات بانتظارك',
    upcoming: 'القادمة',
    completedMonth: 'المنجزة هذا الشهر',
    revenueMonth: 'دخل هذا الشهر',
    services: 'الخدمات',
    byStatus: 'خدماتك',
    manage: 'إدارة الخدمات',
    add: 'إضافة خدمة',
    none: 'لم تنشر أي خدمة بعد.',
    priceHint: 'الخدمة بلا سعر تظهر في التطبيق بزر «تواصل» بدل «احجز». أضف سعرًا لتستقبل الحجوزات.',
    errorTitle: 'تعذّر تحميل النظرة العامة',
    retry: 'حاول مرة أخرى',
  },
}

function money(amount, lang) {
  const n = (amount ?? 0).toLocaleString('en-US')
  return lang === 'ar' ? `${n} ر.س` : `SAR ${n}`
}

/** The app's provider/dashboard.tsx: headline numbers and what needs doing. */
export default function Overview() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard, user } = usePartnerGate('services')
  const skip = guard ? 'skip' : {}
  const stats = useQuerySafe(api.bookings.queries.getProviderStats, skip)
  const services = useQuerySafe(api.services.queries.getMyServices, skip)
  const bookings = useQuerySafe(api.bookings.queries.getProviderBookings, skip)
  if (guard) return guard

  const comma = lang === 'ar' ? '، ' : ', '
  const hello = t.greet[dayPart(new Date().getHours())] + (user?.firstName ? comma + user.firstName : '')

  const error = stats.error || services.error
  if (error) return <ErrorState title={t.errorTitle} retryLabel={t.retry} onRetry={() => window.location.reload()} />
  if (stats.data === undefined || services.data === undefined) {
    return (
      <div className="p-stack">
        <div>
          <p className="p-greet">{hello}</p>
          <h1 className="p-title">{t.title}</h1>
          <p className="p-subtitle" style={{ margin: 0 }}>{t.subtitle}</p>
        </div>
        <SkeletonKpis />
      </div>
    )
  }

  const s = stats.data ?? { pending: 0, upcoming: 0, completedMonth: 0, revenueMonth: 0, services: 0 }
  const rows = services.data ?? []
  const unpriced = rows.some((row) => row.price === undefined || row.price === null)
  const statusLabels = STATUS_LABELS[lang === 'en' ? 'en' : 'ar']

  const cards = [
    { key: 'pending', value: s.pending, icon: 'clock' },
    { key: 'upcoming', value: s.upcoming, icon: 'calendar' },
    { key: 'completedMonth', value: s.completedMonth, icon: 'check' },
    { key: 'revenueMonth', value: money(s.revenueMonth, lang), icon: 'wallet' },
  ]

  return (
    <div className="p-stack">
      <div>
        <p className="p-greet">{hello}</p>
        <h1 className="p-title">{t.title}</h1>
        <p className="p-subtitle" style={{ margin: 0 }}>{t.subtitle}</p>
      </div>

      <div className="p-svc-stats p-kpis">
        {cards.map((card, i) => (
          <Kpi key={card.key} index={i} className="p-svc-stat" label={t[card.key]}
            icon={<Icon name={card.icon} size={15} />} value={card.value} />
        ))}
      </div>

      <BookingPreview bookings={bookings.data} kind="service" path="/partners/services/bookings" />

      <div className="p-card p-stack">
        <div className="p-row" style={{ justifyContent: 'space-between' }}>
          <h2 className="p-h2" style={{ margin: 0 }}>{t.byStatus}</h2>
          <div className="p-row">
            <Link to="/partners/services/mine" className="p-btn p-btn-outline p-btn-sm">{t.manage}</Link>
            <Link to="/partners/services/mine/new" className="p-btn p-btn-primary p-btn-sm">{t.add}</Link>
          </div>
        </div>
        {rows.length === 0 ? (
          <p className="p-muted" style={{ margin: 0 }}>{t.none}</p>
        ) : (
          <ul className="p-items-list">
            {rows.map((row) => {
              const status = ownerStatusOf(row.status)
              const price = priceText(row.price, row.priceUnit, lang)
              return (
                <li key={row._id}>
                  <Link className="p-item" to={`/partners/services/mine/${row._id}`}>
                    <span className="p-item-photo">
                      {row.images?.[0] ? <img src={row.images[0]} alt="" loading="lazy" /> : <Icon name="briefcase" size={22} />}
                    </span>
                    <span className="p-item-body">
                      <span className="p-item-name">{serviceTitle(row, lang) || '—'}</span>
                      <span className="p-item-meta">
                        <span className={`p-badge p-svc-status-${status}`}>{statusLabels[status]}</span>
                        {row.city && <span>{cityName(row.city, lang)}</span>}
                      </span>
                      <span className="p-item-meta">
                        {price ? <span className="p-price">{price}</span> : <span>{t.noPrice}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
        {(rows.length === 0 || unpriced) && <p className="p-note" style={{ margin: 0 }}>{t.priceHint}</p>}
      </div>
    </div>
  )
}
