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

// Stitch bento grid cards
const BENTO_CARDS = [
  {
    title: 'Al Qarah Mountain Caves',
    titleAr: 'كهوف جبل القارة',
    badge: 'CULTURAL LANDMARK',
    badgeAr: 'معلم ثقافي',
    desc: 'Explore the ancient whispers of limestone corridors.',
    descAr: 'استكشف همسات الحجر الجيري القديمة في أعماق الجبل',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD7zOc6WfUxnSoIFNV6r2Y8M3j6jVbR3xnughW0v19jFDH7RS_o1R0xOMi7f2CAYHnljvqopVPrULLbvC140Dah3BRRHMvZDsIWIcTYMrGDEuMiiUen2LnlamkY0nGDwJJXz2AwrN5nnfIxMSFfTbBc0YrHaTrWbbxFrylDbCpJizaMs1rqHjzlZVlgxwhdyqVngv7EN1_XxQCc0tUKDEgHtomI0eNbmF-9kXGbKLmywMIAsTdIq_QE8-nL_CWUNTxsgGiij2Qh6kGr',
    wide: true,
    link: '/listings?type=attraction'
  },
  {
    title: 'The Oasis Serenity Resort',
    titleAr: 'منتجع واحة السكينة',
    badge: 'BOUTIQUE HOTEL',
    badgeAr: 'فندق بوتيك',
    desc: 'Boutique desert living with private natural springs.',
    descAr: 'حياة صحراوية فاخرة مع ينابيع طبيعية خاصة',
    price: 'From SAR 450 / night',
    priceAr: 'من ٤٥٠ ر.س / ليلة',
    rating: '4.9',
    img: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBZhUn3gEH-hDr0pbD1v0-czSYBb_S4wTMYT0nRYAyAJhG15Yf8y9FLcZ8TpcAbjm2PJGa_W1q44G6sjp2LvUKlwlf-X6Nl59xWirusUMMAt9ZI2mBjetJDHevDhouuZCGgVPf3xIfPavYlxxas1bSF21Ip15Zh_oK02R4qUO_kY4KwZVM_NR7UKAEqIhSClVCFNdYYCRSC--7Iw6zBVEAdTcck_OvxWZeKd7aFpqHgysvNCkCDEakUaPAm1Gp4m6L28q2UBimrrMEY',
    wide: false,
    link: '/listings?type=hotel'
  },
  {
    title: 'Palm Grove Dining',
    titleAr: 'مطعم بستان النخيل',
    badge: 'GASTRONOMY',
    badgeAr: 'تجربة طهي',
    desc: "A sensory journey through Al-Ahsa's rich agricultural heritage.",
    descAr: 'رحلة حسية عبر التراث الزراعي الغني للأحساء',
    img: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80',
    wide: false,
    link: '/listings?type=restaurant'
  },
  {
    title: 'The Artisans of Hofuf',
    titleAr: 'حرفيو الهفوف',
    badge: 'MARKETPLACE TOUR',
    badgeAr: 'جولة في السوق',
    desc: "Discover traditional crafts in Al-Ahsa's historic bazaar.",
    descAr: 'اكتشف الحرف التقليدية في السوق التاريخي للأحساء',
    img: 'https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80',
    wide: true,
    link: '/listings'
  }
]

