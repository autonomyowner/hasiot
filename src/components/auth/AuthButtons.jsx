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
  },
  en: {
    signIn: 'Sign In',
    signUp: 'Sign Up',
    welcome: 'Welcome',
    signOut: 'Sign Out',
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
    return (
      <div className="auth-user">
        <span className="welcome-text">
          {t.welcome}, {user.firstName || user.email}
        </span>
        <button
          className="btn btn-outline-auth"
          onClick={async () => {
            await authClient.signOut()
            window.location.href = '/'
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
