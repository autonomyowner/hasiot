import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '../hooks/useLanguage'
import './OnboardingPage.css'

const translations = {
  en: {
    greeting: 'Welcome to Hasio',
    subtext: 'Your AI-powered travel companion for exploring Al-Ahsa. Discover hotels, restaurants, attractions, and plan the perfect trip.',
    selectLanguage: 'SELECT LANGUAGE',
    continueWithEmail: 'Continue with Email',
    skip: 'Skip and explore',
  },
  ar: {
    greeting: 'مرحباً بك في Hasio',
    subtext: 'رفيق سفرك الذكي لاستكشاف الأحساء. اكتشف الفنادق والمطاعم والمعالم السياحية وخطط لرحلة مثالية.',
    selectLanguage: 'اختر اللغة',
    continueWithEmail: 'المتابعة بالبريد الإلكتروني',
    skip: 'تخطي واستكشف',
  },
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  // useLanguage owns dir/lang on <html> and persists the choice, so the
  // language picked here carries through to the rest of the app.
  const { lang, setLang, isRtl: isRTL } = useLanguage()
  const [loaded, setLoaded] = useState(false)
  const t = translations[lang]

  useEffect(() => {
    setLoaded(true)
  }, [])

  const handleContinueWithEmail = () => {
    localStorage.setItem('hasio_onboarding_done', 'true')
    navigate('/sign-up')
  }

  const handleSkip = () => {
    localStorage.setItem('hasio_onboarding_done', 'true')
    navigate('/home')
  }

  return (
    <div className="onboarding">
      {/* Background */}
      <div className="onboarding-bg">
        {/* Falls back to a bundled asset — this is the first screen a new user
            sees, so it must not depend on an external bucket being reachable. */}
        <img
          src="https://pub-d7fc967a0d9e4e42bba0d712e4f9b96e.r2.dev/lodging/desert-camp-a2dc07bf.jpg"
          alt=""
          className="onboarding-bg-img"
          onError={(e) => {
            if (!e.target.dataset.fallback) {
              e.target.dataset.fallback = '1'
              e.target.src = '/hero.png'
            }
          }}
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