// Marketplace horizontal-scroll strip
const MARKETPLACE_CARDS = [
  {
    title: 'Dar Al Ahsa',
    titleAr: 'دار الأحساء',
    subtitle: 'Boutique Hotel',
    subtitleAr: 'فندق بوتيك',
    rating: '4.7',
    img: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80',
    link: '/listings?type=hotel'
  },
  {
    title: 'Al Ahsa InterContinental',
    titleAr: 'إنتركونتيننتال الأحساء',
    subtitle: 'Luxury Resort',
    subtitleAr: 'منتجع فاخر',
    rating: '4.8',
    img: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=500&q=80',
    link: '/listings?type=hotel'
  },
  {
    title: 'Najd Village',
    titleAr: 'قرية نجد',
    subtitle: 'Local Restaurant',
    subtitleAr: 'مطعم محلي',
    rating: '4.6',
    img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=500&q=80',
    link: '/listings?type=restaurant'
  },
  {
    title: 'Heritage Walking Tour',
    titleAr: 'جولة التراث سيراً',
    subtitle: 'Guided Tour',
    subtitleAr: 'جولة مرشدة',
    rating: '4.9',
    img: 'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=500&q=80',
    link: '/listings?type=tour'
  },
  {
    title: 'Al Ahsa Dates',
    titleAr: 'تمور الأحساء',
    subtitle: 'Date Farm',
    subtitleAr: 'مزرعة نخيل',
    rating: '4.9',
    img: 'https://images.unsplash.com/photo-1447279506476-3faec8071eee?w=500&q=80',
    link: '/listings?type=attraction'
  },
  {
    title: 'Oasis Handicrafts',
    titleAr: 'حرف الواحة اليدوية',
    subtitle: 'Artisan Shop',
    subtitleAr: 'متجر حرفي',
    rating: '4.7',
    img: 'https://images.unsplash.com/photo-1578894381163-e72c17f2d45f?w=500&q=80',
    link: '/services'
  }
]

// Testimonials (representative placeholder copy — swap with real reviews later)
const TESTIMONIALS = [
  {
    name: 'Sarah Almutairi',
    location: 'Riyadh, Saudi Arabia',
    locationAr: 'الرياض، السعودية',
    quote: 'Al-Ahsa is a hidden paradise. Hasio made it so easy to discover the best places and plan my trip.',
    quoteAr: 'الأحساء جنة خفية. طبّق هاسيو سهّل عليّ اكتشاف أفضل الأماكن والتخطيط لرحلتي.',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&q=80'
  },
  {
    name: 'James Carter',
    location: 'London, UK',
    locationAr: 'لندن، المملكة المتحدة',
    quote: 'The AI concierge is amazing! It recommended places we would have never found on our own.',
    quoteAr: 'مرشد الذكاء الاصطناعي رائع! رشّح لنا أماكن ما كنا لنعثر عليها بأنفسنا أبداً.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80'
  },
  {
    name: 'Fatima Alzahrani',
    location: 'Dammam, Saudi Arabia',
    locationAr: 'الدمام، السعودية',
    quote: 'Authentic experiences, beautiful places, and seamless booking. Highly recommend!',
    quoteAr: 'تجارب أصيلة وأماكن جميلة وحجز سلس. أنصح به بشدة!',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80'
  }
]

