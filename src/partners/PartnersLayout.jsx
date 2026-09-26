import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import { authClient } from '../lib/auth-client'
import { Toaster } from '../admin/ui/sonner'
import { useConfirm } from '../admin/components/ConfirmDialog'
import { PartnerLangContext, pick } from './lang'
import { PartnerConfirmContext } from './confirm'
import { usePartnerRoute } from './usePartnerGate'
import { formatPhone } from './lib/phone'
import { Icon, PageSpinner } from './components/Ui'
import { InsightIcon } from './insights/InsightsUi'
// Tailwind (with its preflight) is what the shared dialog and toasts are
// styled with; it rides in this lazy chunk like it does in the admin one.
// partners.css comes after it so the portal's own rules win.
import '../admin/tailwind.css'
import './partners.css'

const translations = {
  en: {
    portal: 'Partners',
    toggle: 'العربية',
    toggleLabel: 'Switch to Arabic',
    signOut: 'Sign out',
    overview: 'Overview',
    places: 'My places',
    services: 'My services',
    bookings: 'Bookings',
    analytics: 'Analytics',
    guests: 'Guests',
    verification: 'Verification',
    nav: 'Partner navigation',
    toasts: 'Notifications',
    closeToast: 'Close notification',
    confirm: 'Confirm',
    cancel: 'Cancel',
    navHeading: 'Navigation',
    menu: 'Menu',
    closeMenu: 'Close menu',
    roleHotel: 'Places & stays',
    roleServices: 'Service provider',
    approved: 'Approved',
    awaiting: 'Awaiting approval',
  },
  ar: {
    portal: 'الشركاء',
    toggle: 'English',
    toggleLabel: 'التبديل إلى الإنجليزية',
    signOut: 'تسجيل الخروج',
    overview: 'نظرة عامة',
    places: 'أماكني',
    services: 'خدماتي',
    bookings: 'الحجوزات',
    analytics: 'التحليلات',
    guests: 'الضيوف',
    verification: 'التوثيق',
    nav: 'تنقل الشركاء',
    toasts: 'الإشعارات',
    closeToast: 'إغلاق الإشعار',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
    navHeading: 'التنقل',
    menu: 'القائمة',
    closeMenu: 'إغلاق القائمة',
    roleHotel: 'أماكن وإقامات',
    roleServices: 'مقدّم خدمات',
    approved: 'موثّق',
    awaiting: 'بانتظار الموافقة',
  },
}

// The portal's own type: Geist for Latin and numbers, IBM Plex Sans Arabic for
// Arabic. Injected when the portal mounts so the landing page never pays for it.
const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap'

function usePortalFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-partners-fonts]')) return
    for (const origin of ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']) {
      const pre = document.createElement('link')
      pre.rel = 'preconnect'
      pre.href = origin
      if (origin.includes('gstatic')) pre.crossOrigin = 'anonymous'
      pre.setAttribute('data-partners-fonts', '')
      document.head.appendChild(pre)
    }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = FONT_HREF
    link.setAttribute('data-partners-fonts', '')
    document.head.appendChild(link)
  }, [])
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * The slide-in navigation under 1024px. Escape and the backdrop close it,
 * Tab stays inside while it is open, and focus goes back to the menu button.
 */
