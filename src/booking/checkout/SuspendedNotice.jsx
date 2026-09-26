import { useSignOut } from './useSignOut'

const SUPPORT_EMAIL = 'support@hasio.xyz'

const translations = {
  en: { lead: 'Your account is suspended. Contact', signOut: 'Sign out' },
  ar: { lead: 'حسابك موقوف. تواصل مع', signOut: 'تسجيل الخروج' },
}

/**
 * What a suspended account sees instead of a sign-in or a checkout. The
 * server hides such an account from every signed-in query, so there is
 * nothing to book with; support is the way back, and signing out lets
 * someone else on this browser use their own account.
 */
export default function SuspendedNotice({ lang }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const { signOut, signingOut } = useSignOut()
  return (
    <div className="bk-card co-message">
      <p className="co-message-text">
        {t.lead}{' '}
        <a className="bk-link" href={`mailto:${SUPPORT_EMAIL}`}><bdi dir="ltr">{SUPPORT_EMAIL}</bdi></a>.
      </p>
      <button type="button" className="bk-btn bk-btn-ghost" onClick={() => void signOut()} disabled={signingOut} aria-busy={signingOut || undefined}>
        {signingOut && <span className="bk-spinner" aria-hidden="true" />}
        <span>{t.signOut}</span>
      </button>
    </div>
  )
}
