import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../../convex/_generated/api'
import { useQuerySafe } from '../../admin/useQuerySafe'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { ErrorState, Icon, Kpi, SkeletonKpis } from '../components/Ui'
import { errorText } from '../lib/errors'
import { Bars, InsightIcon, TrendChart } from './InsightsUi'
import {
  bucketLabel,
  formatChange,
  formatCount,
  formatMinutes,
  formatMoney,
  formatPercent,
  formatTimestamp,
} from './format'

const translations = {
  en: {
    title: 'Analytics',
    subtitleHotel: 'How your places are doing, counted by when each request was made.',
    subtitleServices: 'How your services are doing, counted by when each request was made.',
    periodLabel: 'Period',
    periods: { '30d': '30 days', '90d': '90 days', '12m': '12 months' },
    vsPrevious: 'vs previous period',
    requests: 'Requests',
    confirmed: 'Confirmed',
    acceptanceRate: 'Acceptance rate',
    medianResponse: 'Typical time to answer',
    revenue: 'Revenue',
    avgBookingValue: 'Average booking',
    nightsSold: 'Nights sold',
    repeatGuests: 'Repeat guests',
    trend: 'Over time',
    outcomes: 'Where requests ended',
    perItemHotel: 'By place',
    perItemServices: 'By service',
    item: 'Name',
    rating: 'Rating',
    noRating: 'No reviews',
    ratings: 'Ratings',
    ratingsHint: 'All reviews, not only this period.',
    reviews: 'reviews',
    latest: 'Latest reviews',
    noReviews: 'No reviews yet.',
    guest: 'Guest',
    truncated: 'These numbers cover your most recent 2,000 requests.',
    emptyTitle: 'Nothing to show yet',
    emptyHintHotel: 'Numbers appear here once travellers send requests for your places.',
    emptyHintServices: 'Numbers appear here once travellers send requests for your services.',
    emptyCtaHotel: 'Go to My places',
    emptyCtaServices: 'Go to My services',
    errorTitle: 'Analytics could not be loaded',
    retry: 'Try again',
    status: {
      pending: 'Waiting for you',
      confirmed: 'Confirmed',
      completed: 'Completed',
      declined: 'Declined',
      expired: 'Expired',
      cancelled: 'Cancelled',
      no_show: 'No-show',
    },
  },
  ar: {
    title: 'التحليلات',
    subtitleHotel: 'أداء أماكنك، محسوبًا بتاريخ إرسال كل طلب.',
    subtitleServices: 'أداء خدماتك، محسوبًا بتاريخ إرسال كل طلب.',
    periodLabel: 'الفترة',
    periods: { '30d': '30 يومًا', '90d': '90 يومًا', '12m': '12 شهرًا' },
    vsPrevious: 'مقارنة بالفترة السابقة',
    requests: 'الطلبات',
    confirmed: 'المؤكدة',
    acceptanceRate: 'نسبة القبول',
    medianResponse: 'مدة الرد المعتادة',
    revenue: 'الدخل',
    avgBookingValue: 'متوسط الحجز',
    nightsSold: 'الليالي المباعة',
    repeatGuests: 'الضيوف العائدون',
    trend: 'عبر الزمن',
    outcomes: 'مآل الطلبات',
    perItemHotel: 'حسب المكان',
    perItemServices: 'حسب الخدمة',
    item: 'الاسم',
    rating: 'التقييم',
    noRating: 'لا تقييمات',
    ratings: 'التقييمات',
    ratingsHint: 'كل التقييمات، لا تقييمات هذه الفترة وحدها.',
    reviews: 'تقييم',
    latest: 'أحدث التقييمات',
    noReviews: 'لا توجد تقييمات بعد.',
    guest: 'ضيف',
    truncated: 'تغطي هذه الأرقام أحدث 2,000 طلب لديك.',
    emptyTitle: 'لا توجد أرقام بعد',
    emptyHintHotel: 'تظهر الأرقام هنا حين يرسل المسافرون طلبات لأماكنك.',
    emptyHintServices: 'تظهر الأرقام هنا حين يرسل المسافرون طلبات لخدماتك.',
    emptyCtaHotel: 'إلى أماكني',
    emptyCtaServices: 'إلى خدماتي',
    errorTitle: 'تعذّر تحميل التحليلات',
    retry: 'حاول مرة أخرى',
    status: {
      pending: 'بانتظارك',
      confirmed: 'مؤكدة',
      completed: 'مكتملة',
      declined: 'مرفوضة',
      expired: 'منتهية',
      cancelled: 'ملغاة',
      no_show: 'لم يحضر',
    },
  },
}

