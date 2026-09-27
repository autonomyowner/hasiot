import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import PageShell from './PageShell'
import { readAuthReturn } from './authReturn'
import { safeNext } from './params'
import { usePageMeta } from './usePageMeta'
import SignInPanel from './checkout/SignInPanel'
import SuspendedNotice from './checkout/SuspendedNotice'
import { loginReturnURL } from './checkout/returnUrl'
import { useSteadyViewer } from './checkout/useSteadyViewer'
import './checkout/checkout.css'

const translations = {
  en: {
    title: 'Sign in',
    lead: 'Book stays and local services, and follow your requests in My trips. The same account as the Hasio app.',
    loading: 'Loading…',
    partnerLead: 'Hotel or service provider?',
    partnerLink: 'Partner sign-in',
  },
  ar: {
    title: 'تسجيل الدخول',
    lead: 'احجز الإقامات والخدمات المحلية وتابع طلباتك في رحلاتي. نفس حسابك في تطبيق Hasio.',
    loading: 'جارٍ التحميل…',
    partnerLead: 'فندق أو مقدم خدمة؟',
    partnerLink: 'دخول الشركاء',
  },
}

/**
 * /login — the traveller's sign-in on its own page (design W16), for My trips
 * and anything else reached signed out. `?next=` is followed only when
 * safeNext accepts it (a path in My trips or the checkout), so the page can
 * never be used to bounce someone somewhere else.
 *
 * Google comes back here with `?next=` intact, and a sign-in whose state was
 * lost on the way lands here too (W20: `?error=` or `?state=state_not_found`).
 * Either is read once, said under the Google button, and removed from the
 * address bar. Partners are pointed to their own sign-in, which would
 * otherwise be a dead end for a hotel that found this page first.
 */
export default function LoginPage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  usePageMeta({ title: t.title })

  const [googleFailed] = useState(() => readAuthReturn(window.location.search).kind === 'failed')
  // Drop Google's answer from the address once read, so a reload or a copied
  // link does not repeat it. history.replaceState rather than navigate():
  // nothing on the page needs to re-render for it.
  useEffect(() => {
    const { kind, search } = readAuthReturn(window.location.search)
    if (kind === null) return
    const { pathname, hash } = window.location
    window.history.replaceState(window.history.state, '', `${pathname}${search}${hash}`)
  }, [])

  // Steady: returning to the tab refetches the session, which must not
  // unmount a half-finished sign-in (checkout/steady.js).
  const viewer = useSteadyViewer()
  if (viewer.state === 'active') return <Navigate to={next ?? '/trips'} replace />

  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl}>
      <div className="bk-narrow co-narrow">
        <h1 className="bk-h1">{t.title}</h1>
        <p className="co-lead">{t.lead}</p>
        {viewer.state === 'suspended' ? (
          <SuspendedNotice lang={lang} />
        ) : (
          <div className="bk-card">
            {viewer.state === 'loading' ? (
              <div className="co-skel" aria-busy="true" aria-label={t.loading}>
                <div className="bk-skel co-skel-block" />
                <div className="bk-skel co-skel-line is-short" />
                <div className="bk-skel co-skel-block" />
              </div>
            ) : (
              <SignInPanel
                returnTo={loginReturnURL(window.location.origin, next)}
                lang={lang}
                errorFromReturn={googleFailed}
              />
            )}
          </div>
        )}
        <p className="co-partner">
          {t.partnerLead} <Link className="bk-link" to="/partners">{t.partnerLink}</Link>
        </p>
      </div>
    </PageShell>
  )
}
