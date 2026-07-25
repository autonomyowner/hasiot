import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { authClient } from '../lib/auth-client'
import './Navbar.css'

const t = {
  en: { explore: 'Explore', marketplace: 'Marketplace', services: 'Services', dashboard: 'Dashboard', signIn: 'Sign In', signUp: 'Sign Up', langSwitch: 'عربي', menu: 'Menu' },
  ar: { explore: 'استكشف', marketplace: 'السوق', services: 'الخدمات', dashboard: 'لوحة التحكم', signIn: 'تسجيل الدخول', signUp: 'إنشاء حساب', langSwitch: 'English', menu: 'القائمة' }
}

const LINKS = [
  { to: '/explore', key: 'explore' },
  { to: '/listings', key: 'marketplace' },
  { to: '/services', key: 'services' },
]

export default function Navbar({ lang = 'en', onLangToggle }) {
  const session = authClient.useSession()
  const isLoggedIn = !!session?.data
  const nav = t[lang] || t.en
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const closeMenu = () => setMenuOpen(false)

  return (
    <nav className="site-nav">
      <div className="site-nav-inner">
        <Link to="/" className="site-nav-logo">
          <img src="/logo.png" alt="Hasio" className="site-nav-logo-img" />
          Hasio
        </Link>

        <ul className="site-nav-links">
          {LINKS.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className={pathname.startsWith(l.to) ? 'active' : undefined}>
                {nav[l.key]}
              </Link>
            </li>
          ))}
          {isLoggedIn && (
            <li>
              <Link to="/dashboard" className={pathname.startsWith('/dashboard') ? 'active' : undefined}>
                {nav.dashboard}
              </Link>
            </li>
          )}
        </ul>

        <div className="site-nav-actions">
          {onLangToggle && (
            <button onClick={onLangToggle} className="site-nav-lang">{nav.langSwitch}</button>
          )}
          {isLoggedIn ? (
            <Link to="/dashboard" className="site-nav-signup">{nav.dashboard}</Link>
          ) : (
            <>
              <Link to="/sign-in" className="site-nav-signin">{nav.signIn}</Link>
              <Link to="/sign-up" className="site-nav-signup">{nav.signUp}</Link>
            </>
          )}
          <button
            className="site-nav-burger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={nav.menu}
            aria-expanded={menuOpen}
          >
            <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="site-nav-dropdown">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} onClick={closeMenu}>{nav[l.key]}</Link>
          ))}
          {isLoggedIn && <Link to="/dashboard" onClick={closeMenu}>{nav.dashboard}</Link>}
          <div className="site-nav-dropdown-divider" />
          {isLoggedIn ? (
            <Link to="/dashboard" className="site-nav-dropdown-cta" onClick={closeMenu}>{nav.dashboard}</Link>
          ) : (
            <>
              <Link to="/sign-in" onClick={closeMenu}>{nav.signIn}</Link>
              <Link to="/sign-up" className="site-nav-dropdown-cta" onClick={closeMenu}>{nav.signUp}</Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
