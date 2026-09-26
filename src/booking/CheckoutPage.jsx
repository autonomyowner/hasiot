import { useLanguage } from '../hooks/useLanguage'
import PageShell from './PageShell'

// Placeholder: plan task C replaces this with the checkout (`kind` is "stay" or "service").
export default function CheckoutPage({ kind }) {
  const { lang, toggleLang, isRtl } = useLanguage()
  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl}>
      <p className="bk-muted" data-kind={kind}>{lang === 'ar' ? 'قريبًا' : 'Coming soon'}</p>
    </PageShell>
  )
}
