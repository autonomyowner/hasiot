import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'
import BookingForm from '../appointments/BookingForm'

const translations = {
  ar: {
    title: 'الحجوزات',
    upcoming: 'الحجوزات القادمة',
    past: 'الحجوزات السابقة',
    bookNew: 'حجز جديد',
    noUpcoming: 'لا توجد حجوزات قادمة',
    noPast: 'لا توجد حجوزات سابقة',
    bookFirst: 'احجز أول تجربة لك في السعودية',
    cancel: 'إلغاء',
    cancelConfirm: 'هل تريد إلغاء هذا الحجز؟',
    cancelling: 'جاري الإلغاء...',
    cancelled: 'تم الإلغاء',
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    no_show: 'لم يحضر',
    showPast: 'عرض الحجوزات السابقة',
    hidePast: 'إخفاء الحجوزات السابقة',
    reservation: 'حجز',
    tour_booking: 'جولة سياحية',
    event_ticket: 'تذكرة فعالية',
    guests: 'ضيوف',
  },
  en: {
    title: 'Bookings',
    upcoming: 'Upcoming Bookings',
    past: 'Past Bookings',
    bookNew: 'New Booking',
    noUpcoming: 'No upcoming bookings',
    noPast: 'No past bookings',
    bookFirst: 'Book your first experience in Saudi Arabia',
    cancel: 'Cancel',
    cancelConfirm: 'Are you sure you want to cancel this booking?',
    cancelling: 'Cancelling...',
    cancelled: 'Cancelled',
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    no_show: 'No Show',
    showPast: 'Show past bookings',
    hidePast: 'Hide past bookings',
    reservation: 'Reservation',
    tour_booking: 'Tour Booking',
    event_ticket: 'Event Ticket',
    guests: 'guests',
  }
}

export default function AppointmentsSection({ lang = 'ar' }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'
  const [showBooking, setShowBooking] = useState(false)
  const [showPast, setShowPast] = useState(false)
  const [cancellingId, setCancellingId] = useState(null)

  const bookings = useQuery(api.bookings.queries.getUserBookings, {})
  const cancelBooking = useMutation(api.bookings.mutations.cancelBooking)

  const today = new Date().toISOString().split('T')[0]

  const upcoming = (bookings || []).filter(
    a => (a.status === 'pending' || a.status === 'confirmed') && a.date >= today
  ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  const past = (bookings || []).filter(
    a => a.status === 'completed' || a.status === 'cancelled' || a.date < today
  ).sort((a, b) => b.date.localeCompare(a.date))

  const handleCancel = async (bookingId) => {
    if (!confirm(t.cancelConfirm)) return
    setCancellingId(bookingId)
    try {
      await cancelBooking({ bookingId })
    } catch (err) {
      console.error('Cancel error:', err)
    }
    setCancellingId(null)
  }

  const formatDate = (dateStr) => {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString(isRTL ? 'ar-SA' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const statusClass = (status) => `status-badge status-${status}`
  const statusLabel = (status) => t[status] || status

  const typeLabel = (type) => {
    if (type === 'reservation') return t.reservation
    if (type === 'tour_booking') return t.tour_booking
    if (type === 'event_ticket') return t.event_ticket
    return type || t.reservation
  }

  return (
    <div>
      {/* Header */}
      <div className="section-header">
        <h2>{t.title}</h2>
        <button className="btn-primary" onClick={() => setShowBooking(true)}>
          + {t.bookNew}
        </button>
      </div>

      {/* Booking Modal */}
      <AnimatePresence>
        {showBooking && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowBooking(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="modal-header">
                <h2>{t.bookNew}</h2>
                <button className="modal-close" onClick={() => setShowBooking(false)}>&times;</button>
              </div>
              <BookingForm
                lang={lang}
                onSuccess={() => {
                  setTimeout(() => setShowBooking(false), 2000)
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upcoming */}
      <div className="subsection">
        <h3 className="subsection-title">{t.upcoming}</h3>
        {bookings === undefined ? (
          <div className="dash-card" style={{ textAlign: 'center', color: '#9ca3af' }}>
            {isRTL ? 'جاري التحميل...' : 'Loading...'}
          </div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state">
            <CalendarEmptyIcon />
            <h3>{t.noUpcoming}</h3>
            <p>{t.bookFirst}</p>
            <button className="btn-primary" onClick={() => setShowBooking(true)}>
              + {t.bookNew}
            </button>
          </div>
        ) : (
          upcoming.map(booking => (
            <div key={booking._id} className="dash-card">
              <div className="apt-card">
                <div className="apt-info">
                  <h3>{isRTL ? booking.listing?.name_ar : booking.listing?.name_en}</h3>
                  <p>
                    {isRTL ? booking.listing?.category_ar : booking.listing?.category}
                    {' · '}
                    {typeLabel(booking.type)}
                    {booking.partySize > 1 && ` · ${booking.partySize} ${t.guests}`}
                  </p>
                  <p className="apt-datetime">
                    {formatDate(booking.date)} · {booking.time}
                  </p>
                  {booking.notes && (
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      {booking.notes}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <span className={statusClass(booking.status)}>
                    {statusLabel(booking.status)}
                  </span>
                  <button
                    className="apt-action-btn danger"
                    onClick={() => handleCancel(booking._id)}
                    disabled={cancellingId === booking._id}
                  >
                    {cancellingId === booking._id ? t.cancelling : t.cancel}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Past bookings toggle */}
      {past.length > 0 && (
        <div className="subsection">
          <button
            className="btn-secondary"
            onClick={() => setShowPast(!showPast)}
            style={{ marginBottom: '1rem' }}
          >
            {showPast ? t.hidePast : t.showPast} ({past.length})
          </button>

          <AnimatePresence>
            {showPast && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: 'hidden' }}
              >
                {past.map(booking => (
                  <div key={booking._id} className="dash-card" style={{ opacity: 0.7 }}>
                    <div className="apt-card">
                      <div className="apt-info">
                        <h3>{isRTL ? booking.listing?.name_ar : booking.listing?.name_en}</h3>
                        <p>{isRTL ? booking.listing?.category_ar : booking.listing?.category}</p>
                        <p className="apt-datetime">
                          {formatDate(booking.date)} · {booking.time}
                        </p>
                      </div>
                      <span className={statusClass(booking.status)}>
                        {statusLabel(booking.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

function CalendarEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="9" y1="16" x2="15" y2="16" />
    </svg>
  )
}
