import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useLanguage } from '../hooks/useLanguage'
import PageShell from '../booking/PageShell'
import { usePageMeta } from '../booking/usePageMeta'
import { useViewer } from '../booking/useViewer'
import { splitTrips } from '../booking/status'
import { bookingErrorText } from '../booking/errors'
import { authClient } from '../lib/auth-client'
import TripCard from './TripCard'
import { accountLabel, defaultTab, STORE_LINKS } from './tripDisplay'
import './trips.css'

const translations = {
  en: {
    title: 'My trips',
    loading: 'Loading your trips…',
    show: 'Show',
    upcoming: 'Upcoming',
    past: 'Past',
    emptyTitle: 'No bookings yet',
    emptyBody: 'Stays and services you book will appear here.',
    explore: 'Explore stays',
    noUpcomingTitle: 'No upcoming bookings',
    noUpcomingBody: 'Your earlier bookings are under Past.',
    noPastTitle: 'Nothing here yet',
    noPastBody: "Bookings appear here once they're over.",
    account: 'Your account',
    signedInAs: 'Signed in as',
    signedIn: 'Signed in',
    signOut: 'Sign out',
    deleteAccount: 'Delete account',
    alsoInApp: 'Also in the app',
    suspended: ['Your account is suspended. Contact ', '.'],
  },
  ar: {
    title: 'رحلاتي',
    loading: 'جارٍ تحميل رحلاتك…',
    show: 'عرض',
    upcoming: 'القادمة',
    past: 'السابقة',
    emptyTitle: 'لا توجد حجوزات بعد',
    emptyBody: 'ستظهر هنا الإقامات والخدمات التي تحجزها.',
    explore: 'استكشف الإقامات',
    noUpcomingTitle: 'لا توجد حجوزات قادمة',
    noUpcomingBody: 'حجوزاتك السابقة في تبويب السابقة.',
    noPastTitle: 'لا شيء هنا بعد',
    noPastBody: 'تظهر الحجوزات هنا بعد انتهائها.',
    account: 'حسابك',
    signedInAs: 'مسجّل باسم',
    signedIn: 'مسجّل الدخول',
    signOut: 'تسجيل الخروج',
    deleteAccount: 'حذف الحساب',
    alsoInApp: 'متوفر أيضًا في التطبيق',
    suspended: ['حسابك موقوف. تواصل مع ', '.'],
  },
}

const SUPPORT_EMAIL = 'support@hasio.xyz'

/**
 * The clock, moved on once a minute: what is upcoming and what a chip says
 * (a request past its deadline reads Expired) turn on it, and reading
 * Date.now() during render would make the page impure.
 */
function useMinuteClock() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

const SuitcaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
  </svg>
)

function Empty({ title, body, children }) {
  return (
    <div className="tr-empty">
      <SuitcaseIcon />
      <h2>{title}</h2>
      <p>{body}</p>
      {children}
    </div>
  )
}

function ListSkeleton({ label }) {
  return (
    <div aria-busy="true">
      <span className="bk-sr" role="status">{label}</span>
      <div className="bk-skel tr-skel-tabs" />
      <div className="tr-list">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bk-skel tr-skel-card" />
        ))}
      </div>
    </div>
  )
}

