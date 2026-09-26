import { useLayoutEffect, useState } from 'react'
import { Link, useNavigationType, useParams } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import PageShell from '../booking/PageShell'
import { usePageMeta } from '../booking/usePageMeta'
import Gallery from '../booking/place/Gallery'
import Reviews, { RatingLine } from '../booking/place/Reviews'
import ContactActions from '../booking/place/ContactActions'
import { riyadhToday } from '../booking/dates'
import { formatSAR } from '../booking/money'
import { useConvexQuery } from '../lib/convexHttp'
import StayBooking from './place/StayBooking'
import {
  amenityLabels,
  categoryLabel,
  cityText,
  isBookableHotel,
  localized,
  openingHours,
  stayTimes,
  typeLabel,
} from './place/placeInfo'
import './place/place.css'

// /places/:id — one place: photos, what it is, how to reach it, reviews, and
// for a priced hotel the booking section (design W3: public, so the backend is
// read with a plain fetch and nothing from convex/ or Better Auth is imported;
// docs/superpowers/specs/2026-09-26-web-booking-design.md).

const translations = {
  en: {
    explore: 'Explore',
    loading: 'Loading this place…',
    notFound: "This place isn't available.",
    backToExplore: 'Back to Explore',
    failed: "We couldn't load this place.",
    retry: 'Try again',
    place: 'Place',
    perNight: '/ night',
    about: 'About',
    noAbout: 'No description has been added for this place yet.',
    amenities: 'Amenities',
    hours: 'Opening hours',
    closed: 'Closed',
    today: 'Today',
    reviews: 'Reviews',
    reviewsFailed: "We couldn't load the reviews.",
  },
  ar: {
    explore: 'استكشف',
    loading: 'جارٍ تحميل هذا المكان…',
    notFound: 'هذا المكان غير متاح.',
    backToExplore: 'العودة إلى الاستكشاف',
    failed: 'تعذّر تحميل هذا المكان.',
    retry: 'حاول مجددًا',
    place: 'مكان',
    perNight: '/ الليلة',
    about: 'نبذة',
    noAbout: 'لم تُضف نبذة عن هذا المكان بعد.',
    amenities: 'المرافق',
    hours: 'أوقات العمل',
    closed: 'مغلق',
    today: 'اليوم',
    reviews: 'التقييمات',
    reviewsFailed: 'تعذّر تحميل التقييمات.',
  },
}

const icon = (children, strokeWidth = 1.8) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
// Points back in reading order; booking.css mirrors it in RTL.
const BackIcon = () => icon(<path d="M19 12H5M11 6l-6 6 6 6" />, 2)
const PinIcon = () => icon(<><path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></>)
const CheckIcon = () => icon(<path d="m5 12.5 4.5 4.5L19 7.5" />, 2)
const ClockIcon = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)

/** Shaped like the page it stands in for, so nothing jumps when it arrives. */
function PlaceSkeleton({ label }) {
  return (
    <div className="bk-layout pl-layout" aria-busy="true">
      <p className="bk-sr" role="status">{label}</p>
      <div className="pl-main" aria-hidden="true">
        <div className="bk-skel pl-skel-gallery" />
        <div className="bk-skel pl-skel-title" />
        <div className="bk-skel pl-skel-line is-short" />
        <div className="bk-skel pl-skel-line" />
        <div className="bk-skel pl-skel-line" />
        <div className="bk-skel pl-skel-line is-short" />
      </div>
      <div className="pl-aside" aria-hidden="true">
        <div className="bk-skel pl-skel-card" />
      </div>
    </div>
  )
}

function Message({ title, children }) {
  return (
    <div className="pl-state">
      <h1 className="bk-h1">{title}</h1>
      {children}
    </div>
  )
}

