import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import './ListingsPage.css'

const AIDA_FALLBACKS = [
  'https://lh3.googleusercontent.com/aida-public/AB6AXuDPTsZ4J6YVULnt7fquihF15Zua-d_IaG_DSiVEf3PooFw7Gh3WRLBYMKUZYU3CPxu5JHMTKdTUwIYnFp14FIXZxje1BTAY9H7CsUb994QeSgzK3NV_2rlJ4gLl6vXhU-WIiu53Nj-ajFv24mmeLeF6CFFQJNmssZCr0kKmD1GDTkL2d9mc_iTcst5c7ziPGv8HD50LfXwmC-iTWgVygnY_6hU2N66b2S5oZhgA-uu6g4RPjeQ19oLXzSD26v0pudZN8trqqRrm9cL9',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAyiW8qmkIv-9kXm-_aCsf3ekCel21krXAUNALubEZWe1WWuEX434Jb9m3noHb2NzoRFPw7GdCOOzdaCN2fByK1zLcKIx3-vi1EL0IYIrgACQvFmoi6N2ra28rxygeUBwxaPpSjfjCC6AbYRM05wD_DQ3_yxovW3Xa0konAHA9OZGCFZQPdQtgIrHTdYHzi40ylJi-4pBweJLIsSVExa-thgBQzFpfPpwKVW4XJvJ-E-A1e3Ap8C9087mnxzB4ogj4eit9XIbQ21EFs',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAyzHKTFxTIzlwopk3U-b9kYFQiHvs3A7O-RBvnbZQUs1JIXbH_I7J_Qfvd7vd2TC-EH4MvsCXDfxz4BzBzaxUYJFkVo5Fr2czcRSw28isobBIZufkdska4qEWUlBlvwy_vxlaiZp3ndIina0ZKq5C8JdlLKwOd562gq_uHjyxmIh-0ErlZpXEnW3B01rt5vb840HtigRODzaAvrOP8uV3eUrtnAJu1W6cFiwH8qO8D3GCSALnaFa_HSWmderYTwpx_ygHby-G5DHCf',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAiu18zXFzFoviKXAEUqt-KXU32TWTD6POvKiy_b_RVddOf1zAikj-Ye8X_pVLZMWgUZ-BmNrcWLuahCA2N5_LEObXQ8rNWTUNanlMoMjJ1MTsMxDLV-t4YzL94vNV2jDAgYkV2qW9juQk8_TkbxJUR-5He6SmfbY4rN6w_a1_9qi-eocJous18e7_Nohs3-TWMjzBYkkaTXcKfJeHVnntavqFWaEXwK2rylVB734ktdzYByFfx7uGh1F_dCSbLKlHFOuj91LleZIJV',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuD7zOc6WfUxnSoIFNV6r2Y8M3j6jVbR3xnughW0v19jFDH7RS_o1R0xOMi7f2CAYHnljvqopVPrULLbvC140Dah3BRRHMvZDsIWIcTYMrGDEuMiiUen2LnlamkY0nGDwJJXz2AwrN5nnfIxMSFfTbBc0YrHaTrWbbxFrylDbCpJizaMs1rqHjzlZVlgxwhdyqVngv7EN1_XxQCc0tUKDEgHtomI0eNbmF-9kXGbKLmywMIAsTdIq_QE8-nL_CWUNTxsgGiij2Qh6kGr',
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAueHTXCOOFF_YPQmVsG4IFULuqd7LKl-Ck8RT2bwGR8PSpGGQXCBvo6uEwZ2p4lfVFEKKIACx8OOFbtdpAVSkT8VM98axICt2ZKkesmM5ySpxeJlIiMx02nwbrMWiaEEINd5GPCIJxOJcBcesqOg-9qYl3gufR40Qzc_2X56OxWZa24PMKjLL7NNQgfRGEMERJlQFRAPf3OZxVB2GKb4jBw9CGW6cBE5OCx4D5gp5Ig1_Z1kS-1tOsW3U92NoBN_XGc2VJqoK1hLz',
]

const translations = {
  ar: {
    title: 'الوجهات',
    subtitle: 'استكشف الفنادق والمطاعم والمعالم السياحية في الأحساء',
    search: 'ابحث...',
    allTypes: 'الكل',
    allCities: 'كل المدن',
    hotel: 'فندق',
    restaurant: 'مطعم',
    attraction: 'معلم سياحي',
    event: 'فعالية',
    tour: 'جولة',
    noResults: 'لا توجد نتائج',
    noResultsSub: 'حاول تعديل الفلاتر',
    back: 'الرئيسية',
    langSwitch: 'EN',
    filters: 'الفلاتر',
    type: 'النوع',
    city: 'المدينة',
    clearAll: 'مسح الكل',
    listings: 'وجهة',
  },
  en: {
    title: 'Destinations',
    subtitle: 'Explore hotels, restaurants, and attractions across Al-Ahsa',
    search: 'Search...',
    allTypes: 'All',
    allCities: 'All Cities',
    hotel: 'Hotel',
    restaurant: 'Restaurant',
    attraction: 'Attraction',
    event: 'Event',
    tour: 'Tour',
    noResults: 'No listings found',
    noResultsSub: 'Try adjusting your filters',
    back: 'Home',
    langSwitch: 'عربي',
    filters: 'Filters',
    type: 'Type',
    city: 'City',
    clearAll: 'Clear All',
    listings: 'listings',
  },
}

