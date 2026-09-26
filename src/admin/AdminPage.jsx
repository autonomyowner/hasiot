import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useSyncHtmlLang } from '../hooks/useLanguage'
import { authClient } from '../lib/auth-client'
import { Toaster } from './ui/sonner'
import { SectionBoundary, TabErrorBoundary } from './components/States'
import { pendingBookingsOf, queuesOf, queueTotalOf, useDashboardStats } from './stats'
import { personName, realEmail } from './constants'
import DashboardTab from './tabs/DashboardTab'
import ListingsTab from './tabs/ListingsTab'
import ServicesTab from './tabs/ServicesTab'
import ContentApprovalTab from './tabs/ContentApprovalTab'
import ServiceApprovalTab from './tabs/ServiceApprovalTab'
import PendingBusinessesTab from './tabs/PendingBusinessesTab'
import ReportsTab from './tabs/ReportsTab'
import KnowledgeTab from './tabs/KnowledgeTab'
import BookingsTab from './tabs/BookingsTab'
import UsersTab from './tabs/UsersTab'
import ActivityTab from './tabs/ActivityTab'
import EmailCapturesTab from './tabs/EmailCapturesTab'
import './tailwind.css'
import './admin.css'

// `count` reads the tab's badge off the dashboard queues, each piece of
// waiting work counted in exactly one of them.
const TABS = [
  { id: 'dashboard', label: 'الرئيسية' },
  { id: 'listings', label: 'الأماكن' },
  { id: 'liveServices', label: 'الخدمات المنشورة' },
  { id: 'content', label: 'المحتوى', count: (q) => q.content },
  // Was «الخدمات». Beside «الخدمات المنشورة» that read as the same list twice;
  // this one is the queue of submissions waiting for a decision.
  { id: 'services', label: 'طلبات الخدمات', count: (q) => q.services },
  { id: 'pending', label: 'الحسابات', count: (q) => q.accounts },
  { id: 'reports', label: 'التبليغات', count: (q) => q.reports },
  { id: 'bookings', label: 'الحجوزات', count: pendingBookingsOf },
  { id: 'knowledge', label: 'المعرفة' },
  { id: 'activity', label: 'السجل' },
  { id: 'emails', label: 'البريد' },
  { id: 'users', label: 'المستخدمون' },
]

