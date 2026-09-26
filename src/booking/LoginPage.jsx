import { useLanguage } from '../hooks/useLanguage'
import PageShell from './PageShell'

// Placeholder: plan task C replaces this with the traveller sign-in (/login).
export default function LoginPage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl}>
      <p className="bk-muted">{lang === 'ar' ? 'قريبًا' : 'Coming soon'}</p>
    </PageShell>
  )
}
