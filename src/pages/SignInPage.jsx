import { useState } from 'react'
import { Link } from 'react-router-dom'
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
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: '••••••••',
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
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: '••••••••',
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [lang, setLang] = useState('ar')
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
      <div className="auth-card">
        <button
          className="auth-lang-toggle"
          type="button"
          onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
        >
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>

        <Link to="/" className="auth-logo">Hasio</Link>
        <h1>{t.title}</h1>
        <p className="auth-subtitle">{t.subtitle}</p>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group-auth">
            <label className="form-label-auth">{t.email}</label>
            <input
              className="form-input-auth"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group-auth">
            <label className="form-label-auth">{t.password}</label>
            <input
              className="form-input-auth"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              required
              autoComplete="current-password"
              minLength={8}
            />
          </div>
          <button className="auth-btn-primary" type="submit" disabled={loading}>
            {loading ? t.loading : t.signIn}
          </button>
        </form>

        <p className="auth-footer-text">
          {t.noAccount}{' '}
          <Link to="/sign-up">{t.signUp}</Link>
        </p>
        <p className="auth-legal">
          By continuing, you agree to our{' '}
          <Link to="/terms-of-service.html">Terms of Service</Link> and{' '}
          <Link to="/privacy-policy.html">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
