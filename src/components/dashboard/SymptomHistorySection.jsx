import { useState } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

const translations = {
  ar: {
    title: 'سجل تحليل الأعراض',
    noAnalyses: 'لا توجد تحليلات سابقة',
    noAnalysesDesc: 'استخدم المحلل الذكي للأعراض من الصفحة الرئيسية',
    goHome: 'الذهاب للصفحة الرئيسية',
    symptoms: 'الأعراض',
    possibleConditions: 'الحالات المحتملة',
    recommendedSpecialty: 'التخصص الموصى به',
    urgency: 'مستوى الاستعجال',
    advice: 'النصيحة العامة',
    emergency: 'طوارئ',
    urgent: 'عاجل',
    routine: 'روتيني',
    self_care: 'عناية ذاتية',
    high: 'عالي',
    medium: 'متوسط',
    low: 'منخفض',
    showDetails: 'عرض التفاصيل',
    hideDetails: 'إخفاء التفاصيل',
  },
  en: {
    title: 'Symptom Analysis History',
    noAnalyses: 'No past analyses',
    noAnalysesDesc: 'Use the AI symptom checker from the home page',
    goHome: 'Go to Home Page',
    symptoms: 'Symptoms',
    possibleConditions: 'Possible Conditions',
    recommendedSpecialty: 'Recommended Specialty',
    urgency: 'Urgency Level',
    advice: 'General Advice',
    emergency: 'Emergency',
    urgent: 'Urgent',
    routine: 'Routine',
    self_care: 'Self Care',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    showDetails: 'Show Details',
    hideDetails: 'Hide Details',
  }
}

export default function SymptomHistorySection({ lang = 'ar' }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'
  const [expandedId, setExpandedId] = useState(null)

  const analyses = useQuery(api.symptoms.queries.getMyAnalyses, {})

  if (analyses === undefined) {
    return <div style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
      {isRTL ? 'جاري التحميل...' : 'Loading...'}
    </div>
  }

  const urgencyColor = (level) => {
    const colors = {
      emergency: '#DC2626',
      urgent: '#f59e0b',
      routine: '#3b82f6',
      self_care: '#10b981',
    }
    return colors[level] || '#6b7280'
  }

  const probabilityColor = (prob) => {
    if (prob === 'high') return '#DC2626'
    if (prob === 'medium') return '#f59e0b'
    return '#10b981'
  }

  return (
    <div>
      <h2 className="dashboard-section-title">{t.title}</h2>

      {analyses.length === 0 ? (
        <div className="empty-state">
          <ActivityEmptyIcon />
          <h3>{t.noAnalyses}</h3>
          <p>{t.noAnalysesDesc}</p>
          <a href="/" className="btn-primary" style={{ textDecoration: 'none' }}>
            {t.goHome}
          </a>
        </div>
      ) : (
        analyses.map(analysis => {
          const isExpanded = expandedId === analysis._id
          const urgency = analysis.analysis.urgencyLevel

          return (
            <div key={analysis._id} className={`dash-card analysis-card urgency-${urgency}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0 0 0.25rem' }}>
                    {new Date(analysis.createdAt).toLocaleDateString(isRTL ? 'ar-DZ' : 'en-US', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                    })}
                  </p>
                  <p style={{ fontSize: '0.9375rem', color: '#111827', margin: 0, fontWeight: 500 }}>
                    {analysis.symptoms.length > 100
                      ? analysis.symptoms.slice(0, 100) + '...'
                      : analysis.symptoms
                    }
                  </p>
                </div>
                <span
                  className="status-badge"
                  style={{ background: urgencyColor(urgency) + '20', color: urgencyColor(urgency), flexShrink: 0 }}
                >
                  {t[urgency] || urgency}
                </span>
              </div>

              <div style={{ marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                  {t.recommendedSpecialty}: {' '}
                </span>
                <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                  {isRTL && analysis.analysis.recommendedSpecialty_ar
                    ? analysis.analysis.recommendedSpecialty_ar
                    : analysis.analysis.recommendedSpecialty}
                </span>
              </div>

              <button
                className="btn-secondary"
                onClick={() => setExpandedId(isExpanded ? null : analysis._id)}
                style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
              >
                {isExpanded ? t.hideDetails : t.showDetails}
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
                      {/* Possible conditions */}
                      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
                        {t.possibleConditions}
                      </p>
                      {analysis.analysis.possibleConditions.map((condition, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.375rem 0', borderBottom: '1px solid #f9fafb' }}>
                          <span style={{ fontSize: '0.875rem', color: '#111827' }}>
                            {isRTL && condition.name_ar ? condition.name_ar : condition.name}
                          </span>
                          <span
                            className="tag"
                            style={{
                              background: probabilityColor(condition.probability) + '15',
                              color: probabilityColor(condition.probability)
                            }}
                          >
                            {t[condition.probability] || condition.probability}
                          </span>
                        </div>
                      ))}

                      {/* Advice */}
                      {(analysis.analysis.generalAdvice || analysis.analysis.generalAdvice_ar) && (
                        <div style={{ marginTop: '1rem' }}>
                          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
                            {t.advice}
                          </p>
                          <p style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
                            {isRTL && analysis.analysis.generalAdvice_ar
                              ? analysis.analysis.generalAdvice_ar
                              : analysis.analysis.generalAdvice}
                          </p>
                        </div>
                      )}

                      {/* Disclaimer */}
                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem', fontStyle: 'italic' }}>
                        {analysis.analysis.disclaimer}
                      </p>
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

function ActivityEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}
