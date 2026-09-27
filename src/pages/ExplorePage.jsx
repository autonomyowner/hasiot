import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import { useListings } from '../hooks/useListings'
import { useServices } from '../hooks/useServices'
import { useHotelPages, useSentinel } from '../hooks/useHotelPages'
import { canonicalCity, CITIES, CITY_LABELS } from '../admin/constants'
import { formatSAR, priceLine, unitLabel } from '../booking/money'
import { cityName, serviceTitle, serviceTypeLabel } from '../partners/services/labels'
import { matchServices, serviceSearchText, sortServices } from './service/browse'
import '../App.css'
import './ExplorePage.css'

// /explore — every live hotel and place straight from the backend: a search
// hero, then the home page's two drifting rows. Searching or filtering swaps
// the rows for a still grid, because nobody can read results that move.
// Every card opens its place's page (/places/:id), where a priced hotel can be
// booked (docs/superpowers/specs/2026-09-26-web-booking-design.md). Services
// (/services/:id) have a chip of their own once one is live, and join a
// search under "All"; the rows and the hotel list stay places only.

const copy = {
  en: {
    home: 'Home', explore: 'Explore', app: 'The app', contact: 'Contact', switch: 'العربية', getApp: 'Get the app', trips: 'My trips',
    kicker: 'EXPLORE THE KINGDOM', title: ['Timeless places', 'waiting for you.'],
    body: 'Hotels, heritage, tables and events — live from Hasio. Find a stay and book it right here.',
    placeholder: 'Search a hotel, a place, a city…', search: 'Search', allCities: 'All cities', city: 'City',
    types: [['all', 'All'], ['hotel', 'Stays'], ['attraction', 'Places'], ['restaurant', 'Food'], ['event', 'Events']],
    services: 'Services',
    book: 'Book', view: 'View', night: '/ night', sar: 'SAR',
    results: (n) => (n === 1 ? '1 result' : `${n} results`),
    none: 'Nothing matches that yet.', noneBody: 'Try another word, or clear the filters.', clear: 'Clear filters',
    failed: 'We couldn’t load places right now.', retry: 'Try again',
    rows: 'Places on Hasio',
    stays: (n) => `${n} ${n === 1 ? 'stay' : 'stays'}`, places: (n) => `${n} ${n === 1 ? 'place' : 'places'}`,
    allKicker: 'EVERY STAY', allTitle: 'All hotels', allBody: 'Browse every hotel on Hasio. More load as you scroll.',
    loadMore: 'Load more', end: 'You’ve seen every hotel.', loadFailed: 'Couldn’t load more hotels.',
  },
  ar: {
    home: 'الرئيسية', explore: 'استكشف', app: 'التطبيق', contact: 'تواصل معنا', switch: 'English', getApp: 'حمّل التطبيق', trips: 'رحلاتي',
    kicker: 'استكشف المملكة', title: ['أماكن خالدة', 'بانتظارك.'],
    body: 'فنادق وتراث وموائد وفعاليات — مباشرة من Hasio. اعثر على إقامتك واحجزها هنا مباشرة.',
    placeholder: 'ابحث عن فندق أو مكان أو مدينة…', search: 'بحث', allCities: 'كل المدن', city: 'المدينة',
    types: [['all', 'الكل'], ['hotel', 'الإقامة'], ['attraction', 'الأماكن'], ['restaurant', 'المطاعم'], ['event', 'الفعاليات']],
    services: 'الخدمات',
    book: 'احجز', view: 'عرض', night: '/ الليلة', sar: 'ر.س',
    results: (n) => (n === 1 ? 'نتيجة واحدة' : n === 2 ? 'نتيجتان' : n <= 10 ? `${n} نتائج` : `${n} نتيجة`),
    none: 'لا توجد نتائج مطابقة.', noneBody: 'جرّب كلمة أخرى أو امسح عوامل التصفية.', clear: 'مسح التصفية',
    failed: 'تعذّر تحميل الأماكن الآن.', retry: 'حاول مجدداً',
    rows: 'أماكن على Hasio',
    stays: (n) => `${n} ${n >= 3 && n <= 10 ? 'فنادق' : 'فندقاً'}`, places: (n) => `${n} ${n >= 3 && n <= 10 ? 'أماكن' : 'مكاناً'}`,
    allKicker: 'كل الإقامات', allTitle: 'جميع الفنادق', allBody: 'تصفّح كل الفنادق على Hasio. يظهر المزيد كلما نزلت.',
    loadMore: 'عرض المزيد', end: 'شاهدت كل الفنادق.', loadFailed: 'تعذّر تحميل المزيد من الفنادق.',
  },
}

