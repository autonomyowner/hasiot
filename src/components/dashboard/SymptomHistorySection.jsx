import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

const translations = {
  ar: {
    title: 'خطط السفر السابقة',
    noPlans: 'لا توجد خطط سفر سابقة',
    noPlansDesc: 'استخدم مخطط الرحلات الذكي من الصفحة الرئيسية',
    goHome: 'الذهاب للصفحة الرئيسية',
    destinations: 'الوجهات المقترحة',
    itinerary: 'برنامج الرحلة',
    travelTips: 'نصائح السفر',
    budget: 'الميزانية التقديرية',
    day: 'يوم',
    showDetails: 'عرض التفاصيل',
    hideDetails: 'إخفاء التفاصيل',
    sar: 'ر.س',
  },
  en: {
    title: 'Travel Plan History',
    noPlans: 'No past travel plans',
    noPlansDesc: 'Use the AI travel planner from the home page',
    goHome: 'Go to Home Page',
    destinations: 'Suggested Destinations',
    itinerary: 'Itinerary',
    travelTips: 'Travel Tips',
    budget: 'Estimated Budget',
    day: 'Day',
    showDetails: 'Show Details',
    hideDetails: 'Hide Details',
    sar: 'SAR',
  }
}

export default function SymptomHistorySection({ lang = 'ar' }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'
  const [expandedId, setExpandedId] = useState(null)

  const plans = useQuery(api.travelPlanner.queries.getMyPlans, {})

  if (plans === undefined) {
    return <div style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
      {isRTL ? 'جاري التحميل...' : 'Loading...'}
    </div>
  }

  return (
    <div>
      <h2 className="dashboard-section-title">{t.title}</h2>

      {plans.length === 0 ? (
        <div className="empty-state">
          <MapEmptyIcon />
          <h3>{t.noPlans}</h3>
          <p>{t.noPlansDesc}</p>
          <a href="/" className="btn-primary" style={{ textDecoration: 'none' }}>
            {t.goHome}
          </a>
        </div>
      ) : (
        plans.map(plan => {
          const isExpanded = expandedId === plan._id
          const data = plan.plan

          return (
            <div key={plan._id} className="dash-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.25rem' }}>
                    {new Date(plan.createdAt).toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontWeight: 500 }}>
                    {plan.userInput.length > 100
                      ? plan.userInput.slice(0, 100) + '...'
                      : plan.userInput
                    }
                  </p>
                </div>
                {data?.estimatedBudget && (
                  <span
                    className="status-badge"
                    style={{ background: '#D1FAE520', color: '#0D7A5F', flexShrink: 0 }}
                  >
                    {data.estimatedBudget} {t.sar}
                  </span>
                )}
              </div>

              {/* Suggested Destinations preview */}
              {data?.suggestedDestinations && data.suggestedDestinations.length > 0 && (
                <div style={{ marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    {t.destinations}: {' '}
                  </span>
                  <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                    {data.suggestedDestinations.join('، ')}
                  </span>
                </div>
              )}

              <button
                className="btn-secondary"
                onClick={() => setExpandedId(isExpanded ? null : plan._id)}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
              >
                {isExpanded ? t.hideDetails : t.showDetails}
              </button>

              <AnimatePresence>
                {isExpanded && data && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
                      {/* Itinerary */}
                      {data.itinerary && data.itinerary.length > 0 && (
                        <>
                          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                            {t.itinerary}
                          </p>
                          {data.itinerary.map((item, i) => (
                            <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f9fafb' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0D7A5F' }}>
                                {t.day} {item.day || i + 1}:
                              </span>
                              <span style={{ fontSize: '0.875rem', color: '#111827', marginRight: '0.5rem', marginLeft: '0.5rem' }}>
                                {item.activity || item.description}
                              </span>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Travel Tips */}
                      {data.travelTips && data.travelTips.length > 0 && (
                        <div style={{ marginTop: '1rem' }}>
                          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
                            {t.travelTips}
                          </p>
                          <ul style={{ margin: 0, paddingRight: isRTL ? '1.25rem' : 0, paddingLeft: isRTL ? 0 : '1.25rem' }}>
                            {data.travelTips.map((tip, i) => (
                              <li key={i} style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>
                                {tip}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Disclaimer */}
                      {data.disclaimer && (
                        <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem', fontStyle: 'italic' }}>
                          {data.disclaimer}
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })
      )}
    </div>
  )
}

function MapEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
      <line x1="8" y1="2" x2="8" y2="18" />
      <line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  )
}
