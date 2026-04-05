import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { authClient } from '../lib/auth-client'
import AppointmentsSection from '../components/dashboard/AppointmentsSection'
import FavoritesSection from '../components/dashboard/FavoritesSection'
import ProfileSection from '../components/dashboard/ProfileSection'
import TripsSection from '../components/dashboard/TripsSection'
import './PatientDashboard.css'

const tabs = [
  { id: 'bookings', label_ar: 'الحجوزات', label_en: 'Bookings', icon: CalendarIcon },
  { id: 'favorites', label_ar: 'المفضلة', label_en: 'Favorites', icon: HeartIcon },
  { id: 'profile', label_ar: 'الملف الشخصي', label_en: 'Profile', icon: UserIcon },
  { id: 'trips', label_ar: 'رحلاتي', label_en: 'My Trips', icon: MapIcon },
  { id: 'upgrade', label_ar: 'ترقية الحساب', label_en: 'Upgrade', icon: UpgradeIcon },
]

export default function PatientDashboard() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const [activeTab, setActiveTab] = useState('bookings')
  const lang = user?.preferredLanguage || 'ar'
  const isRTL = lang === 'ar'

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/sign-in'
    }
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div className="patient-dashboard" dir={isRTL ? 'rtl' : 'ltr'}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
          <p style={{ color: '#6b7280' }}>{isRTL ? 'جاري التحميل...' : 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="patient-dashboard" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <Link to="/" className="auth-logo">Hasio</Link>
          <div className="dashboard-user-info">
            <span className="dashboard-user-name">
              {isRTL ? 'مرحباً، ' : 'Hi, '}{user.firstName || user.email}
            </span>
            <button
              className="dashboard-signout"
              onClick={async () => { await authClient.signOut(); window.location.href = '/home' }}
            >
              {isRTL ? 'خروج' : 'Sign out'}
            </button>
          </div>
        </div>
      </header>

      <div className="dashboard-layout">
        {/* Sidebar */}
        <aside className="dashboard-sidebar">
          <nav className="sidebar-nav">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`sidebar-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="sidebar-icon">
                  <tab.icon />
                </span>
                {isRTL ? tab.label_ar : tab.label_en}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="dashboard-content">
          {activeTab === 'bookings' && <AppointmentsSection lang={lang} />}
          {activeTab === 'favorites' && <FavoritesSection lang={lang} user={user} />}
          {activeTab === 'profile' && <ProfileSection lang={lang} user={user} />}
          {activeTab === 'trips' && <TripsSection lang={lang} />}
          {activeTab === 'upgrade' && <UpgradeSection lang={lang} user={user} />}
        </main>
      </div>

      {/* Mobile bottom tabs */}
      <div className="dashboard-bottom-tabs">
        <div className="bottom-tabs-inner">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`bottom-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon />
              <span>{isRTL ? tab.label_ar : tab.label_en}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// Icon components
function CalendarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}

function UpgradeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="16 12 12 8 8 12" />
      <line x1="12" y1="16" x2="12" y2="8" />
    </svg>
  )
}

function UpgradeSection({ lang, user }) {
  const isRTL = lang === 'ar'
  const setUserRole = useMutation(api.users.mutations.setUserRole)
  const [loading, setLoading] = useState(null)

  const handleUpgrade = async (role) => {
    setLoading(role)
    try {
      await setUserRole({ role })
      window.location.href = '/business'
    } catch (err) {
      console.error('Upgrade failed:', err)
      setLoading(null)
    }
  }

  const cardContainerStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '24px',
    maxWidth: '720px',
    margin: '0 auto',
    padding: '24px 0',
  }

  const cardStyle = {
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: '20px',
    border: '1px solid rgba(13, 122, 95, 0.12)',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '16px',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  }

  const iconCircleStyle = {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'rgba(13, 122, 95, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0D7A5F',
  }

  const titleStyle = {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#1a1a1a',
    margin: 0,
  }

  const descStyle = {
    fontSize: '0.9rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: 0,
  }

  const btnStyle = {
    padding: '12px 32px',
    borderRadius: '14px',
    border: 'none',
    background: '#0D7A5F',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.2s ease, transform 0.15s ease',
    marginTop: '8px',
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: '#1a1a1a', marginBottom: '8px' }}>
        {isRTL ? 'ترقية حسابك' : 'Upgrade Your Account'}
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '0.95rem' }}>
        {isRTL
          ? 'اختر نوع الحساب الذي يناسبك للبدء في تقديم خدماتك'
          : 'Choose the account type that fits you to start offering your services'}
      </p>
      <div style={cardContainerStyle}>
        {/* Business Owner Card */}
        <div
          style={cardStyle}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(13, 122, 95, 0.12)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.06)' }}
        >
          <div style={iconCircleStyle}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <h3 style={titleStyle}>{isRTL ? 'صاحب عمل' : 'Business Owner'}</h3>
          <p style={descStyle}>
            {isRTL
              ? 'أضف فنادق، مطاعم، فعاليات، ومعالم سياحية على المنصة وأدر حجوزاتك'
              : 'List hotels, restaurants, events, and attractions on the platform and manage your bookings'}
          </p>
          <button
            style={{
              ...btnStyle,
              opacity: loading === 'business_owner' ? 0.7 : 1,
              pointerEvents: loading ? 'none' : 'auto',
            }}
            onClick={() => handleUpgrade('business_owner')}
          >
            {loading === 'business_owner'
              ? (isRTL ? 'جاري الترقية...' : 'Upgrading...')
              : (isRTL ? 'ترقية' : 'Upgrade')}
          </button>
        </div>

        {/* Service Provider Card */}
        <div
          style={cardStyle}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(13, 122, 95, 0.12)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.06)' }}
        >
          <div style={iconCircleStyle}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 style={titleStyle}>{isRTL ? 'مقدم خدمات' : 'Service Provider'}</h3>
          <p style={descStyle}>
            {isRTL
              ? 'قدّم خدماتك المستقلة مثل التصوير، القيادة السياحية، الإرشاد، والمزيد'
              : 'Offer freelance services like photography, driving, tour guiding, and more'}
          </p>
          <button
            style={{
              ...btnStyle,
              opacity: loading === 'service_provider' ? 0.7 : 1,
              pointerEvents: loading ? 'none' : 'auto',
            }}
            onClick={() => handleUpgrade('service_provider')}
          >
            {loading === 'service_provider'
              ? (isRTL ? 'جاري الترقية...' : 'Upgrading...')
              : (isRTL ? 'ترقية' : 'Upgrade')}
          </button>
        </div>
      </div>
    </div>
  )
}
