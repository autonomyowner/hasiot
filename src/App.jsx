import { useState, useEffect, lazy, Suspense } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../convex/_generated/api'
import { authClient } from './lib/auth-client'
import './App.css'

const hasConvex = !!import.meta.env.VITE_CONVEX_URL

// Lazy-load components that need Convex provider
const TravelPlanner = hasConvex ? lazy(() => import('./components/travel/TravelPlanner')) : () => null
const ChatWidget = hasConvex ? lazy(() => import('./components/chat/ChatWidget')) : () => null

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

// Translations
const translations = {
  en: {
    nav: {
      explore: 'Explore',
      marketplace: 'Marketplace',
      services: 'Services',
      dashboard: 'Dashboard',
      signIn: 'Sign In',
      signUp: 'Sign Up',
      langSwitch: 'عربي'
    },
    hero: {
      badge: 'Al-Ahsa — A UNESCO World Heritage Site',
      title: 'Discover the Hidden Heart of Al-Ahsa',
      sub: "Explore ancient oases, traditional souks, and world-class hospitality in Saudi Arabia's Eastern Province.",
      searchPlaceholder: 'Where do you want to go?',
      datePlaceholder: 'Choose dates',
      guestsPlaceholder: 'Guests',
      searchBtn: 'Search',
      categories: ['Hotels', 'Restaurants', 'Attractions', 'Tours', 'Services'],
      categoryTypes: ['hotel', 'restaurant', 'attraction', 'tour', 'services']
    },
    featured: {
      title: 'Featured Gems',
      subtitle: 'Curated Al-Ahsa experiences',
      viewAll: 'View All'
    },
    atlas: {
      title: 'The Oasis Atlas',
      desc: 'Navigate Al-Ahsa like a local. Our interactive map covers every hidden gem, heritage site, and oasis trail across the region.',
      cta: 'Explore the Map',
      mapLabel: 'Interactive Map of Al-Ahsa'
    },
    concierge: {
      title: 'Your Personal Al-Ahsa Concierge',
      desc: "Tell our AI what you're looking for — adventure, culture, relaxation — and get a personalized itinerary in seconds.",
      cta: 'Start Planning',
      assistantName: 'Hasio AI',
      assistantStatus: 'Online now',
      chat1: 'I want a 3-day itinerary for Al-Ahsa with family activities.',
      chat2: 'Great! I can plan visits to Al-Ahsa National Museum, Qaisariah Souq, and the UNESCO oasis farms. Shall I add restaurant recommendations?',
      chat3: 'Yes please, and include a desert sunset experience!'
    },
    email: {
      title: 'Get Early Access to the Hasio App',
      desc: 'Join thousands exploring Al-Ahsa with our mobile companion.',
      placeholder: 'Enter your email',
      btn: 'Join Waitlist',
      btnSubmitting: 'Joining...',
      success: "You're on the list!",
      duplicate: "You're already signed up!",
      error: 'Something went wrong, please try again.'
    },
    footer: {
      brand: "Your gateway to Al-Ahsa — the world's largest oasis and a UNESCO World Heritage Site.",
      platform: 'Platform',
      support: 'Support',
      legal: 'Legal',
      links: {
        explore: 'Explore',
        marketplace: 'Marketplace',
        services: 'Services',
        helpCenter: 'Help Center',
        contact: 'Contact Us',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        cookies: 'Cookie Policy'
      },
      copy: '© 2025 Hasio. All rights reserved.'
    },
    mobileNav: {
      home: 'Home',
      explore: 'Explore',
      services: 'Services',
      chat: 'Chat',
      profile: 'Profile'
    }
  },
  ar: {
    nav: {
      explore: 'استكشف',
      marketplace: 'السوق',
      services: 'الخدمات',
      dashboard: 'لوحة التحكم',
      signIn: 'تسجيل الدخول',
      signUp: 'إنشاء حساب',
      langSwitch: 'EN'
    },
    hero: {
      badge: 'الأحساء — موقع تراث عالمي لليونسكو',
      title: 'اكتشف قلب الأحساء الخفي',
      sub: 'استكشف الواحات القديمة والأسواق التقليدية والضيافة العالمية في المنطقة الشرقية بالمملكة العربية السعودية.',
      searchPlaceholder: 'أين تريد الذهاب؟',
      datePlaceholder: 'اختر التواريخ',
      guestsPlaceholder: 'الضيوف',
      searchBtn: 'بحث',
      categories: ['فنادق', 'مطاعم', 'معالم سياحية', 'جولات', 'خدمات'],
      categoryTypes: ['hotel', 'restaurant', 'attraction', 'tour', 'services']
    },
    featured: {
      title: 'جواهر مميزة',
      subtitle: 'تجارب الأحساء المنتقاة',
      viewAll: 'عرض الكل'
    },
    atlas: {
      title: 'أطلس الواحة',
      desc: 'تنقل في الأحساء كالسكان المحليين. تغطي خريطتنا التفاعلية كل جوهرة خفية وموقع تراثي ومسار واحة في المنطقة.',
      cta: 'استكشف الخريطة',
      mapLabel: 'خريطة الأحساء التفاعلية'
    },
    concierge: {
      title: 'مرشدك الشخصي في الأحساء',
      desc: 'أخبر ذكاءنا الاصطناعي بما تبحث عنه — مغامرة، ثقافة، استرخاء — واحصل على جدول سفر مخصص في ثوانٍ.',
      cta: 'ابدأ التخطيط',
      assistantName: 'هاسيو AI',
      assistantStatus: 'متصل الآن',
      chat1: 'أريد خطة 3 أيام في الأحساء مع أنشطة عائلية.',
      chat2: 'رائع! يمكنني التخطيط لزيارة متحف الأحساء الوطني وسوق القيصرية ومزارع الواحة. هل أضيف توصيات المطاعم؟',
      chat3: 'نعم من فضلك، وأضف تجربة غروب الشمس في الصحراء!'
    },
    email: {
      title: 'احصل على وصول مبكر لتطبيق هاسيو',
      desc: 'انضم لآلاف المستكشفين للأحساء مع رفيقنا المحمول.',
      placeholder: 'أدخل بريدك الإلكتروني',
      btn: 'انضم للقائمة',
      btnSubmitting: 'جاري الانضمام...',
      success: 'أنت في القائمة!',
      duplicate: 'أنت مسجل بالفعل!',
      error: 'حدث خطأ، يرجى المحاولة مرة أخرى.'
    },
    footer: {
      brand: 'بوابتك إلى الأحساء — أكبر واحة في العالم وموقع تراث عالمي لليونسكو.',
      platform: 'المنصة',
      support: 'الدعم',
      legal: 'قانوني',
      links: {
        explore: 'استكشف',
        marketplace: 'السوق',
        services: 'الخدمات',
        helpCenter: 'مركز المساعدة',
        contact: 'اتصل بنا',
        privacy: 'سياسة الخصوصية',
        terms: 'شروط الخدمة',
        cookies: 'سياسة ملفات تعريف الارتباط'
      },
      copy: '© 2025 هاسيو. جميع الحقوق محفوظة.'
    },
    mobileNav: {
      home: 'الرئيسية',
      explore: 'استكشف',
      services: 'خدمات',
      chat: 'محادثة',
      profile: 'حسابي'
    }
  }
}

