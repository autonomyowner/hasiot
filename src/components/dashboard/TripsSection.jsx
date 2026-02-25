import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

const translations = {
  ar: {
    title: 'رحلاتي',
    newTrip: 'رحلة جديدة',
    noTrips: 'لا توجد رحلات بعد',
    noTripsDesc: 'أنشئ رحلة جديدة أو استخدم مخطط الرحلات الذكي',
    goHome: 'الذهاب للصفحة الرئيسية',
    all: 'الكل',
    planning: 'قيد التخطيط',
    active: 'نشطة',
    completed: 'مكتملة',
    aiPlans: 'خطط الذكاء الاصطناعي',
    stops: 'محطات',
    noStops: 'لا توجد محطات',
    noStopsDesc: 'أضف محطات من صفحة الاستكشاف أو المفضلة',
    date: 'التاريخ',
    time: 'الوقت',
    notes: 'ملاحظات',
    edit: 'تعديل',
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف الرحلة',
    deleteConfirm: 'هل أنت متأكد من حذف هذه الرحلة؟',
    yes: 'نعم',
    no: 'لا',
    remove: 'إزالة',
    tripTitle: 'عنوان الرحلة',
    tripTitlePlaceholder: 'مثال: رحلة الرياض',
    startDate: 'تاريخ البداية',
    endDate: 'تاريخ النهاية',
    create: 'إنشاء',
    showDetails: 'عرض التفاصيل',
    hideDetails: 'إخفاء التفاصيل',
    hotel: 'فندق',
    restaurant: 'مطعم',
    attraction: 'معلم سياحي',
    event: 'فعالية',
    tour: 'جولة',
    statusPlanning: 'قيد التخطيط',
    statusActive: 'نشطة',
    statusCompleted: 'مكتملة',
    markActive: 'بدء الرحلة',
    markCompleted: 'إكمال الرحلة',
    saveAsTrip: 'حفظ كرحلة',
    destinations: 'الوجهات المقترحة',
    itinerary: 'برنامج الرحلة',
    travelTips: 'نصائح السفر',
    budget: 'الميزانية التقديرية',
    day: 'يوم',
    sar: 'ر.س',
    noPlans: 'لا توجد خطط سفر سابقة',
    editNotes: 'تعديل الملاحظات',
    notesPlaceholder: 'أضف ملاحظات...',
  },
  en: {
    title: 'My Trips',
    newTrip: 'New Trip',
    noTrips: 'No trips yet',
    noTripsDesc: 'Create a new trip or use the AI travel planner',
    goHome: 'Go to Home Page',
    all: 'All',
    planning: 'Planning',
    active: 'Active',
    completed: 'Completed',
    aiPlans: 'AI Plans',
    stops: 'stops',
    noStops: 'No stops yet',
    noStopsDesc: 'Add stops from the explore page or favorites',
    date: 'Date',
    time: 'Time',
    notes: 'Notes',
    edit: 'Edit',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete Trip',
    deleteConfirm: 'Are you sure you want to delete this trip?',
    yes: 'Yes',
    no: 'No',
    remove: 'Remove',
    tripTitle: 'Trip title',
    tripTitlePlaceholder: 'e.g. Riyadh Weekend',
    startDate: 'Start date',
    endDate: 'End date',
    create: 'Create',
    showDetails: 'Show Details',
    hideDetails: 'Hide Details',
    hotel: 'Hotel',
    restaurant: 'Restaurant',
    attraction: 'Attraction',
    event: 'Event',
    tour: 'Tour',
    statusPlanning: 'Planning',
    statusActive: 'Active',
    statusCompleted: 'Completed',
    markActive: 'Start Trip',
    markCompleted: 'Complete Trip',
    saveAsTrip: 'Save as Trip',
    destinations: 'Suggested Destinations',
    itinerary: 'Itinerary',
    travelTips: 'Travel Tips',
    budget: 'Estimated Budget',
    day: 'Day',
    sar: 'SAR',
    noPlans: 'No past travel plans',
    editNotes: 'Edit notes',
    notesPlaceholder: 'Add notes...',
  }
}

const STATUS_COLORS = {
  planning: { bg: '#FEF3C7', color: '#92400E' },
  active: { bg: '#D1FAE5', color: '#065F46' },
  completed: { bg: '#E5E7EB', color: '#374151' },
}

