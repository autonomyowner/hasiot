import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

const translations = {
  ar: {
    title: 'حفظ في رحلة',
    selectTrip: 'اختر رحلة',
    createNew: 'إنشاء رحلة جديدة',
    tripName: 'اسم الرحلة',
    tripNamePlaceholder: 'مثال: رحلة الرياض',
    date: 'التاريخ',
    time: 'الوقت',
    notes: 'ملاحظات',
    notesPlaceholder: 'أضف ملاحظات...',
    add: 'أضف للرحلة',
    create: 'أنشئ وأضف',
    cancel: 'إلغاء',
    success: 'تمت الإضافة بنجاح!',
    noTrips: 'لا توجد رحلات قيد التخطيط',
    stops: 'محطات',
    loading: 'جاري التحميل...',
  },
  en: {
    title: 'Save to Trip',
    selectTrip: 'Select a trip',
    createNew: 'Create new trip',
    tripName: 'Trip name',
    tripNamePlaceholder: 'e.g. Riyadh Weekend',
    date: 'Date',
    time: 'Time',
    notes: 'Notes',
    notesPlaceholder: 'Add notes...',
    add: 'Add to Trip',
    create: 'Create & Add',
    cancel: 'Cancel',
    success: 'Added successfully!',
    noTrips: 'No trips in planning',
    stops: 'stops',
    loading: 'Loading...',
  }
}

export default function SaveToTripModal({ listingId, listingName, lang = 'ar', isOpen, onClose }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'

  const [mode, setMode] = useState('select') // 'select' | 'create'
  const [selectedTripId, setSelectedTripId] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [notes, setNotes] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)

  const tripSummaries = useQuery(api.trips.queries.getMyTripSummaries, isOpen ? {} : "skip")
  const addStop = useMutation(api.trips.mutations.addStopToTrip)
  const createTrip = useMutation(api.trips.mutations.createTrip)

  const reset = () => {
    setMode('select')
    setSelectedTripId(null)
    setNewTitle('')
    setDate('')
    setTime('')
    setNotes('')
    setSuccess(false)
    setSaving(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleAdd = async () => {
    if (saving) return
    setSaving(true)
    try {
      let tripId = selectedTripId
      if (mode === 'create') {
        if (!newTitle.trim()) return
        tripId = await createTrip({ title: newTitle.trim() })
      }
      if (!tripId) return

      await addStop({
        tripId,
        listingId,
        date: date || undefined,
        time: time || undefined,
        notes: notes || undefined,
      })

      setSuccess(true)
      setTimeout(handleClose, 1500)
    } catch (err) {
      console.error('Save to trip error:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem',
        }}
      >
        <motion.div
          className="modal-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            background: '#fff', borderRadius: '1rem', padding: '1.5rem',
            width: '100%', maxWidth: '420px', maxHeight: '80vh', overflowY: 'auto',
          }}
        >
          {success ? (
            <div style={{ textAlign: 'center', padding: '2rem 0' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0D7A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <p style={{ marginTop: '1rem', color: '#0D7A5F', fontWeight: 600 }}>{t.success}</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>{t.title}</h3>
                <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}>&times;</button>
              </div>

              {listingName && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: '0 0 1rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                  {listingName}
                </p>
              )}

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setMode('select')}
                  style={{
                    flex: 1, padding: '0.5rem', border: '1px solid',
                    borderColor: mode === 'select' ? '#0D7A5F' : '#e5e7eb',
                    background: mode === 'select' ? '#0D7A5F10' : '#fff',
                    color: mode === 'select' ? '#0D7A5F' : '#6b7280',
                    borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
                  }}
                >
                  {t.selectTrip}
                </button>
                <button
                  onClick={() => setMode('create')}
                  style={{
                    flex: 1, padding: '0.5rem', border: '1px solid',
                    borderColor: mode === 'create' ? '#0D7A5F' : '#e5e7eb',
                    background: mode === 'create' ? '#0D7A5F10' : '#fff',
                    color: mode === 'create' ? '#0D7A5F' : '#6b7280',
                    borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
                  }}
                >
                  + {t.createNew}
                </button>
              </div>

              {/* Select existing trip */}
              {mode === 'select' && (
                <div style={{ marginBottom: '1rem' }}>
                  {tripSummaries === undefined ? (
                    <p style={{ color: '#9ca3af', fontSize: '0.8125rem', textAlign: 'center' }}>{t.loading}</p>
                  ) : tripSummaries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#9ca3af' }}>
                      <p style={{ fontSize: '0.8125rem' }}>{t.noTrips}</p>
                      <button onClick={() => setMode('create')} style={{
                        marginTop: '0.5rem', color: '#0D7A5F', background: 'none',
                        border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500,
                      }}>
                        + {t.createNew}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {tripSummaries.map(trip => (
                        <button
                          key={trip._id}
                          onClick={() => setSelectedTripId(trip._id)}
                          style={{
                            padding: '0.75rem', border: '1px solid',
                            borderColor: selectedTripId === trip._id ? '#0D7A5F' : '#e5e7eb',
                            background: selectedTripId === trip._id ? '#0D7A5F08' : '#fff',
                            borderRadius: '0.5rem', cursor: 'pointer', textAlign: isRTL ? 'right' : 'left',
                          }}
                        >
                          <span style={{ fontWeight: 500, fontSize: '0.875rem', color: '#111827' }}>
                            {isRTL && trip.title_ar ? trip.title_ar : trip.title}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                            {trip.stopCount} {t.stops}
                            {trip.startDate && ` · ${trip.startDate}`}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Create new trip */}
              {mode === 'create' && (
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                    {t.tripName}
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder={t.tripNamePlaceholder}
                    style={{
                      width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* Date & Time */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                    {t.date}
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem', fontSize: '0.8125rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                    {t.time}
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    style={{
                      width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb',
                      borderRadius: '0.5rem', fontSize: '0.8125rem', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>
                  {t.notes}
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t.notesPlaceholder}
                  rows={2}
                  style={{
                    width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb',
                    borderRadius: '0.5rem', fontSize: '0.8125rem', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  onClick={handleClose}
                  style={{
                    flex: 1, padding: '0.625rem', border: '1px solid #e5e7eb',
                    background: '#fff', borderRadius: '0.5rem', cursor: 'pointer',
                    fontSize: '0.875rem', color: '#6b7280',
                  }}
                >
                  {t.cancel}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || (mode === 'select' && !selectedTripId) || (mode === 'create' && !newTitle.trim())}
                  style={{
                    flex: 1, padding: '0.625rem', border: 'none',
                    background: '#0D7A5F', color: '#fff', borderRadius: '0.5rem',
                    cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
                    opacity: (saving || (mode === 'select' && !selectedTripId) || (mode === 'create' && !newTitle.trim())) ? 0.5 : 1,
                  }}
                >
                  {saving ? '...' : mode === 'create' ? t.create : t.add}
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
