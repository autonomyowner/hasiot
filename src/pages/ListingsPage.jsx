import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../../convex/_generated/api'
import './ListingsPage.css'

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
              {listings.map((item) => (
                <ListingCard key={item._id} item={item} lang={lang} t={t} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ListingCard({ item, lang, t }) {
  const navigate = useNavigate()
  const name = lang === 'ar' ? (item.name_ar || item.name_en) : item.name_en
  const desc = lang === 'ar' ? (item.description_ar || item.description_en) : item.description_en

  return (
    <div
      className="listing-card"
      onClick={() => navigate(`/listings/${item._id}`)}
    >
      <div className="listing-card-img">
        {item.images?.[0] ? (
          <img src={item.images[0]} alt={name} loading="lazy" />
        ) : (
          <div className="listing-card-img-placeholder">🏛️</div>
        )}
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
              📍 {item.city}
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
