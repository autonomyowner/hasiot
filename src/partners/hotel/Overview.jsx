import { Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { Icon, Kpi, SkeletonKpis } from '../components/Ui'
import BookingPreview from '../components/BookingPreview'
import { dayPart, formatMoney } from '../lib/bookingText'
import { cityLabel } from './cities'
import { kindOfType, ownerStatusOf } from './placePayload'

const translations = {
  en: {
    title: 'Overview',
    greet: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    subtitle: 'Your places and bookings at a glance.',
    pending: 'Requests waiting',
    upcoming: 'Upcoming stays',
    revenue: 'Revenue this month',
    places: 'Places',
    placesTitle: 'Your places',
    status: { approved: 'Live', pending: 'In review', rejected: 'Not approved', suspended: 'Suspended' },
    perNight: '/ night',
    notBookable: 'No nightly price — not bookable',
    manage: 'Manage places',
    add: 'Add a place',
    none: 'You have not posted a place yet. Add your hotel and our team reviews it before it goes live.',
  },
  ar: {
    title: 'نظرة عامة',
    greet: { morning: 'صباح الخير', afternoon: 'مساء الخير', evening: 'مساء الخير' },
    subtitle: 'أماكنك وحجوزاتك في لمحة.',
    pending: 'طلبات بانتظارك',
    upcoming: 'إقامات قادمة',
    revenue: 'إيرادات هذا الشهر',
    places: 'الأماكن',
    placesTitle: 'أماكنك',
    status: { approved: 'منشور', pending: 'قيد المراجعة', rejected: 'مرفوض', suspended: 'موقوف' },
    perNight: '/ الليلة',
    notBookable: 'بلا سعر لليلة — غير قابل للحجز',
    manage: 'إدارة الأماكن',
    add: 'أضف مكانًا',
    none: 'لم تنشر أي مكان بعد. أضف فندقك وسيراجعه فريقنا قبل نشره.',
  },
}

/**
 * The host's home: the headline numbers (getOwnerStats), what needs an answer
 * and what is coming up (getBusinessBookings, the same rows the inbox shows),
 * then each place with its photo, status and nightly price.
 */
export default function Overview() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard, user } = usePartnerGate('hotel')
  const skip = guard ? 'skip' : {}
  const stats = useQuery(api.bookings.queries.getOwnerStats, skip)
  const listings = useQuery(api.listings.queries.getMyListings, skip)
  const bookings = useQuery(api.bookings.queries.getBusinessBookings, skip)
  if (guard) return guard

  const comma = lang === 'ar' ? '، ' : ', '
  const hello = t.greet[dayPart(new Date().getHours())] + (user?.firstName ? comma + user.firstName : '')
  const heading = (
    <div>
      <p className="p-greet">{hello}</p>
      <h1 className="p-title">{t.title}</h1>
      <p className="p-subtitle">{t.subtitle}</p>
    </div>
  )

  if (stats === undefined || listings === undefined) {
    return (
      <div>
        {heading}
        <SkeletonKpis />
      </div>
    )
  }

  const number = (n) => new Intl.NumberFormat(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US').format(n ?? 0)
  const currency = stats?.currency === 'SAR' || !stats?.currency ? (lang === 'ar' ? 'ر.س' : 'SAR') : stats.currency

  return (
    <div>
      {heading}

      <div className="h-stats p-kpis">
        <Kpi index={0} className="h-stat" label={t.pending} icon={<Icon name="clock" size={15} />} value={number(stats?.pending)} />
        <Kpi index={1} className="h-stat" label={t.upcoming} icon={<Icon name="calendar" size={15} />} value={number(stats?.upcoming)} />
        <Kpi index={2} className="h-stat" label={t.revenue} icon={<Icon name="wallet" size={15} />}
          value={<>{number(stats?.revenueMonth)} <span className="p-kpi-unit">{currency}</span></>} />
        <Kpi index={3} className="h-stat" label={t.places} icon={<Icon name="building" size={15} />} value={number(stats?.listings ?? listings.length)} />
      </div>

      <BookingPreview bookings={bookings} kind="stay" path="/partners/hotel/bookings" />

      <section className="p-card p-items" aria-labelledby="overview-places">
        <div className="p-items-head">
          <h2 id="overview-places" className="p-h2" style={{ margin: 0 }}>{t.placesTitle}</h2>
          <div className="p-row">
            <Link className="p-btn p-btn-outline p-btn-sm" to="/partners/hotel/places">{t.manage}</Link>
            <Link className="p-btn p-btn-primary p-btn-sm" to="/partners/hotel/places/new">
              <Icon name="building" size={16} /> {t.add}
            </Link>
          </div>
        </div>
        {listings.length === 0 ? (
          <p className="p-muted" style={{ margin: 0 }}>{t.none}</p>
        ) : (
          <ul className="p-items-list">
            {listings.map((l) => {
              const status = ownerStatusOf(l.status)
              const name = lang === 'ar' ? l.name_ar || l.name_en : l.name_en || l.name_ar
              const isStay = l.type === 'hotel'
              const to = kindOfType(l.type) !== null ? `/partners/hotel/places/${l._id}` : '/partners/hotel/places'
              return (
                <li key={l._id}>
                  <Link className="p-item" to={to}>
                    <span className="p-item-photo">
                      {l.images?.[0] ? <img src={l.images[0]} alt="" loading="lazy" /> : <Icon name="building" size={22} />}
                    </span>
                    <span className="p-item-body">
                      <span className="p-item-name">{name || '—'}</span>
                      <span className="p-item-meta">
                        <span className={`p-badge h-badge-${status}`}>{t.status[status] ?? t.status.pending}</span>
                        <span>{cityLabel(l.city, lang)}</span>
                      </span>
                      {isStay && (
                        <span className="p-item-meta">
                          {typeof l.pricePerNight === 'number' ? (
                            <span><span className="p-price">{formatMoney(l.pricePerNight, l.currency, lang)}</span> {t.perNight}</span>
                          ) : (
                            <span>{t.notBookable}</span>
                          )}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