// Events and tours share one chip: both are "something happening", and tours
// alone are too few to earn their own.
const matchesType = (l, type) => type === 'all' || l.type === type || (type === 'event' && l.type === 'tour')

// Arabic spelling folds (hamza forms, taa marbuta, alef maqsura, tashkeel) so
// "الاحساء" finds "الأحساء" — the same rules the app's search uses.
const fold = (s) => (s || '')
  .toLowerCase()
  .replace(/[ً-ْـ]/g, '')
  .replace(/[أإآ]/g, 'ا')
  .replace(/ة/g, 'ه')
  .replace(/ى/g, 'ي')
  .trim()

const haystack = (l) => {
  const city = canonicalCity(l.city)
  return fold([l.name_en, l.name_ar, city, CITY_LABELS[city], l.category, l.category_ar, l.address].join(' '))
}

const Arrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </svg>
)
const SearchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" />
  </svg>
)
const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" />
  </svg>
)
const Star = () => <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" /></svg>

// The whole card is the link to the place's page; "Book" / "View" is its
// label, not a second link inside it.
function ListingCard({ l, lang, hidden = false }) {
  const t = copy[lang]
  const city = canonicalCity(l.city)
  const name = lang === 'ar' ? l.name_ar || l.name_en : l.name_en
  const priced = l.type === 'hotel' && typeof l.pricePerNight === 'number' && l.pricePerNight > 0
  const typeLabel = (t.types.find(([k]) => matchesType(l, k) && k !== 'all') || [])[1]
  const price = priced ? Math.round(l.pricePerNight).toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US') : null
  return (
    <Link className="place-card hotel-card ex-card is-link" to={`/places/${l._id}`} aria-hidden={hidden || undefined} tabIndex={hidden ? -1 : undefined}>
      {l.images?.[0] && <img src={l.images[0]} alt={hidden ? '' : name} loading="lazy" decoding="async" width="500" height="625" />}
      <div className="place-shade" />
      <div className="ex-tags">
        {typeLabel && <span>{typeLabel}</span>}
        {l.rating > 0 && <span className="ex-rating"><Star />{l.rating.toFixed(1)}</span>}
      </div>
      <div className="place-body">
        <span className="hotel-city">{lang === 'ar' ? CITY_LABELS[city] || city : city}</span>
        <h3>{name}</h3>
        <div className="hotel-foot">
          {priced ? (
            <p className="hotel-price">
              {lang === 'ar' ? <><b>{price}</b> {t.sar}</> : <>{t.sar} <b>{price}</b></>} <small>{t.night}</small>
            </p>
          ) : <span />}
          <span className="hotel-book">{priced ? t.book : t.view}</span>
        </div>
      </div>
    </Link>
  )
}

const PersonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="3.6" /><path d="M4.5 20c.9-4 3.8-6.2 7.5-6.2s6.6 2.2 7.5 6.2" />
  </svg>
)

// A service in the same frame as a place: its photo, or the card's sand with
// a quiet glyph when the provider added none; its kind, city, title and
// price. The whole card opens /services/:id — "Book" when it can be booked
// there, "View" when it offers Contact instead.
function ServiceCard({ s, lang }) {
  const t = copy[lang]
  const title = serviceTitle(s, lang)
  const city = cityName(s.city, lang)
  const priced = typeof s.price === 'number' && s.price > 0
  return (
    <Link className="place-card hotel-card ex-card is-link ex-svc" to={`/services/${s._id}`}>
      {s.images?.[0]
        ? <img src={s.images[0]} alt={title} loading="lazy" decoding="async" width="500" height="625" />
        : <span className="ex-svc-blank" aria-hidden="true"><PersonIcon /></span>}
      <div className="place-shade" />
      <div className="ex-tags">
        <span>{serviceTypeLabel(s.serviceType, lang)}</span>
        {s.rating > 0 && <span className="ex-rating"><Star />{s.rating.toFixed(1)}</span>}
      </div>
      <div className="place-body">
        {city && <span className="hotel-city">{city}</span>}
        <h3>{title}</h3>
        <div className="hotel-foot">
          <p className="hotel-price">
            {priced
              ? <><b>{formatSAR(s.price, lang)}</b> <small>{unitLabel(s.priceUnit, lang)}</small></>
              : <small>{priceLine(s.price, s.priceUnit, lang)}</small>}
          </p>
          <span className="hotel-book">{s.bookable ? t.book : t.view}</span>
        </div>
      </div>
    </Link>
  )
}

