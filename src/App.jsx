import { useState, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { authClient } from './lib/auth-client'
import './App.css'

const hasConvex = !!import.meta.env.VITE_CONVEX_URL

// Lazy-load components that need Convex provider
const AuthButtons = hasConvex ? lazy(() => import('./components/auth/AuthButtons')) : () => null
const TravelPlanner = hasConvex ? lazy(() => import('./components/travel/TravelPlanner')) : () => null
const ChatWidget = hasConvex ? lazy(() => import('./components/chat/ChatWidget')) : () => null

// Translations
const translations = {
  ar: {
    // Navigation
    nav: {
      features: 'المميزات',
      howItWorks: 'كيف يعمل',
      services: 'الخدمات',
      map: 'استكشف',
      listings: 'الوجهات',
      freelancers: 'المستقلين',
      contact: 'تواصل معنا',
      getStarted: 'ابدأ الآن',
      langSwitch: 'EN'
    },
    // Hero
    hero: {
      badge: 'اكتشف الأحساء',
      title: 'سفرك،',
      titleHighlight: 'أسهل',
      description: 'هاسيو يربطك بمخطط رحلات ذكي، فنادق، مطاعم، ومعالم سياحية — كل ذلك في منصة واحدة مصممة لاستكشاف الأحساء.',
      btnPrimary: 'خطط رحلتك الآن',
      btnSecondary: 'استكشف الوجهات',
      stats: {
        destinations: 'وجهة',
        regions: 'منطقة',
        support: 'دعم متواصل'
      }
    },
    // Chat Demo
    chat: {
      assistant: 'مساعد هاسيو',
      online: 'متصل الآن',
      userMsg1: 'ابي اروح العلا، وش تنصحني؟',
      botMsg1: 'العلا وجهة رائعة! تبي تزور مدائن صالح والبلدة القديمة؟ خلني أرتب لك خطة كاملة مع أفضل الفنادق والمطاعم.',
      userMsg2: 'ايه ورتب لي 3 أيام',
      botMsg2: 'تمام! جهزت لك خطة 3 أيام تشمل مدائن صالح، جبل الفيل، البلدة القديمة، مع 5 فنادق قريبة وأفضل المطاعم المحلية.'
    },
    // Features
    features: {
      label: 'المميزات',
      title: 'كل ما تحتاجه',
      titleHighlight: 'لرحلة مثالية',
      description: 'من التخطيط الذكي إلى الحجز الفوري، هاسيو يجلب لك تجربة سفر متكاملة في الأحساء.',
      items: [
        {
          number: '01',
          title: 'مخطط رحلات ذكي',
          description: 'صف وجهتك واهتماماتك بالعربية أو الإنجليزية. الذكاء الاصطناعي يخطط لك رحلة كاملة مع جدول يومي مفصل.'
        },
        {
          number: '02',
          title: 'فنادق وإقامة',
          description: 'اعثر على أفضل الفنادق والشاليهات والمنتجعات في الأحساء. فلتر حسب السعر، التقييم، والموقع.'
        },
        {
          number: '03',
          title: 'مطاعم',
          description: 'اكتشف أفضل المطاعم والمقاهي القريبة مع عرض خريطة تفاعلية. شاهد التقييمات والقوائم ومعلومات الاتصال.'
        },
        {
          number: '04',
          title: 'حجوزات',
          description: 'احجز فنادق ومطاعم وأنشطة سياحية عبر الإنترنت مع التوفر في الوقت الفعلي. استلم التأكيدات فوراً.'
        },
        {
          number: '05',
          title: 'معالم سياحية',
          description: 'استكشف المعالم والوجهات السياحية في الأحساء. من المواقع التاريخية إلى المغامرات الطبيعية.'
        },
        {
          number: '06',
          title: 'البحث الذكي',
          description: 'بحث قوي يفهم ما تحتاجه. اعثر على الفنادق، المطاعم، أو الأنشطة السياحية فوراً.'
        }
      ]
    },
    // How It Works
    howItWorks: {
      label: 'كيف يعمل',
      title: 'خطط رحلتك في',
      titleHighlight: 'أربع خطوات بسيطة',
      description: 'من اختيار الوجهة إلى الحجز، هاسيو يرشدك في كل خطوة من رحلتك.',
      steps: [
        { number: 1, title: 'اختر وجهتك', description: 'أخبر هاسيو وين تبي تروح واهتماماتك' },
        { number: 2, title: 'خطة ذكية', description: 'احصل على خطة رحلة مفصلة بالذكاء الاصطناعي' },
        { number: 3, title: 'اكتشف الخيارات', description: 'تصفح الفنادق والمطاعم والأنشطة القريبة' },
        { number: 4, title: 'احجز وانطلق', description: 'أكد حجوزاتك وابدأ مغامرتك' }
      ]
    },
    // Services
    services: {
      label: 'الخدمات',
      title: 'اكتشف',
      titleHighlight: 'خدماتنا الأساسية',
      description: 'أدوات سفر شاملة مصممة خصيصاً لاستكشاف الأحساء.',
      directory: {
        title: 'دليل الفنادق والمنتجعات',
        description: 'اعثر على الإقامة المثالية في أي مكان بالأحساء مع دليلنا الشامل.',
        features: [
          'عرض خريطة تفاعلية لجميع المواقع',
          'فلتر حسب السعر والتقييم والمرافق',
          'تقييمات وآراء حقيقية من المسافرين',
          'حجز مباشر وتأكيد فوري'
        ]
      },
      booking: {
        title: 'حجز الرحلات والأنشطة',
        description: 'احجز أنشطة سياحية وجولات ومغامرات في شبكتنا فوراً عبر الإنترنت.',
        features: [
          'تقويم التوفر في الوقت الفعلي',
          'تأكيد فوري عبر البريد والرسائل',
          'خيارات إلغاء وتعديل مرنة',
          'بدون رسوم حجز إضافية'
        ]
      },
      attractions: {
        title: 'المعالم السياحية',
        description: 'اكتشف أجمل المعالم والوجهات السياحية في الأحساء من تاريخ وثقافة وطبيعة.',
        features: [
          'دليل شامل لكل منطقة',
          'صور ومعلومات تفصيلية',
          'مسارات سياحية مقترحة',
          'نصائح من مسافرين محليين'
        ],
        cardHolder: 'المسافر',
        validThru: 'صالحة حتى'
      },
      search: {
        title: 'البحث الذكي',
        description: 'اعثر على ما تحتاجه بالضبط مع بحثنا الذكي الذي يفهم اللغة الطبيعية.',
        features: [
          'البحث بالعربية أو الإنجليزية',
          'اقتراحات الإكمال التلقائي',
          'فلتر حسب المسافة، السعر، التقييم',
          'حفظ الوجهات المفضلة'
        ],
        recentSearches: 'عمليات البحث الأخيرة:'
      }
    },
    // CTA
    cta: {
      title: 'كن من أوائل المستخدمين',
      titleHighlight: 'لهاسيو',
      description: 'نعمل على بناء أفضل منصة سفر لاستكشاف الأحساء. سجّل الآن لتكون من أوائل من يجرب هاسيو عند الإطلاق.',
      btnPrimary: 'سجّل للإطلاق المبكر',
      btnSecondary: 'تواصل معنا'
    },
    // Footer
    footer: {
      description: 'نجعل السفر واستكشاف الأحساء أسهل. حلول سفر مدعومة بالذكاء الاصطناعي في متناول يدك.',
      phone: '+966 55 244 2119',
      product: {
        title: 'المنتج',
        links: ['مخطط الرحلات الذكي', 'استكشف الوجهات', 'حجز الفنادق', 'المعالم السياحية']
      },
      company: {
        title: 'الشركة',
        links: ['من نحن', 'الوظائف', 'الصحافة', 'الشركاء']
      },
      support: {
        title: 'الدعم',
        links: ['مركز المساعدة', 'تواصل معنا', 'للفنادق', 'للمطاعم']
      },
      bottom: {
        quote: '"السفر يُعلّمك أكثر مما تُعلّمك أي مدرسة" — الأحساء، واحة التاريخ والحضارة',
        privacy: 'سياسة الخصوصية',
        terms: 'شروط الخدمة',
        cookies: 'سياسة ملفات تعريف الارتباط'
      }
    },
    earlyAccess: {
      badge: 'قريباً',
      title: 'تطبيق هاسيو',
      titleHighlight: 'على جوالك',
      description: 'نطلق تطبيق الجوال قريباً! سجّل بريدك الإلكتروني لتكون من أول المستخدمين وتحصل على وصول مبكر حصري.',
      placeholder: 'بريدك الإلكتروني',
      submit: 'سجّل الآن',
      submitting: 'جاري التسجيل...',
      success: 'تم التسجيل بنجاح! سنتواصل معك قريباً.',
      duplicate: 'بريدك مسجل بالفعل! سنتواصل معك قريباً.',
      error: 'حدث خطأ، يرجى المحاولة مرة أخرى.',
      features: ['وصول مبكر للتطبيق', 'عروض حصرية', 'تجربة بيتا'],
    }
  },
  en: {
    // Navigation
    nav: {
      features: 'Features',
      howItWorks: 'How it Works',
      services: 'Services',
      map: 'Explore',
      listings: 'Destinations',
      freelancers: 'Services',
      contact: 'Contact',
      getStarted: 'Get Started',
      langSwitch: 'عربي'
    },
    // Hero
    hero: {
      badge: 'Discover Al-Ahsa',
      title: 'Your Travel,',
      titleHighlight: 'Simplified',
      description: 'Hasio connects you with AI-powered trip planning, hotels, restaurants, and attractions — all in one platform designed to explore Al-Ahsa.',
      btnPrimary: 'Plan Your Trip Now',
      btnSecondary: 'Explore Destinations',
      stats: {
        destinations: 'Destinations',
        regions: 'Regions',
        support: 'AI Support'
      }
    },
    // Chat Demo
    chat: {
      assistant: 'Hasio Assistant',
      online: 'Online now',
      userMsg1: 'What should I visit in Al-Ahsa?',
      botMsg1: 'Great choice! Al-Ahsa has amazing spots. Would you like to explore Al-Qarah caves or the historic Ibrahim Palace? Let me plan your trip.',
      userMsg2: 'Both! Plan me a 3-day trip',
      botMsg2: 'Done! I\'ve created a 3-day itinerary covering Al-Qarah caves, Ibrahim Palace, the Al-Ahsa Oasis, and Jawatha Mosque, with top-rated hotels and restaurants nearby.'
    },
    // Features
    features: {
      label: 'Features',
      title: 'Everything you need for',
      titleHighlight: 'the perfect trip',
      description: 'From AI-powered planning to instant booking, Hasio brings a complete travel experience across Al-Ahsa.',
      items: [
        {
          number: '01',
          title: 'AI Travel Planner',
          description: 'Describe your destination and interests in Arabic or English. Our AI plans a complete trip with a detailed daily itinerary.'
        },
        {
          number: '02',
          title: 'Hotels & Stays',
          description: 'Find the best hotels, chalets, and resorts across Al-Ahsa. Filter by price, rating, and location.'
        },
        {
          number: '03',
          title: 'Restaurants',
          description: 'Discover the best restaurants and cafes nearby with interactive map view. See ratings, menus, and contact information.'
        },
        {
          number: '04',
          title: 'Bookings',
          description: 'Book hotels, restaurants, and tourist activities online with real-time availability. Receive instant confirmations.'
        },
        {
          number: '05',
          title: 'Attractions',
          description: 'Explore landmarks and tourist destinations across Al-Ahsa. From historical sites to natural adventures.'
        },
        {
          number: '06',
          title: 'Smart Search',
          description: 'Powerful search that understands what you need. Find hotels, restaurants, or tourist activities instantly.'
        }
      ]
    },
    // How It Works
    howItWorks: {
      label: 'How It Works',
      title: 'Plan your trip in',
      titleHighlight: 'four simple steps',
      description: 'From choosing your destination to booking, Hasio guides you through every step of your journey.',
      steps: [
        { number: 1, title: 'Choose Destination', description: 'Tell Hasio where you want to go and your interests' },
        { number: 2, title: 'AI Planning', description: 'Get a detailed trip plan powered by AI' },
        { number: 3, title: 'Discover Options', description: 'Browse hotels, restaurants, and activities nearby' },
        { number: 4, title: 'Book & Go', description: 'Confirm your bookings and start your adventure' }
      ]
    },
    // Services
    services: {
      label: 'Services',
      title: 'Explore our',
      titleHighlight: 'core services',
      description: 'Comprehensive travel tools designed specifically for exploring Al-Ahsa.',
      directory: {
        title: 'Hotels & Resorts Directory',
        description: 'Find the perfect stay anywhere in Al-Ahsa with our comprehensive directory.',
        features: [
          'Interactive map view of all locations',
          'Filter by price, rating, and amenities',
          'Real traveler reviews and ratings',
          'Direct booking with instant confirmation'
        ]
      },
      booking: {
        title: 'Trip & Activity Booking',
        description: 'Book tourist activities, tours, and adventures in our network instantly online.',
        features: [
          'Real-time availability calendar',
          'Instant email and SMS confirmation',
          'Flexible cancellation and modification',
          'No extra booking fees'
        ]
      },
      attractions: {
        title: 'Tourist Attractions',
        description: 'Discover the most beautiful landmarks and destinations across Al-Ahsa — history, culture, and nature.',
        features: [
          'Comprehensive guide for each region',
          'Photos and detailed information',
          'Suggested tourist itineraries',
          'Tips from local travelers'
        ],
        cardHolder: 'Traveler',
        validThru: 'Valid Thru'
      },
      search: {
        title: 'Smart Search',
        description: 'Find exactly what you need with our intelligent search that understands natural language.',
        features: [
          'Search in Arabic or English',
          'Auto-complete suggestions',
          'Filter by distance, price, rating',
          'Save favorite destinations'
        ],
        recentSearches: 'Recent searches:'
      }
    },
    // CTA
    cta: {
      title: 'Be among the first to use',
      titleHighlight: 'Hasio',
      description: 'We are building the best travel platform for exploring Al-Ahsa. Sign up now to be among the first to try Hasio at launch.',
      btnPrimary: 'Sign Up for Early Access',
      btnSecondary: 'Contact Us'
    },
    // Footer
    footer: {
      description: 'Making travel and exploring Al-Ahsa easier. AI-powered travel solutions at your fingertips.',
      phone: '+966 55 244 2119',
      product: {
        title: 'Product',
        links: ['AI Travel Planner', 'Explore Destinations', 'Book Hotels', 'Attractions']
      },
      company: {
        title: 'Company',
        links: ['About Us', 'Careers', 'Press', 'Partners']
      },
      support: {
        title: 'Support',
        links: ['Help Center', 'Contact Us', 'For Hotels', 'For Restaurants']
      },
      bottom: {
        quote: '"Travel teaches you more than any school ever could" — Al-Ahsa, oasis of history and civilization',
        privacy: 'Privacy Policy',
        terms: 'Terms of Service',
        cookies: 'Cookie Policy'
      }
    },
    earlyAccess: {
      badge: 'Coming Soon',
      title: 'Hasio App',
      titleHighlight: 'on Your Phone',
      description: 'We\'re launching the mobile app soon! Enter your email to get early access and be part of the first beta users.',
      placeholder: 'Your email address',
      submit: 'Sign Up',
      submitting: 'Signing up...',
      success: 'You\'re in! We\'ll reach out soon.',
      duplicate: 'You\'re already signed up! We\'ll reach out soon.',
      error: 'Something went wrong, please try again.',
      features: ['Early app access', 'Exclusive offers', 'Beta experience'],
    }
  }
}

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
}

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

