import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { LoadingState } from '../components/States'
import { AreaChart, BarList, Meter, StatTile } from '../components/Charts'
import { STATUS_COLORS, formatNumber } from '../components/chart-tokens'
import { TYPE_LABELS, BOOKING_STATUSES } from '../constants'

/**
 * The dashboard leads with work, then with movement, then with totals.
 *
 * The previous version opened on eleven equal-weight counters, so "3 accounts
 * have been waiting since Tuesday" looked exactly like "56 listings exist".
 * Queues come first now and every card is a link into the tab that clears it;
 * the charts below answer "is anything moving" without the operator reading a
 * single table.
 */
export default function DashboardTab({ onNavigate }) {
  const stats = useQuery(api.admin.queries.getDashboardStats)

  if (stats === undefined) return <LoadingState />

  const queues = [
    { label: 'محتوى بانتظار المراجعة', value: stats.pendingContent, tab: 'content' },
    { label: 'خدمات بانتظار المراجعة', value: stats.pendingServices, tab: 'services' },
    { label: 'حسابات بانتظار الاعتماد', value: stats.pendingBusinesses, tab: 'pending' },
    { label: 'تبليغات مفتوحة', value: stats.pendingReports, tab: 'reports' },
    { label: 'حجوزات بانتظار التأكيد', value: stats.pendingBookings, tab: 'bookings' },
  ]
  const openQueues = queues.filter((q) => q.value > 0)
  const totalWaiting = openQueues.reduce((sum, q) => sum + q.value, 0)

  const trend = stats.trend || { days: [], listings: [], bookings: [], users: [] }
  const withPhotos = stats.totalListings - stats.listingsMissingImages
  const withHours = stats.totalListings - stats.listingsMissingHours

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="ar-dash">
      <header className="ar-page-head">
        <div>
          <h2 className="ar-page-title">نظرة عامة</h2>
          <p className="ar-page-sub">
            {totalWaiting > 0
              ? `${formatNumber(totalWaiting)} عنصر ينتظر إجراءً منك`
              : 'كل شيء تمت معالجته'}
          </p>
        </div>
      </header>

      {stats.truncated && (
        <div className="ar-note">
          تجاوزت البيانات {formatNumber(stats.statsCap)} سجل في جدول واحد على الأقل،
          لذا الأرقام أدناه تمثل أول {formatNumber(stats.statsCap)} سجل فقط.
        </div>
      )}

      {/* 1 — work waiting */}
      <section className="ar-section">
        <h3 className="ar-section-title">يحتاج إجراءً</h3>
        {openQueues.length === 0 ? (
          <div className="ar-clear">
            <span className="ar-clear-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="ar-clear-title">لا يوجد شيء بانتظارك</p>
              <p className="ar-clear-hint">كل الطلبات والتبليغات والحجوزات تمت معالجتها.</p>
            </div>
          </div>
        ) : (
          <div className="ar-queue-grid">
            {openQueues.map((queue) => (
              <button key={queue.tab} type="button" className="ar-queue" onClick={() => onNavigate(queue.tab)}>
                <span className="ar-queue-value">{formatNumber(queue.value)}</span>
                <span className="ar-queue-label">{queue.label}</span>
                <span className="ar-queue-go" aria-hidden="true">
                  فتح
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2"
                          strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* 2 — movement */}
      <section className="ar-section">
        <h3 className="ar-section-title">آخر 14 يوماً</h3>
        <div className="ar-chart-grid">
          <article className="ar-card">
            <header className="ar-card-head">
              <h4 className="ar-card-title">أماكن جديدة</h4>
              <span className="ar-card-figure">{formatNumber(stats.newListingsThisWeek)}<small> هذا الأسبوع</small></span>
            </header>
            <AreaChart values={trend.listings} labels={trend.days} valueLabel="أماكن جديدة" />
          </article>

          <article className="ar-card">
            <header className="ar-card-head">
              <h4 className="ar-card-title">حجوزات جديدة</h4>
              <span className="ar-card-figure">{formatNumber(stats.upcomingBookings)}<small> خلال 7 أيام</small></span>
            </header>
            <AreaChart values={trend.bookings} labels={trend.days} valueLabel="حجوزات جديدة" />
          </article>
        </div>

        <div className="ar-stat-row">
          <StatTile label="مستخدمون جدد هذا الأسبوع" value={stats.newUsersThisWeek} />
          <StatTile label="إجمالي المستخدمين" value={stats.totalUsers} />
          <StatTile label="إجمالي الحجوزات" value={stats.totalBookings} />
          <StatTile label="تسجيلات البريد" value={stats.totalEmailCaptures} />
        </div>
      </section>

      {/* 3 — content health */}
      <section className="ar-section">
        <h3 className="ar-section-title">جودة المحتوى</h3>
        <div className="ar-chart-grid">
          <article className="ar-card">
            <header className="ar-card-head">
              <h4 className="ar-card-title">اكتمال بيانات الأماكن</h4>
            </header>
            <Meter
              label="أماكن لديها صور"
              value={withPhotos}
              total={stats.totalListings}
              hint="الأماكن بدون صور تظهر كبطاقات فارغة في التطبيق."
            />
            <Meter
              label="أماكن لديها أوقات عمل"
              value={withHours}
              total={stats.totalListings}
              hint="بدون أوقات عمل لا يستطيع أحد الحجز في المكان."
            />
            {/* A shortcut to "the 0 listings missing photos" is noise, so each
                button appears only while there is something to fix. */}
            {(stats.listingsMissingImages > 0 || stats.listingsMissingHours > 0) && (
              <div className="ar-card-actions">
                {stats.listingsMissingImages > 0 && (
                  <button type="button" className="ar-btn ar-btn-ghost"
                          onClick={() => onNavigate('listings', { hasImages: 'no' })}>
                    عرض {formatNumber(stats.listingsMissingImages)} بدون صور
                  </button>
                )}
                {stats.listingsMissingHours > 0 && (
                  <button type="button" className="ar-btn ar-btn-ghost"
                          onClick={() => onNavigate('listings', { hasWorkingHours: 'no' })}>
                    عرض {formatNumber(stats.listingsMissingHours)} بدون أوقات
                  </button>
                )}
              </div>
            )}
          </article>

          <article className="ar-card">
            <header className="ar-card-head">
              <h4 className="ar-card-title">الأماكن حسب النوع</h4>
              <span className="ar-card-figure">{formatNumber(stats.totalListings)}</span>
            </header>
            <BarList
              items={Object.entries(TYPE_LABELS).map(([type, label]) => ({
                label,
                value: stats.listingsByType?.[type] ?? 0,
              }))}
            />
          </article>
        </div>
      </section>

      {/* 4 — bookings by state */}
      <section className="ar-section">
        <h3 className="ar-section-title">الحجوزات حسب الحالة</h3>
        <div className="ar-chart-grid">
          <article className="ar-card">
            <BarList
              items={BOOKING_STATUSES.map((status) => ({
                label: status.label,
                value: stats.bookingsByStatus?.[status.value] ?? 0,
                color: STATUS_COLORS[status.value],
              }))}
              emptyLabel="لا توجد حجوزات بعد"
            />
          </article>

          <article className="ar-card">
            <header className="ar-card-head">
              <h4 className="ar-card-title">المحتوى المنشور</h4>
            </header>
            <BarList
              items={[
                { label: 'أماكن نشطة', value: stats.activeListings },
                { label: 'أماكن موثقة', value: stats.verifiedListings },
                { label: 'خدمات', value: stats.totalServices },
                { label: 'معلومات في قاعدة المعرفة', value: stats.totalKnowledgeData },
                { label: 'خطط سفر', value: stats.totalTravelPlans },
              ]}
            />
          </article>
        </div>
      </section>
    </motion.div>
  )
}
