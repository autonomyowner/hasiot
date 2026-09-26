import { useLanguage } from '../hooks/useLanguage'
import PageShell from '../booking/PageShell'

// Placeholder: plan task D replaces this with My trips.
export default function TripsPage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl} current="trips">
      <p className="bk-muted">{lang === 'ar' ? 'قريبًا' : 'Coming soon'}</p>
    </PageShell>
  )
}
