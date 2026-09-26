import { Suspense, useMemo } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { authClient } from '../lib/auth-client'
import { Toaster } from '../admin/ui/sonner'
import { useConfirm } from '../admin/components/ConfirmDialog'
import { PartnerLangContext, pick } from './lang'
import { PartnerConfirmContext } from './confirm'
import { partnerRoute } from './lib/gate'
import { Icon, PageSpinner } from './components/Ui'
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
    verification: 'Verification',
    nav: 'Partner navigation',
    toasts: 'Notifications',
    closeToast: 'Close notification',
    confirm: 'Confirm',
    cancel: 'Cancel',
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
    verification: 'التوثيق',
    nav: 'تنقل الشركاء',
    toasts: 'الإشعارات',
    closeToast: 'إغلاق الإشعار',
    confirm: 'تأكيد',
    cancel: 'إلغاء',
  },
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
      { to: '/partners/hotel/bookings', label: t.bookings, icon: 'calendar' }
    )
  } else if (route === 'services') {
    items.push(
      { to: '/partners/services', end: true, label: t.overview, icon: 'home' },
      { to: '/partners/services/mine', label: t.services, icon: 'briefcase' },
      { to: '/partners/services/bookings', label: t.bookings, icon: 'calendar' }
    )
  }
  items.push({ to: '/partners/verify', label: t.verification, icon: 'shield' })
  return items
}

/**
 * The partner portal's shell: header (wordmark, language, sign out), a side
 * nav for signed-in hosts and providers, and the page. Owns the language,
 * the toasts and the one confirm dialog, so pages only render content.
 */
export default function PartnersLayout() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = pick(translations, lang)
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const route = partnerRoute({ isLoading, isAuthenticated, user })
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

  const signOut = async () => {
    try {
      await authClient.signOut()
    } finally {
      navigate('/partners', { replace: true })
    }
  }

  return (
    <PartnerLangContext.Provider value={langValue}>
      <PartnerConfirmContext.Provider value={partnerConfirm}>
        <div className="partners" dir={isRtl ? 'rtl' : 'ltr'} lang={lang}>
          <header className="p-header">
            <a className="p-brand" href="/partners">
              {/* The brand is always "Hasio" in Latin script, in both languages. */}
              <span className="p-wordmark" lang="en" dir="ltr">Hasio</span>
              <span className="p-brand-sub">{t.portal}</span>
            </a>
            <div className="p-header-actions">
              <button type="button" className="p-btn p-btn-ghost p-btn-sm" onClick={toggleLang} aria-label={t.toggleLabel}>
                <Icon name="globe" size={18} />
                <span lang={isRtl ? 'en' : 'ar'}>{t.toggle}</span>
              </button>
              {isAuthenticated && (
                <button type="button" className="p-btn p-btn-ghost p-btn-sm" onClick={signOut}>
                  <Icon name="logout" size={18} />
                  <span>{t.signOut}</span>
                </button>
              )}
            </div>
          </header>

          <div className={items.length ? 'p-body has-nav' : 'p-body'}>
            {items.length > 0 && (
              <nav className="p-nav" aria-label={t.nav}>
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? 'p-nav-link is-active' : 'p-nav-link')}
                  >
                    <Icon name={item.icon} size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            )}
            <main className="p-main">
              {/* Pages are lazy chunks; loading one keeps the shell on screen. */}
              <Suspense fallback={<PageSpinner />}>
                <Outlet />
              </Suspense>
            </main>
          </div>

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