function App() {
  const [lang, setLang] = useState(() => localStorage.getItem('hasio_lang') || 'ar')
  const [scrolled, setScrolled] = useState(false)
  const [chatStep, setChatStep] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showTravelPlanner, setShowTravelPlanner] = useState(false)
  const [showMobileChat, setShowMobileChat] = useState(false)
  const [earlyEmail, setEarlyEmail] = useState('')
  const [earlyStatus, setEarlyStatus] = useState(null) // null | 'submitting' | 'success' | 'duplicate' | 'error'
  const captureEmail = hasConvex ? useMutation(api.emailCaptures.mutations.captureEmail) : null

  const session = hasConvex ? authClient.useSession() : { data: null }
  const isLoggedIn = !!session?.data
  const t = translations[lang]
  const isRTL = lang === 'ar'

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
  }, [lang, isRTL])

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Animate chat demo
  useEffect(() => {
    const timer = setInterval(() => {
      setChatStep(prev => (prev < 3 ? prev + 1 : 0))
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const toggleLang = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar')
  }

  return (
    <div className={`app ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="grid-bg" />
      {/* Header */}
      <header className={`header ${scrolled ? 'scrolled' : ''}`}>
        <div className="container header-inner">
          <a href="#" className="logo">
            <div className="logo-circle">
              <img src="/logo.png" alt="Hasio" />
            </div>
            <span className="logo-text">Hasio</span>
          </a>
          <nav className="nav">
            <ul className="nav-links">
              <li><a href="#features" className="nav-link">{t.nav.features}</a></li>
              <li><a href="#how-it-works" className="nav-link">{t.nav.howItWorks}</a></li>
              <li><a href="#services" className="nav-link">{t.nav.services}</a></li>
              <li><Link to="/explore" className="nav-link">{t.nav.map}</Link></li>
              <li><Link to="/listings" className="nav-link">{t.nav.listings}</Link></li>
              <li><Link to="/services" className="nav-link">{t.nav.freelancers}</Link></li>
              <li><a href="#contact" className="nav-link">{t.nav.contact}</a></li>
            </ul>
            <button onClick={toggleLang} className="btn btn-lang">
              {t.nav.langSwitch}
            </button>
            <Suspense fallback={null}><AuthButtons lang={lang} /></Suspense>
          </nav>
          <div className="mobile-actions">
            <button onClick={toggleLang} className="btn btn-lang btn-lang-mobile">
              {t.nav.langSwitch}
            </button>
            <button
              className={`mobile-menu-btn ${mobileMenuOpen ? 'active' : ''}`}
              aria-label="Menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <motion.div
            className="mobile-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <ul className="mobile-nav-links">
              <li><a href="#features" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t.nav.features}</a></li>
              <li><a href="#how-it-works" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t.nav.howItWorks}</a></li>
              <li><a href="#services" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t.nav.services}</a></li>
              <li><Link to="/explore" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t.nav.map}</Link></li>
              <li><Link to="/listings" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t.nav.listings}</Link></li>
              <li><Link to="/services" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t.nav.freelancers}</Link></li>
              <li><a href="#contact" className="mobile-nav-link" onClick={() => setMobileMenuOpen(false)}>{t.nav.contact}</a></li>
            </ul>
            <a href="#" className="btn btn-primary mobile-cta" onClick={() => setMobileMenuOpen(false)}>{t.nav.getStarted}</a>
          </motion.div>
        )}
      </header>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="container hero-content">
          <motion.div
            className="hero-text"
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.span className="hero-badge" variants={fadeInUp}>
              {t.hero.badge}
            </motion.span>
            <motion.h1 className="hero-title" variants={fadeInUp}>
              {t.hero.title} <em>{t.hero.titleHighlight}</em>
            </motion.h1>
            <motion.p className="hero-description" variants={fadeInUp}>
              {t.hero.description}
            </motion.p>
            <motion.div className="hero-buttons" variants={fadeInUp}>
              <button onClick={() => setShowTravelPlanner(true)} className="btn btn-primary btn-large">{t.hero.btnPrimary}</button>
              <Link to="/explore" className="btn btn-outline btn-large">{t.hero.btnSecondary}</Link>
            </motion.div>
            <motion.div className="hero-stats" variants={fadeInUp}>
              <div className="stat-item">
                <h4>+500</h4>
                <p>{t.hero.stats.destinations}</p>
              </div>
              <div className="stat-item">
                <h4>13</h4>
                <p>{t.hero.stats.regions}</p>
              </div>
              <div className="stat-item">
                <h4>24/7</h4>
                <p>{t.hero.stats.support}</p>
              </div>
            </motion.div>
          </motion.div>

          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, x: isRTL ? -50 : 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="hero-card">
              <div className="chat-header">
                <div className="chat-avatar">
                  <img src="/logo.png" alt="Hasio" />
                </div>
                <div className="chat-info">
                  <h4>{t.chat.assistant}</h4>
                  <p>{t.chat.online}</p>
                </div>
              </div>
              <div className="chat-messages">
                <motion.div
                  className="message message-user"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: chatStep >= 0 ? 1 : 0, y: 0 }}
                >
                  {t.chat.userMsg1}
                </motion.div>
                {chatStep >= 1 && (
                  <motion.div
                    className="message message-bot"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {t.chat.botMsg1}
                  </motion.div>
                )}
                {chatStep >= 2 && (
                  <motion.div
                    className="message message-user"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {t.chat.userMsg2}
                  </motion.div>
                )}
                {chatStep >= 3 && (
                  <motion.div
                    className="message message-bot"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {t.chat.botMsg2}
                  </motion.div>
                )}
                {chatStep < 1 && (
                  <div className="typing-indicator">
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                    <span className="typing-dot"></span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="container">
          <motion.div
            className="section-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="section-label">{t.features.label}</span>
            <h2 className="section-title">{t.features.title} <em>{t.features.titleHighlight}</em></h2>
            <p className="section-description">{t.features.description}</p>
          </motion.div>

          <motion.div
            className="features-grid"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {t.features.items.map((feature, index) => (
              <motion.div
                key={index}
                className="feature-card"
                variants={fadeInUp}
              >
                <div className="feature-number">{feature.number}</div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-description">{feature.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works" id="how-it-works">
        <div className="container">
          <motion.div
            className="section-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="section-label">{t.howItWorks.label}</span>
            <h2 className="section-title">{t.howItWorks.title} <em>{t.howItWorks.titleHighlight}</em></h2>
            <p className="section-description">{t.howItWorks.description}</p>
          </motion.div>

          <motion.div
            className="steps-container"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {t.howItWorks.steps.map((step, index) => (
              <motion.div key={index} className="step-card" variants={fadeInUp}>
                <div className="step-number">{step.number}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Services */}
      <section className="services" id="services">
        <div className="container">
          <motion.div
            className="section-header"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeInUp}
          >
            <span className="section-label">{t.services.label}</span>
            <h2 className="section-title">{t.services.title} <em>{t.services.titleHighlight}</em></h2>
            <p className="section-description">{t.services.description}</p>
          </motion.div>

          <div className="services-grid">
            {/* Hotels & Resorts Directory */}
            <motion.div
              className="service-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <div className="service-content">
                <h3>{t.services.directory.title}</h3>
                <p>{t.services.directory.description}</p>
                <ul className="service-features">
                  {t.services.directory.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
              <div className="service-visual">
                <div className="map-preview">
                  <div className="map-pin pin-1"></div>
                  <div className="map-pin pin-2"></div>
                  <div className="map-pin pin-3"></div>
                </div>
              </div>
            </motion.div>

            {/* Trip & Activity Booking */}
            <motion.div
              className="service-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
            >
              <div className="service-content">
                <h3>{t.services.booking.title}</h3>
                <p>{t.services.booking.description}</p>
                <ul className="service-features">
                  {t.services.booking.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
              <div className="service-visual">
                <div className="calendar-preview">
                  {[...Array(28)].map((_, i) => (
                    <div
                      key={i}
                      className={`calendar-day ${i === 14 ? 'active' : ''} ${[5, 8, 12, 18, 22, 25].includes(i) ? 'available' : ''}`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Tourist Attractions */}
            <motion.div
              className="service-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
            >
              <div className="service-content">
                <h3>{t.services.attractions.title}</h3>
                <p>{t.services.attractions.description}</p>
                <ul className="service-features">
                  {t.services.attractions.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
              <div className="service-visual">
                <div className="health-card-preview">
                  <div className="card-header">
                    <span className="card-brand">{isRTL ? 'هاسيو للسفر' : 'Hasio Travel'}</span>
                    <div className="card-chip"></div>
                  </div>
                  <div className="card-number">{isRTL ? 'بطاقة المسافر' : 'Traveler Pass'}</div>
                  <div className="card-info">
                    <div className="card-info-item">
                      <label>{t.services.attractions.cardHolder}</label>
                      <span>{isRTL ? 'محمد العتيبي' : 'Mohammed Al-Otaibi'}</span>
                    </div>
                    <div className="card-info-item">
                      <label>{t.services.attractions.validThru}</label>
                      <span>12/28</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Smart Search */}
            <motion.div
              className="service-card"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
            >
              <div className="service-content">
                <h3>{t.services.search.title}</h3>
                <p>{t.services.search.description}</p>
                <ul className="service-features">
                  {t.services.search.features.map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
              </div>
              <div className="service-visual">
                <div className="search-preview">
                  <div className="search-input">
                    {isRTL ? 'فنادق في العلا قريبة من مدائن صالح' : 'Hotels in AlUla near Hegra'}
                  </div>
                  <div className="search-label">
                    {t.services.search.recentSearches}
                  </div>
                  <div className="search-item">
                    {isRTL ? 'مطاعم في جدة البلد' : 'Restaurants in Jeddah Al-Balad'}
                  </div>
                  <div className="search-item">
                    {isRTL ? 'أنشطة مغامرات في نيوم' : 'Adventure activities in NEOM'}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Early Access Email Capture */}
      <section className="early-access" id="early-access">
        <div className="container">
          <motion.div
            className="early-access-card"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.span className="early-access-badge" variants={fadeInUp}>
              {t.earlyAccess.badge}
            </motion.span>
            <motion.h2 className="early-access-title" variants={fadeInUp}>
              {t.earlyAccess.title} <em>{t.earlyAccess.titleHighlight}</em>
            </motion.h2>
            <motion.p className="early-access-description" variants={fadeInUp}>
              {t.earlyAccess.description}
            </motion.p>

            <motion.div className="early-access-features" variants={fadeInUp}>
              {t.earlyAccess.features.map((f, i) => (
                <span key={i} className="early-access-feature">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  {f}
                </span>
              ))}
            </motion.div>

            <motion.form
              className="early-access-form"
              variants={fadeInUp}
              onSubmit={async (e) => {
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
              }}
            >
              {earlyStatus === 'success' || earlyStatus === 'duplicate' ? (
                <div className="early-access-success">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0D7A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>{earlyStatus === 'duplicate' ? t.earlyAccess.duplicate : t.earlyAccess.success}</span>
                </div>
              ) : (
                <>
                  <input
                    type="email"
                    required
                    value={earlyEmail}
                    onChange={(e) => { setEarlyEmail(e.target.value); setEarlyStatus(null) }}
                    placeholder={t.earlyAccess.placeholder}
                    className="early-access-input"
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-large early-access-btn"
                    disabled={earlyStatus === 'submitting'}
                  >
                    {earlyStatus === 'submitting' ? t.earlyAccess.submitting : t.earlyAccess.submit}
                  </button>
                </>
              )}
            </motion.form>
            {earlyStatus === 'error' && (
              <p className="early-access-error">{t.earlyAccess.error}</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta" id="contact">
        <div className="container">
          <motion.div
            className="cta-content"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.h2 className="cta-title" variants={fadeInUp}>
              {t.cta.title} <em>{t.cta.titleHighlight}</em>
            </motion.h2>
            <motion.p className="cta-description" variants={fadeInUp}>
              {t.cta.description}
            </motion.p>
            <motion.div className="cta-buttons" variants={fadeInUp}>
              <a href="#" className="btn btn-white btn-large">{t.cta.btnPrimary}</a>
              <a href="#" className="btn btn-outline-white btn-large">{t.cta.btnSecondary}</a>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand">
              <a href="#" className="logo">
                <div className="logo-circle">
                  <img src="/logo.png" alt="Hasio" />
                </div>
                <span className="logo-text">Hasio</span>
              </a>
              <p>{t.footer.description}</p>
              <a href={`tel:${t.footer.phone}`} className="footer-phone" dir="ltr">
                {t.footer.phone}
              </a>
            </div>
            <div className="footer-column">
              <h4>{t.footer.product.title}</h4>
              <ul className="footer-links">
                {t.footer.product.links.map((link, i) => (
                  <li key={i}><a href="#">{link}</a></li>
                ))}
              </ul>
            </div>
            <div className="footer-column">
              <h4>{t.footer.company.title}</h4>
              <ul className="footer-links">
                {t.footer.company.links.map((link, i) => (
                  <li key={i}><a href="#">{link}</a></li>
                ))}
              </ul>
            </div>
            <div className="footer-column">
              <h4>{t.footer.support.title}</h4>
              <ul className="footer-links">
                {t.footer.support.links.map((link, i) => (
                  <li key={i}><a href="#">{link}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p className="footer-hadith">{t.footer.bottom.quote}</p>
            <div className="footer-legal">
              <a href="/privacy-policy.html">{t.footer.bottom.privacy}</a>
              <a href="/terms-of-service.html">{t.footer.bottom.terms}</a>
              <a href="/privacy-policy.html">{t.footer.bottom.cookies}</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Chat Widget (hidden on mobile - triggered from bottom nav) */}
      <div className="chat-widget-desktop">
        <Suspense fallback={null}><ChatWidget lang={lang} /></Suspense>
      </div>

      {/* Travel Planner Modal */}
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

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <Link to="/listings" className="mobile-bottom-nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span>{t.nav.listings}</span>
        </Link>
        <Link to="/services" className="mobile-bottom-nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>{t.nav.freelancers}</span>
        </Link>
        <Link to="/home" className="mobile-bottom-nav-item mobile-bottom-nav-home">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <span>{lang === 'ar' ? 'الرئيسية' : 'Home'}</span>
        </Link>
        <button className="mobile-bottom-nav-item" onClick={() => setShowMobileChat(!showMobileChat)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>{lang === 'ar' ? 'المحادثة' : 'Chat'}</span>
        </button>
        <Link to={isLoggedIn ? '/dashboard' : '/sign-in'} className="mobile-bottom-nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>{lang === 'ar' ? 'حسابي' : 'Profile'}</span>
        </Link>
      </nav>

      {/* Mobile Chat Panel */}
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
                <div style={{ width: 32, height: 32, background: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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
                <TravelPlanner lang={lang} onBookListing={(data) => { console.log('Book:', data); setShowMobileChat(false) }} />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
