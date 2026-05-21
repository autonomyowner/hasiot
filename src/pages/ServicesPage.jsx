import { useState } from 'react'
import { useQuery } from 'convex/react'
import { motion as Motion } from 'framer-motion'
import { api } from '../../convex/_generated/api'
import './ServicesPage.css'

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

const SERVICE_TYPES = ['tour_guide', 'photographer', 'driver', 'translator', 'event_planner', 'catering', 'equipment_rental', 'other']

const translations = {
  en: {
    title: 'Local Experts & Services',
    subtitle: 'Connect with vetted Al-Ahsa professionals',
    searchPlaceholder: 'Search services...',
    all: 'All',
    allCities: 'All Cities',
    professionals: 'professionals found',
    noResults: 'No services found',
    adjustFilters: 'Try adjusting your filters',
    contact: 'Contact',
    contactAdmin: 'Contact through platform',
    languages: 'Languages',
    langSwitch: 'عربي',
    trust1Title: 'Vetted Expertise',
    trust1Desc: 'All providers are verified and background-checked',
    trust2Title: 'Secure Payments',
    trust2Desc: 'Safe transactions with full refund protection',
    trust3Title: '24/7 Concierge',
    trust3Desc: 'Our team is always available to help',
  },
  ar: {
    title: 'خبراء ومقدمو الخدمات المحليون',
    subtitle: 'تواصل مع محترفي الأحساء الموثوقين',
    searchPlaceholder: 'ابحث عن الخدمات...',
    all: 'الكل',
    allCities: 'كل المدن',
    professionals: 'محترف متاح',
    noResults: 'لا توجد خدمات',
    adjustFilters: 'حاول تعديل الفلاتر',
    contact: 'تواصل',
    contactAdmin: 'التواصل عبر المنصة',
    languages: 'اللغات',
    langSwitch: 'EN',
    trust1Title: 'خبرة موثقة',
    trust1Desc: 'جميع مقدمي الخدمات موثقون ومتحقق منهم',
    trust2Title: 'مدفوعات آمنة',
    trust2Desc: 'معاملات آمنة مع حماية استرداد كاملة',
    trust3Title: 'كونسيرج 24/7',
    trust3Desc: 'فريقنا متاح دائمًا للمساعدة',
  },
}

