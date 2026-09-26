import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Flag,
  History,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
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
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'listings', label: 'الأماكن', icon: MapPin },
  { id: 'liveServices', label: 'الخدمات المنشورة', icon: BriefcaseBusiness },
  { id: 'content', label: 'المحتوى', icon: FileCheck2, count: (q) => q.content },
  // Was «الخدمات». Beside «الخدمات المنشورة» that read as the same list twice;
  // this one is the queue of submissions waiting for a decision.
  { id: 'services', label: 'طلبات الخدمات', icon: ClipboardCheck, count: (q) => q.services },
  { id: 'pending', label: 'الحسابات', icon: UserCheck, count: (q) => q.accounts },
  { id: 'reports', label: 'التبليغات', icon: Flag, count: (q) => q.reports },
  { id: 'bookings', label: 'الحجوزات', icon: CalendarDays, count: pendingBookingsOf },
  { id: 'knowledge', label: 'المعرفة', icon: BookOpen },
  { id: 'activity', label: 'السجل', icon: History },
  { id: 'emails', label: 'البريد', icon: Mail },
  { id: 'users', label: 'المستخدمون', icon: Users },
]
const TAB = Object.fromEntries(TABS.map((tab) => [tab.id, tab]))

// The sidebar, as the operator thinks about the work: what is live, what is
// waiting for a decision, what is happening, and the records. Every tab is
// in exactly one group.
const NAV_GROUPS = [
  { label: 'عام', tabs: ['dashboard'] },
  { label: 'بانتظار قرارك', tabs: ['content', 'services', 'pending', 'reports'] },
  { label: 'المنشور', tabs: ['listings', 'liveServices', 'knowledge'] },
  { label: 'العمليات', tabs: ['bookings', 'users'] },
  { label: 'السجلات', tabs: ['activity', 'emails'] },
]

// The top bar's shortcuts: the places an operator goes most.
const QUICK_TABS = ['dashboard', 'bookings', 'listings', 'users']

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
  const [menuOpen, setMenuOpen] = useState(false)
  const { stats, error: statsError } = useDashboardStats()

  // Dashboard cards hand the operator straight into the tab that clears the
  // work, carrying a filter where one applies.
  const navigate = useCallback((tab, params = null) => {
    setActiveTab(tab)
    setTabParams(params)
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const chrome = { user, activeTab, onSelect: navigate }

  return (
    <>
      {/* A console, as in the aitridi operator panel: the sections live in a
          sidebar grouped by the kind of work, the page sits on one bounded
          plate with a slim top bar. Both have their own error boundary: if the
          counts fail, the fallback is the same chrome without them, so the nav
          and sign-out never disappear. */}
      <div className="admin-page" dir="rtl">
        <div className="admin-console">
          <SectionBoundary
            name="sidebar"
            fallback={() => <AdminSidebar {...chrome} stats={null} countsFailed />}
          >
            <AdminSidebar {...chrome} stats={stats} countsFailed={Boolean(statsError)} />
          </SectionBoundary>

          <div className="admin-shell">
            <SectionBoundary
              name="header"
              fallback={() => (
                <AdminTopbar {...chrome} stats={null} countsFailed onOpenMenu={() => setMenuOpen(true)} />
              )}
            >
              <AdminTopbar
                {...chrome}
                stats={stats}
                countsFailed={Boolean(statsError)}
                onOpenMenu={() => setMenuOpen(true)}
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
      </div>

      <AnimatePresence>
        {menuOpen && (
          <MobileMenu onClose={() => setMenuOpen(false)}>
            <AdminSidebar {...chrome} stats={statsError ? null : stats} countsFailed={Boolean(statsError)} inSheet />
          </MobileMenu>
        )}
      </AnimatePresence>
      <Toaster />
    </>
  )
}

/** Counts per tab, and the first queue that has work in it, from the dashboard stats. */
function useQueueCounts(stats) {
  const queues = queuesOf(stats)
  const countFor = (tab) => (tab.count && queues ? tab.count(queues) : 0)
  return {
    countFor,
    waiting: queueTotalOf(stats),
    firstWaiting: TABS.find((tab) => countFor(tab) > 0),
  }
}

function useSignOut() {
  const [signingOut, setSigningOut] = useState(false)
  const signOut = async () => {
    setSigningOut(true)
    try {
      await authClient.signOut()
    } finally {
      // Leave regardless: a failed sign-out request still leaves a session the
      // operator wants closed, and / is the only public page.
      window.location.href = '/'
    }
  }
  return { signingOut, signOut }
}

/**
 * The sidebar: brand, which console this is, the sections in groups with
 * their waiting counts, and the signed-in admin with sign-out at the foot.
 * The same body is the phone menu (`inSheet`).
 */
function AdminSidebar({ user, activeTab, onSelect, stats, countsFailed, inSheet = false }) {
  const { countFor } = useQueueCounts(stats)
  const { signingOut, signOut } = useSignOut()
  const name = personName(user) || user.firstName || 'المدير'
  const initial = (user.firstName || user.email || '؟').trim().charAt(0)

  return (
    <aside className={inSheet ? 'admin-sidebar in-sheet' : 'admin-sidebar'} aria-label="أقسام لوحة التحكم">
      <Link to="/" className="admin-side-brand">Hasio</Link>

      <div className="admin-console-badge">
        <span className="admin-console-badge-icon"><ShieldCheck aria-hidden="true" /></span>
        <span>
          <small>المدير</small>
          <strong>لوحة الإدارة</strong>
        </span>
      </div>

      <nav className="admin-side-nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="admin-side-group">
            <p className="admin-side-heading">{group.label}</p>
            {group.tabs.map((id) => {
              const tab = TAB[id]
              const Icon = tab.icon
              const count = countFor(tab)
              const active = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={active ? 'admin-side-link active' : 'admin-side-link'}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon aria-hidden="true" strokeWidth={active ? 1.9 : 1.6} />
                  <span className="admin-side-label">{tab.label}</span>
                  {count > 0 && <span className="admin-side-count">{count}</span>}
                </button>
              )
            })}
          </div>
        ))}
        {countsFailed && <p className="admin-side-note">تعذّر تحميل الأعداد</p>}
      </nav>

      <div className="admin-side-foot">
        <p className="admin-side-audit">
          كل إجراء هنا يُسجَّل في{' '}
          <button type="button" onClick={() => onSelect('activity')}>السجل</button>
          {' '}باسمك.
        </p>
        <div className="admin-side-account">
          <span className="admin-side-avatar" aria-hidden="true">{initial}</span>
          <span className="admin-side-who">
            <strong>{name}</strong>
            <small dir="ltr">{realEmail(user.email) || user.phone || ''}</small>
          </span>
          <button
            type="button"
            className="admin-side-signout"
            onClick={signOut}
            disabled={signingOut}
            aria-label="تسجيل الخروج"
            title="تسجيل الخروج"
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  )
}