function ReviewsBlock({ summaryQ, reviewsQ, isHotel, lang, t }) {
  const failed = Boolean(summaryQ.error || reviewsQ.error)
  if (failed) {
    const retry = () => {
      summaryQ.reload()
      reviewsQ.reload()
    }
    return (
      <section aria-labelledby="pl-reviews-title">
        <h2 id="pl-reviews-title" className="bk-h2">{t.reviews}</h2>
        <p className="pl-reviews-note bk-muted">
          {t.reviewsFailed} <button type="button" className="bk-link" onClick={retry}>{t.retry}</button>
        </p>
      </section>
    )
  }
  if (summaryQ.loading || reviewsQ.loading) {
    return (
      <section aria-labelledby="pl-reviews-title" aria-busy="true">
        <h2 id="pl-reviews-title" className="bk-h2">{t.reviews}</h2>
        <div aria-hidden="true">
          <div className="bk-skel pl-skel-line is-short" />
          <div className="bk-skel pl-skel-line" />
          <div className="bk-skel pl-skel-line" />
        </div>
      </section>
    )
  }
  // `kind` only picks the verified label. Any completed booking at a place
  // verifies a review (convex/reviews/service.ts isVerifiedStay), and at a
  // restaurant or an event that was a table or a ticket, not a stay: those
  // read "Verified booking".
  return <Reviews summary={summaryQ.data} reviews={reviewsQ.data} lang={lang} kind={isHotel ? 'stay' : 'service'} />
}

