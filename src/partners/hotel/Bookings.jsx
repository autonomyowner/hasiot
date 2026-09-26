import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import BookingsInbox from '../components/BookingsInbox'

const translations = {
  en: { title: 'Bookings', subtitle: 'Requests for your stays. Confirm or decline each within 48 hours.' },
  ar: { title: 'الحجوزات', subtitle: 'طلبات الحجز في أماكنك. أكّد أو ارفض كل طلب خلال 48 ساعة.' },
}

/** The host inbox: getBusinessBookings in the shared inbox, as the app's business/bookings.tsx. */
export default function Bookings() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate('hotel')
  const bookings = useQuery(api.bookings.queries.getBusinessBookings, guard ? 'skip' : {})
  if (guard) return guard
  return (
    <div>
      <h1 className="p-title">{t.title}</h1>
      <p className="p-subtitle">{t.subtitle}</p>
      <BookingsInbox kind="stay" bookings={bookings} />
    </div>
  )
}
