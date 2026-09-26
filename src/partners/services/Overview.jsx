import { Link } from 'react-router-dom'
import { api } from '../../../convex/_generated/api'
import { useQuerySafe } from '../../admin/useQuerySafe'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { ErrorState, Icon, PageSpinner } from '../components/Ui'
import { ownerStatusOf } from './servicePayload'
import { STATUS_LABELS } from './labels'

const translations = {
  en: {
    title: 'Overview',
    subtitle: 'Your services and bookings at a glance.',
    pending: 'Requests waiting',
    upcoming: 'Upcoming',
    completedMonth: 'Completed this month',
    revenueMonth: 'Earned this month',
    services: 'Services',
    answer: 'Answer requests',
    answerHint: 'A request not answered within 48 hours expires.',
    noRequests: 'No requests waiting.',
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
    subtitle: 'خدماتك وحجوزاتك في لمحة.',
    pending: 'طلبات بانتظارك',
    upcoming: 'القادمة',
    completedMonth: 'المنجزة هذا الشهر',
    revenueMonth: 'دخل هذا الشهر',
    services: 'الخدمات',
    answer: 'الرد على الطلبات',
    answerHint: 'ينتهي الطلب إن لم تردّ عليه خلال 48 ساعة.',
    noRequests: 'لا توجد طلبات بانتظارك.',
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
  const { guard } = usePartnerGate('services')
  const skip = guard ? 'skip' : {}
  const stats = useQuerySafe(api.bookings.queries.getProviderStats, skip)
  const services = useQuerySafe(api.services.queries.getMyServices, skip)
  if (guard) return guard

  const error = stats.error || services.error
  if (error) return <ErrorState title={t.errorTitle} retryLabel={t.retry} onRetry={() => window.location.reload()} />
  if (stats.data === undefined || services.data === undefined) return <PageSpinner />

  const s = stats.data ?? { pending: 0, upcoming: 0, completedMonth: 0, revenueMonth: 0, services: 0 }
  const rows = services.data ?? []
  const counts = {}
  for (const row of rows) {
    const status = ownerStatusOf(row.status)
    counts[status] = (counts[status] ?? 0) + 1
  }
  const unpriced = rows.some((row) => row.price === undefined || row.price === null)
  const statusLabels = STATUS_LABELS[lang === 'en' ? 'en' : 'ar']

  const cards = [
    { key: 'pending', value: s.pending },
    { key: 'upcoming', value: s.upcoming },
    { key: 'completedMonth', value: s.completedMonth },
    { key: 'revenueMonth', value: money(s.revenueMonth, lang) },
  ]

  return (
    <div className="p-stack">
      <div>
        <h1 className="p-title">{t.title}</h1>
        <p className="p-subtitle" style={{ margin: 0 }}>{t.subtitle}</p>
      </div>

      <div className="p-svc-stats">
        {cards.map((card) => (
          <div key={card.key} className="p-card p-svc-stat">
            <span className="p-svc-stat-value">{card.value}</span>
            <span className="p-muted p-small">{t[card.key]}</span>
          </div>
        ))}
      </div>

      <Link to="/partners/services/bookings" className="p-choice">
        <span className="p-choice-icon"><Icon name="calendar" /></span>
        <span className="p-choice-body">
          <span className="p-choice-title">
            {t.answer}
            {s.pending > 0 && <span className="p-badge p-badge-pending" style={{ marginInlineStart: 8 }}>{s.pending}</span>}
          </span>
          <span className="p-choice-hint">{s.pending > 0 ? t.answerHint : t.noRequests}</span>
        </span>
        <Icon name="chevron" className="p-chevron" />
      </Link>

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
          <div className="p-row">
            {['approved', 'pending', 'rejected', 'suspended']
              .filter((status) => counts[status])
              .map((status) => (
                <span key={status} className={`p-badge p-svc-status-${status}`}>
                  {statusLabels[status]} · {counts[status]}
                </span>
              ))}
          </div>
        )}
        {(rows.length === 0 || unpriced) && <p className="p-note" style={{ margin: 0 }}>{t.priceHint}</p>}
      </div>
    </div>
  )
}
