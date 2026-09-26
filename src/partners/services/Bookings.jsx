import { useQuerySafe } from '../../admin/useQuerySafe'
import { api } from '../../../convex/_generated/api'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import BookingsInbox from '../components/BookingsInbox'

const translations = {
  en: {
    title: 'Bookings',
    subtitle: 'Confirm or decline each request within 48 hours, or before it starts.',
  },
  ar: {
    title: 'الحجوزات',
    subtitle: 'أكّد كل طلب أو ارفضه خلال 48 ساعة، أو قبل موعده إن كان أقرب.',
  },
}

/** The provider's inbox: the app's provider/bookings.tsx on the web. */
export default function Bookings() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate('services')
  // Called unconditionally (hooks), skipped until the gate lets the page through.
  const { data: bookings, error } = useQuerySafe(api.bookings.queries.getProviderBookings, guard ? 'skip' : {})
  if (guard) return guard

  return (
    <div>
      <h1 className="p-title">{t.title}</h1>
      <p className="p-subtitle">{t.subtitle}</p>
      <BookingsInbox bookings={bookings} kind="service" error={error} onRetry={() => window.location.reload()} />
    </div>
  )
}
