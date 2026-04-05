import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../convex/_generated/api'
import ImageCarousel from '../components/ImageCarousel'

const translations = {
  ar: {
    title: 'الوجهات',
    subtitle: 'استكشف الفنادق والمطاعم والمعالم السياحية في السعودية',
    search: 'ابحث...',
    allTypes: 'الكل',
    allCities: 'كل المدن',
    hotel: 'فندق',
    restaurant: 'مطعم',
    attraction: 'معلم سياحي',
    event: 'فعالية',
    tour: 'جولة',
    noResults: 'لا توجد نتائج',
    back: 'الرئيسية',
    langSwitch: 'EN',
  },
  en: {
    title: 'Destinations',
    subtitle: 'Explore hotels, restaurants, and attractions across Saudi Arabia',
    search: 'Search...',
    allTypes: 'All',
    allCities: 'All Cities',
    hotel: 'Hotel',
    restaurant: 'Restaurant',
    attraction: 'Attraction',
    event: 'Event',
    tour: 'Tour',
    noResults: 'No results found',
    back: 'Home',
    langSwitch: 'عربي',
  },
}

const typeOptions = ['hotel', 'restaurant', 'attraction', 'event', 'tour']

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

  return (
    <div style={{ minHeight: '100vh', background: '#fafbfc', fontFamily: lang === 'ar' ? "'Cairo', sans-serif" : "'Outfit', sans-serif" }} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto', padding: '0 20px' }}>
          <Link to="/home" style={{ textDecoration: 'none', color: '#0D7A5F', fontWeight: 700, fontSize: 22 }}>Hasio</Link>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link to="/services" style={navLinkStyle}>
              {lang === 'ar' ? 'الخدمات' : 'Services'}
            </Link>
            <Link to="/explore" style={navLinkStyle}>
              {lang === 'ar' ? 'الخريطة' : 'Map'}
            </Link>
            <button onClick={toggleLang} style={langBtnStyle}>{t.langSwitch}</button>
          </div>
        </div>
      </header>

      {/* Title */}
      <div style={{ textAlign: 'center', padding: '40px 20px 10px' }}>
        <h1 style={{ fontSize: 32, color: '#111', margin: 0 }}>{t.title}</h1>
        <p style={{ color: '#6b7280', marginTop: 6, fontSize: 15 }}>{t.subtitle}</p>
      </div>

      {/* Filters */}
      <div style={filterBarStyle}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.search}
          style={inputStyle}
        />
        <select value={type} onChange={(e) => setType(e.target.value)} style={inputStyle}>
          <option value="">{t.allTypes}</option>
          {typeOptions.map((tp) => (
            <option key={tp} value={tp}>{t[tp]}</option>
          ))}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle}>
          <option value="">{t.allCities}</option>
          {cityList.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px 20px 60px' }}>
        {listings === undefined ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        ) : listings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>{t.noResults}</div>
        ) : (
          <div style={gridStyle}>
            {listings.map((item, i) => (
              <ListingCard key={item._id} item={item} lang={lang} t={t} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ListingCard({ item, lang, t, index }) {
  const navigate = useNavigate()
  const name = lang === 'ar' ? (item.name_ar || item.name_en) : item.name_en
  const desc = lang === 'ar' ? (item.description_ar || item.description_en) : item.description_en

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      onClick={() => navigate('/explore')}
      style={cardStyle}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <ImageCarousel images={item.images || []} height={180} />
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#111', lineHeight: 1.3 }}>{name}</h3>
          {item.rating > 0 && (
            <span style={{ fontSize: 13, color: '#f59e0b', whiteSpace: 'nowrap' }}>★ {item.rating.toFixed(1)}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={badgeStyle('#0D7A5F')}>{t[item.type] || item.type}</span>
          {item.city && <span style={badgeStyle('#6b7280')}>{item.city}</span>}
          {item.priceRange && <span style={badgeStyle('#92400e')}>{item.priceRange}</span>}
        </div>
        {desc && <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</p>}
      </div>
    </motion.div>
  )
}

function badgeStyle(color) {
  return {
    fontSize: 11,
    padding: '2px 8px',
    borderRadius: 20,
    background: `${color}15`,
    color,
    fontWeight: 500,
  }
}

const headerStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 50,
  background: 'rgba(255,255,255,0.8)',
  backdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(0,0,0,0.06)',
  padding: '12px 0',
}

const navLinkStyle = {
  textDecoration: 'none',
  color: '#374151',
  fontSize: 14,
  fontWeight: 500,
}

const langBtnStyle = {
  background: 'none',
  border: '1px solid #d1d5db',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 13,
  cursor: 'pointer',
  color: '#374151',
}

const filterBarStyle = {
  display: 'flex',
  gap: 10,
  maxWidth: 700,
  margin: '0 auto',
  padding: '10px 20px 0',
  flexWrap: 'wrap',
  justifyContent: 'center',
}

const inputStyle = {
  padding: '10px 14px',
  borderRadius: 14,
  border: '1px solid rgba(0,0,0,0.1)',
  background: 'rgba(255,255,255,0.7)',
  backdropFilter: 'blur(8px)',
  fontSize: 14,
  outline: 'none',
  minWidth: 140,
  flex: 1,
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 20,
}

const cardStyle = {
  background: '#fff',
  borderRadius: 16,
  overflow: 'hidden',
  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
  cursor: 'pointer',
  transition: 'transform 0.2s, box-shadow 0.2s',
}