function SkeletonProvider() {
  return (
    <div className="skeleton-provider">
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div className="skeleton-line" style={{ width: 68, height: 68, borderRadius: '50%', flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skeleton-line" style={{ height: 18, width: '70%' }} />
          <div className="skeleton-line" style={{ height: 13, width: '45%' }} />
          <div className="skeleton-line" style={{ height: 13, width: '35%' }} />
        </div>
      </div>
      <div className="skeleton-line" style={{ height: 13, width: '100%' }} />
      <div className="skeleton-line" style={{ height: 13, width: '85%' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skeleton-line" style={{ height: 20, width: '30%' }} />
        <div className="skeleton-line" style={{ height: 36, width: '35%', borderRadius: 12 }} />
      </div>
    </div>
  )
}

function ProviderCard({ svc, lang, t, stLabels, index, expanded, onToggle }) {
  const title = lang === 'ar' ? (svc.title_ar || svc.title_en) : svc.title_en
  const desc = lang === 'ar' ? (svc.description_ar || svc.description_en) : svc.description_en

  return (
    <Motion.div
      className="provider-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      onClick={onToggle}
    >
      <div className="provider-card-top">
        <div className="provider-avatar">
          {svc.images?.[0]
            ? <img src={svc.images[0]} alt={title} />
            : '👤'}
        </div>
        <div className="provider-info">
          <div className="provider-name">{title || svc.title}</div>
          <div className="provider-type">{stLabels[svc.serviceType] || svc.serviceType}</div>
          {svc.rating > 0 && (
            <div className="provider-rating">
              <span className="star">★</span>
              {svc.rating.toFixed(1)}
            </div>
          )}
        </div>
      </div>

      {(svc.city || svc.priceRange) && (
        <div className="provider-badges">
          {svc.city && <span className="provider-badge provider-badge-city">{svc.city}</span>}
          {svc.priceRange && (
            <span className="provider-badge provider-badge-price">
              {svc.priceRange}{svc.priceUnit ? ` / ${svc.priceUnit.replace('per_', '')}` : ''}
            </span>
          )}
        </div>
      )}

      {desc && <p className="provider-desc">{desc}</p>}

      <div className="provider-card-footer">
        {svc.priceRange
          ? <span className="provider-price">{svc.priceRange}<small>{svc.priceUnit ? ` / ${svc.priceUnit.replace('per_', '')}` : ''}</small></span>
          : <span />}
        <button
          className="provider-contact-btn"
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {t.contact}
        </button>
      </div>

      {expanded && (
        <Motion.div
          className="provider-contact-info"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
        >
          {svc.languages?.length > 0 && (
            <span className="provider-languages">
              <strong>{t.languages}:</strong> {svc.languages.join(', ')}
            </span>
          )}
          {svc.contactPhone && <span>📞 {svc.contactPhone}</span>}
          {svc.contactEmail && (
            <a href={`mailto:${svc.contactEmail}`} style={{ color: 'var(--color-primary)' }}>
              ✉️ {svc.contactEmail}
            </a>
          )}
          {!svc.contactPhone && !svc.contactEmail && (
            <span>{t.contactAdmin}</span>
          )}
        </Motion.div>
      )}
    </Motion.div>
  )
}

export default function ServicesPage() {
  const [lang, setLang] = useState(() => localStorage.getItem('hasio_lang') || 'ar')
  const [search, setSearch] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [city, setCity] = useState('')
  const [expanded, setExpanded] = useState(null)

  const t = translations[lang]
  const stLabels = serviceTypeLabels[lang]
  const isAr = lang === 'ar'

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

  const loading = services === undefined

  return (
    <div className="services-page" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Hero bar */}
      <div className="services-hero-bar">
        <h1>{t.title}</h1>
        <p>{t.subtitle}</p>
      </div>

      {/* Sticky filter bar */}
      <div className="services-filter-bar">
        <div className="services-filter-inner">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="services-search">
              <input
                placeholder={t.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {cityList.length > 0 && (
              <select
                className="services-city-select"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">{t.allCities}</option>
                {cityList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}
            <button className="services-lang-btn" onClick={toggleLang}>{t.langSwitch}</button>
          </div>

          {/* Type filter tabs */}
          <div className="services-filter-tabs">
            <button
              className={`filter-tab ${serviceType === '' ? 'active' : ''}`}
              onClick={() => setServiceType('')}
            >
              {t.all}
            </button>
            {SERVICE_TYPES.map((type) => (
              <button
                key={type}
                className={`filter-tab ${serviceType === type ? 'active' : ''}`}
                onClick={() => setServiceType(type)}
              >
                {stLabels[type]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="services-content">
        <div className="services-results-bar">
          <span className="services-count">
            {loading ? '—' : services.length} {t.professionals}
          </span>
        </div>

        {loading ? (
          <div className="services-loading">
            {[...Array(6)].map((_, i) => <SkeletonProvider key={i} />)}
          </div>
        ) : services.length === 0 ? (
          <div className="services-empty">
            <h3>{t.noResults}</h3>
            <p>{t.adjustFilters}</p>
          </div>
        ) : (
          <div className="services-grid">
            {services.map((svc, i) => (
              <ProviderCard
                key={svc._id}
                svc={svc}
                lang={lang}
                t={t}
                stLabels={stLabels}
                index={i}
                expanded={expanded === svc._id}
                onToggle={() => setExpanded(expanded === svc._id ? null : svc._id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Trust indicators */}
      <section className="trust-section">
        <div className="trust-inner">
          <div className="trust-item">
            <span className="trust-icon">✓</span>
            <h3>{t.trust1Title}</h3>
            <p>{t.trust1Desc}</p>
          </div>
          <div className="trust-item">
            <span className="trust-icon">🔒</span>
            <h3>{t.trust2Title}</h3>
            <p>{t.trust2Desc}</p>
          </div>
          <div className="trust-item">
            <span className="trust-icon">📞</span>
            <h3>{t.trust3Title}</h3>
            <p>{t.trust3Desc}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
