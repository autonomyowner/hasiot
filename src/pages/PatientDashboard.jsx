import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
              onClick={async () => { await authClient.signOut(); window.location.href = '/' }}
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