export default function AdminPage() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()

  // Admin panel is Arabic-only; the RTL rules key off html[dir].
  useSyncHtmlLang('ar')

  // The panel is dark, like the partner portal. `dark` goes on <html>, not on
  // .admin-page, because Radix portals dialogs, selects and toasts to <body>
  // and they must be dark too; it comes off on leave so no other page is.
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('dark')
    return () => root.classList.remove('dark')
  }, [])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/sign-in?next=/admin'
    }
  }, [isLoading, isAuthenticated])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="admin-page" dir="rtl">
        <div className="admin-loading" style={{ minHeight: '100vh', alignItems: 'center' }}>
          <div className="admin-spinner" />
        </div>
      </div>
    )
  }

  // Better Auth's cached session still says "signed in", but the backend
  // knows nobody: getCurrentUser is null when the Convex token could not be
  // renewed (the session expired, or was ended elsewhere) and when the account
  // is gone or suspended. This used to fall through to «غير مصرح» — "this
  // account () has no access", with nothing between the parentheses — which
  // replaced the whole panel, nav included, with a permissions message and
  // no way back in but the home page.
  if (user === null) return <SessionEnded />

  if (user.role !== 'admin') {
    return (
      <div className="admin-page admin-page-centered" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="admin-login-card"
        >
          <div className="admin-login-header">
            <h1 className="admin-login-title">غير مصرح</h1>
            <p className="admin-login-subtitle">
              {/* A phone sign-up's address is a placeholder nobody knows it by. */}
              هذا الحساب ({realEmail(user.email) || user.phone || personName(user)}) لا يملك صلاحية الوصول إلى لوحة التحكم.
            </p>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link to="/" className="admin-link">العودة للرئيسية</Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return <AdminShell user={user} />
}

/**
 * The session behind the panel has ended. Every query would be refused, so
 * rather than a dozen failing tabs this says what happened and offers the way
 * back: signing in again, or reloading when it was only a failed renewal.
 */
function SessionEnded() {
  return (
    <div className="admin-page admin-page-centered" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-login-card"
        role="alert"
      >
        <div className="admin-login-header">
          <h1 className="admin-login-title">انتهت الجلسة</h1>
          <p className="admin-login-subtitle">
            لم يعد الخادم يتعرّف على جلستك: ربما انتهت صلاحيتها، أو سُجّل الخروج من مكان آخر، أو لم
            يعد الحساب متاحًا. سجّل الدخول من جديد للمتابعة.
          </p>
        </div>
        <div className="admin-session-actions">
          {/* A full page load rather than a router link, so the panel comes
              back with a fresh Convex client instead of the one that lost
              its token. */}
          <a href="/sign-in?next=/admin" className="admin-btn admin-btn-primary">
            تسجيل الدخول من جديد
          </a>
          <button
            type="button"
            className="admin-btn admin-btn-secondary"
            onClick={() => window.location.reload()}
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      </motion.div>
    </div>
  )
}

/**
 * The panel itself, rendered for an admin only — so the dashboard numbers are
 * never asked for on behalf of an account that is about to be turned away.
 */
function AdminShell({ user }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tabParams, setTabParams] = useState(null)
  const { stats, error: statsError } = useDashboardStats()

  // Dashboard cards hand the operator straight into the tab that clears the
  // work, carrying a filter where one applies.
  const navigate = useCallback((tab, params = null) => {
    setActiveTab(tab)
    setTabParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <>
      {/* The panel is a single floating sheet on a neutral ground, rather than a
          full-bleed page. It keeps the working area visually bounded, which is
          what makes a dense operator tool feel calm. */}
      <div className="admin-page" dir="rtl">
        <div className="admin-shell">
          {/* The header has its own boundary: whatever goes wrong in it, the
              fallback is the same bar without its counts, so the nav and the
              sign-out button never disappear with them. */}
          <SectionBoundary
            name="header"
            fallback={() => (
              <AdminHeader user={user} activeTab={activeTab} onSelect={navigate} stats={null} countsFailed />
            )}
          >
            <AdminHeader
              user={user}
              activeTab={activeTab}
              onSelect={navigate}
              stats={stats}
              countsFailed={Boolean(statsError)}
            />
          </SectionBoundary>

          <main className="admin-main">
            {/* Keyed so a failure in one tab is cleared by moving to another,
                instead of the root boundary blanking the whole panel. */}
            <TabErrorBoundary key={activeTab}>
              <AnimatePresence mode="wait">
                <TabContent
                  key={activeTab}
                  tab={activeTab}
                  params={tabParams}
                  user={user}
                  stats={stats}
                  statsError={statsError}
                  onNavigate={navigate}
                />
              </AnimatePresence>
            </TabErrorBoundary>
          </main>
        </div>
      </div>
      <Toaster />
    </>
  )
}

function TabContent({ tab, params, user, stats, statsError, onNavigate }) {
  switch (tab) {
    case 'dashboard':
      return <DashboardTab onNavigate={onNavigate} user={user} stats={stats} statsError={statsError} />
    case 'listings': return <ListingsTab initialFilters={params} />
    case 'liveServices': return <ServicesTab />
    case 'content': return <ContentApprovalTab />
    case 'services': return <ServiceApprovalTab />
    case 'pending': return <PendingBusinessesTab />
    case 'reports': return <ReportsTab />
    case 'bookings': return <BookingsTab initialFilters={params} />
    case 'knowledge': return <KnowledgeTab />
    case 'activity': return <ActivityTab />
    case 'emails': return <EmailCapturesTab />
    case 'users': return <UsersTab currentUser={user} />
    default: return null
  }
}

function AdminHeader({ user, activeTab, onSelect, stats, countsFailed }) {
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const navRef = useRef(null)

  // Below ~1150px the twelve tabs scroll sideways behind a hidden scrollbar.
  // A tab opened from elsewhere — a dashboard row, the bell — could then be
  // active out of sight, so the track brings it into view. scrollBy with the
  // measured overlap, rather than scrollIntoView, so the page never moves.
  useEffect(() => {
    const nav = navRef.current
    const pill = nav?.querySelector('.admin-pill.active')
    if (!pill) return
    const track = nav.getBoundingClientRect()
    const box = pill.getBoundingClientRect()
    if (box.left < track.left) nav.scrollBy({ left: box.left - track.left - 12, behavior: 'smooth' })
    else if (box.right > track.right) nav.scrollBy({ left: box.right - track.right + 12, behavior: 'smooth' })
  }, [activeTab])

  const queues = queuesOf(stats)
  const countFor = (tab) => (tab.count && queues ? tab.count(queues) : 0)
  const waiting = queueTotalOf(stats)

  // Whichever queue the bell should open — the first one, in nav order, that
  // has anything in it.
  const firstWaiting = TABS.find((tab) => countFor(tab) > 0)

  const handleLogout = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      // Leave regardless: a failed sign-out request still leaves a session the
      // operator wants closed, and / is the only public page.
      window.location.href = '/'
    }
  }

  const initial = (user.firstName || user.email || '؟').trim().charAt(0)
  const bellLabel = countsFailed
    ? 'تعذّر تحميل أعداد الطلبات'
    : waiting > 0 ? `${waiting} عنصر ينتظر إجراءً` : 'لا يوجد شيء بانتظارك'

  return (
    <header className="admin-topbar">
      <Link to="/" className="admin-brand">Hasio</Link>

      <nav className="admin-pillnav" aria-label="أقسام لوحة التحكم" ref={navRef}>
        {TABS.map((tab) => {
          const count = countFor(tab)
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={`admin-pill ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {count > 0 && <span className="admin-pill-badge">{count}</span>}
            </button>
          )
        })}
      </nav>

      <div className="admin-topbar-actions">
        {/* Was a <span>: it carried the panel's button styling, including the
            pointer cursor, but nothing happened on click. It now jumps to the
            first queue with work in it, and goes flat when there is none. */}
        <button
          type="button"
          className={`admin-icon-btn ${waiting > 0 ? 'has-dot' : ''} ${countsFailed ? 'has-error' : ''}`}
          onClick={() => firstWaiting && onSelect(firstWaiting.id)}
          disabled={!firstWaiting}
          title={bellLabel}
          aria-label={bellLabel}
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9a6 6 0 0112 0c0 3.5.8 5 1.5 5.8.4.4.1 1.2-.5 1.2h-14c-.6 0-.9-.8-.5-1.2C5.2 14 6 12.5 6 9Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        <div className="admin-avatar-wrap">
          <button
            type="button"
            className="admin-avatar"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label="حساب المدير"
          >
            {initial}
          </button>

          <AnimatePresence>
            {menuOpen && (
              <>
                <div className="admin-menu-scrim" onClick={() => setMenuOpen(false)} />
                <motion.div
                  className="admin-menu"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <p className="admin-menu-name">{user.firstName || 'المدير'}</p>
                  <p className="admin-menu-mail" dir="ltr">{user.email}</p>
                  <button
                    onClick={handleLogout}
                    className="admin-btn admin-btn-secondary admin-btn-small"
                    disabled={signingOut}
                  >
                    {signingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
