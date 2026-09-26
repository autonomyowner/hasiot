import { Link } from 'react-router-dom'
import SiteHeader from '../site/SiteHeader'
import './booking.css'

const translations = {
  en: { explore: 'Explore', trips: 'My trips', terms: 'Terms', privacy: 'Privacy', support: 'Support' },
  ar: { explore: 'استكشف', trips: 'رحلاتي', terms: 'الشروط', privacy: 'الخصوصية', support: 'الدعم' },
}

/**
 * The frame every traveller page sits in: the landing page's typeface, the
 * .bk tokens, the header, the page's <main> and a quiet footer.
 *
 * The page passes its own `useLanguage()` result in rather than the shell
 * calling it again: each call keeps its own state, and a toggle in one would
 * not re-render the other (the storage event only fires in other tabs).
 * `withBar` leaves room under the footer for a page's fixed phone bar, which
 * would otherwise cover the page's last lines.
 */
export default function PageShell({ lang, toggleLang, isRtl, current = null, withBar = false, children }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  return (
    <div className="landing-type contents">
      <div className={`bk${isRtl ? ' rtl' : ''}${withBar ? ' bk-with-bar' : ''}`} dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
        <SiteHeader lang={lang} toggleLang={toggleLang} current={current} />
        <main id="main" className="bk-page">{children}</main>
        <footer className="bk-foot">
          <span>© 2026 HASIO</span>
          <span className="bk-row" style={{ gap: 18 }}>
            <Link to="/explore">{t.explore}</Link>
            <Link to="/trips">{t.trips}</Link>
            {/* Static files in public/, not routes: plain anchors. */}
            <a href="/terms-of-service.html">{t.terms}</a>
            <a href="/privacy-policy.html">{t.privacy}</a>
            <a href="/support.html">{t.support}</a>
          </span>
        </footer>
      </div>
    </div>
  )
}