function Place({ listing, summaryQ, reviewsQ, bookable, lang, t }) {
  const name = localized(listing, 'name', lang) ?? { text: t.place, lang }
  const about = localized(listing, 'description', lang)
  const type = typeLabel(listing.type, lang)
  const category = categoryLabel(listing, lang)
  const city = cityText(listing.city, lang)
  const address = typeof listing.address === 'string' ? listing.address.trim() : ''
  const amenities = amenityLabels(listing.amenities, lang)
  const isHotel = listing.type === 'hotel'
  // Hotels are open all day; what a guest needs is when rooms are ready.
  const hours = isHotel ? [] : openingHours(listing.workingHours, lang, riyadhToday())
  const times = isHotel ? stayTimes(listing.checkInTime, listing.checkOutTime, lang) : null
  const rated = summaryQ.data?.count > 0

  const main = (
    <div className="pl-main">
      <Gallery images={listing.images} name={name.text} lang={lang} />

      <header className="pl-head">
        {(type || category) && (
          <p className="pl-kicker">
            {type && <span className="pl-tag">{type}</span>}
            {category && category !== type && <span>{category}</span>}
          </p>
        )}
        {/* <bdi>: a name in the other language keeps its own order without
            pulling the heading's alignment with it. */}
        <h1 className="bk-h1 pl-title"><bdi lang={name.lang}>{name.text}</bdi></h1>
        {(city || address || rated) && (
          <div className="pl-meta">
            {(city || address) && (
              <span className="pl-where">
                <PinIcon />
                <span>
                  {city}
                  {city && address && ' · '}
                  {address && <bdi>{address}</bdi>}
                </span>
              </span>
            )}
            <RatingLine summary={summaryQ.data} lang={lang} />
          </div>
        )}
        {bookable && (
          <p className="pl-price"><b>{formatSAR(listing.pricePerNight, lang)}</b> <span>{t.perNight}</span></p>
        )}
        <ContactActions
          phone={listing.phone}
          email={listing.email}
          website={listing.website}
          coordinates={listing.coordinates}
          address={listing.address}
          lang={lang}
        />
      </header>

      <section className="bk-section" aria-labelledby="pl-about-title">
        <h2 id="pl-about-title" className="bk-h2">{t.about}</h2>
        {about ? (
          <p className="pl-about" lang={about.lang} dir="auto">{about.text}</p>
        ) : (
          <p className="pl-about bk-muted">{t.noAbout}</p>
        )}
        {times && <p className="pl-times"><ClockIcon /><span>{times}</span></p>}
      </section>

      {amenities.length > 0 && (
        <section className="bk-section" aria-labelledby="pl-amenities-title">
          <h2 id="pl-amenities-title" className="bk-h2">{t.amenities}</h2>
          <ul className="pl-amenities">
            {amenities.map((label) => (
              <li key={label} className="pl-amenity"><CheckIcon /><span dir="auto">{label}</span></li>
            ))}
          </ul>
        </section>
      )}

      {hours.length > 0 && (
        <section className="bk-section" aria-labelledby="pl-hours-title">
          <h2 id="pl-hours-title" className="bk-h2">{t.hours}</h2>
          <table className="pl-hours">
            <tbody>
              {hours.map((row) => (
                <tr key={row.key} className={row.isToday ? 'is-today' : undefined}>
                  <th scope="row">
                    {row.day}
                    {row.isToday && <span className="pl-today">{t.today}</span>}
                  </th>
                  <td>{row.hours ? <span dir="ltr">{row.hours}</span> : t.closed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )

  const rest = (
    <div className="bk-section pl-rest">
      <ReviewsBlock summaryQ={summaryQ} reviewsQ={reviewsQ} isHotel={isHotel} lang={lang} t={t} />
    </div>
  )

  if (!bookable) {
    return (
      <>
        {main}
        {rest}
      </>
    )
  }
  return (
    <div className="bk-layout pl-layout">
      {main}
      <StayBooking key={listing._id} listing={listing} lang={lang} />
      {rest}
    </div>
  )
}

export default function PlacePage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const { id } = useParams()

  // Three independent reads, sent together. A malformed or foreign id comes
  // back as a validation error: to a visitor that is "not found" (W24).
  const listingQ = useConvexQuery('listings/queries:getListing', { listingId: id })
  const summaryQ = useConvexQuery('reviews/queries:getSummary', { listingId: id })
  const reviewsQ = useConvexQuery('reviews/queries:listForListing', { listingId: id, limit: 6 })

  const listing = listingQ.data
  const notFound = !listingQ.loading && (listing === null || listingQ.error?.validation === true)
  const failed = !listingQ.loading && !notFound && Boolean(listingQ.error)
  const shown = !listingQ.loading && !notFound && !failed && listing ? listing : null
  const waiting = !shown && !notFound && !failed
  const bookable = shown !== null && isBookableHotel(shown)

  const name = shown ? localized(shown, 'name', lang) : null
  const message = notFound ? t.notFound : failed ? t.failed : null
  usePageMeta({ title: name?.text ?? message?.replace(/\.$/, '') })

  // The router keeps the previous page's scroll offset, so a place opened from
  // far down /explore would open part-way down its own page. Back and forward
  // (POP) are left to the browser. Before paint, so the jump is never seen.
  const navigationType = useNavigationType()
  const [arrival] = useState(navigationType)
  useLayoutEffect(() => {
    if (arrival !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' })
  }, [id, arrival])

  const retry = () => {
    listingQ.reload()
    summaryQ.reload()
    reviewsQ.reload()
  }

  let content
  if (waiting) {
    content = <PlaceSkeleton label={t.loading} />
  } else if (notFound) {
    content = (
      <Message title={t.notFound}>
        <Link className="bk-btn bk-btn-primary" to="/explore">{t.backToExplore}</Link>
      </Message>
    )
  } else if (failed) {
    content = (
      <Message title={t.failed}>
        <button type="button" className="bk-btn bk-btn-primary" onClick={retry}>{t.retry}</button>
      </Message>
    )
  } else {
    content = <Place listing={shown} summaryQ={summaryQ} reviewsQ={reviewsQ} bookable={bookable} lang={lang} t={t} />
  }

  // A bookable hotel gets two columns (content and the booking card); anything
  // else reads better as one narrower column. The skeleton assumes a hotel:
  // most visits arrive from a hotel card.
  const wide = waiting || bookable

  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl} withBar={bookable}>
      <div className={wide ? undefined : 'pl-solo'}>
        <Link className="bk-back" to="/explore"><BackIcon />{t.explore}</Link>
        {content}
      </div>
    </PageShell>
  )
}
