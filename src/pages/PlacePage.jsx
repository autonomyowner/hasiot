import { useLanguage } from '../hooks/useLanguage'
import PageShell from '../booking/PageShell'

// Placeholder: plan task A replaces this with the place page and its booking section.
export default function PlacePage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl}>
      <p className="bk-muted">{lang === 'ar' ? 'قريبًا' : 'Coming soon'}</p>
    </PageShell>
  )
}