// Stats band (illustrative marketing figures)
const STATS = [
  { num: '50K+', label: 'Travelers', labelAr: 'مسافر' },
  { num: '400+', label: 'Experiences', labelAr: 'تجربة' },
  { num: '120+', label: 'Hotels', labelAr: 'فندق' },
  { num: '95%', label: 'Satisfaction', labelAr: 'نسبة الرضا' }
]

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
      categories: ['Hotels', 'Restaurants', 'Attractions', 'Tours', 'Cafes', 'Shopping', 'Local Guides'],
      categoryTypes: ['hotel', 'restaurant', 'attraction', 'tour', 'cafe', 'shopping', 'guides'],
      categoryIcons: ['hotel', 'restaurant', 'landscape', 'map', 'local_cafe', 'shopping_bag', 'person_pin_circle']
    },
    featured: {
      title: 'Featured Gems',
      subtitle: 'Curated Al-Ahsa experiences',
      viewAll: 'View All'
    },
    marketplace: {
      title: 'Marketplace',
      subtitle: 'Book unforgettable stays, unique experiences, and local treasures.',
      viewAll: 'Explore All'
    },
    atlas: {
      title: 'The Oasis Atlas',
      desc: 'Navigate Al-Ahsa like a local. Our interactive map covers every hidden gem, heritage site, and oasis trail across the region.',
      cta: 'Explore the Map',
      mapLabel: 'Interactive Map of Al-Ahsa',
      stats: [
        { num: '120+', label: 'Points of Interest' },
        { num: '25+', label: 'Heritage Sites' },
        { num: '10+', label: 'Unique Routes' }
      ]
    },
    testimonials: {
      title: 'Loved by Travelers',
      subtitle: 'Real experiences from those who explored Al-Ahsa with Hasio.',
      viewAll: 'View All'
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
      categories: ['فنادق', 'مطاعم', 'معالم سياحية', 'جولات', 'مقاهي', 'تسوق', 'مرشدون محليون'],
      categoryTypes: ['hotel', 'restaurant', 'attraction', 'tour', 'cafe', 'shopping', 'guides'],
      categoryIcons: ['hotel', 'restaurant', 'landscape', 'map', 'local_cafe', 'shopping_bag', 'person_pin_circle']
    },
    featured: {
      title: 'جواهر مميزة',
      subtitle: 'تجارب الأحساء المنتقاة',
      viewAll: 'عرض الكل'
    },
    marketplace: {
      title: 'السوق',
      subtitle: 'احجز إقامات لا تُنسى وتجارب فريدة وكنوز محلية.',
      viewAll: 'استكشف الكل'
    },
    atlas: {
      title: 'أطلس الواحة',
      desc: 'تنقل في الأحساء كالسكان المحليين. تغطي خريطتنا التفاعلية كل جوهرة خفية وموقع تراثي ومسار واحة في المنطقة.',
      cta: 'استكشف الخريطة',
      mapLabel: 'خريطة الأحساء التفاعلية',
      stats: [
        { num: '+120', label: 'معلم سياحي' },
        { num: '+25', label: 'موقع تراثي' },
        { num: '+10', label: 'مسار فريد' }
      ]
    },
    testimonials: {
      title: 'محبوب من المسافرين',
      subtitle: 'تجارب حقيقية من مستكشفي الأحساء مع هاسيو.',
      viewAll: 'عرض الكل'
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


function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('hasio_lang') || 'ar')
  const [showTravelPlanner, setShowTravelPlanner] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [earlyEmail, setEarlyEmail] = useState('')
  const [earlyStatus, setEarlyStatus] = useState(null) // null | 'submitting' | 'success' | 'duplicate' | 'error'

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const captureEmail = hasConvex ? useMutation(api.emailCaptures.mutations.captureEmail) : null
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const publicConfig = hasConvex ? useQuery(api.config.queries.getPublicConfig, {}) : null
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

  const handleCategoryClick = (categoryType) => {
    if (categoryType === 'guides') {
      navigate('/services')
    } else if (categoryType === 'shopping') {
      navigate('/listings')
    } else if (categoryType === 'cafe') {
      navigate('/listings?type=restaurant')
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
            <button
              className="nav-hamburger"
              aria-label="Menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
            >
              <span className="material-symbols-outlined">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            className="nav-mobile-dropdown"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Link to="/explore" onClick={() => setMobileMenuOpen(false)}>{t.nav.explore}</Link>
            <Link to="/listings" onClick={() => setMobileMenuOpen(false)}>{t.nav.marketplace}</Link>
            <Link to="/services" onClick={() => setMobileMenuOpen(false)}>{t.nav.services}</Link>
            {isLoggedIn && <Link to="/dashboard" onClick={() => setMobileMenuOpen(false)}>{t.nav.dashboard}</Link>}
            <div className="nav-mobile-dropdown-divider" />
            {isLoggedIn ? (
              <Link to="/dashboard" className="nav-mobile-dropdown-cta" onClick={() => setMobileMenuOpen(false)}>{t.nav.dashboard}</Link>
            ) : (
              <>
                <Link to="/sign-in" onClick={() => setMobileMenuOpen(false)}>{t.nav.signIn}</Link>
                <Link to="/sign-up" className="nav-mobile-dropdown-cta" onClick={() => setMobileMenuOpen(false)}>{t.nav.signUp}</Link>
              </>
            )}
          </motion.div>
        )}
      </nav>

      {/* ===== HERO ===== */}
      <section className="hero">
        <img
          className="hero-bg-img"
          src="/hero.png"
          alt="Al-Ahsa Oasis"
        />
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

            <motion.h1 variants={fadeInUp}>
              {(() => {
                const accent = isAr ? 'الأحساء' : 'Al-Ahsa'
                const idx = t.hero.title.indexOf(accent)
                if (idx === -1) return t.hero.title
                return (
                  <>
                    {t.hero.title.slice(0, idx)}
                    <span className="hero-title-accent">{accent}</span>
                    {t.hero.title.slice(idx + accent.length)}
                  </>
                )
              })()}
            </motion.h1>

            <motion.p className="hero-sub" variants={fadeInUp}>
              {t.hero.sub}
            </motion.p>

            <motion.form className="hero-search" variants={fadeInUp} onSubmit={handleSearch}>
              <div className="search-field-group">
                <span className="material-symbols-outlined search-field-icon">location_on</span>
                <input
                  className="search-field"
                  type="text"
                  placeholder={t.hero.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="search-divider" />
              <div className="search-field-group" style={{ maxWidth: 170 }}>
                <span className="material-symbols-outlined search-field-icon">calendar_month</span>
                <input
                  className="search-field"
                  type="text"
                  placeholder={t.hero.datePlaceholder}
                />
              </div>
              <div className="search-divider" />
              <div className="search-field-group" style={{ maxWidth: 130 }}>
                <span className="material-symbols-outlined search-field-icon">group</span>
                <input
                  className="search-field"
                  type="text"
                  placeholder={t.hero.guestsPlaceholder}
                />
              </div>
              <button type="submit" className="search-btn">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>search</span>
                {t.hero.searchBtn}
              </button>
            </motion.form>

            <motion.div className="hero-categories" variants={fadeInUp}>
              {t.hero.categories.map((label, i) => (
                <button
                  key={i}
                  className="cat-pill"
                  onClick={() => handleCategoryClick(t.hero.categoryTypes[i])}
                >
                  <span className="material-symbols-outlined">{t.hero.categoryIcons[i]}</span>
                  {label}
                </button>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURED GEMS BENTO ===== */}
      <div className="section">
        <div className="section-header">
          <div className="section-header-text">
            <h2 className="section-title">{t.featured.title}</h2>
            <p className="section-subtitle">{t.featured.subtitle}</p>
          </div>
          <Link to="/listings" className="btn-view-all">{t.featured.viewAll}</Link>
        </div>

        <motion.div
          className="gems-bento"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={staggerContainer}
        >
          {BENTO_CARDS.map((card, i) => (
            <motion.a
              key={i}
              href={card.link}
              className="bento-card"
              variants={fadeInUp}
            >
              <img src={card.img} alt={isAr ? card.titleAr : card.title} className="bento-card-img" />
              <div className="bento-card-overlay" />
              <span className="bento-card-bookmark">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>bookmark</span>
              </span>
              <div className="bento-card-content">
                <span className="bento-card-badge">{isAr ? card.badgeAr : card.badge}</span>
                <h3>{isAr ? card.titleAr : card.title}</h3>
                <p>{isAr ? card.descAr : card.desc}</p>
                {card.rating && (
                  <div className="bento-card-rating">
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#D4AF37', fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" }}>star</span>
                    <span>{card.rating}</span>
                    {card.price && <span className="bento-card-price">{isAr ? card.priceAr : card.price}</span>}
                  </div>
                )}
              </div>
            </motion.a>
          ))}
        </motion.div>
      </div>

      {/* ===== MARKETPLACE ===== */}
      <div className="section">
        <div className="section-header">
          <div className="section-header-text">
            <h2 className="section-title">{t.marketplace.title}</h2>
            <p className="section-subtitle">{t.marketplace.subtitle}</p>
          </div>
          <Link to="/listings" className="btn-view-all">{t.marketplace.viewAll}</Link>
        </div>

        <div className="marketplace-scroll">
          {MARKETPLACE_CARDS.map((card, i) => (
            <a key={i} href={card.link} className="marketplace-card">
              <div className="marketplace-card-img-wrap">
                <img src={card.img} alt={isAr ? card.titleAr : card.title} />
              </div>
              <div className="marketplace-card-title">{isAr ? card.titleAr : card.title}</div>
              <div className="marketplace-card-rating">
                <span className="material-symbols-outlined">star</span>
                <span>{card.rating}</span>
              </div>
            </a>
          ))}
        </div>
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

            <div className="atlas-stats">
              {t.atlas.stats.map((stat, i) => (
                <div key={i}>
                  <div className="atlas-stat-num">{stat.num}</div>
                  <div className="atlas-stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            className="atlas-map-thumb"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {publicConfig?.mapboxToken ? (
              <img
                src={`https://api.mapbox.com/styles/v1/mapbox/outdoors-v12/static/49.5683,25.3854,9,0/600x400@2x?access_token=${publicConfig.mapboxToken}`}
                alt="Al-Ahsa map"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <iframe
                title="Al-Ahsa map"
                width="100%"
                height="100%"
                style={{ border: 'none' }}
                src="https://www.openstreetmap.org/export/embed.html?bbox=49.0%2C25.0%2C50.2%2C25.8&layer=mapnik&marker=25.3854%2C49.5683"
              />
            )}
          </motion.div>
        </div>
      </section>

      {/* ===== AI CONCIERGE + TESTIMONIALS (shared background) ===== */}
      <div className="concierge-testimonials-bg">
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
              <div className="chat-avatar"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>person</span></div>
              <div className="chat-bubble user">{t.concierge.chat1}</div>
            </div>

            <div className="chat-msg">
              <div className="chat-avatar">
                <img src="/logo.png" alt="AI" style={{ width: 36, height: 36, borderRadius: '50%' }} />
              </div>
              <div className="chat-bubble bot">{t.concierge.chat2}</div>
            </div>

            <div className="chat-msg user">
              <div className="chat-avatar"><span className="material-symbols-outlined" style={{ fontSize: 20 }}>person</span></div>
              <div className="chat-bubble user">{t.concierge.chat3}</div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== TESTIMONIALS ===== */}
      <div className="section testimonials-on-photo">
        <div className="section-header">
          <div className="section-header-text">
            <h2 className="section-title">{t.testimonials.title}</h2>
            <p className="section-subtitle">{t.testimonials.subtitle}</p>
          </div>
          <Link to="/listings" className="btn-view-all btn-view-all--light">{t.testimonials.viewAll}</Link>
        </div>

        <div className="testimonials-grid">
          {TESTIMONIALS.map((item, i) => (
            <div key={i} className="testimonial-card">
              <div className="testimonial-stars">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                ))}
              </div>
              <p className="testimonial-quote">"{isAr ? item.quoteAr : item.quote}"</p>
              <div className="testimonial-person">
                <img className="testimonial-avatar" src={item.avatar} alt={item.name} />
                <div>
                  <div className="testimonial-name">{item.name}</div>
                  <div className="testimonial-location">{isAr ? item.locationAr : item.location}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* ===== CTA BAND (stats + email, merged) ===== */}
      <section className="cta-band">
        <div className="cta-band-inner">
          <motion.div
            className="cta-stats"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {STATS.map((stat, i) => (
              <motion.div key={i} className="cta-stat" variants={fadeInUp}>
                <span className="cta-stat-num">{stat.num}</span>
                <span className="cta-stat-label">{isAr ? stat.labelAr : stat.label}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.h2 className="cta-heading" variants={fadeInUp}>{t.email.title}</motion.h2>
            <motion.p className="cta-desc" variants={fadeInUp}>{t.email.desc}</motion.p>

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
        </div>
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
