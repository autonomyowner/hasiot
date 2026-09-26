import { useEffect } from 'react'
import { Link, useNavigationType, useParams } from 'react-router-dom'
import PageShell from '../booking/PageShell'
import { mailHref, telHref } from '../booking/links'
import { formatSAR, priceLine, unitLabel } from '../booking/money'
import ContactActions from '../booking/place/ContactActions'
import Gallery from '../booking/place/Gallery'
import Reviews, { RatingLine } from '../booking/place/Reviews'
import { maxPeople } from '../booking/serviceRules'
import { usePageMeta } from '../booking/usePageMeta'
import { useLanguage } from '../hooks/useLanguage'
import { useConvexQuery } from '../lib/convexHttp'
import { cityName, serviceTitle, serviceTypeLabel } from '../partners/services/labels'
import ServiceBooking from './service/ServiceBooking'
import { groupSizeText, languagesText, memberSinceYear, pickText, providerName } from './service/serviceText'
import './service/service.css'

// /services/:id — one guide, driver, photographer… for a traveller deciding
// whether to book it. Public and anonymous like /explore: the service, its
// rating and its reviews come over plain fetch (src/lib/convexHttp.js), and
// nothing here may import the Convex client, Better Auth or any file under
// convex/ (contract §5) — the checkout loads those once a booking starts.
// A priced service from an approved provider gets the booking section; any
// other gets Contact instead (services design D16).

const translations = {
  en: {
    back: 'Back to Explore',
    loading: 'Loading…',
    unavailableTitle: 'Service not available',
    unavailable: "This service isn't available right now.",
    unavailableBody: 'The provider may have paused it, or the link may be incomplete.',
    failed: "We couldn't load this service.",
    failedBody: 'Check your connection and try again.',
    retry: 'Try again',
    offeredBy: 'Offered by',
    memberSince: (year) => `Member since ${year}`,
    languages: (list) => `Languages: ${list}`,
    about: 'About',
    contact: 'Contact',
    callProvider: 'Call provider',
    contactNote: 'The price and the time are arranged with the provider directly.',
    summary: 'Booking summary',
  },
  ar: {
    back: 'العودة إلى الاستكشاف',
    loading: 'جارٍ التحميل…',
    unavailableTitle: 'الخدمة غير متاحة',
    unavailable: 'هذه الخدمة غير متاحة حاليًا.',
    unavailableBody: 'ربما أوقفها مقدم الخدمة مؤقتًا، أو أن الرابط غير مكتمل.',
    failed: 'تعذّر تحميل هذه الخدمة.',
    failedBody: 'تحقّق من اتصالك وحاول مجددًا.',
    retry: 'حاول مجددًا',
    offeredBy: 'يقدّمها',
    memberSince: (year) => `عضو منذ ${year}`,
    languages: (list) => `اللغات: ${list}`,
    about: 'نبذة',
    contact: 'تواصل',
    callProvider: 'اتصل بمقدم الخدمة',
    contactNote: 'يُتفق على السعر والموعد مع مقدم الخدمة مباشرة.',
    summary: 'ملخص الحجز',
  },
}

const icon = (children) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
// Drawn pointing back in a left-to-right page; booking.css mirrors it in RTL.
const BackIcon = () => icon(<path d="M19 12H5M11 6l-6 6 6 6" />)
const PeopleIcon = () => icon(<><circle cx="9" cy="8" r="3.2" /><path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2" /><path d="M15.5 5.2a3 3 0 0 1 0 5.6M17.5 14.6c1.8.6 3 2.3 3.4 4.9" /></>)
const GlobeIcon = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>)
const ClockIcon = () => icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>)

export default function ServicePage() {
  const { id } = useParams()
  const navigationType = useNavigationType()
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = translations[lang === 'ar' ? 'ar' : 'en']

  const service = useConvexQuery('services/queries:getService', { serviceId: id })
  const rating = useConvexQuery('reviews/queries:getServiceSummary', { serviceId: id })
  const reviews = useConvexQuery('reviews/queries:listForService', { serviceId: id, limit: 6 })

  const data = service.data
  // `null` is a service travellers may not see (pending, suspended, its
  // provider suspended); a refused id is a link cut short or edited by hand.
  // Both read "not available", never the error screen (design W24).
  const notFound = data === null || service.error?.validation === true
  usePageMeta({ title: data ? serviceTitle(data, lang) : notFound ? t.unavailableTitle : undefined })

  // BrowserRouter keeps the scroll position across a link, so a card clicked
  // far down /explore would open this page part-way down. Back and Forward
  // (POP) keep the browser's own restoration; the page's own replace() of
  // its query string (REPLACE) must not jump either.
  useEffect(() => {
    if (navigationType === 'PUSH') window.scrollTo(0, 0)
  }, [id, navigationType])

  const retry = () => {
    service.reload()
    rating.reload()
    reviews.reload()
  }

  let body
  if (data) body = <ServiceDetails key={data._id} service={data} rating={rating.data} reviews={reviews} lang={lang} t={t} />
  else if (notFound) body = <Unavailable t={t} />
  else if (service.error) body = <LoadFailed t={t} onRetry={retry} />
  else body = <Loading t={t} />

  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl} withBar={Boolean(data?.bookable)}>
      {!notFound && (
        <Link className="bk-back" to="/explore">
          <BackIcon />
          {t.back}
        </Link>
      )}
      {body}
    </PageShell>
  )
}

