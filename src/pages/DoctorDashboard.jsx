import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCurrentUser } from '../hooks/useCurrentUser'
import './AuthPages.css'

export default function DoctorDashboard() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/sign-in'
    }
  }, [isLoading, isAuthenticated])

  if (isLoading) {
    return (
      <div className="auth-page" dir="rtl">
        <div className="auth-container">
          <div className="auth-card">
            <p style={{ textAlign: 'center', color: '#6b7280' }}>جاري التحميل...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Check if doctor is approved
  if (user.role === 'doctor' && !user.isApproved) {
    return (
      <div className="auth-page" dir="rtl">
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <Link to="/" className="auth-logo">طبرة</Link>
              <h1 className="auth-title">حسابك قيد المراجعة</h1>
            </div>
            <div className="auth-success">
              <p style={{ color: '#92400e', background: '#fef3c7', padding: '1rem', borderRadius: '8px' }}>
                حسابك كطبيب قيد المراجعة من قبل الإدارة. سيتم إعلامك عند الموافقة على حسابك.
              </p>
            </div>
            <div className="auth-footer">
              <Link to="/" className="auth-link-secondary">العودة للرئيسية</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Approved doctor dashboard placeholder
  return (
    <div className="doctor-dashboard" dir="rtl">
      <header className="doctor-header">
        <div className="doctor-header-inner">
          <Link to="/" className="auth-logo">طبرة</Link>
          <div>
            <span style={{ color: '#6b7280', marginLeft: '1rem' }}>
              مرحباً، د. {user.firstName || user.email}
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
          لوحة تحكم الطبيب
        </h1>

        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          textAlign: 'center',
          color: '#6b7280'
        }}>
          <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            مرحباً بك في لوحة تحكم الطبيب
          </p>
          <p>هذه الصفحة قيد التطوير. ستتمكن قريباً من إدارة مواعيدك ومرضاك من هنا.</p>
        </div>
      </main>
    </div>
  )
}