export default function TripsSection({ lang = 'ar' }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'

  const [filter, setFilter] = useState('all')
  const [expandedId, setExpandedId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [editingStop, setEditingStop] = useState(null) // { tripId, stopIndex }
  const [editStopData, setEditStopData] = useState({ date: '', time: '', notes: '' })
  const [savingTrip, setSavingTrip] = useState(null) // planId being saved

  // Trip queries
  const trips = useQuery(api.trips.queries.getMyTrips, filter !== 'aiPlans' ? (filter === 'all' ? {} : { status: filter }) : "skip")
  const aiPlans = useQuery(api.travelPlanner.queries.getMyPlans, filter === 'all' || filter === 'aiPlans' ? {} : "skip")

  // Mutations
  const createTripMut = useMutation(api.trips.mutations.createTrip)
  const updateTrip = useMutation(api.trips.mutations.updateTrip)
  const removeStop = useMutation(api.trips.mutations.removeStop)
  const reorderStops = useMutation(api.trips.mutations.reorderStops)
  const updateStop = useMutation(api.trips.mutations.updateStop)
  const deleteTrip = useMutation(api.trips.mutations.deleteTrip)
  const convertPlan = useMutation(api.trips.mutations.convertPlanToTrip)

  const typeLabel = (type) => t[type] || type

  const statusLabel = (status) => {
    if (status === 'planning') return t.statusPlanning
    if (status === 'active') return t.statusActive
    if (status === 'completed') return t.statusCompleted
    return status
  }

  const handleReorder = async (tripId, fromIndex, toIndex) => {
    try {
      await reorderStops({ tripId, fromIndex, toIndex })
    } catch (err) {
      console.error('Reorder error:', err)
    }
  }

  const handleRemoveStop = async (tripId, stopIndex) => {
    try {
      await removeStop({ tripId, stopIndex })
    } catch (err) {
      console.error('Remove stop error:', err)
    }
  }

  const handleEditStop = (tripId, stopIndex, stop) => {
    setEditingStop({ tripId, stopIndex })
    setEditStopData({ date: stop.date || '', time: stop.time || '', notes: stop.notes || '' })
  }

  const handleSaveStop = async () => {
    if (!editingStop) return
    try {
      await updateStop({
        tripId: editingStop.tripId,
        stopIndex: editingStop.stopIndex,
        date: editStopData.date || undefined,
        time: editStopData.time || undefined,
        notes: editStopData.notes || undefined,
      })
      setEditingStop(null)
    } catch (err) {
      console.error('Update stop error:', err)
    }
  }

  const handleDeleteTrip = async (tripId) => {
    try {
      await deleteTrip({ tripId })
      setDeleteConfirmId(null)
      setExpandedId(null)
    } catch (err) {
      console.error('Delete trip error:', err)
    }
  }

  const handleStatusChange = async (tripId, newStatus) => {
    try {
      await updateTrip({ tripId, status: newStatus })
    } catch (err) {
      console.error('Status update error:', err)
    }
  }

  const handleConvertPlan = async (planId, userInput) => {
    setSavingTrip(planId)
    try {
      await convertPlan({
        planId,
        title: userInput.length > 50 ? userInput.slice(0, 50) + '...' : userInput,
      })
      setSavingTrip(null)
    } catch (err) {
      console.error('Convert plan error:', err)
      setSavingTrip(null)
    }
  }

  const filters = [
    { id: 'all', label: t.all },
    { id: 'planning', label: t.planning },
    { id: 'active', label: t.active },
    { id: 'completed', label: t.completed },
    { id: 'aiPlans', label: t.aiPlans },
  ]

  const isLoading = (filter !== 'aiPlans' && trips === undefined) || ((filter === 'all' || filter === 'aiPlans') && aiPlans === undefined)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="dashboard-section-title" style={{ margin: 0 }}>{t.title}</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '0.5rem 1rem', background: '#0D7A5F', color: '#fff',
            border: 'none', borderRadius: '0.5rem', cursor: 'pointer',
            fontSize: '0.8125rem', fontWeight: 600,
          }}
        >
          + {t.newTrip}
        </button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              padding: '0.375rem 0.75rem', borderRadius: '1rem',
              border: '1px solid', fontSize: '0.8125rem', whiteSpace: 'nowrap',
              cursor: 'pointer',
              borderColor: filter === f.id ? '#0D7A5F' : '#e5e7eb',
              background: filter === f.id ? '#0D7A5F' : '#fff',
              color: filter === f.id ? '#fff' : '#6b7280',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
          {isRTL ? 'جاري التحميل...' : 'Loading...'}
        </div>
      )}

      {/* Trips list */}
      {!isLoading && filter !== 'aiPlans' && (
        <>
          {trips && trips.length === 0 && (filter !== 'all' || !aiPlans || aiPlans.length === 0) && (
            <div className="empty-state">
              <TripEmptyIcon />
              <h3>{t.noTrips}</h3>
              <p>{t.noTripsDesc}</p>
              <a href="/" className="btn-primary" style={{ textDecoration: 'none' }}>{t.goHome}</a>
            </div>
          )}

          {trips && trips.map(trip => {
            const isExpanded = expandedId === trip._id
            const sc = STATUS_COLORS[trip.status] || STATUS_COLORS.planning

            return (
              <div key={trip._id} className="dash-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <div>
                    <span
                      className="status-badge"
                      style={{ background: sc.bg, color: sc.color, fontSize: '0.6875rem', marginBottom: '0.375rem', display: 'inline-block' }}
                    >
                      {statusLabel(trip.status)}
                    </span>
                    <h3 style={{ margin: '0.25rem 0 0', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
                      {isRTL && trip.title_ar ? trip.title_ar : trip.title}
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
                      {trip.stops.length} {t.stops}
                      {trip.startDate && ` · ${trip.startDate}`}
                      {trip.endDate && ` - ${trip.endDate}`}
                    </p>
                  </div>
                </div>

                <button
                  className="btn-secondary"
                  onClick={() => setExpandedId(isExpanded ? null : trip._id)}
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
                        {/* Status actions */}
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                          {trip.status === 'planning' && (
                            <button
                              onClick={() => handleStatusChange(trip._id, 'active')}
                              style={{
                                padding: '0.375rem 0.75rem', background: '#0D7A5F', color: '#fff',
                                border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem',
                              }}
                            >
                              {t.markActive}
                            </button>
                          )}
                          {trip.status === 'active' && (
                            <button
                              onClick={() => handleStatusChange(trip._id, 'completed')}
                              style={{
                                padding: '0.375rem 0.75rem', background: '#374151', color: '#fff',
                                border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem',
                              }}
                            >
                              {t.markCompleted}
                            </button>
                          )}
                          {deleteConfirmId === trip._id ? (
                            <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>{t.deleteConfirm}</span>
                              <button
                                onClick={() => handleDeleteTrip(trip._id)}
                                style={{ padding: '0.25rem 0.5rem', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}
                              >
                                {t.yes}
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                style={{ padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}
                              >
                                {t.no}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(trip._id)}
                              style={{
                                padding: '0.375rem 0.75rem', background: '#fff', color: '#ef4444',
                                border: '1px solid #fecaca', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem',
                              }}
                            >
                              {t.delete}
                            </button>
                          )}
                        </div>

                        {/* Stops timeline */}
                        {trip.stops.length === 0 ? (
                          <p style={{ fontSize: '0.8125rem', color: '#9ca3af', textAlign: 'center', padding: '1rem 0' }}>
                            {t.noStops}<br /><span style={{ fontSize: '0.75rem' }}>{t.noStopsDesc}</span>
                          </p>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            {/* Timeline line */}
                            <div style={{
                              position: 'absolute',
                              [isRTL ? 'right' : 'left']: '10px',
                              top: '8px', bottom: '8px', width: '2px',
                              background: '#e5e7eb',
                            }} />

                            {trip.stops.map((stop, idx) => {
                              const isEditingThis = editingStop?.tripId === trip._id && editingStop?.stopIndex === idx
                              return (
                                <div
                                  key={idx}
                                  style={{
                                    position: 'relative',
                                    [isRTL ? 'paddingRight' : 'paddingLeft']: '2rem',
                                    marginBottom: '0.75rem',
                                  }}
                                >
                                  {/* Timeline dot */}
                                  <div style={{
                                    position: 'absolute',
                                    [isRTL ? 'right' : 'left']: '4px',
                                    top: '6px', width: '14px', height: '14px',
                                    borderRadius: '50%', background: '#0D7A5F',
                                    border: '2px solid #fff', boxShadow: '0 0 0 2px #0D7A5F40',
                                  }} />

                                  <div style={{
                                    padding: '0.625rem 0.75rem', background: '#f9fafb',
                                    borderRadius: '0.5rem', border: '1px solid #f3f4f6',
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827' }}>
                                          {stop.listing ? (isRTL ? stop.listing.name_ar : stop.listing.name_en) : '—'}
                                        </span>
                                        {stop.listing && (
                                          <span style={{
                                            fontSize: '0.6875rem', color: '#6b7280',
                                            marginRight: isRTL ? '0.5rem' : 0,
                                            marginLeft: isRTL ? 0 : '0.5rem',
                                          }}>
                                            {typeLabel(stop.listing.type)} · {stop.listing.city}
                                          </span>
                                        )}
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                                        {/* Reorder arrows */}
                                        {idx > 0 && (
                                          <button
                                            onClick={() => handleReorder(trip._id, idx, idx - 1)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280', padding: '0 0.125rem' }}
                                            title="Move up"
                                          >
                                            ↑
                                          </button>
                                        )}
                                        {idx < trip.stops.length - 1 && (
                                          <button
                                            onClick={() => handleReorder(trip._id, idx, idx + 1)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280', padding: '0 0.125rem' }}
                                            title="Move down"
                                          >
                                            ↓
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleEditStop(trip._id, idx, stop)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#0D7A5F', padding: '0 0.25rem' }}
                                        >
                                          {t.edit}
                                        </button>
                                        <button
                                          onClick={() => handleRemoveStop(trip._id, idx)}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#ef4444', padding: '0 0.125rem' }}
                                        >
                                          ×
                                        </button>
                                      </div>
                                    </div>

                                    {/* Stop details */}
                                    {(stop.date || stop.time) && !isEditingThis && (
                                      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
                                        {stop.date && <span>{stop.date}</span>}
                                        {stop.date && stop.time && ' · '}
                                        {stop.time && <span>{stop.time}</span>}
                                      </p>
                                    )}
                                    {stop.notes && !isEditingThis && (
                                      <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.25rem 0 0', fontStyle: 'italic' }}>
                                        {stop.notes}
                                      </p>
                                    )}

                                    {/* Edit form */}
                                    {isEditingThis && (
                                      <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                          <input type="date" value={editStopData.date} onChange={e => setEditStopData(p => ({ ...p, date: e.target.value }))}
                                            style={{ flex: 1, padding: '0.25rem', border: '1px solid #e5e7eb', borderRadius: '0.25rem', fontSize: '0.75rem' }} />
                                          <input type="time" value={editStopData.time} onChange={e => setEditStopData(p => ({ ...p, time: e.target.value }))}
                                            style={{ flex: 1, padding: '0.25rem', border: '1px solid #e5e7eb', borderRadius: '0.25rem', fontSize: '0.75rem' }} />
                                        </div>
                                        <textarea value={editStopData.notes} onChange={e => setEditStopData(p => ({ ...p, notes: e.target.value }))}
                                          placeholder={t.notesPlaceholder} rows={2}
                                          style={{ padding: '0.25rem', border: '1px solid #e5e7eb', borderRadius: '0.25rem', fontSize: '0.75rem', resize: 'vertical' }} />
                                        <div style={{ display: 'flex', gap: '0.375rem' }}>
                                          <button onClick={handleSaveStop}
                                            style={{ padding: '0.25rem 0.5rem', background: '#0D7A5F', color: '#fff', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                                            {t.save}
                                          </button>
                                          <button onClick={() => setEditingStop(null)}
                                            style={{ padding: '0.25rem 0.5rem', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '0.25rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                                            {t.cancel}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </>
      )}

      {/* AI Plans tab */}
      {!isLoading && (filter === 'all' || filter === 'aiPlans') && aiPlans && aiPlans.length > 0 && (
        <>
          {filter === 'all' && trips && trips.length > 0 && (
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#374151', margin: '1.5rem 0 0.75rem' }}>
              {t.aiPlans}
            </h3>
          )}
          {aiPlans.map(plan => {
            const isExpanded = expandedId === `plan-${plan._id}`
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
                      {plan.userInput.length > 100 ? plan.userInput.slice(0, 100) + '...' : plan.userInput}
                    </p>
                  </div>
                  {data?.estimatedBudget && (
                    <span className="status-badge" style={{ background: '#D1FAE520', color: '#0D7A5F', flexShrink: 0 }}>
                      {data.estimatedBudget} {t.sar}
                    </span>
                  )}
                </div>

                {data?.suggestedDestinations && data.suggestedDestinations.length > 0 && (
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{t.destinations}: </span>
                    <span style={{ fontSize: '0.8125rem', color: '#374151', fontWeight: 500 }}>
                      {data.suggestedDestinations.map(d => typeof d === 'string' ? d : d.name).join('، ')}
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn-secondary"
                    onClick={() => setExpandedId(isExpanded ? null : `plan-${plan._id}`)}
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.625rem' }}
                  >
                    {isExpanded ? t.hideDetails : t.showDetails}
                  </button>
                  <button
                    onClick={() => handleConvertPlan(plan._id, plan.userInput)}
                    disabled={savingTrip === plan._id}
                    style={{
                      fontSize: '0.75rem', padding: '0.25rem 0.625rem',
                      background: '#0D7A5F', color: '#fff', border: 'none',
                      borderRadius: '0.375rem', cursor: 'pointer',
                      opacity: savingTrip === plan._id ? 0.5 : 1,
                    }}
                  >
                    {savingTrip === plan._id ? '...' : t.saveAsTrip}
                  </button>
                </div>

                <AnimatePresence>
                  {isExpanded && data && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
                        {data.itinerary && typeof data.itinerary === 'string' && (
                          <>
                            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>{t.itinerary}</p>
                            <p style={{ fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{data.itinerary}</p>
                          </>
                        )}
                        {data.itinerary && Array.isArray(data.itinerary) && data.itinerary.map((item, i) => (
                          <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid #f9fafb' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#0D7A5F' }}>
                              {t.day} {item.day || i + 1}:
                            </span>
                            <span style={{ fontSize: '0.875rem', color: '#111827', marginRight: '0.5rem', marginLeft: '0.5rem' }}>
                              {item.activity || item.description}
                            </span>
                          </div>
                        ))}

                        {(data.travelTips || data.travelTips_ar) && (
                          <div style={{ marginTop: '1rem' }}>
                            <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>{t.travelTips}</p>
                            {typeof data.travelTips === 'string' ? (
                              <p style={{ fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                                {isRTL && data.travelTips_ar ? data.travelTips_ar : data.travelTips}
                              </p>
                            ) : Array.isArray(data.travelTips) && (
                              <ul style={{ margin: 0, paddingRight: isRTL ? '1.25rem' : 0, paddingLeft: isRTL ? 0 : '1.25rem' }}>
                                {data.travelTips.map((tip, i) => (
                                  <li key={i} style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>{tip}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}

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
          })}
        </>
      )}

      {/* Create Trip Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <CreateTripModal
            lang={lang}
            t={t}
            isRTL={isRTL}
            onCreate={async (data) => {
              await createTripMut(data)
              setShowCreateModal(false)
            }}
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateTripModal({ lang, t, isRTL, onCreate, onClose }) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!title.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({
        title: title.trim(),
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      })
    } catch (err) {
      console.error('Create trip error:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, padding: '1rem',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          background: '#fff', borderRadius: '1rem', padding: '1.5rem',
          width: '100%', maxWidth: '400px',
        }}
      >
        <h3 style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 600 }}>+ {t.newTrip}</h3>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>{t.tripTitle}</label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder={t.tripTitlePlaceholder}
            style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>{t.startDate}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.8125rem', boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>{t.endDate}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.8125rem', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '0.625rem', border: '1px solid #e5e7eb', background: '#fff', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#6b7280' }}>
            {t.cancel}
          </button>
          <button onClick={handleCreate} disabled={!title.trim() || saving}
            style={{ flex: 1, padding: '0.625rem', border: 'none', background: '#0D7A5F', color: '#fff', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, opacity: (!title.trim() || saving) ? 0.5 : 1 }}>
            {saving ? '...' : t.create}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function TripEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <circle cx="12" cy="10" r="3" />
      <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z" />
    </svg>
  )
}