function Trips({ split, tab, onTab, lang, now, t }) {
  if (split.upcoming.length + split.past.length === 0) {
    return (
      <Empty title={t.emptyTitle} body={t.emptyBody}>
        <Link className="bk-btn bk-btn-primary" to="/explore">{t.explore}</Link>
      </Empty>
    )
  }
  // Until the traveller picks a tab, the default follows the data: Upcoming,
  // unless nothing is ahead and something is behind.
  const current = tab ?? defaultTab(split)
  const rows = current === 'past' ? split.past : split.upcoming
  return (
    <>
      <div className="bk-chips tr-tabs" role="group" aria-label={t.show}>
        <button type="button" className="bk-chip" aria-pressed={current === 'upcoming'} onClick={() => onTab('upcoming')}>
          {t.upcoming}
        </button>
        <button type="button" className="bk-chip" aria-pressed={current === 'past'} onClick={() => onTab('past')}>
          {t.past}
        </button>
      </div>
      {rows.length === 0 ? (
        current === 'upcoming' ? (
          <Empty title={t.noUpcomingTitle} body={t.noUpcomingBody} />
        ) : (
          <Empty title={t.noPastTitle} body={t.noPastBody} />
        )
      ) : (
        <ul className="tr-list">
          {rows.map((booking) => (
            <li key={booking._id}>
              <TripCard booking={booking} lang={lang} now={now} />
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function StoreLinks({ label }) {
  // The app does everything this page does, and more; a quiet line, not a pitch.
  return (
    <p className="tr-apps">
      {label}:{' '}
      <a href={STORE_LINKS.appStore} target="_blank" rel="noopener noreferrer" lang="en">App Store</a>
      {' · '}
      <a href={STORE_LINKS.googlePlay} target="_blank" rel="noopener noreferrer" lang="en">Google Play</a>
    </p>
  )
}

function SignOutButton({ label, busy, onClick }) {
  return (
    <button type="button" className="bk-link" onClick={onClick} disabled={busy} aria-busy={busy || undefined}>
      {busy ? <span className="bk-spinner" aria-hidden="true" /> : null}
      {label}
    </button>
  )
}

/**
 * My trips: the traveller's stays, services and old reservations, split into
 * Upcoming and Past and updating live — a host's answer moves a chip without
 * a reload (design W15, plan task D).
 */
export default function TripsPage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const location = useLocation()
  const navigate = useNavigate()
  const viewer = useViewer()
  const now = useMinuteClock()
  const [tab, setTab] = useState(null)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(null)
  const signOutGuard = useRef(false)
  usePageMeta({ title: t.title })

  const active = viewer.state === 'active'
  const rows = useQuery(api.bookings.queries.getUserBookings, active ? { includeServices: true } : 'skip')
  const split = useMemo(() => (rows ? splitTrips(rows, now) : null), [rows, now])

  const signOut = async () => {
    if (signOutGuard.current) return
    signOutGuard.current = true
    setSigningOut(true)
    setSignOutError(null)
    try {
      const result = await authClient.signOut()
      if (result?.error) throw result.error
      navigate('/', { replace: true })
    } catch (err) {
      signOutGuard.current = false
      setSigningOut(false)
      setSignOutError(bookingErrorText(err, lang))
    }
  }

  // Signing out flips the viewer to signed_out before navigate('/') lands;
  // without the check this page would send the person to /login instead.
  if (!signingOut && (viewer.state === 'signed_out' || viewer.state === 'no_account')) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  let body
  if (viewer.state === 'suspended') {
    body = (
      <div className="tr-state">
        <p>
          {t.suspended[0]}
          <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">{SUPPORT_EMAIL}</a>
          {t.suspended[1]}
        </p>
        <div className="tr-account-actions">
          <SignOutButton label={t.signOut} busy={signingOut} onClick={signOut} />
        </div>
        {signOutError ? <p className="bk-error" role="alert">{signOutError}</p> : null}
      </div>
    )
  } else if (!active || !split) {
    body = <ListSkeleton label={t.loading} />
  } else {
    const who = accountLabel(viewer.user)
    body = (
      <>
        <Trips split={split} tab={tab} onTab={setTab} lang={lang} now={now} t={t} />
        <section className="tr-account" aria-label={t.account}>
          <p>
            {who ? (
              <>
                {t.signedInAs}{' '}
                {/* A phone number or an address stays in one piece inside an Arabic line. */}
                <bdi dir={who.kind === 'name' ? undefined : 'ltr'}>
                  <b>{who.text}</b>
                </bdi>
              </>
            ) : (
              t.signedIn
            )}
          </p>
          <div className="tr-account-actions">
            <SignOutButton label={t.signOut} busy={signingOut} onClick={signOut} />
            {/* A plain link: account deletion is its own page (App Store 5.1.1(v)). */}
            <a className="bk-link" href="/delete-account">{t.deleteAccount}</a>
          </div>
          {signOutError ? <p className="bk-error" role="alert">{signOutError}</p> : null}
          <StoreLinks label={t.alsoInApp} />
        </section>
      </>
    )
  }

  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl} current="trips">
      <header className="tr-head">
        <h1 className="bk-h1">{t.title}</h1>
      </header>
      {body}
    </PageShell>
  )
}
