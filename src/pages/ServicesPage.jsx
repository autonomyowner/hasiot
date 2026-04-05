import { useState } from 'react'
import { useQuery } from 'convex/react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { api } from '../../convex/_generated/api'
import ImageCarousel from '../components/ImageCarousel'

const serviceTypeLabels = {
  ar: {
    tour_guide: 'مرشد سياحي',
    photographer: 'مصور',
    driver: 'سائق',
    translator: 'مترجم',
    event_planner: 'منظم فعاليات',
    catering: 'تموين',
    equipment_rental: 'تأجير معدات',
    other: 'أخرى',
  },
  en: {
    tour_guide: 'Tour Guide',
    photographer: 'Photographer',
    driver: 'Driver',
    translator: 'Translator',
    event_planner: 'Event Planner',
    catering: 'Catering',
    equipment_rental: 'Equipment Rental',
    other: 'Other',
  },
}

const translations = {
  ar: {
    title: 'خدمات المستقلين',
    subtitle: 'اعثر على مصورين، مرشدين سياحيين، سائقين وأكثر',
    search: 'ابحث...',
    allTypes: 'كل الخدمات',
    allCities: 'كل المدن',
    noResults: 'لا توجد نتائج',
    langSwitch: 'EN',
    languages: 'اللغات',
    contact: 'تواصل',
  },
  en: {
    title: 'Freelancer Services',
    subtitle: 'Find photographers, tour guides, drivers and more',
    search: 'Search...',
    allTypes: 'All Services',
    allCities: 'All Cities',
    noResults: 'No results found',
    langSwitch: 'عربي',
    languages: 'Languages',
    contact: 'Contact',
  },
}

const serviceTypes = ['tour_guide', 'photographer', 'driver', 'translator', 'event_planner', 'catering', 'equipment_rental', 'other']

export default function ServicesPage() {
  const [lang, setLang] = useState(() => localStorage.getItem('hasio_lang') || 'ar')
  const [search, setSearch] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [city, setCity] = useState('')
  const [expanded, setExpanded] = useState(null)
  const t = translations[lang]
  const stLabels = serviceTypeLabels[lang]
  const isRtl = lang === 'ar'

  const services = useQuery(
    search.trim() ? api.services.queries.searchServices : api.services.queries.listServices,
    search.trim()
      ? { searchQuery: search.trim(), ...(serviceType ? { serviceType } : {}), ...(city ? { city } : {}), limit: 100 }
      : { ...(serviceType ? { serviceType } : {}), ...(city ? { city } : {}), limit: 100 }
  )

  // Extract unique cities from results
  const citySet = new Set()
  if (services) services.forEach((s) => s.city && citySet.add(s.city))
  const cityList = [...citySet].sort()

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
            <Link to="/listings" style={navLinkStyle}>
              {lang === 'ar' ? 'الوجهات' : 'Destinations'}
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
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} style={inputStyle}>
          <option value="">{t.allTypes}</option>
          {serviceTypes.map((st) => (
            <option key={st} value={st}>{stLabels[st]}</option>
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
        {services === undefined ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Loading...</div>
        ) : services.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>{t.noResults}</div>
        ) : (
          <div style={gridStyle}>
            {services.map((svc, i) => (
              <ServiceCard key={svc._id} svc={svc} lang={lang} t={t} stLabels={stLabels} index={i} expanded={expanded === svc._id} onToggle={() => setExpanded(expanded === svc._id ? null : svc._id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ServiceCard({ svc, lang, t, stLabels, index, expanded, onToggle }) {
  const title = lang === 'ar' ? (svc.title_ar || svc.title_en) : svc.title_en
  const desc = lang === 'ar' ? (svc.description_ar || svc.description_en) : svc.description_en

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      onClick={onToggle}
      style={cardStyle}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.06)' }}
    >
      <ImageCarousel images={svc.images || []} height={180} />
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: '#111', lineHeight: 1.3 }}>{title}</h3>
          {svc.rating > 0 && (
            <span style={{ fontSize: 13, color: '#f59e0b', whiteSpace: 'nowrap' }}>★ {svc.rating.toFixed(1)}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={badgeStyle('#0D7A5F')}>{stLabels[svc.serviceType] || svc.serviceType}</span>
          {svc.city && <span style={badgeStyle('#6b7280')}>{svc.city}</span>}
          {svc.priceRange && <span style={badgeStyle('#92400e')}>{svc.priceRange}{svc.priceUnit ? ` / ${svc.priceUnit.replace('per_', '')}` : ''}</span>}
        </div>
        {desc && <p style={{ fontSize: 13, color: '#6b7280', margin: '8px 0 0', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</p>}

        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} style={{ marginTop: 12, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
            {svc.languages?.length > 0 && (
              <p style={{ fontSize: 13, color: '#374151', margin: '0 0 6px' }}>
                <strong>{t.languages}:</strong> {svc.languages.join(', ')}
              </p>
            )}
            {(svc.contactPhone || svc.contactEmail) && (
              <div style={{ fontSize: 13, color: '#374151' }}>
                <strong>{t.contact}:</strong>{' '}
                {svc.contactPhone && <span>{svc.contactPhone}</span>}
                {svc.contactPhone && svc.contactEmail && <span> · </span>}
                {svc.contactEmail && <a href={`mailto:${svc.contactEmail}`} style={{ color: '#0D7A5F' }}>{svc.contactEmail}</a>}
              </div>
            )}
          </motion.div>
        )}
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