/** The phone menu: the sidebar in a sheet from the start edge. */
function MobileMenu({ onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="admin-sheet-root" dir="rtl" role="dialog" aria-modal="true" aria-label="القائمة">
      <motion.div
        className="admin-sheet-backdrop"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="admin-sheet"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        <button type="button" className="admin-sheet-close" onClick={onClose} aria-label="إغلاق القائمة">
          <X aria-hidden="true" />
        </button>
        {children}
      </motion.div>
    </div>
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

/**
 * The plate's top bar: the menu button on phones, where you are (group and
 * section), shortcuts to the busiest sections, and the bell.
 */
function AdminTopbar({ activeTab, onSelect, stats, countsFailed, onOpenMenu }) {
  const { countFor, waiting, firstWaiting } = useQueueCounts(stats)
  const group = NAV_GROUPS.find((g) => g.tabs.includes(activeTab))
  const bellLabel = countsFailed
    ? 'تعذّر تحميل أعداد الطلبات'
    : waiting > 0 ? `${waiting} عنصر ينتظر إجراءً` : 'لا يوجد شيء بانتظارك'

  return (
    <header className="admin-topbar">
      <button type="button" className="admin-icon-btn admin-menu-btn" onClick={onOpenMenu} aria-label="القائمة">
        <Menu aria-hidden="true" />
      </button>

      <p className="admin-crumb">
        {group && <span>{group.label}</span>}
        <strong>{TAB[activeTab]?.label}</strong>
      </p>

      <nav className="admin-quick" aria-label="اختصارات">
        {QUICK_TABS.map((id) => {
          const tab = TAB[id]
          const count = countFor(tab)
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`admin-pill ${activeTab === id ? 'active' : ''}`}
            >
              {tab.label}
              {count > 0 && <span className="admin-pill-badge">{count}</span>}
            </button>
          )
        })}
      </nav>

      <div className="admin-topbar-actions">
        {/* Jumps to the first queue with work in it, and goes flat when there is none. */}
        <button
          type="button"
          className={`admin-icon-btn ${waiting > 0 ? 'has-dot' : ''} ${countsFailed ? 'has-error' : ''}`}
          onClick={() => firstWaiting && onSelect(firstWaiting.id)}
          disabled={!firstWaiting}
          title={bellLabel}
          aria-label={bellLabel}
        >
          <Bell aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