const typeOptions = ['hotel', 'restaurant', 'attraction', 'event', 'tour']

function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-img" />
      <div className="skeleton-body">
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <div className="skeleton-line short" />
      </div>
    </div>
  )
}

export default function ListingsPage() {
  const [lang, setLang] = useState(() => localStorage.getItem('hasio_lang') || 'ar')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')
  const [city, setCity] = useState('')
  const t = translations[lang]
  const isRtl = lang === 'ar'

  const listings = useQuery(
    search.trim() ? api.listings.queries.searchListings : api.listings.queries.listListings,
    search.trim()
      ? { searchQuery: search.trim(), ...(type ? { type } : {}), ...(city ? { city } : {}), limit: 100 }
      : { ...(type ? { type } : {}), ...(city ? { city } : {}), limit: 100 }
  )

  const cities = useQuery(api.listings.queries.getCities)
  const cityList = useMemo(() => (cities || []).map((c) => c.city), [cities])

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar'
    setLang(next)
    localStorage.setItem('hasio_lang', next)
  }

  const clearFilters = () => {
    setType('')
    setCity('')
    setSearch('')
  }

  const isLoading = listings === undefined
  const count = listings?.length ?? 0

  return (
    <div
      className="listings-page"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ fontFamily: isRtl ? "'Cairo', sans-serif" : "'Outfit', sans-serif" }}
    >
      <Navbar lang={lang} onLangToggle={toggleLang} />

      {/* Sticky search bar */}
      <div className="listings-header">
        <div className="listings-header-inner">
          <input
            className="listings-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.search}
          />
          {!isLoading && (
            <span className="listings-count">
              {count} {t.listings}
            </span>
          )}
          <button
            onClick={toggleLang}
            style={{
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              fontSize: 13,
              cursor: 'pointer',
              color: 'var(--color-text-muted)',
              background: 'transparent',
            }}
          >
            {t.langSwitch}
          </button>
        </div>
      </div>

      {/* Sidebar + grid */}
      <div className="listings-layout">
        {/* Sidebar */}
        <aside className="listings-sidebar">
          <div className="sidebar-title">{t.filters}</div>

          {/* Type filter */}
          <div className="sidebar-section">
            <span className="sidebar-section-label">{t.type}</span>
            <div className="filter-chips">
              <button
                className={`filter-chip${type === '' ? ' active' : ''}`}
                onClick={() => setType('')}
              >
                {t.allTypes}
              </button>
              {typeOptions.map((tp) => (
                <button
                  key={tp}
                  className={`filter-chip${type === tp ? ' active' : ''}`}
                  onClick={() => setType(tp)}
                >
                  {t[tp]}
                </button>
              ))}
            </div>
          </div>

          {/* City filter */}
          <div className="sidebar-section">
            <span className="sidebar-section-label">{t.city}</span>
            <div className="filter-chips">
              <button
                className={`filter-chip${city === '' ? ' active' : ''}`}
                onClick={() => setCity('')}
              >
                {t.allCities}
              </button>
              {cityList.map((c) => (
                <button
                  key={c}
                  className={`filter-chip${city === c ? ' active' : ''}`}
                  onClick={() => setCity(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <button className="sidebar-clear-btn" onClick={clearFilters}>
            {t.clearAll}
          </button>
        </aside>

        {/* Grid area */}
        <div>
          {isLoading ? (
            <div className="listings-loading">
              {[...Array(6)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <div className="listings-empty">
              <h3>{t.noResults}</h3>
              <p>{t.noResultsSub}</p>
            </div>
          ) : (
            <div className="listings-grid">
              {listings.map((item, idx) => (
                <ListingCard key={item._id} item={item} lang={lang} t={t} index={idx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ListingCard({ item, lang, t, index }) {
  const navigate = useNavigate()
  const name = lang === 'ar' ? (item.name_ar || item.name_en) : item.name_en
  const desc = lang === 'ar' ? (item.description_ar || item.description_en) : item.description_en
  const imgSrc = item.images?.[0] || AIDA_FALLBACKS[index % AIDA_FALLBACKS.length]

  return (
    <div
      className="listing-card"
      onClick={() => navigate(`/listings/${item._id}`)}
    >
      <div className="listing-card-img">
        <img src={imgSrc} alt={name} loading="lazy" />
        <span className="listing-card-badge">{t[item.type] || item.type}</span>
      </div>
      <div className="listing-card-body">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h3>{name}</h3>
          {item.rating > 0 && (
            <span className="listing-card-rating">★ {item.rating.toFixed(1)}</span>
          )}
        </div>
        {desc && <p className="listing-card-desc">{desc}</p>}
        <div className="listing-card-footer">
          {item.city && (
            <span className="listing-card-location">
              <span className="material-symbols-outlined" style={{ fontSize: 14, verticalAlign: 'middle' }}>location_on</span> {item.city}
            </span>
          )}
          {item.priceRange && (
            <span className="listing-card-price">{item.priceRange}</span>
          )}
        </div>
      </div>
    </div>
  )
}
