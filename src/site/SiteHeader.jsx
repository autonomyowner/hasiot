import { Link } from 'react-router-dom'
import '../App.css'

const translations = {
  en: { explore: 'Explore', home: 'Home', app: 'The app', contact: 'Contact', trips: 'My trips', switch: 'العربية', nav: 'Main' },
  ar: { explore: 'استكشف', home: 'الرئيسية', app: 'التطبيق', contact: 'تواصل معنا', trips: 'رحلاتي', switch: 'English', nav: 'الرئيسية' },
}

/**
 * The bar on the traveller's pages: /explore's (App.css .home-nav, fixed and
 * already "stuck"), plus "My trips" (design W15). Below 900px the four links
 * give way, as on the landing page; a plain Explore link stands in for them.
 *
 * Internal routes are router links, so moving between My trips and a place
 * page never reloads the Convex connection; the landing page's section links
 * stay plain anchors because the router does not scroll to a hash.
 */
export default function SiteHeader({ lang, toggleLang, current = null }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  return (
    <header className="home-nav is-stuck">
      <Link className="wordmark" to="/">
        <img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" />
        {/* The brand is always "Hasio" in Latin script. */}
        <span lang="en" dir="ltr">Hasio</span>
      </Link>
      <nav className="nav-menu" aria-label={t.nav}>
        <Link to="/explore" aria-current={current === 'explore' ? 'page' : undefined}>{t.explore}</Link>
        <Link to="/">{t.home}</Link>
        <a href="/#app">{t.app}</a>
        <a href="/#contact">{t.contact}</a>
      </nav>
      <div className="nav-actions">
        <Link className="site-mini" to="/explore">{t.explore}</Link>
        <Link className="site-trips" to="/trips" aria-current={current === 'trips' ? 'page' : undefined}>{t.trips}</Link>
        <button type="button" className="lang-btn" onClick={toggleLang} lang={lang === 'ar' ? 'en' : 'ar'}>{t.switch}</button>
      </div>
    </header>
  )
}