const PERIODS = ['30d', '90d', '12m']
const OUTCOMES = ['pending', 'confirmed', 'completed', 'declined', 'expired', 'cancelled', 'no_show']

const CARD_ICONS = {
  requests: <Icon name="calendar" size={15} />,
  confirmed: <Icon name="check" size={15} />,
  acceptanceRate: <InsightIcon name="chart" size={15} />,
  medianResponse: <Icon name="clock" size={15} />,
  revenue: <Icon name="wallet" size={15} />,
  avgBookingValue: <Icon name="wallet" size={15} />,
  nightsSold: <Icon name="building" size={15} />,
  repeatGuests: <InsightIcon name="users" size={15} />,
}

function HeadlineCard({ label, value, change, hint, icon, index }) {
  return (
    <Kpi className="p-ins-stat" label={label} value={value} icon={icon} index={index}>
      {change ? (
        <span className={`p-ins-change is-${change.direction}`} title={hint}>
          <bdi dir="ltr">{change.text}</bdi>
        </span>
      ) : (
        <span className="p-ins-change is-none" aria-hidden="true">&nbsp;</span>
      )}
    </Kpi>
  )
}

/**
 * The partner's numbers: headline cards against the previous period, the
 * trend, where requests ended, each place or service, and ratings.
 * `role` is "hotel" or "services" — the same page serves both dashboards.
 */
