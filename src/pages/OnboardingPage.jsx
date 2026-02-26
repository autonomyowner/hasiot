import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import './OnboardingPage.css'

const translations = {
  en: {
    greeting: 'Welcome to Hasio',
    subtext: 'Your AI-powered travel companion for exploring Saudi Arabia. Discover hotels, restaurants, attractions, and plan the perfect trip.',
    selectLanguage: 'SELECT LANGUAGE',
    continueWithEmail: 'Continue with Email',
    skip: 'Skip and explore',
  },
  ar: {
    greeting: 'مرحباً بك في Hasio',
    subtext: 'رفيق سفرك الذكي لاستكشاف المملكة العربية السعودية. اكتشف الفنادق والمطاعم والمعالم السياحية وخطط لرحلة مثالية.',
    selectLanguage: 'اختر اللغة',
    continueWithEmail: 'المتابعة بالبريد الإلكتروني',
    skip: 'تخطي واستكشف',
  },
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [lang, setLang] = useState('ar')
  const [loaded, setLoaded] = useState(false)
  const t = translations[lang]
  const isRTL = lang === 'ar'

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'
    document.documentElement.lang = lang
    setLoaded(true)
  }, [lang, isRTL])

  const handleContinueWithEmail = () => {
    localStorage.setItem('hasio_onboarding_done', 'true')
    localStorage.setItem('hasio_lang', lang)
    navigate('/sign-up')
  }

  const handleSkip = () => {
    localStorage.setItem('hasio_onboarding_done', 'true')
    localStorage.setItem('hasio_lang', lang)
    navigate('/home')
  }

  return (
    <div className="onboarding">
      {/* Background */}
      <div className="onboarding-bg">
        <img
          src="https://pub-d7fc967a0d9e4e42bba0d712e4f9b96e.r2.dev/lodging/desert-camp-a2dc07bf.jpg"
          alt=""
          className="onboarding-bg-img"
        />
        <div className="onboarding-overlay" />
      </div>

      {/* Content */}
      <AnimatePresence>
        {loaded && (
          <div className={`onboarding-content ${isRTL ? 'rtl' : 'ltr'}`}>
            {/* Logo */}
            <motion.div
              className="onboarding-logo"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="onboarding-logo-text">Hasio</span>
            </motion.div>

            {/* Hero text */}
            <motion.div
              className="onboarding-hero"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="onboarding-greeting">{t.greeting}</h1>
              <p className="onboarding-subtext">{t.subtext}</p>
            </motion.div>

            {/* Language picker */}
            <motion.div
              className="onboarding-lang-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <span className="onboarding-lang-label">{t.selectLanguage}</span>
              <div className="onboarding-lang-buttons">
                <button
                  className={`onboarding-lang-btn ${lang === 'en' ? 'active' : ''}`}
                  onClick={() => setLang('en')}
                >
                  English
                </button>
                <button
                  className={`onboarding-lang-btn ${lang === 'ar' ? 'active' : ''}`}
                  onClick={() => setLang('ar')}
                >
                  العربية
                </button>
              </div>
            </motion.div>

            {/* Actions */}
            <motion.div
              className="onboarding-actions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <button
                className="onboarding-btn-primary"
                onClick={handleContinueWithEmail}
              >
                {t.continueWithEmail}
              </button>
              <button
                className="onboarding-btn-skip"
                onClick={handleSkip}
              >
                {t.skip}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
