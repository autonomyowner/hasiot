import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { EmptyState } from '../components/Ui'

const translations = {
  en: {
    hotel: 'Hotel dashboard',
    services: 'Provider dashboard',
    soon: 'Coming next',
    hint: 'Your places, services and bookings will appear here.',
  },
  ar: {
    hotel: 'لوحة الفندق',
    services: 'لوحة مقدم الخدمة',
    soon: 'قريبًا',
    hint: 'ستظهر هنا أماكنك وخدماتك وحجوزاتك.',
  },
}

/**
 * Stands in for a dashboard until Part 2 replaces it. Gated like the real
 * one, so a partner of the other role is redirected, never shown this.
 */
export default function Placeholder({ kind }) {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate(kind)
  if (guard) return guard
  return (
    <div>
      <h1 className="p-title">{t[kind]}</h1>
      <div className="p-card">
        <EmptyState title={t.soon} hint={t.hint} icon="home" />
      </div>
    </div>
  )
}
