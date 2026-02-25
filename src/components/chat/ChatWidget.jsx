import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TravelPlanner from '../travel/TravelPlanner'
import './ChatWidget.css'

const translations = {
  ar: {
    buttonText: 'خطط رحلتك الآن',
    close: 'إغلاق'
  },
  en: {
    buttonText: 'Plan Your Trip Now',
    close: 'Close'
  }
}

export default function ChatWidget({ lang = 'ar' }) {
  const [isOpen, setIsOpen] = useState(false)
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'

  const handleBookListing = (data) => {
    console.log('Book listing with:', data)
  }

  return (
    <div className={`chat-widget ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="chat-window"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="chat-window-header">
              <div className="chat-window-title">
                <div className="chat-avatar">
                  <img src="/logo.png" alt="Hasio" />
                </div>
                <div className="chat-title-text">
                  <span className="chat-name">Hasio</span>
                  <span className="chat-status">{isRTL ? 'متصل الآن' : 'Online'}</span>
                </div>
              </div>
              <button
                className="chat-close-btn"
                onClick={() => setIsOpen(false)}
                aria-label={t.close}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="chat-window-body">
              <TravelPlanner
                lang={lang}
                onBookListing={handleBookListing}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <motion.button
        className={`chat-fab ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ) : (
          <>
            <svg className="chat-fab-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            <span className="chat-fab-text">{t.buttonText}</span>
          </>
        )}
      </motion.button>
    </div>
  )
}
