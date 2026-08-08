import { useState } from 'react'
import { useQuery, usePaginatedQuery } from 'convex/react'
import { motion as Motion } from 'framer-motion'
import { api } from '../../convex/_generated/api'
import Navbar from '../components/Navbar'
import SectionBoundary from '../components/SectionBoundary'
import { SkeletonLine, SkeletonRow, SkeletonList } from '../components/Skeleton'
import ReportButton from '../components/moderation/ReportButton'
import { useLanguage } from '../hooks/useLanguage'
import './ServicesPage.css'
import '../components/moderation/ReportButton.css'

const PAGE_SIZE = 24

const FALLBACK_AVATARS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAzcPMUwTld7-zCtkSnKB2ym4qiOjQ2fYoorZT6uPNWTW0qye4fvZBdnjo_4BVsw5deSOqJ6_7Xe3o_jDaL3ElV-6nGsRUFSiH0cjHcYpumKpa1inLHIex8jzevIycdFyQtBvIBFiqK6naq4aovwHeAOPKFITF2FpUiE4v-s_kG9vV7AYcW0Y9LxXPjQ8GFtkzEfZi8uh1N_GkciK2ZBh1tmK_Af02c95G0h1C6Hu-G7OBNWqRNaZMsLLSZvJcL3-GqKpDaVA5Cw2PL",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCAoGlmFFrhxqYudq5RPuoNc22gbFqcDjILXJ62wQGg3ZS6K9a3_QPLtKkoaW0fxrKarw2jjXR0rO1IDcVMQqk4W5JiXSAhgw5WN0bU_zqblwfWt6ptcc6bccUp2bSfi-tRALpJicYfCYf6zxCtKaptGe8pYIkSrwm0DEftEMFX4KDVvT3eN25Es-H1P8TEkblqlZQSemZi-n1Ram5cwsjfhf5pS6Dt7BPFkXfq5O_QfUCOQxiX7kP22S8emDeW8r3880dfUfTjjZN4",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA_xyc1dGx3goV06aqaqg5J1pQoU-G-ItBP0SUgHKWglQencPiDTIBTB31flfTve_ot1bieCY3RrIWN6iMvSBRbkpouHwnDKW85jFJ0qdgSw7a8eQGYMbBVn0PXpWKwLvqO7yEs8GP06bDtW69EV1Epl5AAOtubRfDZkr7JXdOU0dG8p79OHxuZde6Zh5WRHN7As3_E3hlRU6UW2HY7afb3fxkHyUT-UPAQSMy7IZqY4cqhdwBTrTfnZR6Dd_ku_GtqrsdCz-81JVwNO",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCkdRWpPnRMmx8ImT5ISq9yCqBH5fYC29hHuzlCpl74G3vXTBFmryef3XN-BTldG4f9RphURWsSUl0NcruVcXmFI--msj9ZqRCXpo0jG2a-Mum2ud-O5jrLEPx9VMHhyvNw2jyx-cPhzUQweLkuYjp4_vw1HaUYfPltkFAgBRm25hShKsoC6ftQgOdVMVF53FFJFkqngxruL24MdE45sXGSqAloshZZlKgOxFUd2mZM-w8_Lc0KCLGsvV3JZI55IfDLDfMYOxSH0Fhp"
]

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
    title: 'The Custodians of Al-Ahsa',
    subtitle: 'Connect with vetted Al-Ahsa professionals',
    searchPlaceholder: 'Search services...',
    all: 'All',
    allCities: 'All Cities',
    professionals: 'professionals found',
    noResults: 'No services found',
    adjustFilters: 'Try adjusting your filters',
    loadMore: 'Load more',
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
    title: 'حُرّاس الأحساء',
    subtitle: 'تواصل مع محترفي الأحساء الموثوقين',
    searchPlaceholder: 'ابحث عن الخدمات...',
    all: 'الكل',
    allCities: 'كل المدن',
    professionals: 'محترف متاح',
    noResults: 'لا توجد خدمات',
    adjustFilters: 'حاول تعديل الفلاتر',
    loadMore: 'عرض المزيد',
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
      <SkeletonRow />
      <SkeletonLine height={13} />
      <SkeletonLine height={13} width="85%" />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SkeletonLine height={20} width="30%" />
        <SkeletonLine height={36} width="35%" />
      </div>
    </div>
  )
}

