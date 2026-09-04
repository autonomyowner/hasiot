import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { Skeleton } from '../ui/skeleton'
import { DotMatrix, Donut, LineChart, SegmentBar } from '../components/Charts'
import { STATUS_COLORS, formatNumber } from '../components/chart-tokens'
import { BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, TYPE_LABELS } from '../constants'

const GOLD = '#D4AF37'
const BRAND = '#0D7A5F'

/**
 * The dashboard is a bento: a greeting and the headline figures, then cards of
 * deliberately different sizes so the eye lands on the important one first.
 *
 * Reading order is work → movement → health. The old version opened on eleven
 * identical counters, which made "3 accounts have been waiting since Tuesday"
 * look exactly like "56 listings exist".
 */
export default function DashboardTab({ onNavigate, user }) {
  const stats = useQuery(api.admin.queries.getDashboardStats)
  const recentBookings = useQuery(api.admin.queries.listAllBookings, { limit: 4 })

  if (stats === undefined) return <DashboardSkeleton />

  const queues = [
    { label: 'محتوى بانتظار المراجعة', value: stats.pendingContent, tab: 'content' },
    { label: 'خدمات بانتظار المراجعة', value: stats.pendingServices, tab: 'services' },
    { label: 'حسابات بانتظار الاعتماد', value: stats.pendingBusinesses, tab: 'pending' },
    { label: 'تبليغات مفتوحة', value: stats.pendingReports, tab: 'reports' },
    // Waiting on the host, not on us. Listed here because an unanswered
    // request expires after 48 hours and the guest loses the booking, so it is
    // work someone should chase even though nobody here can approve it.
    { label: 'طلبات حجز بانتظار المالك', value: stats.awaitingOwner ?? 0, tab: 'bookings' },
    { label: 'حجوزات بانتظار التأكيد', value: stats.pendingBookings, tab: 'bookings' },
  ]
  const openQueues = queues.filter((q) => q.value > 0)

  const trend = stats.trend || { days: [], listings: [], bookings: [], users: [] }
  const total = stats.totalListings || 0

  // Every listing sits in exactly one review state, so these four shares add up
  // to the whole — which is what makes the segmented capsule an honest form
  // here. Overlapping measures ("missing photos", "missing hours") would not be.
  const byStatus = stats.listingsByStatus || {}
  const segments = [
    { label: 'منشورة', value: (byStatus.approved ?? 0) + (byStatus.seed ?? 0), tone: 'ink' },
    { label: 'بانتظار المراجعة', value: byStatus.pending ?? 0, tone: 'gold' },
    {
      label: 'مرفوضة أو موقوفة',
      value: (byStatus.rejected ?? 0) + (byStatus.suspended ?? 0),
      tone: 'hatch',
    },
  ].filter((seg) => seg.value > 0)

  const complete = Math.max(
    total - Math.max(stats.listingsMissingImages, stats.listingsMissingHours), 0
  )

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* ---- Greeting + headline figures ---- */}
      <section className="ar-hero">
        <div className="ar-hero-main">
          <h2 className="ar-hero-title">مرحباً {user?.firstName || 'بك'}</h2>
          <SegmentBar segments={segments} total={total} />
        </div>

        <div className="ar-hero-figures">
          <HeroFigure
            value={stats.totalListings}
            label="مكان"
            icon="pin"
            added={stats.newListingsThisWeek}
          />
          <HeroFigure
            value={stats.totalUsers}
            label="مستخدم"
            icon="user"
            added={stats.newUsersThisWeek}
          />
          <HeroFigure value={stats.totalBookings} label="حجز" icon="calendar" />
          {/* Revenue from confirmed and completed stays this month. Confirmed
              counts because the host is owed it either way — dropping it as
              stays finish would make the figure fall through the month. */}
          <HeroFigure
            value={stats.stayRevenueMonth ?? 0}
            unit="ر.س"
            label="إيرادات الشهر"
            icon="calendar"
          />
        </div>
      </section>

      {/* ---- Bento ---- */}
      <div className="ar-bento">

        {/* Work waiting — the tall card, because it is the reason to open this page */}
        <article className="ar-card ar-bento-queue">
          <header className="ar-card-head">
            <h3 className="ar-card-title">يحتاج إجراءً</h3>
            <span className="ar-card-count">{formatNumber(openQueues.reduce((s, q) => s + q.value, 0))}</span>
          </header>

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
                <p className="ar-clear-hint">كل الطلبات والتبليغات تمت معالجتها.</p>
              </div>
            </div>
          ) : (
            <ul className="ar-tasks">
              {openQueues.map((queue, i) => (
                <li key={queue.tab}>
                  {/* The first row is the one to do next, so it carries the ink
                      fill — the same emphasis the rest of the panel reserves for
                      "act on this". */}
                  <button
                    type="button"
                    className={`ar-task ${i === 0 ? 'primary' : ''}`}
                    onClick={() => onNavigate(queue.tab)}
                  >
                    <span className="ar-task-count">{formatNumber(queue.value)}</span>
                    <span className="ar-task-label">{queue.label}</span>
                    <svg className="ar-task-go" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Recent bookings — the table card */}
        <article className="ar-card ar-bento-table">
          <header className="ar-card-head">
            <h3 className="ar-card-title">أحدث الحجوزات</h3>
            <button type="button" className="ar-expand" onClick={() => onNavigate('bookings')}
                    aria-label="فتح الحجوزات">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 5h10v10M19 5L6 18" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>

          {recentBookings === undefined ? (
            <p className="ar-chart-empty">جاري التحميل...</p>
          ) : recentBookings.length === 0 ? (
            <p className="ar-chart-empty">لا توجد حجوزات بعد.</p>
          ) : (
            <ul className="ar-minirows">
              {recentBookings.map((booking) => (
                <li key={booking._id} className="ar-minirow">
                  <span className="ar-minirow-avatar" aria-hidden="true">
                    {(booking.userName || '؟').trim().charAt(0)}
                  </span>
                  <span className="ar-minirow-main">
                    <span className="ar-minirow-name">{booking.userName}</span>
                    <span className="ar-minirow-sub">{booking.listingName_ar}</span>
                  </span>
                  <span className="ar-minirow-date" dir="ltr">{booking.date}</span>
                  <span
                    className="ar-chip"
                    style={{ '--chip': STATUS_COLORS[booking.status] || BOOKING_STATUS_COLORS[booking.status] }}
                  >
                    {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* Activity — the dark card */}
        <article className="ar-card ar-card-dark ar-bento-activity">
          <header className="ar-card-head">
            <h3 className="ar-card-title">نشاط آخر 14 يوماً</h3>
            <button type="button" className="ar-expand" onClick={() => onNavigate('activity')}
                    aria-label="فتح السجل">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 5h10v10M19 5L6 18" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>

          <div className="ar-dark-figures">
            <span className="ar-dark-figure">
              {formatNumber(stats.newListingsThisWeek)}
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 17L17 7M17 7H9M17 7v8" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <small>أماكن</small>
            </span>
            <span className="ar-dark-figure">
              {formatNumber(stats.newUsersThisWeek)}
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M7 17L17 7M17 7H9M17 7v8" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <small>مستخدمون</small>
            </span>
          </div>

          <DotMatrix
            labels={trend.days}
            rows={[
              { label: 'أماكن', values: trend.listings },
              { label: 'حجوزات', values: trend.bookings },
              { label: 'مستخدمون', values: trend.users },
            ]}
          />
        </article>

        {/* Growth — the line chart */}
        <article className="ar-card ar-bento-line">
          <header className="ar-card-head">
            <h3 className="ar-card-title">النمو</h3>
            <span className="ar-card-note">آخر 14 يوماً</span>
          </header>
          <LineChart
            labels={trend.days}
            series={[
              { label: 'أماكن', values: trend.listings, color: BRAND },
              { label: 'حجوزات', values: trend.bookings, color: GOLD, dashed: true },
            ]}
          />
        </article>

        {/* Content health — the donut */}
        <article className="ar-card ar-bento-donut">
          <header className="ar-card-head">
            <h3 className="ar-card-title">اكتمال الأماكن</h3>
          </header>
          <Donut
            value={complete}
            total={total}
            centerLabel="مكان"
            segments={[
              { label: 'مكتملة', value: complete, color: BRAND },
              { label: 'ناقصة', value: Math.max(total - complete, 0), color: '#e6e3dd' },
            ]}
          />
          <div className="ar-card-actions">
            {stats.listingsMissingImages > 0 && (
              <button type="button" className="ar-btn ar-btn-ghost"
                      onClick={() => onNavigate('listings', { hasImages: 'no' })}>
                {formatNumber(stats.listingsMissingImages)} بدون صور
              </button>
            )}
            {stats.listingsMissingHours > 0 && (
              <button type="button" className="ar-btn ar-btn-ghost"
                      onClick={() => onNavigate('listings', { hasWorkingHours: 'no' })}>
                {formatNumber(stats.listingsMissingHours)} بدون أوقات
              </button>
            )}
          </div>
        </article>

        {/* Type mix — compact ranked list */}
        <article className="ar-card ar-bento-types">
          <header className="ar-card-head">
            <h3 className="ar-card-title">الأماكن حسب النوع</h3>
            <button type="button" className="ar-expand" onClick={() => onNavigate('listings')}
                    aria-label="فتح الأماكن">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M9 5h10v10M19 5L6 18" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </header>
          <ul className="ar-typegrid">
            {Object.entries(TYPE_LABELS)
              .map(([type, label]) => ({ label, value: stats.listingsByType?.[type] ?? 0 }))
              .sort((a, b) => b.value - a.value)
              .map((row) => (
                <li key={row.label} className="ar-typecell">
                  <span className="ar-typecell-value">{formatNumber(row.value)}</span>
                  <span className="ar-typecell-label">{row.label}</span>
                </li>
              ))}
          </ul>
        </article>
      </div>
    </motion.div>
  )
}

const ICONS = {
  pin: <><path d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.6" /></>,
  user: <><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" /><path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.6" /><path d="M4 10h16M9 3.5v4M15 3.5v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></>,
}

function HeroFigure({ value, label, icon, added, unit }) {
  return (
    <div className="ar-figure">
      <span className="ar-figure-value">
        {formatNumber(value)}
        {unit ? <span className="ar-figure-unit"> {unit}</span> : null}
      </span>
      {added > 0 && (
        <span className="ar-figure-delta">+{formatNumber(added)} هذا الأسبوع</span>
      )}
      <span className="ar-figure-label">
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">{ICONS[icon]}</svg>
        {label}
      </span>
    </div>
  )
}

/** Mirrors the bento so the layout does not shift when the data arrives. */
function DashboardSkeleton() {
  return (
    <div>
      <section className="ar-hero">
        <div className="ar-hero-main">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-9 w-full max-w-xl rounded-full" />
        </div>
        <div className="ar-hero-figures">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ar-figure">
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-3 w-14 mt-2" />
            </div>
          ))}
        </div>
      </section>

      <div className="ar-bento">
        <article className="ar-card ar-bento-queue"><Skeleton className="h-40 w-full" /></article>
        <article className="ar-card ar-bento-table"><Skeleton className="h-40 w-full" /></article>
        <article className="ar-card ar-bento-activity"><Skeleton className="h-56 w-full" /></article>
        <article className="ar-card ar-bento-line"><Skeleton className="h-44 w-full" /></article>
        <article className="ar-card ar-bento-donut"><Skeleton className="h-52 w-full" /></article>
        <article className="ar-card ar-bento-types"><Skeleton className="h-24 w-full" /></article>
      </div>
    </div>
  )
}
