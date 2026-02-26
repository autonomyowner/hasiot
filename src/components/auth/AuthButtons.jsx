import { useNavigate } from 'react-router-dom'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { authClient } from '../../lib/auth-client'
import './AuthButtons.css'

const translations = {
  ar: {
    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    welcome: 'مرحباً',
    signOut: 'تسجيل الخروج',
    dashboard: 'لوحة التحكم',
  },
  en: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    welcome: 'Welcome',
    signOut: 'Sign Out',
    dashboard: 'Dashboard',
  }
}

export default function AuthButtons({ lang = 'ar' }) {
  const navigate = useNavigate()
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const t = translations[lang] || translations.ar

  if (isLoading) {
    return <div className="auth-loading"></div>
  }

  if (isAuthenticated && user) {
    const dashboardPath = user.role === 'business_owner' || user.role === 'service_provider'
      ? '/business'
      : '/dashboard'

    return (
      <div className="auth-user">
        <button
          className="btn btn-primary-auth"
          onClick={() => navigate(dashboardPath)}
        >
          {t.dashboard}
        </button>
        <button
          className="btn btn-outline-auth"
          onClick={async () => {
            await authClient.signOut()
            window.location.href = '/home'
          }}
        >
          {t.signOut}
        </button>
      </div>
    )
  }

  return (
    <div className="auth-buttons">
      <button className="btn btn-outline-auth" onClick={() => navigate('/sign-in')}>
        {t.signIn}
      </button>
      <button className="btn btn-primary-auth" onClick={() => navigate('/sign-up')}>
        {t.signUp}
      </button>
    </div>
  )
}