// Type label mapping for gem cards
const TYPE_LABELS = {
  hotel: { en: 'Hotel', ar: 'فندق' },
  restaurant: { en: 'Restaurant', ar: 'مطعم' },
  attraction: { en: 'Attraction', ar: 'معلم سياحي' },
  event: { en: 'Event', ar: 'فعالية' },
  tour: { en: 'Tour', ar: 'جولة' }
}

function getTypeLabel(type, lang) {
  if (!type) return ''
  const entry = TYPE_LABELS[type]
  if (!entry) return type
  return entry[lang] || entry.en
}

function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('hasio_lang') || 'ar')
  const [showTravelPlanner, setShowTravelPlanner] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [earlyEmail, setEarlyEmail] = useState('')
  const [earlyStatus, setEarlyStatus] = useState(null) // null | 'submitting' | 'success' | 'duplicate' | 'error'

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const captureEmail = hasConvex ? useMutation(api.emailCaptures.mutations.captureEmail) : null
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const listingsRaw = hasConvex ? useQuery(api.listings.queries.listListings, { limit: 12 }) : null

  const session = hasConvex ? authClient.useSession() : { data: null }
  const isLoggedIn = !!session?.data

  const navigate = useNavigate()

  const t = translations[lang]
  const isAr = lang === 'ar'

  useEffect(() => {
    document.documentElement.dir = isAr ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    localStorage.setItem('hasio_lang', lang)
  }, [lang, isAr])

  const toggleLang = () => setLang(prev => (prev === 'ar' ? 'en' : 'ar'))

  // Filter listings: approved or no status (seed), prefer those with images
  const featuredListings = (() => {
    if (!listingsRaw) return []
    const approved = listingsRaw.filter(l => !l.status || l.status === 'approved')
    const withImages = approved.filter(l => l.images && l.images.length > 0)
    const withoutImages = approved.filter(l => !l.images || l.images.length === 0)
    return [...withImages, ...withoutImages].slice(0, 6)
  })()

  const handleCategoryClick = (categoryType) => {
    if (categoryType === 'services') {
      navigate('/services')
    } else {
      navigate(`/listings?type=${categoryType}`)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/listings?search=${encodeURIComponent(searchQuery.trim())}`)
    } else {
      navigate('/listings')
    }
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!earlyEmail.trim() || !captureEmail || earlyStatus === 'submitting') return
    setEarlyStatus('submitting')
    try {
      const result = await captureEmail({ email: earlyEmail.trim(), source: 'home_banner' })
      setEarlyStatus(result.duplicate ? 'duplicate' : 'success')
      if (!result.duplicate) setEarlyEmail('')
    } catch {
      setEarlyStatus('error')
    }
  }

  return (
    <div className={`app ${isAr ? 'rtl' : 'ltr'}`}>
      {/* ===== NAVBAR ===== */}
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="nav-logo">
            <img src="/logo.png" alt="Hasio" className="nav-logo-img" />
            Hasio
          </Link>

          <ul className="nav-links">
            <li><Link to="/explore">{t.nav.explore}</Link></li>
            <li><Link to="/listings">{t.nav.marketplace}</Link></li>
            <li><Link to="/services">{t.nav.services}</Link></li>
            {isLoggedIn && <li><Link to="/dashboard">{t.nav.dashboard}</Link></li>}
          </ul>

          <div className="nav-actions">
            <button onClick={toggleLang} className="btn-lang">{t.nav.langSwitch}</button>
            {isLoggedIn ? (
              <Link to="/dashboard" className="btn-signup">{t.nav.dashboard}</Link>
            ) : (
              <>
                <Link to="/sign-in" className="btn-signin">{t.nav.signIn}</Link>
                <Link to="/sign-up" className="btn-signup">{t.nav.signUp}</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="hero">
        <div className="hero-overlay" />
        <div className="hero-content">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.div className="hero-badge" variants={fadeInUp}>
              <span className="hero-badge-dot" />
              {t.hero.badge}
            </motion.div>

            <motion.h1 variants={fadeInUp}>{t.hero.title}</motion.h1>

            <motion.p className="hero-sub" variants={fadeInUp}>
              {t.hero.sub}
            </motion.p>

            <motion.form className="hero-search" variants={fadeInUp} onSubmit={handleSearch}>
              <input
                className="search-field"
                type="text"
                placeholder={t.hero.searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="search-divider" />
              <input
                className="search-field"
                type="text"
                placeholder={t.hero.datePlaceholder}
                style={{ maxWidth: 160 }}
              />
              <div className="search-divider" />
              <input
                className="search-field"
                type="text"
                placeholder={t.hero.guestsPlaceholder}
                style={{ maxWidth: 110 }}
              />
              <button type="submit" className="search-btn">{t.hero.searchBtn}</button>
            </motion.form>

            <motion.div className="hero-categories" variants={fadeInUp}>
              {t.hero.categories.map((label, i) => (
                <button
                  key={i}
                  className="cat-pill"
                  onClick={() => handleCategoryClick(t.hero.categoryTypes[i])}
                >
                  {label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURED GEMS ===== */}
      <div className="section">
        <div className="section-header">
          <div className="section-header-text">
            <h2 className="section-title">{t.featured.title}</h2>
            <p className="section-subtitle">{t.featured.subtitle}</p>
          </div>
          <Link to="/listings" className="btn-view-all">{t.featured.viewAll}</Link>
        </div>

        <motion.div
          className="gems-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
        >
          {featuredListings.length > 0
            ? featuredListings.map((listing) => (
                <motion.a
                  key={listing._id}
                  href={`/listings?id=${listing._id}`}
                  className="gem-card"
                  variants={fadeInUp}
                >
                  <div className="gem-card-img">
                    {listing.images && listing.images.length > 0 ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.name}
                        loading="lazy"
                      />
                    ) : (
                      <div className="gem-card-img-placeholder">🏛</div>
                    )}
                    {listing.type && (
                      <span className="gem-card-badge">
                        {getTypeLabel(listing.type, lang)}
                      </span>
                    )}
                  </div>
                  <div className="gem-card-body">
                    <h3>{isAr && listing.nameAr ? listing.nameAr : listing.name}</h3>
                    {listing.description && (
                      <p className="gem-card-desc">
                        {isAr && listing.descriptionAr ? listing.descriptionAr : listing.description}
                      </p>
                    )}
                    <div className="gem-card-meta">
                      <span className="gem-location">
                        📍 {isAr && listing.cityAr ? listing.cityAr : (listing.city || 'Al-Ahsa')}
                      </span>
                      {listing.priceRange && (
                        <span className="gem-price">{listing.priceRange}</span>
                      )}
                    </div>
                  </div>
                </motion.a>
              ))
            : Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="gem-card" style={{ minHeight: 280, background: 'var(--color-border)', borderRadius: 'var(--radius-lg)', opacity: 0.4 }} />
              ))
          }
        </motion.div>
      </div>

      {/* ===== OASIS ATLAS ===== */}
      <section className="atlas-section">
        <div className="atlas-inner">
          <motion.div
            className="atlas-text"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2>{t.atlas.title}</h2>
            <p>{t.atlas.desc}</p>
            <Link to="/explore" className="btn-atlas">{t.atlas.cta}</Link>
          </motion.div>

          <motion.div
            className="atlas-map-thumb"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="atlas-map-visual">
              <div className="atlas-map-icon">🗺</div>
              <div className="atlas-map-label">{t.atlas.mapLabel}</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== AI CONCIERGE ===== */}
      <section className="concierge-section">
        <div className="concierge-inner">
          <motion.div
            className="concierge-text"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <h2>{t.concierge.title}</h2>
            <p>{t.concierge.desc}</p>
            <button className="btn-concierge" onClick={() => setShowTravelPlanner(true)}>
              {t.concierge.cta}
            </button>
          </motion.div>

          <motion.div
            className="chat-demo"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            {/* Chat demo header */}
            <div className="chat-demo-header">
              <div className="chat-demo-avatar">
                <img src="/logo.png" alt="Hasio" />
              </div>
              <div>
                <div className="chat-demo-name">{t.concierge.assistantName}</div>
                <div className="chat-demo-status">{t.concierge.assistantStatus}</div>
              </div>
            </div>

            {/* Static chat messages */}
            <div className="chat-msg user">
              <div className="chat-avatar">👤</div>
              <div className="chat-bubble user">{t.concierge.chat1}</div>
            </div>

            <div className="chat-msg">
              <div className="chat-avatar">
                <img src="/logo.png" alt="AI" style={{ width: 36, height: 36, borderRadius: '50%' }} />
              </div>
              <div className="chat-bubble bot">{t.concierge.chat2}</div>
            </div>

            <div className="chat-msg user">
              <div className="chat-avatar">👤</div>
              <div className="chat-bubble user">{t.concierge.chat3}</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== EMAIL CAPTURE ===== */}
      <section className="email-section">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          <motion.h2 variants={fadeInUp}>{t.email.title}</motion.h2>
          <motion.p variants={fadeInUp}>{t.email.desc}</motion.p>

          <motion.div variants={fadeInUp}>
            {earlyStatus === 'success' || earlyStatus === 'duplicate' ? (
              <div className="email-success-msg">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {earlyStatus === 'duplicate' ? t.email.duplicate : t.email.success}
              </div>
            ) : (
              <form className="email-form" onSubmit={handleEmailSubmit}>
                <input
                  className="email-input"
                  type="email"
                  required
                  placeholder={t.email.placeholder}
                  value={earlyEmail}
                  onChange={(e) => { setEarlyEmail(e.target.value); setEarlyStatus(null) }}
                />
                <button
                  type="submit"
                  className="email-submit"
                  disabled={earlyStatus === 'submitting'}
                >
                  {earlyStatus === 'submitting' ? t.email.btnSubmitting : t.email.btn}
                </button>
              </form>
            )}
            {earlyStatus === 'error' && (
              <p className="email-error-msg">{t.email.error}</p>
            )}
          </motion.div>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-grid">
            {/* Brand column */}
            <div className="footer-brand">
              <h3>Hasio</h3>
              <p>{t.footer.brand}</p>
            </div>

            {/* Platform column */}
            <div className="footer-col">
              <h4>{t.footer.platform}</h4>
              <ul>
                <li><Link to="/explore">{t.footer.links.explore}</Link></li>
                <li><Link to="/listings">{t.footer.links.marketplace}</Link></li>
                <li><Link to="/services">{t.footer.links.services}</Link></li>
              </ul>
            </div>

            {/* Support column */}
            <div className="footer-col">
              <h4>{t.footer.support}</h4>
              <ul>
                <li><a href="mailto:support@hasio.xyz">{t.footer.links.helpCenter}</a></li>
                <li><a href="mailto:support@hasio.xyz">{t.footer.links.contact}</a></li>
              </ul>
            </div>

            {/* Legal column */}
            <div className="footer-col">
              <h4>{t.footer.legal}</h4>
              <ul>
                <li><a href="/privacy-policy.html">{t.footer.links.privacy}</a></li>
                <li><a href="/terms-of-service.html">{t.footer.links.terms}</a></li>
                <li><a href="/privacy-policy.html">{t.footer.links.cookies}</a></li>
              </ul>
            </div>
          </div>

          <div className="footer-bottom">
            <span className="footer-copy">{t.footer.copy}</span>
            <div className="footer-legal-links">
              <a href="/privacy-policy.html">{t.footer.links.privacy}</a>
              <a href="/terms-of-service.html">{t.footer.links.terms}</a>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== MOBILE BOTTOM NAV ===== */}
      <nav className="mobile-bottom-nav">
        <div className="nav-items">
          <Link to="/" className="nav-item active">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            <span>{t.mobileNav.home}</span>
          </Link>
          <Link to="/explore" className="nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>{t.mobileNav.explore}</span>
          </Link>
          <Link to="/services" className="nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span>{t.mobileNav.services}</span>
          </Link>
          <button className="nav-item" onClick={() => setShowMobileChat(true)}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>{t.mobileNav.chat}</span>
          </button>
          <Link to={isLoggedIn ? '/dashboard' : '/sign-in'} className="nav-item">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>{t.mobileNav.profile}</span>
          </Link>
        </div>
      </nav>

      {/* ===== CHAT WIDGET (desktop) ===== */}
      <Suspense fallback={null}>
        <ChatWidget lang={lang} />
      </Suspense>

      {/* ===== TRAVEL PLANNER MODAL ===== */}
      <AnimatePresence>
        {showTravelPlanner && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowTravelPlanner(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="modal-close"
                onClick={() => setShowTravelPlanner(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <Suspense fallback={null}>
                <TravelPlanner
                  lang={lang}
                  onBookListing={(data) => {
                    console.log('Book listing with:', data)
                    setShowTravelPlanner(false)
                  }}
                />
              </Suspense>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== MOBILE CHAT PANEL ===== */}
      <AnimatePresence>
        {showMobileChat && (
          <motion.div
            className="mobile-chat-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <div className="mobile-chat-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src="/logo.png" alt="Hasio" style={{ width: 22, height: 22, objectFit: 'contain' }} />
                </div>
                <span style={{ fontWeight: 600, fontSize: 15 }}>Hasio</span>
              </div>
              <button onClick={() => setShowMobileChat(false)} className="mobile-chat-close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="mobile-chat-body">
              <Suspense fallback={null}>
                <TravelPlanner
                  lang={lang}
                  onBookListing={(data) => { console.log('Book:', data); setShowMobileChat(false) }}
                />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
