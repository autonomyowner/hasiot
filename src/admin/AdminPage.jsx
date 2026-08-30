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
  { id: 'dashboard', label: 'الإحصائيات' },
  { id: 'listings', label: 'الأماكن' },
  { id: 'content', label: 'محتوى معلق', badge: 'pendingContent' },
  { id: 'services', label: 'خدمات معلقة', badge: 'pendingServices' },
  { id: 'pending', label: 'حسابات معلقة', badge: 'pendingBusinesses' },
  { id: 'reports', label: 'التبليغات', badge: 'pendingReports' },
  { id: 'bookings', label: 'الحجوزات', badge: 'pendingBookings' },
  { id: 'knowledge', label: 'قاعدة المعرفة' },
  { id: 'activity', label: 'السجل' },
  { id: 'emails', label: 'البريد الإلكتروني' },
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

  // The dashboard's cards hand the operator straight into the tab that clears
  // the work, carrying a filter where one applies.
  const navigate = useCallback((tab, params = null) => {
    setActiveTab(tab)
    setTabParams(params)
  }, [])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="admin-login" dir="rtl">
        <div className="admin-loading" style={{ minHeight: '100vh', alignItems: 'center' }}>
          <div className="admin-spinner" />
        </div>
      </div>
    )
  }

  if (user?.role !== 'admin') {
    return (
      <div className="admin-login" dir="rtl">
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
      <div className="admin-layout" dir="rtl">
        <AdminHeader user={user} />
        <AdminNav activeTab={activeTab} onSelect={navigate} />

        <main className="admin-main">
          {/* Keyed so a failure in one tab is cleared by moving to another,
              instead of the root boundary blanking the whole panel. */}
          <TabErrorBoundary key={activeTab}>
            <AnimatePresence mode="wait">
              <TabContent
                key={activeTab}
                tab={activeTab}
                params={tabParams}
                onNavigate={navigate}
              />
            </AnimatePresence>
          </TabErrorBoundary>
        </main>
      </div>
    </ToastProvider>
  )
}

function TabContent({ tab, params, onNavigate }) {
  switch (tab) {
    case 'dashboard': return <DashboardTab onNavigate={onNavigate} />
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

function AdminHeader({ user }) {
  const [signingOut, setSigningOut] = useState(false)

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

  return (
    <header className="admin-header">
      <div className="admin-header-inner">
        <Link to="/" className="admin-logo">لوحة تحكم Hasio</Link>
        <div className="admin-header-right">
          <span className="admin-header-user">مرحباً، {user.firstName || 'المدير'}</span>
          <button
            onClick={handleLogout}
            className="admin-btn admin-btn-secondary admin-btn-small"
            disabled={signingOut}
          >
            {signingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
          </button>
        </div>
      </div>
    </header>
  )
}

function AdminNav({ activeTab, onSelect }) {
  // Same query the dashboard runs, so Convex serves both from one subscription
  // and the badges stay live as queues empty.
  const stats = useQuery(api.admin.queries.getDashboardStats)

  return (
    <nav className="admin-nav">
      <div className="admin-nav-inner">
        {TABS.map((tab) => {
          const count = tab.badge ? stats?.[tab.badge] ?? 0 : 0
          return (
            <button
              key={tab.id}
              onClick={() => onSelect(tab.id)}
              className={`admin-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
              {count > 0 && <span className="admin-nav-badge">{count}</span>}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
