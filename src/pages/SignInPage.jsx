import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import { useLanguage } from '../hooks/useLanguage'
import './SignIn.css'

// The landing page's two brand posters, as on the partner sign-in: artwork
// with its own typography, so always shown whole and never cropped.
const POSTERS = [
  { src: '/posters/gate.webp', w: 1085, h: 1335 },
  { src: '/posters/arch.webp', w: 1122, h: 1402 },
]

const Poster = ({ p }) => (
  <aside className="signin-poster" aria-hidden="true">
    <img src={p.src} alt="" width={p.w} height={p.h} loading="lazy" decoding="async" />
  </aside>
)

const translations = {
  ar: {
    title: 'تسجيل الدخول',
    subtitle: 'مرحباً بك مجدداً في Hasio',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    signIn: 'تسجيل الدخول',
    backHome: 'العودة للرئيسية',
    error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة',
    loading: 'جاري التحميل...',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: '••••••••',
    legalPrefix: 'بمتابعتك فإنك توافق على',
    terms: 'شروط الخدمة',
    legalAnd: 'و',
    privacy: 'سياسة الخصوصية',
  },
  en: {
    title: 'Sign In',
    subtitle: 'Welcome back to Hasio',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    backHome: 'Back to Home',
    error: 'Invalid email or password',
    loading: 'Loading...',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: '••••••••',
    legalPrefix: 'By continuing, you agree to our',
    terms: 'Terms of Service',
    legalAnd: 'and',
    privacy: 'Privacy Policy',
  }
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { lang, toggleLang } = useLanguage()
  const [searchParams] = useSearchParams()
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

      // Sign-in only exists to reach the admin portal and the account
      // deletion page, so honour ?next= and default to /admin. Relative
      // paths only — never redirect to a caller-supplied absolute URL.
      const next = searchParams.get('next')
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/admin'
    } catch {
      setError(t.error)
      setLoading(false)
    }
  }

  return (
    <div className="signin" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <Poster p={POSTERS[0]} />

      <main className="signin-card">
        <div className="signin-top">
          <Link to="/" className="signin-logo">Hasio</Link>
          <button className="signin-lang" type="button" onClick={() => toggleLang()}>
            {lang === 'ar' ? 'English' : 'العربية'}
          </button>
        </div>

        <h1 className="signin-title">{t.title}</h1>
        <p className="signin-subtitle">{t.subtitle}</p>

        {error && <div className="signin-error" role="alert">{error}</div>}

        <form className="signin-form" onSubmit={handleSubmit}>
          <div className="signin-field">
            <label className="signin-label" htmlFor="signin-email">{t.email}</label>
            <input
              id="signin-email"
              className="signin-input"
              dir="ltr"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlaceholder}
              required
              autoComplete="email"
            />
          </div>
          <div className="signin-field">
            <label className="signin-label" htmlFor="signin-password">{t.password}</label>
            <input
              id="signin-password"
              className="signin-input"
              dir="ltr"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t.passwordPlaceholder}
              required
              autoComplete="current-password"
              minLength={8}
            />
          </div>
          <button className="signin-btn" type="submit" disabled={loading}>
            {loading ? t.loading : t.signIn}
          </button>
        </form>

        {/* Plain anchors, not react-router <Link>: these are static files in
            public/, not routes. A <Link> is intercepted client-side, matches no
            route, and renders a blank page. */}
        <p className="signin-legal">
          {t.legalPrefix}{' '}
          <a href="/terms-of-service.html">{t.terms}</a> {t.legalAnd}{' '}
          <a href="/privacy-policy.html">{t.privacy}</a>
        </p>
      </main>

      <Poster p={POSTERS[1]} />
    </div>
  )
}
