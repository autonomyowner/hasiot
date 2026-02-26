import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import './AuthPages.css'

const translations = {
  ar: {
    title: 'تسجيل الدخول',
    subtitle: 'مرحباً بك مجدداً في Hasio',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    noAccount: 'ليس لديك حساب؟',
    signUp: 'إنشاء حساب',
    backHome: 'العودة للرئيسية',
    error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    loading: 'جاري التحميل...',
  },
  en: {
    title: 'Sign In',
    subtitle: 'Welcome back to Hasio',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    noAccount: "Don't have an account?",
    signUp: 'Sign Up',
    backHome: 'Back to Home',
    error: 'Invalid email or password',
    loading: 'Loading...',
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState('ar')
  const navigate = useNavigate()
  const t = translations[lang] || translations.ar

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      })

      if (signInError) {
        setError(t.error)
        setLoading(false)
        return
      }

      // Redirect to home — the app will check role and redirect as needed
      window.location.href = '/home'
    } catch {
      setError(t.error)
      setLoading(false)
    }
  }

  return (
    <div className="auth-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <button className="auth-lang-toggle" onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}>
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link to="/" className="auth-logo">Hasio</Link>
            <h1 className="auth-title">{t.title}</h1>
            <p className="auth-subtitle">{t.subtitle}</p>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label>{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@example.com"
              />
            </div>

            <div className="auth-field">
              <label>{t.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                minLength={8}
              />
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? t.loading : t.signIn}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {t.noAccount}{' '}
              <Link to="/sign-up" className="auth-link">{t.signUp}</Link>
            </p>
            <Link to="/" className="auth-link-secondary">{t.backHome}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