// The home page's marquee (see HotelMarquee in App.jsx and its CSS): each row
// is one padded half rendered twice and moved -50%, so the loop is seamless.
const MIN_HALF = 10

function Marquee({ items, lang, label }) {
  const rows = [items.filter((_, i) => i % 2 === 0), items.filter((_, i) => i % 2 === 1)]
    .map((row) => (row.length ? row : items))
  return (
    <div className="marquee ex-marquee" role="region" aria-label={label}>
      {rows.map((row, r) => {
        const half = []
        while (half.length < MIN_HALF) half.push(...row)
        return (
          <div className="marquee-row" key={r}>
            <div className={`marquee-track ${r ? 'is-reverse' : ''}`} style={{ '--dur': `${half.length * 6}s` }}>
              {[0, 1].map((c) => half.map((l, i) => (
                <ListingCard key={`${c}-${i}`} l={l} lang={lang} hidden={c > 0 || i >= row.length} />
              )))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function AllHotels({ lang, hidden }) {
  const t = copy[lang]
  const { items, done, loading, error, loadMore } = useHotelPages()
  const sentinel = useRef(null)
  // Stop observing after an error, or a failing backend would be retried in a
  // tight loop; the button is the way back.
  useSentinel(sentinel, error ? () => {} : loadMore, items.length + (loading ? 0.5 : 0))

  return (
    <section className="ex-all" aria-labelledby="ex-all-title" hidden={hidden}>
      <div className="ex-all-head">
        <span className="eyebrow gold">{t.allKicker}</span>
        <h2 id="ex-all-title">{t.allTitle}</h2>
        <p>{t.allBody}</p>
      </div>
      {/* The carousel's own card, standing still in a grid. */}
      <div className="ex-grid" aria-busy={loading}>
        {items.map((h) => <ListingCard key={h._id} l={h} lang={lang} />)}
        {loading && Array.from({ length: items.length ? 4 : 8 }, (_, i) => (
          <div className="place-card hotel-card hotel-skeleton" key={`s${i}`} aria-hidden="true" />
        ))}
      </div>
      {!done && <div ref={sentinel} className="ex-sentinel" aria-hidden="true" />}
      <div className="ex-all-foot" aria-live="polite">
        {error && <><p>{t.loadFailed}</p><button type="button" className="ex-clear" onClick={loadMore}>{t.retry}</button></>}
        {!error && !done && !loading && <button type="button" className="ex-more" onClick={loadMore}>{t.loadMore}</button>}
        {done && items.length > 0 && <p>{t.end}</p>}
      </div>
    </section>
  )
}

export default function ExplorePage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = copy[lang]
  const listings = useListings()
  const services = useServices()
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [city, setCity] = useState('')

  // Hotels lead the rows: they are what can actually be booked.
  const ordered = useMemo(() => (listings || [])
    .map((l) => ({ l, key: haystack(l) }))
    .sort((a, b) => (b.l.type === 'hotel') - (a.l.type === 'hotel')), [listings])

  // Guides, drivers, photographers…: bookable ones first, as in the app. None
  // are shown until the first is live (design W2) — the Services chip comes
  // with it.
  const serviceIndex = useMemo(() => sortServices(services || [])
    .map((s) => ({ s, key: fold(serviceSearchText(s)) })), [services])
  const hasServices = serviceIndex.length > 0

  // Only cities that have something in them — twelve empty options is a trap.
  const cities = useMemo(() => {
    const present = new Set(ordered.map(({ l }) => canonicalCity(l.city)))
    for (const { s } of serviceIndex) present.add(canonicalCity(s.city))
    return CITIES.filter((c) => present.has(c))
  }, [ordered, serviceIndex])

  const q = fold(query)
  const filtering = q !== '' || type !== 'all' || city !== ''
  const results = useMemo(() => ordered
    .filter(({ l, key }) => matchesType(l, type) && (!city || canonicalCity(l.city) === city) && (!q || q.split(/\s+/).every((w) => key.includes(w))))
    .map(({ l }) => l), [ordered, type, city, q])

  // The Services chip lists services alone; "All" lists them after the
  // places whenever the visitor searches or picks a city. The rows and the
  // hotel list below stay places only.
  const serviceResults = useMemo(() => matchServices(serviceIndex, { type, query: q, city }), [serviceIndex, type, q, city])
  const found = results.length + serviceResults.length

  const clear = () => { setQuery(''); setType('all'); setCity('') }

  return (
    <div className="landing-type contents">
      <main className={`home-redesign explore ${isRtl ? 'rtl' : ''}`} dir={isRtl ? 'rtl' : 'ltr'}>
        <header className="home-nav is-stuck">
          <a className="wordmark" href="/"><img className="brand-mark" src="/logo-mark.webp" alt="" width="38" height="38" /><span>Hasio</span></a>
          {/* The home page's four links, so the bar reads the same on both pages. */}
          <nav className="nav-menu">
            <a href="/explore" aria-current="page">{t.explore}</a>
            <a href="/">{t.home}</a>
            <a href="/#app">{t.app}</a>
            <a href="/#contact">{t.contact}</a>
          </nav>
          <div className="nav-actions">
            <a className="ex-home" href="/">{t.home}</a>
            <Link className="partner-login trips-link" to="/trips">{t.trips}</Link>
            <button className="lang-btn" onClick={toggleLang}>{t.switch}</button>
            <a className="join" href="/#download">{t.getApp}<span>↓</span></a>
          </div>
        </header>

        <section className="ex-hero">
          <form className="ex-search" role="search" onSubmit={(e) => { e.preventDefault(); document.getElementById('ex-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}>
            <label className="ex-field ex-q">
              <SearchIcon />
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.placeholder} aria-label={t.placeholder} />
            </label>
            <label className="ex-field ex-city">
              <PinIcon />
              <select value={city} onChange={(e) => setCity(e.target.value)} aria-label={t.city}>
                <option value="">{t.allCities}</option>
                {cities.map((c) => <option key={c} value={c}>{lang === 'ar' ? CITY_LABELS[c] : c}</option>)}
              </select>
            </label>
            <button type="submit" className="ex-go">{t.search}<span><Arrow /></span></button>
          </form>
          <div className="ex-chips" role="group" aria-label={t.kicker}>
            {t.types.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={type === k} onClick={() => setType(k)}>{label}</button>
            ))}
            {hasServices && (
              <button type="button" aria-pressed={type === 'services'} onClick={() => setType('services')}>{t.services}</button>
            )}
          </div>

          <div className="ex-copy">
            <div>
              <span className="eyebrow gold">{t.kicker}</span>
              <h1>{t.title[0]}<br />{t.title[1]}</h1>
            </div>
            <div>
              <p>{t.body}</p>
              {listings?.length > 0 && (
                <div className="ex-stats">
                  <span>{t.stays(ordered.filter(({ l }) => l.type === 'hotel').length)}</span>
                  <span>{t.places(ordered.filter(({ l }) => l.type !== 'hotel').length)}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="ex-results" id="ex-results" aria-live="polite">
          {/* The Services chip does not wait on the places: its list is its own. */}
          {listings === null && type !== 'services' && (
            <div className="marquee ex-marquee" aria-hidden="true">
              {[0, 1].map((r) => (
                <div className="marquee-row" key={r}>
                  <div className="marquee-track is-static">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => <div className="place-card hotel-card hotel-skeleton" key={i} />)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {listings?.length === 0 && type !== 'services' && (
            <div className="ex-empty">
              <h2>{t.failed}</h2>
              <button type="button" className="ex-clear" onClick={() => window.location.reload()}>{t.retry}</button>
            </div>
          )}

          {listings?.length > 0 && !filtering && <Marquee items={ordered.map(({ l }) => l)} lang={lang} label={t.rows} />}

          {filtering && (listings?.length > 0 || type === 'services') && (
            <div className="ex-grid-wrap">
              <div className="ex-count">
                <b>{t.results(found)}</b>
                <button type="button" onClick={clear}>{t.clear}</button>
              </div>
              {found > 0 ? (
                <div className="ex-grid">
                  {results.map((l) => <ListingCard key={l._id} l={l} lang={lang} />)}
                  {serviceResults.map((s) => <ServiceCard key={s._id} s={s} lang={lang} />)}
                </div>
              ) : (
                <div className="ex-empty">
                  <h2>{t.none}</h2>
                  <p>{t.noneBody}</p>
                  <button type="button" className="ex-clear" onClick={clear}>{t.clear}</button>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Hidden, not unmounted, while searching: the result grid above is the
            list then, and the pages already fetched are kept for when it clears. */}
        <AllHotels lang={lang} hidden={filtering} />

        <footer className="ex-foot">
          <span>© 2026 HASIO</span>
          <a href="/">{t.home}</a>
        </footer>
      </main>
    </div>
  )
}