function NavSheet({ open, onClose, label, closeLabel, returnFocusRef, children }) {
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const panel = panelRef.current
    const returnTo = returnFocusRef.current
    panel?.querySelector(FOCUSABLE)?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab' || !panel) return
      const nodes = [...panel.querySelectorAll(FOCUSABLE)]
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    // Widening past the breakpoint hides the sheet with CSS but would leave the
    // body scroll-locked; close it properly instead.
    const wide = window.matchMedia('(min-width: 1024px)')
    const onWide = (e) => { if (e.matches) onClose() }
    wide.addEventListener('change', onWide)
    return () => {
      document.removeEventListener('keydown', onKey)
      wide.removeEventListener('change', onWide)
      document.body.style.overflow = prevOverflow
      returnTo?.focus()
    }
  }, [open, onClose, returnFocusRef])

  if (!open) return null
  return (
    <div className="p-sheet-root">
      <div className="p-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="p-sheet" role="dialog" aria-modal="true" aria-label={label} ref={panelRef}>
        <div className="p-sheet-head">
          <a className="p-brand" href="/partners">
            <span className="p-wordmark" lang="en" dir="ltr">Hasio</span>
          </a>
          <button type="button" className="p-icon-btn" onClick={onClose} aria-label={closeLabel}>
            <Icon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function navFor(route, user, t) {
  const isBusiness = user?.role === 'business_owner'
  const isProvider = user?.role === 'service_provider'
  if (!isBusiness && !isProvider) return []
  const items = []
  if (route === 'hotel') {
    items.push(
      { to: '/partners/hotel', end: true, label: t.overview, icon: 'home' },
      { to: '/partners/hotel/places', label: t.places, icon: 'building' },
      { to: '/partners/hotel/bookings', label: t.bookings, icon: 'calendar' },
      { to: '/partners/hotel/analytics', label: t.analytics, insightIcon: 'chart' },
      { to: '/partners/hotel/guests', label: t.guests, insightIcon: 'users' }
    )
  } else if (route === 'services') {
    items.push(
      { to: '/partners/services', end: true, label: t.overview, icon: 'home' },
      { to: '/partners/services/mine', label: t.services, icon: 'briefcase' },
      { to: '/partners/services/bookings', label: t.bookings, icon: 'calendar' },
      { to: '/partners/services/analytics', label: t.analytics, insightIcon: 'chart' },
      { to: '/partners/services/guests', label: t.guests, insightIcon: 'users' }
    )
  }
  items.push({ to: '/partners/verify', label: t.verification, icon: 'shield' })
  return items
}

/**
 * The partner portal's shell. Signed-in hosts and providers get a sticky
 * sidebar (≥1024px) or a top bar with a slide-in sheet, beside a white plate
 * holding the page; everyone else gets a slim header and a centred page.
 * Owns the language,
 * the toasts and the one confirm dialog, so pages only render content.
 */
export default function PartnersLayout() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = pick(translations, lang)
  const { user, isAuthenticated, route } = usePartnerRoute()
  const navigate = useNavigate()
  const { confirm, confirmDialog } = useConfirm()

  // Every portal confirm speaks the page's language unless the caller says otherwise.
  const partnerConfirm = useMemo(
    () => (options) =>
      confirm({ dir: isRtl ? 'rtl' : 'ltr', confirmLabel: t.confirm, cancelLabel: t.cancel, ...options }),
    [confirm, isRtl, t.confirm, t.cancel]
  )
  const langValue = useMemo(() => ({ lang, isRtl, toggleLang }), [lang, isRtl, toggleLang])

  const items = navFor(route, user, t)
  usePortalFonts()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtnRef = useRef(null)
  const closeMenu = useCallback(() => setMenuOpen(false), [])

  const signOut = async () => {
    try {
      await authClient.signOut()
    } finally {
      navigate('/partners', { replace: true })
    }
  }

  const langButton = (
    <button type="button" className="p-btn p-btn-ghost p-btn-sm" onClick={toggleLang} aria-label={t.toggleLabel}>
      <Icon name="globe" size={18} />
      <span lang={isRtl ? 'en' : 'ar'}>{t.toggle}</span>
    </button>
  )
  const signOutButton = isAuthenticated && (
    <button type="button" className="p-btn p-btn-ghost p-btn-sm" onClick={signOut} aria-label={t.signOut}>
      <Icon name="logout" size={18} />
      <span>{t.signOut}</span>
    </button>
  )
  const brand = (
    <a className="p-brand" href="/partners">
      {/* The brand is always "Hasio" in Latin script, in both languages. */}
      <span className="p-wordmark" lang="en" dir="ltr">Hasio</span>
      <span className="p-brand-sub">{t.portal}</span>
    </a>
  )

  // Phone sign-ups carry a synthetic @phone.hasio.xyz email, never shown to anyone.
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
  const realEmail = user?.email && !user.email.endsWith('@phone.hasio.xyz') ? user.email : ''
  const displayName = fullName || user?.name || (user?.phone ? formatPhone(user.phone) : '') || realEmail
  const account = user && (
    <div className="p-account">
      <span className="p-account-avatar" aria-hidden="true">
        {displayName ? [...displayName.trim()][0]?.toUpperCase() : <Icon name="user" size={16} />}
      </span>
      <span className="p-account-body">
        <span className="p-account-name" dir="auto">{displayName}</span>
        <span className="p-account-meta">
          <span>{user.role === 'business_owner' ? t.roleHotel : t.roleServices}</span>
          <span className={user.isApproved ? 'p-account-status is-ok' : 'p-account-status'}>
            {user.isApproved ? t.approved : t.awaiting}
          </span>
        </span>
      </span>
    </div>
  )

  const renderNav = (inSheet) => (
    <nav className="p-nav" aria-label={t.nav}>
      <span className="p-nav-heading" aria-hidden="true">{t.navHeading}</span>
      {items.map((item, i) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={inSheet ? closeMenu : undefined}
          style={inSheet ? { '--i': i } : undefined}
          className={({ isActive }) => (isActive ? 'p-nav-link is-active' : 'p-nav-link')}
        >
          {item.insightIcon
            ? <InsightIcon name={item.insightIcon} size={18} />
            : <Icon name={item.icon} size={18} />}
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )

  const content = (
    <main className="p-main">
      {/* Pages are lazy chunks; loading one keeps the shell on screen. */}
      <Suspense fallback={<PageSpinner />}>
        <Outlet />
      </Suspense>
    </main>
  )

  return (
    <PartnerLangContext.Provider value={langValue}>
      <PartnerConfirmContext.Provider value={partnerConfirm}>
        <div className="partners" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
          {items.length > 0 ? (
            <div className="p-shell">
              <aside className="p-sidebar">
                {brand}
                {account}
                {renderNav(false)}
                <div className="p-sidebar-foot">
                  {signOutButton}
                  {langButton}
                </div>
              </aside>

              <header className="p-topbar">
                <button type="button" ref={menuBtnRef} className="p-icon-btn p-menu-btn" onClick={() => setMenuOpen(true)}
                  aria-label={t.menu} aria-expanded={menuOpen} aria-haspopup="dialog">
                  <Icon name="menu" size={18} />
                </button>
                {brand}
                <div className="p-header-actions">{langButton}</div>
              </header>

              <div className="p-plate">{content}</div>

              <NavSheet open={menuOpen} onClose={closeMenu} label={t.nav} closeLabel={t.closeMenu} returnFocusRef={menuBtnRef}>
                {account}
                {renderNav(true)}
                <div className="p-sidebar-foot">
                  {signOutButton}
                  {langButton}
                </div>
              </NavSheet>
            </div>
          ) : (
            <>
              <header className="p-header">
                {brand}
                <div className="p-header-actions">
                  {langButton}
                  {signOutButton}
                </div>
              </header>
              <div className="p-body">{content}</div>
            </>
          )}

          <Toaster
            dir={isRtl ? 'rtl' : 'ltr'}
            containerAriaLabel={t.toasts}
            toastOptions={{ closeButtonAriaLabel: t.closeToast }}
          />
          {confirmDialog}
        </div>
      </PartnerConfirmContext.Provider>
    </PartnerLangContext.Provider>
  )
}
