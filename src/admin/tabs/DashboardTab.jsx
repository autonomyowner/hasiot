import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { LoadingState } from '../components/States'
import { TYPE_LABELS, BOOKING_STATUSES } from '../constants'

/**
 * The dashboard leads with work, not totals.
 *
 * The previous version opened on eleven equal-weight counters, so "3 accounts
 * have been waiting since Tuesday" looked exactly like "56 listings exist". The
 * queues come first now and every card is a link into the tab that clears it.
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

  const quality = [
    {
      label: 'أماكن بدون صور',
      value: stats.listingsMissingImages,
      hint: 'تظهر فارغة في التطبيق',
      tab: 'listings',
      params: { hasImages: 'no' },
    },
    {
      label: 'أماكن بدون أوقات عمل',
      value: stats.listingsMissingHours,
      hint: 'لا يمكن الحجز فيها',
      tab: 'listings',
      params: { hasWorkingHours: 'no' },
    },
  ]

  const totals = [
    { label: 'إجمالي الأماكن', value: stats.totalListings, color: 'blue' },
    { label: 'الأماكن النشطة', value: stats.activeListings, color: 'green' },
    { label: 'الموثقة', value: stats.verifiedListings, color: 'purple' },
    { label: 'إجمالي الخدمات', value: stats.totalServices, color: 'teal' },
    { label: 'المستخدمون', value: stats.totalUsers, color: 'orange' },
    { label: 'الحجوزات', value: stats.totalBookings, color: 'pink' },
    { label: 'قاعدة المعرفة', value: stats.totalKnowledgeData, color: 'indigo' },
    { label: 'خطط السفر', value: stats.totalTravelPlans, color: 'teal' },
    { label: 'تسجيلات البريد', value: stats.totalEmailCaptures, color: 'blue' },
  ]

  const week = [
    { label: 'مستخدمون جدد', value: stats.newUsersThisWeek },
    { label: 'أماكن جديدة', value: stats.newListingsThisWeek },
    { label: 'حجوزات خلال 7 أيام', value: stats.upcomingBookings },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="admin-page-title">نظرة عامة</h2>

      {stats.truncated && (
        <div className="admin-info-box">
          <p>
            تجاوزت البيانات {stats.statsCap} سجل في جدول واحد على الأقل، لذا الأرقام أدناه
            تمثل أول {stats.statsCap} سجل فقط.
          </p>
        </div>
      )}

      <section className="admin-dash-section">
        <h3 className="admin-subsection-title">يحتاج إجراءً</h3>
        {openQueues.length === 0 ? (
          <div className="admin-all-clear">
            <span className="admin-all-clear-mark" aria-hidden="true">✓</span>
            <div>
              <p className="admin-all-clear-title">لا يوجد شيء بانتظارك</p>
              <p className="admin-all-clear-hint">كل الطلبات والتبليغات والحجوزات تمت معالجتها.</p>
            </div>
          </div>
        ) : (
          <div className="admin-queue-grid">
            {openQueues.map((queue) => (
              <button
                key={queue.tab}
                type="button"
                className="admin-queue-card"
                onClick={() => onNavigate(queue.tab)}
              >
                <span className="admin-queue-value">{queue.value}</span>
                <span className="admin-queue-label">{queue.label}</span>
                <span className="admin-queue-go">فتح ←</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="admin-dash-section">
        <h3 className="admin-subsection-title">جودة المحتوى</h3>
        <div className="admin-queue-grid">
          {quality.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`admin-queue-card ${item.value === 0 ? 'is-clear' : 'is-warn'}`}
              onClick={() => onNavigate(item.tab, item.params)}
            >
              <span className="admin-queue-value">{item.value}</span>
              <span className="admin-queue-label">{item.label}</span>
              <span className="admin-queue-go">{item.value === 0 ? 'لا شيء' : item.hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="admin-dash-section">
        <h3 className="admin-subsection-title">آخر 7 أيام</h3>
        <div className="admin-week-grid">
          {week.map((item) => (
            <div key={item.label} className="admin-week-card">
              <span className="admin-week-value">{item.value}</span>
              <span className="admin-week-label">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-dash-section">
        <h3 className="admin-subsection-title">الإجماليات</h3>
        <div className="admin-stats-grid">
          {totals.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.2) }}
              className="admin-stat-card"
            >
              <div className={`admin-stat-dot ${stat.color}`} />
              <div className="admin-stat-value">{stat.value ?? 0}</div>
              <div className="admin-stat-label">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <div className="admin-breakdown-grid">
        <div className="admin-breakdown-card">
          <h3 className="admin-breakdown-title">الأماكن حسب النوع</h3>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="admin-breakdown-row">
              <span className="admin-breakdown-label">{label}</span>
              <span className="admin-breakdown-value">{stats.listingsByType?.[type] ?? 0}</span>
            </div>
          ))}
        </div>

        <div className="admin-breakdown-card">
          <h3 className="admin-breakdown-title">الحجوزات حسب الحالة</h3>
          {BOOKING_STATUSES.map((status) => (
            <div key={status.value} className="admin-breakdown-row">
              <span className="admin-breakdown-label">{status.label}</span>
              <span className={`admin-breakdown-value ${status.color}`}>
                {stats.bookingsByStatus?.[status.value] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
