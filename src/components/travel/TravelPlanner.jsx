import { useState, useRef, useEffect } from 'react'
import { useAction, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'
import './TravelPlanner.css'

const translations = {
  ar: {
    title: 'مخطط الرحلات بالذكاء الاصطناعي',
    placeholder: 'أخبرني عن رحلتك المثالية في السعودية...',
    send: 'إرسال',
    sending: 'جاري الإرسال...',
    destinations: 'الوجهات المقترحة',
    itinerary: 'برنامج الرحلة',
    travelTips: 'نصائح السفر',
    budget: 'الميزانية التقديرية',
    bookNow: 'احجز الآن',
    saveAsTrip: 'حفظ كرحلة',
    tripSaved: 'تم حفظ الرحلة!',
    tripTitle: 'عنوان الرحلة',
    tripTitlePlaceholder: 'مثال: رحلة الرياض',
    save: 'حفظ',
    cancel: 'إلغاء',
    newConversation: 'محادثة جديدة',
    error: 'حدث خطأ. يرجى المحاولة مرة أخرى.',
    greeting: 'مرحباً! أنا مساعد هاسيو للسفر. كيف يمكنني مساعدتك اليوم؟ أخبرني عن وجهتك المفضلة في السعودية وسأساعدك في التخطيط.',
    day: 'يوم',
    sar: 'ر.س',
  },
  en: {
    title: 'AI Travel Planner',
    placeholder: 'Tell me about your ideal trip in Saudi Arabia...',
    send: 'Send',
    sending: 'Sending...',
    destinations: 'Suggested Destinations',
    itinerary: 'Itinerary',
    travelTips: 'Travel Tips',
    budget: 'Estimated Budget',
    bookNow: 'Book Now',
    saveAsTrip: 'Save as Trip',
    tripSaved: 'Trip saved!',
    tripTitle: 'Trip title',
    tripTitlePlaceholder: 'e.g. Riyadh Weekend',
    save: 'Save',
    cancel: 'Cancel',
    newConversation: 'New Conversation',
    error: 'An error occurred. Please try again.',
    greeting: "Hello! I'm Hasio's travel assistant. How can I help you today? Tell me about your preferred destination in Saudi Arabia and I'll help you plan.",
    day: 'Day',
    sar: 'SAR',
  }
}

export default function TravelPlanner({ lang = 'ar', onBookListing }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [conversationHistory, setConversationHistory] = useState([])
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [planId, setPlanId] = useState(null)
  const [showSaveTrip, setShowSaveTrip] = useState(false)
  const [tripTitle, setTripTitle] = useState('')
  const [tripSaved, setTripSaved] = useState(false)
  const [savingTrip, setSavingTrip] = useState(false)
  const messagesEndRef = useRef(null)

  const planTrip = useAction(api.travelPlanner.actions.planTravel)
  const storePlan = useMutation(api.travelPlanner.mutations.storePlan)
  const convertPlan = useMutation(api.trips.mutations.convertPlanToTrip)
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ role: 'assistant', content: t.greeting }])
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage = input.trim()
    setInput('')
    setError(null)

    setMessages(prev => [...prev, { role: 'user', content: userMessage }])

    const newHistory = [...conversationHistory, { role: 'user', content: userMessage }]

    setLoading(true)

    try {
      const result = await planTrip({
        userInput: userMessage,
        language: lang,
        conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined
      })

      if (result.success) {
        if (result.ready && result.plan) {
          setPlan(result.plan)
          // Store the plan and save the ID for "Save as Trip"
          try {
            const storedPlanId = await storePlan({
              userInput: userMessage,
              language: lang,
              plan: result.plan,
            })
            setPlanId(storedPlanId)
          } catch (e) {
            console.error('Failed to store plan:', e)
          }
          const destNames = result.plan.suggestedDestinations
            ? result.plan.suggestedDestinations.map(d => typeof d === 'string' ? d : (isRTL && d.name_ar ? d.name_ar : d.name))
            : []
          const summary = destNames.length > 0
            ? `${t.destinations}: ${destNames.join('، ')}`
            : (isRTL ? 'تم إعداد خطة رحلتك!' : 'Your travel plan is ready!')
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: summary,
            isPlan: true
          }])
        } else {
          const assistantMessage = isRTL && result.message_ar ? result.message_ar : result.message
          setMessages(prev => [...prev, { role: 'assistant', content: assistantMessage }])

          setConversationHistory([
            ...newHistory,
            { role: 'assistant', content: assistantMessage }
          ])
        }
      } else {
        setError(result.error || t.error)
        setMessages(prev => [...prev, { role: 'assistant', content: t.error, isError: true }])
      }
    } catch (err) {
      console.error('Planning error:', err)
      setError(t.error)
      setMessages(prev => [...prev, { role: 'assistant', content: t.error, isError: true }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    setMessages([{ role: 'assistant', content: t.greeting }])
    setConversationHistory([])
    setPlan(null)
    setError(null)
    setInput('')
    setPlanId(null)
    setShowSaveTrip(false)
    setTripTitle('')
    setTripSaved(false)
  }

  const handleBookListing = () => {
    if (onBookListing && plan) {
      onBookListing({
        destinations: plan.suggestedDestinations,
        budget: plan.estimatedBudget
      })
    }
  }

  return (
    <div className={`symptom-checker ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="symptom-checker-header">
        <h2 className="symptom-checker-title">{t.title}</h2>
        {(messages.length > 1 || plan) && (
          <button className="new-conversation-btn" onClick={handleNewConversation}>
            {t.newConversation}
          </button>
        )}
      </div>

      {/* Chat Messages */}
      <div className="chat-container">
        <div className="messages-list">
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                className={`message ${msg.role === 'user' ? 'message-user' : 'message-assistant'} ${msg.isError ? 'message-error' : ''}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                {msg.content}
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <motion.div
              className="message message-assistant"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Travel Plan Results */}
        <AnimatePresence>
          {plan && (
            <motion.div
              className="analysis-results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {/* Budget */}
              {(plan.estimatedBudget || plan.estimatedBudget_ar) && (
                <div className="urgency-card urgency-routine">
                  <h3>{t.budget}</h3>
                  <p>{isRTL && plan.estimatedBudget_ar ? plan.estimatedBudget_ar : plan.estimatedBudget}</p>
                </div>
              )}

              {/* Destinations */}
              {plan.suggestedDestinations && plan.suggestedDestinations.length > 0 && (
                <div className="result-card">
                  <h3>{t.destinations}</h3>
                  <ul className="conditions-list">
                    {plan.suggestedDestinations.map((dest, idx) => (
                      <li key={idx} className="condition-item">
                        <span className="condition-name">
                          {typeof dest === 'string' ? dest : (isRTL && dest.name_ar ? dest.name_ar : dest.name)}
                        </span>
                        {dest.description && (
                          <p className="condition-description">{dest.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Itinerary */}
              {plan.itinerary && (
                <div className="result-card">
                  <h3>{t.itinerary}</h3>
                  <p className="condition-description" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {plan.itinerary}
                  </p>
                </div>
              )}

              {/* Travel Tips */}
              {(plan.travelTips || plan.travelTips_ar) && (
                <div className="result-card">
                  <h3>{t.travelTips}</h3>
                  <p className="condition-description" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {isRTL && plan.travelTips_ar ? plan.travelTips_ar : plan.travelTips}
                  </p>
                </div>
              )}

              {/* Book & Save buttons */}
              <div className="result-card specialty-card" style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="book-btn" onClick={handleBookListing}>
                  {t.bookNow}
                </button>
                {planId && !tripSaved && (
                  <button
                    className="book-btn"
                    style={{ background: '#065F46' }}
                    onClick={() => setShowSaveTrip(true)}
                  >
                    {t.saveAsTrip}
                  </button>
                )}
                {tripSaved && (
                  <span style={{ color: '#0D7A5F', fontSize: '0.875rem', fontWeight: 600, alignSelf: 'center' }}>
                    {t.tripSaved}
                  </span>
                )}
              </div>

              {/* Save as Trip inline form */}
              {showSaveTrip && planId && (
                <div className="result-card" style={{ padding: '1rem' }}>
                  <input
                    type="text"
                    value={tripTitle}
                    onChange={(e) => setTripTitle(e.target.value)}
                    placeholder={t.tripTitlePlaceholder}
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem', fontSize: '0.875rem', marginBottom: '0.5rem', boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={async () => {
                        if (!tripTitle.trim() || savingTrip) return
                        setSavingTrip(true)
                        try {
                          await convertPlan({ planId, title: tripTitle.trim() })
                          setTripSaved(true)
                          setShowSaveTrip(false)
                        } catch (e) {
                          console.error('Convert plan error:', e)
                        } finally {
                          setSavingTrip(false)
                        }
                      }}
                      disabled={!tripTitle.trim() || savingTrip}
                      style={{
                        padding: '0.375rem 0.75rem', background: '#0D7A5F', color: '#fff',
                        border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem',
                        opacity: (!tripTitle.trim() || savingTrip) ? 0.5 : 1,
                      }}
                    >
                      {savingTrip ? '...' : t.save}
                    </button>
                    <button
                      onClick={() => setShowSaveTrip(false)}
                      style={{
                        padding: '0.375rem 0.75rem', background: '#e5e7eb', color: '#374151',
                        border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem',
                      }}
                    >
                      {t.cancel}
                    </button>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              {plan.disclaimer && (
                <div className="disclaimer">
                  {plan.disclaimer}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      {!plan && (
        <div className="input-container">
          <textarea
            className="symptom-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t.placeholder}
            rows={2}
            disabled={loading}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            {loading ? t.sending : t.send}
          </button>
        </div>
      )}
    </div>
  )
}