export default function AnalyticsPage({ role }) {
  const { lang, isRtl } = usePartnerLang()
  const t = pick(translations, lang)
  const [params, setParams] = useSearchParams()
  const period = PERIODS.includes(params.get('period')) ? params.get('period') : '30d'
  const { guard } = usePartnerGate(role)
  const result = useQuerySafe(api.partners.queries.getAnalytics, guard ? 'skip' : { period })
  if (guard) return guard

  const isHotel = role === 'hotel'
  const choosePeriod = (next) => {
    const copy = new URLSearchParams(params)
    if (next === '30d') copy.delete('period')
    else copy.set('period', next)
    setParams(copy, { replace: true })
  }

  const header = (
    <div className="p-ins-head">
      <div>
        <h1 className="p-title">{t.title}</h1>
        <p className="p-subtitle" style={{ margin: 0 }}>{isHotel ? t.subtitleHotel : t.subtitleServices}</p>
      </div>
      <div className="p-ins-seg p-seg" role="radiogroup" aria-label={t.periodLabel}
        style={{ '--seg-n': PERIODS.length, '--seg-i': Math.max(0, PERIODS.indexOf(period)) }}>
        {PERIODS.map((p) => (
          <button key={p} type="button" role="radio" aria-checked={p === period}
            className={p === period ? 'is-active' : undefined} onClick={() => choosePeriod(p)}>
            {t.periods[p]}
          </button>
        ))}
      </div>
    </div>
  )

  if (result.error) {
    return (
      <div className="p-stack">
        {header}
        <ErrorState title={t.errorTitle} hint={errorText(result.error, lang)} retryLabel={t.retry}
          onRetry={() => window.location.reload()} />
      </div>
    )
  }
  if (result.data === undefined) {
    return <div className="p-stack">{header}<SkeletonKpis count={8} /></div>
  }

  const a = result.data
  const { totals, previous } = a
  const isEmpty = totals.requests === 0 && previous.requests === 0 && a.ratings.count === 0
  if (isEmpty) {
    return (
      <div className="p-stack">
        {header}
        <div className="p-card p-state">
          <InsightIcon name="chart" size={28} />
          <p className="p-state-title">{t.emptyTitle}</p>
          <p className="p-state-hint">{isHotel ? t.emptyHintHotel : t.emptyHintServices}</p>
          <Link to={isHotel ? '/partners/hotel/places' : '/partners/services/mine'} className="p-btn p-btn-outline p-btn-sm">
            {isHotel ? t.emptyCtaHotel : t.emptyCtaServices}
          </Link>
        </div>
      </div>
    )
  }

  const money = (n) => formatMoney(n, lang)
  const change = (key) => formatChange(totals[key], previous[key], lang)
  const cards = [
    { key: 'requests', value: formatCount(totals.requests), change: change('requests') },
    { key: 'confirmed', value: formatCount(totals.confirmed), change: change('confirmed') },
    { key: 'acceptanceRate', value: formatPercent(totals.acceptanceRate), change: change('acceptanceRate') },
    { key: 'medianResponse', value: formatMinutes(totals.medianResponseMinutes, lang), change: change('medianResponseMinutes') },
    { key: 'revenue', value: money(totals.revenue), change: change('revenue') },
    { key: 'avgBookingValue', value: money(totals.avgBookingValue), change: change('avgBookingValue') },
    ...(isHotel ? [{ key: 'nightsSold', value: formatCount(totals.nightsSold), change: change('nightsSold') }] : []),
    { key: 'repeatGuests', value: formatPercent(totals.repeatGuestShare), change: change('repeatGuestShare') },
  ]

  const labels = a.series.map((s) => bucketLabel(s.key, a.bucket, lang))
  const series = [
    { key: 'requests', label: t.requests, values: a.series.map((s) => s.requests) },
    { key: 'confirmed', label: t.confirmed, values: a.series.map((s) => s.confirmed) },
    { key: 'revenue', label: t.revenue, values: a.series.map((s) => s.revenue) },
  ]
  const outcomeRows = OUTCOMES.map((key) => ({ key, label: t.status[key], value: a.outcomes?.[key] ?? 0 }))
  const items = [...a.items].sort((x, y) => y.revenue - x.revenue || y.requests - x.requests)
  const nameOf = (en, ar) => (lang === 'en' ? en || ar : ar || en)
  const dist = a.ratings.distribution ?? [0, 0, 0, 0, 0]

  return (
    <div className="p-stack">
      {header}
      {a.truncated && <p className="p-note" style={{ margin: 0 }}>{t.truncated}</p>}

      <div className="p-ins-stats p-kpis">
        {cards.map((c, i) => (
          <HeadlineCard key={c.key} label={t[c.key]} value={c.value} change={c.change} hint={t.vsPrevious}
            icon={CARD_ICONS[c.key]} index={i} />
        ))}
      </div>

      <div className="p-ins-grid">
        <section className="p-card p-stack">
          <h2 className="p-h2" style={{ margin: 0 }}>{t.trend}</h2>
          <TrendChart labels={labels} series={series} rtl={isRtl} formatters={{ revenue: money }} />
        </section>
        <section className="p-card p-stack">
          <h2 className="p-h2" style={{ margin: 0 }}>{t.outcomes}</h2>
          <Bars rows={outcomeRows} />
        </section>
      </div>

      <section className="p-card p-stack">
        <h2 className="p-h2" style={{ margin: 0 }}>{isHotel ? t.perItemHotel : t.perItemServices}</h2>
        <div className="p-ins-table-wrap">
          <table className="p-ins-table">
            <thead>
              <tr>
                <th scope="col">{t.item}</th>
                <th scope="col">{t.requests}</th>
                <th scope="col">{t.confirmed}</th>
                <th scope="col">{t.revenue}</th>
                <th scope="col">{t.rating}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <th scope="row">{nameOf(item.name_en, item.name_ar)}</th>
                  <td>{formatCount(item.requests)}</td>
                  <td>{formatCount(item.confirmed)}</td>
                  <td>{money(item.revenue)}</td>
                  <td>
                    {item.rating === null || item.reviewCount === 0
                      ? <span className="p-muted">{t.noRating}</span>
                      : <>{item.rating.toFixed(1)} <span className="p-muted">({formatCount(item.reviewCount)})</span></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="p-card p-stack">
        <div>
          <h2 className="p-h2" style={{ margin: 0 }}>{t.ratings}</h2>
          <p className="p-muted p-small" style={{ margin: 0 }}>{t.ratingsHint}</p>
        </div>
        <div className="p-ins-ratings">
          <div className="p-ins-rating-hero">
            <span className="p-ins-stat-value">{a.ratings.average === null ? '—' : a.ratings.average.toFixed(1)}</span>
            <span className="p-muted p-small">{formatCount(a.ratings.count)} {t.reviews}</span>
          </div>
          <Bars rows={[5, 4, 3, 2, 1].map((n) => ({ key: String(n), label: `${n} ★`, value: dist[n - 1] ?? 0 }))} />
        </div>
        <h3 className="p-ins-h3">{t.latest}</h3>
        {a.ratings.latest.length === 0 ? (
          <p className="p-muted" style={{ margin: 0 }}>{t.noReviews}</p>
        ) : (
          <ul className="p-ins-reviews">
            {a.ratings.latest.map((r, i) => (
              <li key={`${r.createdAt}-${i}`} className="p-ins-review">
                <div className="p-ins-review-head">
                  <strong>{r.guestName || t.guest}</strong>
                  <span className="p-ins-review-stars" aria-label={`${r.rating}/5`}>
                    {'★'.repeat(r.rating)}<span className="p-ins-star-off">{'★'.repeat(5 - r.rating)}</span>
                  </span>
                </div>
                <span className="p-muted p-small">
                  {nameOf(r.itemName_en, r.itemName_ar)} · {formatTimestamp(r.createdAt, lang)}
                </span>
                {r.content && <p className="p-ins-review-text">{r.content}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