function ServiceDetails({ service, rating, reviews, lang, t }) {
  const title = serviceTitle(service, lang)
  const city = cityName(service.city, lang)
  const name = providerName(service.provider)
  const since = memberSinceYear(service.provider?.memberSince)
  const about = pickText(service.description_en, service.description_ar, lang)
  const availability = pickText(service.availability_en, service.availability_ar, lang)
  const languages = languagesText(service.languages, lang)
  const hasPrice = typeof service.price === 'number' && service.price > 0
  // The same test ContactActions applies, asked first so an empty card is
  // never drawn: a service with neither shows its price line and no button.
  const contactable = Boolean(telHref(service.contactPhone) || mailHref(service.contactEmail))

  const intro = (
    <>
      <Gallery images={service.images} name={title} lang={lang} />
      <header className="sv-head">
        <div className="sv-kicker">
          <span className="sv-type">{serviceTypeLabel(service.serviceType, lang)}</span>
          {city && <span>{city}</span>}
          <RatingLine summary={rating} lang={lang} />
        </div>
        <h1 className="bk-h1">{title}</h1>
        {name && (
          <p className="sv-by">
            {t.offeredBy} <b><bdi>{name}</bdi></b>
            {since && <> · {t.memberSince(since)}</>}
          </p>
        )}
        <p className="sv-price">
          {hasPrice ? (
            <>
              <b>{formatSAR(service.price, lang)}</b> {unitLabel(service.priceUnit, lang)}
            </>
          ) : (
            priceLine(service.price, service.priceUnit, lang)
          )}
        </p>
        <ul className="sv-facts">
          <li>
            <PeopleIcon />
            <span>{groupSizeText(maxPeople(service), lang)}</span>
          </li>
          {languages && (
            <li>
              <GlobeIcon />
              <span>{t.languages(languages)}</span>
            </li>
          )}
          {availability && (
            <li>
              <ClockIcon />
              <span dir="auto">{availability}</span>
            </li>
          )}
        </ul>
      </header>
    </>
  )

  const aboutBlock = about ? (
    <section className="bk-section sv-about" aria-labelledby="sv-about-title">
      <h2 id="sv-about-title" className="bk-h2">{t.about}</h2>
      <p dir="auto">{about}</p>
    </section>
  ) : null

  // Reviews are extra: if they fail, the page goes on without them rather
  // than showing "No reviews yet" for reviews it could not read.
  const reviewsBlock = reviews.error ? null : (
    <div className="bk-section sv-reviews">
      {reviews.data === undefined ? (
        <div className="sv-skel-reviews" aria-hidden="true">
          <div className="bk-skel" />
          <div className="bk-skel" />
        </div>
      ) : (
        <Reviews summary={rating} reviews={reviews.data} lang={lang} kind="service" />
      )}
    </div>
  )

  if (service.bookable) {
    return (
      <ServiceBooking service={service} lang={lang}>
        {({ choices, summary, bar }) => (
          <>
            <div className="bk-layout sv-layout">
              <div className="sv-top">
                {intro}
                {aboutBlock}
                {choices}
              </div>
              <aside className="bk-sticky sv-side" aria-label={t.summary}>
                {summary}
              </aside>
              <div className="sv-bottom">{reviewsBlock}</div>
            </div>
            {bar}
          </>
        )}
      </ServiceBooking>
    )
  }

  // Not bookable: Contact takes the booking card's place, directly under the
  // header on a phone, which is why About moves below it here.
  return (
    <div className="bk-layout sv-layout">
      <div className="sv-top">{intro}</div>
      {contactable && (
        <aside className="bk-sticky sv-side" aria-labelledby="sv-contact-title">
          <div className="bk-card sv-contact">
            <h2 id="sv-contact-title" className="bk-h2">{t.contact}</h2>
            <ContactActions phone={service.contactPhone} email={service.contactEmail} lang={lang} callLabel={t.callProvider} />
            <p className="bk-note">{t.contactNote}</p>
          </div>
        </aside>
      )}
      <div className="sv-bottom">
        {aboutBlock}
        {reviewsBlock}
      </div>
    </div>
  )
}

function Unavailable({ t }) {
  return (
    <div className="sv-empty">
      <h1 className="bk-h1">{t.unavailable}</h1>
      <p className="bk-muted">{t.unavailableBody}</p>
      <Link className="bk-btn bk-btn-primary" to="/explore">{t.back}</Link>
    </div>
  )
}

function LoadFailed({ t, onRetry }) {
  return (
    <div className="sv-empty">
      <h1 className="bk-h1">{t.failed}</h1>
      <p className="bk-muted">{t.failedBody}</p>
      <button type="button" className="bk-btn bk-btn-primary" onClick={onRetry}>{t.retry}</button>
    </div>
  )
}

function Loading({ t }) {
  return (
    <div className="bk-layout sv-layout" aria-busy="true">
      <p className="bk-sr" role="status">{t.loading}</p>
      <div className="sv-top sv-skeleton" aria-hidden="true">
        <div className="bk-skel sv-skel-gallery" />
        <div className="bk-skel sv-skel-tag" />
        <div className="bk-skel sv-skel-title" />
        <div className="bk-skel sv-skel-line" />
      </div>
      <div className="sv-side sv-skel-side" aria-hidden="true">
        <div className="bk-skel sv-skel-card" />
      </div>
    </div>
  )
}
