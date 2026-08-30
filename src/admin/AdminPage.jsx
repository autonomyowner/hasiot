import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { useSyncHtmlLang } from '../hooks/useLanguage'
import { authClient } from '../lib/auth-client'
import { ToastProvider } from './components/ToastProvider'
import { TabErrorBoundary } from './components/States'
import DashboardTab from './tabs/DashboardTab'
import ListingsTab from './tabs/ListingsTab'
import ContentApprovalTab from './tabs/ContentApprovalTab'
import ServiceApprovalTab from './tabs/ServiceApprovalTab'
import PendingBusinessesTab from './tabs/PendingBusinessesTab'
import ReportsTab from './tabs/ReportsTab'
import KnowledgeTab from './tabs/KnowledgeTab'
import BookingsTab from './tabs/BookingsTab'
import ActivityTab from './tabs/ActivityTab'
import EmailCapturesTab from './tabs/EmailCapturesTab'
import './admin.css'

const TABS = [
  { id: 'dashboard', label: 'الرئيسية' },
  { id: 'listings', label: 'الأماكن' },
  { id: 'content', label: 'المحتوى', badge: 'pendingContent' },
  { id: 'services', label: 'الخدمات', badge: 'pendingServices' },
  { id: 'pending', label: 'الحسابات', badge: 'pendingBusinesses' },
  { id: 'reports', label: 'التبليغات', badge: 'pendingReports' },
  { id: 'bookings', label: 'الحجوزات', badge: 'pendingBookings' },
  { id: 'knowledge', label: 'المعرفة' },
  { id: 'activity', label: 'السجل' },
  { id: 'emails', label: 'البريد' },
]

export default function AdminPage() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tabParams, setTabParams] = useState(null)

  // Admin panel is Arabic-only; the RTL rules key off html[dir].
  useSyncHtmlLang('ar')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/sign-in?next=/admin'
    }
  }, [isLoading, isAuthenticated])

  // Dashboard cards hand the operator straight into the tab that clears the
  // work, carrying a filter where one applies.
  const navigate = useCallback((tab, params = null) => {
    setActiveTab(tab)
    setTabParams(params)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="admin-page" dir="rtl">
        <div className="admin-loading" style={{ minHeight: '100vh', alignItems: 'center' }}>
          <div className="admin-spinner" />
        </div>
      </div>
    )
  }

  if (user?.role !== 'admin') {
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
              هذا الحساب ({user?.email}) لا يملك صلاحية الوصول إلى لوحة التحكم.
            </p>
          </div>
          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <Link to="/" className="admin-link">العودة للرئيسية</Link>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <ToastProvider>
      {/* The panel is a single floating sheet on a neutral ground, rather than a
          full-bleed page. It keeps the working area visually bounded, which is
          what makes a dense operator tool feel calm. */}
      <div className="admin-page" dir="rtl">
        <div className="admin-shell">
          <AdminHeader user={user} activeTab={activeTab} onSelect={navigate} />

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
                  onNavigate={navigate}
                />
              </AnimatePresence>
            </TabErrorBoundary>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}

function TabContent({ tab, params, user, onNavigate }) {
  switch (tab) {
    case 'dashboard': return <DashboardTab onNavigate={onNavigate} user={user} />
    case 'listings': return <ListingsTab initialFilters={params} />
    case 'content': return <ContentApprovalTab />
    case 'services': return <ServiceApprovalTab />
    case 'pending': return <PendingBusinessesTab />
    case 'reports': return <ReportsTab />
    case 'bookings': return <BookingsTab />
    case 'knowledge': return <KnowledgeTab />
    case 'activity': return <ActivityTab />
    case 'emails': return <EmailCapturesTab />
    default: return null
  }
}

function AdminHeader({ user, activeTab, onSelect }) {
  const [signingOut, setSigningOut] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  // Same query the dashboard runs, so Convex serves both from one subscription
  // and the badges stay live as queues empty.
  const stats = useQuery(api.admin.queries.getDashboardStats)
  const waiting =
    (stats?.pendingContent ?? 0) + (stats?.pendingServices ?? 0) +
    (stats?.pendingBusinesses ?? 0) + (stats?.pendingReports ?? 0) +
    (stats?.pendingBookings ?? 0)

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

  return (
    <header className="admin-topbar">
      <Link to="/" className="admin-brand">Hasio</Link>

      <nav className="admin-pillnav" aria-label="أقسام لوحة التحكم">
        {TABS.map((tab) => {
          const count = tab.badge ? stats?.[tab.badge] ?? 0 : 0
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
        <span
          className={`admin-icon-btn ${waiting > 0 ? 'has-dot' : ''}`}
          title={waiting > 0 ? `${waiting} عنصر ينتظر إجراءً` : 'لا يوجد شيء بانتظارك'}
          aria-label="التنبيهات"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 9a6 6 0 0112 0c0 3.5.8 5 1.5 5.8.4.4.1 1.2-.5 1.2h-14c-.6 0-.9-.8-.5-1.2C5.2 14 6 12.5 6 9Z"
                  stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 004 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>

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
