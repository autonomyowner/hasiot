import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'
import './BookingForm.css'

const translations = {
  ar: {
    title: 'حجز جديد',
    selectListing: 'اختر المكان',
    selectDate: 'اختر التاريخ',
    selectTime: 'اختر الوقت',
    partySize: 'عدد الأشخاص',
    notes: 'ملاحظات (اختياري)',
    notesPlaceholder: 'أضف أي معلومات إضافية...',
    book: 'تأكيد الحجز',
    booking: 'جاري الحجز...',
    success: 'تم الحجز بنجاح!',
    error: 'حدث خطأ أثناء الحجز. يرجى المحاولة مرة أخرى.',
    noSlots: 'لا توجد مواعيد متاحة في هذا اليوم',
    loading: 'جاري التحميل...',
    closed: 'مغلق',
    available: 'متاح',
    booked: 'محجوز'
  },
  en: {
    title: 'New Booking',
    selectListing: 'Select Place',
    selectDate: 'Select Date',
    selectTime: 'Select Time',
    partySize: 'Party Size',
    notes: 'Notes (optional)',
    notesPlaceholder: 'Add any additional information...',
    book: 'Confirm Booking',
    booking: 'Booking...',
    success: 'Booking confirmed successfully!',
    error: 'An error occurred while booking. Please try again.',
    noSlots: 'No available slots on this date',
    loading: 'Loading...',
    closed: 'Closed',
    available: 'Available',
    booked: 'Booked'
  }
}

export default function BookingForm({
  lang = 'ar',
  listingId = null,
  category = null,
  onSuccess
}) {
  const [selectedListing, setSelectedListing] = useState(listingId)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [partySize, setPartySize] = useState(1)
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)

  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'

  const listings = useQuery(api.listings.queries.listListings, {
    category: category || undefined,
    limit: 50
  })

  const slots = useQuery(
    api.bookings.queries.getAvailableSlots,
    selectedListing && selectedDate
      ? { listingId: selectedListing, date: selectedDate }
      : "skip"
  )

  const createBooking = useMutation(api.bookings.mutations.createBooking)

  useEffect(() => {
    if (listingId) {
      setSelectedListing(listingId)
    }
  }, [listingId])

  const getAvailableDates = () => {
    const dates = []
    const today = new Date()
    for (let i = 1; i <= 14; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      dates.push({
        value: date.toISOString().split('T')[0],
        label: date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        })
      })
    }
    return dates
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!selectedListing || !selectedDate || !selectedTime) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await createBooking({
        listingId: selectedListing,
        date: selectedDate,
        time: selectedTime,
        partySize: partySize,
        notes: notes || undefined
      })

      setSuccess(true)
      setSelectedTime('')
      setNotes('')

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      console.error('Booking error:', err)
      setError(err.message || t.error)
    } finally {
      setLoading(false)
    }
  }

  const selectedListingData = listings?.find(d => d._id === selectedListing)

  return (
    <div className={`booking-form ${isRTL ? 'rtl' : 'ltr'}`}>
      <h2 className="booking-title">{t.title}</h2>

      <AnimatePresence mode="wait">
        {success ? (
          <motion.div
            className="success-message"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="success-check">&#10003;</div>
            <p>{t.success}</p>
          </motion.div>
        ) : (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Listing Selection */}
            {!listingId && (
              <div className="form-group">
                <label>{t.selectListing}</label>
                <select
                  value={selectedListing || ''}
                  onChange={(e) => {
                    setSelectedListing(e.target.value || null)
                    setSelectedDate('')
                    setSelectedTime('')
                  }}
                  required
                >
                  <option value="">{t.selectListing}</option>
                  {listings?.map(listing => (
                    <option key={listing._id} value={listing._id}>
                      {isRTL ? listing.name_ar : listing.name_en} - {isRTL ? listing.category_ar : listing.category}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Show selected listing info */}
            {selectedListingData && (
              <div className="selected-doctor-info">
                <h3>{isRTL ? selectedListingData.name_ar : selectedListingData.name_en}</h3>
                <p>{isRTL ? selectedListingData.category_ar : selectedListingData.category}</p>
                <p className="doctor-address">{selectedListingData.address}</p>
              </div>
            )}

            {/* Party Size */}
            {selectedListing && (
              <div className="form-group">
                <label>{t.partySize}</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={partySize}
                  onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
                />
              </div>
            )}

            {/* Date Selection */}
            {selectedListing && (
              <div className="form-group">
                <label>{t.selectDate}</label>
                <div className="date-grid">
                  {getAvailableDates().map(date => (
                    <button
                      key={date.value}
                      type="button"
                      className={`date-btn ${selectedDate === date.value ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedDate(date.value)
                        setSelectedTime('')
                      }}
                    >
                      {date.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time Selection */}
            {selectedDate && (
              <div className="form-group">
                <label>{t.selectTime}</label>
                {!slots ? (
                  <p className="loading-text">{t.loading}</p>
                ) : slots.slots.length === 0 ? (
                  <p className="no-slots">{t.noSlots}</p>
                ) : (
                  <div className="time-grid">
                    {slots.slots.map(slot => (
                      <button
                        key={slot.time}
                        type="button"
                        className={`time-btn ${selectedTime === slot.time ? 'selected' : ''} ${!slot.isAvailable ? 'unavailable' : ''}`}
                        onClick={() => slot.isAvailable && setSelectedTime(slot.time)}
                        disabled={!slot.isAvailable}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {selectedTime && (
              <div className="form-group">
                <label>{t.notes}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  rows={3}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="error-message">{error}</div>
            )}

            {/* Submit */}
            <button
              type="submit"
              className="submit-btn"
              disabled={!selectedListing || !selectedDate || !selectedTime || loading}
            >
              {loading ? t.booking : t.book}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