function ProviderCard({ svc, lang, t, stLabels, index, expanded, onToggle }) {
  const title = lang === 'ar' ? (svc.title_ar || svc.title_en) : svc.title_en
  const desc = lang === 'ar' ? (svc.description_ar || svc.description_en) : svc.description_en
  const avatarSrc = svc.portfolioImages?.[0] ?? FALLBACK_AVATARS[index % FALLBACK_AVATARS.length]

  return (
    <Motion.div
      className="provider-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35 }}
      onClick={onToggle}
    >
      <div className="report-btn-corner">
        <ReportButton
          targetType="service"
          targetId={svc._id}
          ownerId={svc.ownerId ?? null}
          targetLabel={title || svc.title}
          lang={lang}
        />
      </div>
      <div className="provider-card-top">
        <div className="provider-avatar">
          {avatarSrc
            ? <img src={avatarSrc} alt={title} />
            : (
              <div className="provider-avatar-placeholder">
                <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--color-border)' }}>person</span>
              </div>
            )
          }
          <div className="provider-online-dot" />
        </div>
        <div className="provider-info">
          <div className="provider-name">{title || svc.title}</div>
          <div className="provider-type">{stLabels[svc.serviceType] || svc.serviceType}</div>
          {svc.rating > 0 && (
            <div className="provider-rating">
              <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#D4AF37', fontVariationSettings: "'FILL' 1" }}>star</span>
              <span>{svc.rating.toFixed(1)}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>· 12 reviews</span>
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
          {svc.contactPhone && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>phone</span>
              {svc.contactPhone}
            </span>
          )}
          {svc.contactEmail && (
            <a href={`mailto:${svc.contactEmail}`} style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>mail</span>
              {svc.contactEmail}
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
  const { lang, toggleLang, isRtl: isAr } = useLanguage()
  const [search, setSearch] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [city, setCity] = useState('')
  const [expanded, setExpanded] = useState(null)

  const t = translations[lang]
  const stLabels = serviceTypeLabels[lang]

  const isSearching = !!search.trim()

  // Search results are relevance-ranked and capped; only browsing paginates.
  const searchResults = useQuery(
    api.services.queries.searchServices,
    isSearching
      ? { searchQuery: search.trim(), ...(serviceType ? { serviceType } : {}), ...(city ? { city } : {}), limit: 100 }
      : 'skip'
  )

  const {
    results: browseResults,
    status: browseStatus,
    loadMore,
  } = usePaginatedQuery(
    api.services.queries.listServicesPaginated,
    isSearching ? 'skip' : { ...(serviceType ? { serviceType } : {}), ...(city ? { city } : {}) },
    { initialNumItems: PAGE_SIZE }
  )

  const services = isSearching ? searchResults : browseResults
  const canLoadMore = !isSearching && browseStatus === 'CanLoadMore'
  const isLoadingMore = !isSearching && browseStatus === 'LoadingMore'

  // Cities come from a dedicated query — deriving them from the visible results
  // silently truncated the filter list to whatever happened to be loaded.
  const cities = useQuery(api.services.queries.getServiceCities, {})
  const cityList = (cities || []).map((c) => c.city)

  const loading = isSearching
    ? searchResults === undefined
    : browseStatus === 'LoadingFirstPage'

  return (
    <div className="services-page" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="services-grain" aria-hidden="true" />
      <Navbar lang={isAr ? 'ar' : 'en'} onLangToggle={toggleLang} />

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

        <SectionBoundary lang={lang}>
          {loading ? (
            <div className="services-loading">
              <SkeletonList count={6} as={SkeletonProvider} />
            </div>
          ) : services.length === 0 ? (
            <div className="services-empty">
              <h3>{t.noResults}</h3>
              <p>{t.adjustFilters}</p>
            </div>
          ) : (
            <>
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

              {isLoadingMore && (
                <div className="services-loading" style={{ marginTop: 24 }}>
                  <SkeletonList count={3} as={SkeletonProvider} />
                </div>
              )}

              {canLoadMore && (
                <div className="services-load-more">
                  <button type="button" onClick={() => loadMore(PAGE_SIZE)}>
                    {t.loadMore}
                  </button>
                </div>
              )}
            </>
          )}
        </SectionBoundary>
      </div>

      {/* Trust indicators */}
      <section className="trust-section">
        <div className="trust-inner">
          <div className="trust-item">
            <span className="material-symbols-outlined trust-icon">verified_user</span>
            <h3>{t.trust1Title}</h3>
            <p>{t.trust1Desc}</p>
          </div>
          <div className="trust-item">
            <span className="material-symbols-outlined trust-icon">lock</span>
            <h3>{t.trust2Title}</h3>
            <p>{t.trust2Desc}</p>
          </div>
          <div className="trust-item">
            <span className="material-symbols-outlined trust-icon">support_agent</span>
            <h3>{t.trust3Title}</h3>
            <p>{t.trust3Desc}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
