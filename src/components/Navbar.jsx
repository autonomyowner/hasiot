import { Link } from 'react-router-dom'
import { authClient } from '../lib/auth-client'

const t = {
  en: { explore: 'Explore', marketplace: 'Marketplace', services: 'Services', dashboard: 'Dashboard', signIn: 'Sign In', signUp: 'Sign Up', langSwitch: 'عربي' },
  ar: { explore: 'استكشف', marketplace: 'السوق', services: 'الخدمات', dashboard: 'لوحة التحكم', signIn: 'تسجيل الدخول', signUp: 'إنشاء حساب', langSwitch: 'English' }
}

export default function Navbar({ lang = 'en', onLangToggle }) {
  const session = authClient.useSession()
  const isLoggedIn = !!session?.data
  const nav = t[lang] || t.en

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-logo">
          <img src="/logo.png" alt="Hasio" className="nav-logo-img" />
          Hasio
        </Link>

        <ul className="nav-links">
          <li><Link to="/explore">{nav.explore}</Link></li>
          <li><Link to="/listings">{nav.marketplace}</Link></li>
          <li><Link to="/services">{nav.services}</Link></li>
          {isLoggedIn && <li><Link to="/dashboard">{nav.dashboard}</Link></li>}
        </ul>

        <div className="nav-actions">
          {onLangToggle && (
            <button onClick={onLangToggle} className="btn-lang">{nav.langSwitch}</button>
          )}
          {isLoggedIn ? (
            <Link to="/dashboard" className="btn-signup">{nav.dashboard}</Link>
          ) : (
            <>
              <Link to="/sign-in" className="btn-signin">{nav.signIn}</Link>
              <Link to="/sign-up" className="btn-signup">{nav.signUp}</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  )
}
