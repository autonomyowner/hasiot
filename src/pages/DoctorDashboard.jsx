import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { authClient } from '../lib/auth-client'
import { motion, AnimatePresence } from 'framer-motion'
import './AuthPages.css'
import '../pages/PatientDashboard.css'

const DAYS = [
  { key: 'saturday', ar: 'السبت', en: 'Saturday' },
  { key: 'sunday', ar: 'الأحد', en: 'Sunday' },
  { key: 'monday', ar: 'الاثنين', en: 'Monday' },
  { key: 'tuesday', ar: 'الثلاثاء', en: 'Tuesday' },
  { key: 'wednesday', ar: 'الأربعاء', en: 'Wednesday' },
  { key: 'thursday', ar: 'الخميس', en: 'Thursday' },
  { key: 'friday', ar: 'الجمعة', en: 'Friday' },
]

const tabs = [
  { id: 'listings', label: 'قوائمي' },
  { id: 'bookings', label: 'الحجوزات' },
  { id: 'schedule', label: 'جدول العمل' },
  { id: 'profile', label: 'الملف الشخصي' },
]

export default function DoctorDashboard() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const saveBusinessDoc = useMutation(api.users.mutations.saveBusinessDoc)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('listings')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/sign-in'
    }
  }, [isLoading, isAuthenticated])

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const uploadUrl = await generateUploadUrl()
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const { storageId } = await result.json()
      await saveBusinessDoc({ fileId: storageId })
      setUploadSuccess(true)
    } catch (err) {
      console.error('Document upload error:', err)
    }
    setUploading(false)
  }

  if (isLoading) {
    return (
      <div className="auth-page" dir="rtl">
        <div className="auth-container">
          <div className="auth-card">
            <p style={{ textAlign: 'center', color: '#6b7280' }}>جاري التحميل...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  const needsDoc = !user.isApproved && !user.cvFileId && !uploadSuccess
  const pendingReview = !user.isApproved && (user.cvFileId || uploadSuccess)
  const isApproved = user.isApproved === true

  return (
    <div className="patient-dashboard" dir="rtl">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <Link to="/" className="auth-logo">Hasio</Link>
          <div className="dashboard-user-info">
            <span className="dashboard-user-name">
              مرحباً، {user.firstName || user.email}
            </span>
            <button
              className="dashboard-signout"
              onClick={async () => { await authClient.signOut(); window.location.href = '/' }}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Document Upload Banner */}
        {needsDoc && (
          <div style={{
            background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '12px',
            padding: '1.5rem', marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#92400e', margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '600' }}>
              مطلوب: رفع وثيقة العمل
            </h3>
            <p style={{ color: '#92400e', margin: '0 0 1rem', fontSize: '0.875rem', lineHeight: '1.6' }}>
              لتفعيل حسابك، يرجى رفع رخصة العمل أو وثيقة تثبت نشاطك التجاري.
              سيقوم فريق الإدارة بمراجعتها والموافقة على حسابك.
            </p>
            <label style={{
              display: 'inline-block', padding: '0.625rem 1.25rem', background: '#0D7A5F',
              color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500'
            }}>
              {uploading ? 'جاري الرفع...' : 'رفع وثيقة العمل (PDF)'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleDocUpload}
                disabled={uploading}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {/* Pending Review Banner */}
        {pendingReview && (
          <div style={{
            background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: '12px',
            padding: '1.5rem', marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#1e40af', margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '600' }}>
              حسابك قيد المراجعة
            </h3>
            <p style={{ color: '#1e40af', margin: '0', fontSize: '0.875rem', lineHeight: '1.6' }}>
              تم استلام وثيقتك بنجاح. فريق الإدارة يراجع طلبك حالياً.
              سيتم تفعيل حسابك بعد الموافقة.
            </p>
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{ opacity: isApproved ? 1 : 0.5, pointerEvents: isApproved ? 'auto' : 'none' }}>
          <div className="filter-tabs" style={{ marginBottom: '1.5rem' }}>
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`filter-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'listings' && <MyListingsTab user={user} />}
          {activeTab === 'bookings' && <BusinessBookingsTab />}
          {activeTab === 'schedule' && <ScheduleTab user={user} />}
          {activeTab === 'profile' && <BusinessProfileTab user={user} />}
        </div>
      </main>
    </div>
  )
}

// === My Listings Tab ===
function MyListingsTab({ user }) {
  const myListings = useQuery(api.listings.queries.getMyListings, {})
  const submitListing = useMutation(api.listings.mutations.submitListing)
  const updateMyListing = useMutation(api.listings.mutations.updateMyListing)
  const deleteMyListing = useMutation(api.listings.mutations.deleteMyListing)
  const [showForm, setShowForm] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const SAUDI_CITIES = [
    "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Al Khobar", "Dhahran",
    "Tabuk", "Taif", "Abha", "Khamis Mushait", "Jizan", "Najran", "Hail",
    "Al Baha", "Arar", "Sakaka", "AlUla", "Yanbu", "Al Jubail"
  ]
  const SAUDI_CITIES_AR = {
    "Riyadh": "الرياض", "Jeddah": "جدة", "Mecca": "مكة المكرمة", "Medina": "المدينة المنورة",
    "Dammam": "الدمام", "Al Khobar": "الخبر", "Dhahran": "الظهران", "Tabuk": "تبوك",
    "Taif": "الطائف", "Abha": "أبها", "Khamis Mushait": "خميس مشيط", "Jizan": "جازان",
    "Najran": "نجران", "Hail": "حائل", "Al Baha": "الباحة", "Arar": "عرعر",
    "Sakaka": "سكاكا", "AlUla": "العلا", "Yanbu": "ينبع", "Al Jubail": "الجبيل"
  }
  const CATEGORIES = [
    { value: "luxury_hotel", label: "فندق فاخر" },
    { value: "business_hotel", label: "فندق أعمال" },
    { value: "mid_range_hotel", label: "فندق متوسط" },
    { value: "boutique_hotel", label: "فندق بوتيك" },
    { value: "resort", label: "منتجع" },
    { value: "traditional_food", label: "مطبخ تقليدي" },
    { value: "fine_dining", label: "مطعم فاخر" },
    { value: "seafood", label: "مأكولات بحرية" },
    { value: "international", label: "عالمي" },
    { value: "fast_food", label: "وجبات سريعة" },
    { value: "historical_site", label: "موقع تاريخي" },
    { value: "museum", label: "متحف" },
    { value: "natural_landmark", label: "معلم طبيعي" },
    { value: "entertainment", label: "ترفيه" },
    { value: "cultural_tour", label: "جولة ثقافية" },
    { value: "adventure", label: "مغامرة" },
    { value: "seasonal_event", label: "موسم" },
  ]

  // Allowed types based on role
  const allowedTypes = user?.role === 'service_provider'
    ? [{ value: 'tour', label: 'جولة' }]
    : [
        { value: 'hotel', label: 'فندق' },
        { value: 'restaurant', label: 'مطعم' },
        { value: 'attraction', label: 'معلم سياحي' },
        { value: 'event', label: 'فعالية' },
      ]

  const typeLabels = { hotel: 'فندق', restaurant: 'مطعم', attraction: 'معلم سياحي', event: 'فعالية', tour: 'جولة' }

  const statusConfig = {
    pending: { label: 'قيد المراجعة', color: '#f59e0b', bg: '#fef3c7' },
    approved: { label: 'معتمد', color: '#059669', bg: '#d1fae5' },
    rejected: { label: 'مرفوض', color: '#dc2626', bg: '#fee2e2' },
  }

  const handleSubmit = async (formData) => {
    setSubmitting(true)
    try {
      if (editingListing) {
        await updateMyListing({ listingId: editingListing._id, ...formData })
      } else {
        await submitListing(formData)
      }
      setShowForm(false)
      setEditingListing(null)
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return
    try {
      await deleteMyListing({ listingId: id })
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
  }

  const pending = (myListings || []).filter(l => l.status === 'pending').length
  const approved = (myListings || []).filter(l => l.status === 'approved').length
  const rejected = (myListings || []).filter(l => l.status === 'rejected').length

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'الإجمالي', value: (myListings || []).length, color: '#6b7280' },
          { label: 'قيد المراجعة', value: pending, color: '#f59e0b' },
          { label: 'معتمد', value: approved, color: '#059669' },
          { label: 'مرفوض', value: rejected, color: '#dc2626' },
        ].map((stat, i) => (
          <div key={i} className="dash-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, margin: '0 0 0.25rem' }}>{stat.value}</p>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Add New Button */}
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(true); setEditingListing(null); }}
        >
          إضافة جديد
        </button>
      </div>

      {/* Listing Cards */}
      {myListings === undefined ? (
        <div className="dash-card" style={{ textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : myListings.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <p>لم تقم بإضافة أي قوائم بعد. اضغط "إضافة جديد" للبدء.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {myListings.map(listing => {
            const sc = statusConfig[listing.status] || statusConfig.pending
            return (
              <div key={listing._id} className="dash-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        color: sc.color,
                        background: sc.bg,
                      }}>
                        {sc.label}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {typeLabels[listing.type] || listing.type}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 600 }}>{listing.name_ar}</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{listing.name_en}</p>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>
                      {SAUDI_CITIES_AR[listing.city] || listing.city} · {listing.address}
                    </p>
                    {listing.status === 'rejected' && listing.rejectionReason && (
                      <div style={{
                        marginTop: '0.5rem', padding: '0.5rem 0.75rem',
                        background: '#fee2e2', borderRadius: '8px',
                        fontSize: '0.8125rem', color: '#991b1b'
                      }}>
                        سبب الرفض: {listing.rejectionReason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="apt-action-btn"
                      onClick={() => { setEditingListing(listing); setShowForm(true); }}
                      style={{ fontSize: '0.8125rem' }}
                    >
                      تعديل
                    </button>
                    <button
                      className="apt-action-btn danger"
                      onClick={() => handleDelete(listing._id)}
                      style={{ fontSize: '0.8125rem' }}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{ maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}
            >
              <div className="modal-header">
                <h2>{editingListing ? 'تعديل القائمة' : 'إضافة قائمة جديدة'}</h2>
                <button className="modal-close" onClick={() => { setShowForm(false); setEditingListing(null); }}>&times;</button>
              </div>
              <CreateListingForm
                onSubmit={handleSubmit}
                submitting={submitting}
                initialData={editingListing}
                allowedTypes={allowedTypes}
                categories={CATEGORIES}
                cities={SAUDI_CITIES}
                citiesAr={SAUDI_CITIES_AR}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateListingForm({ onSubmit, submitting, initialData, allowedTypes, categories, cities, citiesAr }) {
  const [form, setForm] = useState({
    type: initialData?.type || allowedTypes[0]?.value || 'hotel',
    category: initialData?.category || categories[0]?.value || '',
    category_ar: initialData?.category_ar || categories[0]?.label || '',
    name_en: initialData?.name_en || '',
    name_ar: initialData?.name_ar || '',
    description_en: initialData?.description_en || '',
    description_ar: initialData?.description_ar || '',
    address: initialData?.address || '',
    city: initialData?.city || 'Riyadh',
    region: initialData?.region || '',
    lat: initialData?.coordinates?.lat || 24.7136,
    lng: initialData?.coordinates?.lng || 46.6753,
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    website: initialData?.website || '',
    priceRange: initialData?.priceRange || '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const { lat, lng, ...rest } = form
    onSubmit({
      ...rest,
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
      priceRange: rest.priceRange || undefined,
      website: rest.website || undefined,
      region: rest.region || undefined,
      email: rest.email || undefined,
      phone: rest.phone || undefined,
      description_en: rest.description_en || undefined,
      description_ar: rest.description_ar || undefined,
      category_ar: rest.category_ar || undefined,
    })
  }

  const u = (field, value) => setForm(p => ({ ...p, [field]: value }))

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '0 0 1rem' }}>
        <div className="form-row">
          <div className="form-group">
            <label>النوع *</label>
            <select value={form.type} onChange={e => u('type', e.target.value)}>
              {allowedTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>الفئة *</label>
            <select value={form.category} onChange={e => {
              const cat = categories.find(c => c.value === e.target.value)
              setForm(p => ({ ...p, category: e.target.value, category_ar: cat?.label || '' }))
            }}>
              {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>الاسم (بالعربية) *</label>
            <input value={form.name_ar} onChange={e => u('name_ar', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>الاسم (بالإنجليزية) *</label>
            <input value={form.name_en} onChange={e => u('name_en', e.target.value)} dir="ltr" required />
          </div>
        </div>

        <div className="form-group">
          <label>العنوان *</label>
          <input value={form.address} onChange={e => u('address', e.target.value)} required />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>المدينة *</label>
            <select value={form.city} onChange={e => u('city', e.target.value)}>
              {cities.map(c => <option key={c} value={c}>{citiesAr[c] || c}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>المنطقة</label>
            <input value={form.region} onChange={e => u('region', e.target.value)} placeholder="مثال: منطقة الرياض" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>خط العرض *</label>
            <input type="number" step="any" value={form.lat} onChange={e => u('lat', e.target.value)} dir="ltr" required />
          </div>
          <div className="form-group">
            <label>خط الطول *</label>
            <input type="number" step="any" value={form.lng} onChange={e => u('lng', e.target.value)} dir="ltr" required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>الهاتف</label>
            <input value={form.phone} onChange={e => u('phone', e.target.value)} dir="ltr" />
          </div>
          <div className="form-group">
            <label>البريد الإلكتروني</label>
            <input type="email" value={form.email} onChange={e => u('email', e.target.value)} dir="ltr" />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>الموقع الإلكتروني</label>
            <input type="url" value={form.website} onChange={e => u('website', e.target.value)} dir="ltr" placeholder="https://example.com" />
          </div>
          <div className="form-group">
            <label>نطاق السعر</label>
            <select value={form.priceRange} onChange={e => u('priceRange', e.target.value)}>
              <option value="">غير محدد</option>
              <option value="$">$ اقتصادي</option>
              <option value="$$">$$ متوسط</option>
              <option value="$$$">$$$ مرتفع</option>
              <option value="$$$$">$$$$ فاخر</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label>الوصف (بالعربية)</label>
          <textarea value={form.description_ar} onChange={e => u('description_ar', e.target.value)} rows={3} />
        </div>
        <div className="form-group">
          <label>الوصف (بالإنجليزية)</label>
          <textarea value={form.description_en} onChange={e => u('description_en', e.target.value)} rows={3} dir="ltr" />
        </div>

        <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? 'جاري الإرسال...' : initialData ? 'تحديث (سيعاد للمراجعة)' : 'إرسال للمراجعة'}
        </button>
      </div>
    </form>
  )
}

// === Bookings Tab ===
function BusinessBookingsTab() {
  const bookings = useQuery(api.bookings.queries.getBusinessBookings, {})
  const confirmBooking = useMutation(api.bookings.mutations.confirmBooking)
  const completeBooking = useMutation(api.bookings.mutations.completeBooking)
  const cancelBooking = useMutation(api.bookings.mutations.cancelBooking)

  const [actionId, setActionId] = useState(null)
  const [completeNotes, setCompleteNotes] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const todaysBookings = (bookings || []).filter(
    b => b.date === today && b.status !== 'cancelled'
  ).sort((a, b) => a.time.localeCompare(b.time))

  const upcoming = (bookings || []).filter(
    b => b.date > today && (b.status === 'pending' || b.status === 'confirmed')
  ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  const pending = (bookings || []).filter(b => b.status === 'pending')

  const handleConfirm = async (id) => {
    setActionId(id)
    try { await confirmBooking({ bookingId: id }) } catch (e) { console.error(e) }
    setActionId(null)
  }

  const handleComplete = async (id) => {
    setActionId(id)
    try {
      await completeBooking({ bookingId: id, notes: completeNotes || undefined })
      setShowCompleteModal(null)
      setCompleteNotes('')
    } catch (e) { console.error(e) }
    setActionId(null)
  }

  const handleCancel = async (id) => {
    if (!confirm('هل تريد إلغاء هذا الحجز؟')) return
    setActionId(id)
    try { await cancelBooking({ bookingId: id }) } catch (e) { console.error(e) }
    setActionId(null)
  }

  const statusLabel = { pending: 'قيد الانتظار', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغي' }

  const confirmedToday = todaysBookings.filter(b => b.status === 'confirmed').length
  const thisWeekCompleted = (bookings || []).filter(b => {
    if (b.status !== 'completed') return false
    const d = new Date(b.date)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return d >= weekAgo
  }).length

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'في الانتظار', value: pending.length, color: '#f59e0b' },
          { label: 'حجوزات اليوم', value: todaysBookings.length, color: '#3b82f6' },
          { label: 'مؤكدة اليوم', value: confirmedToday, color: '#059669' },
          { label: 'مكتملة هذا الأسبوع', value: thisWeekCompleted, color: '#6366f1' },
        ].map((stat, i) => (
          <div key={i} className="dash-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, margin: '0 0 0.25rem' }}>{stat.value}</p>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Today's bookings */}
      {todaysBookings.length > 0 && (
        <div className="subsection">
          <h3 className="subsection-title">حجوزات اليوم</h3>
          {todaysBookings.map(booking => (
            <BookingRow
              key={booking._id}
              booking={booking}
              statusLabel={statusLabel}
              actionId={actionId}
              onConfirm={handleConfirm}
              onComplete={(id) => setShowCompleteModal(id)}
              onCancel={handleCancel}
            />
          ))}
        </div>
      )}

      {/* Upcoming */}
      <div className="subsection">
        <h3 className="subsection-title">الحجوزات القادمة</h3>
        {bookings === undefined ? (
          <div className="dash-card" style={{ textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>لا توجد حجوزات قادمة</p>
          </div>
        ) : (
          upcoming.map(booking => (
            <BookingRow
              key={booking._id}
              booking={booking}
              statusLabel={statusLabel}
              actionId={actionId}
              onConfirm={handleConfirm}
              onComplete={(id) => setShowCompleteModal(id)}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>

      {/* Complete modal */}
      <AnimatePresence>
        {showCompleteModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowCompleteModal(null)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="modal-header">
                <h2>إتمام الحجز</h2>
                <button className="modal-close" onClick={() => setShowCompleteModal(null)}>&times;</button>
              </div>
              <div className="form-group">
                <label>ملاحظات (اختياري)</label>
                <textarea
                  value={completeNotes}
                  onChange={e => setCompleteNotes(e.target.value)}
                  rows={3}
                  placeholder="أضف ملاحظات..."
                />
              </div>
              <button
                className="btn-primary"
                onClick={() => handleComplete(showCompleteModal)}
                disabled={actionId === showCompleteModal}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {actionId === showCompleteModal ? 'جاري الإتمام...' : 'تأكيد الإتمام'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function BookingRow({ booking, statusLabel, actionId, onConfirm, onComplete, onCancel }) {
  const formatDate = (dateStr) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-SA', {
      weekday: 'short', month: 'short', day: 'numeric'
    })
  }

  return (
    <div className="dash-card">
      <div className="apt-card">
        <div className="apt-info">
          <h3>{booking.tourist?.firstName} {booking.tourist?.lastName || booking.tourist?.email}</h3>
          <p>{booking.tourist?.phone || ''}</p>
          <p className="apt-datetime">{formatDate(booking.date)} · {booking.time}</p>
          {booking.partySize && <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>عدد الأشخاص: {booking.partySize}</p>}
          {booking.notes && <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.25rem' }}>{booking.notes}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <span className={`status-badge status-${booking.status}`}>
            {statusLabel[booking.status] || booking.status}
          </span>
          <div className="apt-actions">
            {booking.status === 'pending' && (
              <button
                className="apt-action-btn confirm"
                onClick={() => onConfirm(booking._id)}
                disabled={actionId === booking._id}
              >
                تأكيد
              </button>
            )}
            {(booking.status === 'pending' || booking.status === 'confirmed') && (
              <>
                <button
                  className="apt-action-btn"
                  onClick={() => onComplete(booking._id)}
                  disabled={actionId === booking._id}
                >
                  إتمام
                </button>
                <button
                  className="apt-action-btn danger"
                  onClick={() => onCancel(booking._id)}
                  disabled={actionId === booking._id}
                >
                  إلغاء
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// === Schedule Tab ===
function ScheduleTab({ user }) {
  const listings = useQuery(api.listings.queries.listListings, { limit: 100 })
  const saveWorkingHours = useMutation(api.listings.mutations.saveWorkingHours)

  const listing = listings?.find(l => l.email === user?.email)

  const [schedule, setSchedule] = useState(
    DAYS.map(day => ({
      day: day.key,
      open: '08:00',
      close: '22:00',
      isClosed: day.key === 'friday',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (listing?.workingHours?.length) {
      const merged = DAYS.map(day => {
        const existing = listing.workingHours.find(wh => wh.day === day.key)
        return existing || { day: day.key, open: '08:00', close: '22:00', isClosed: true }
      })
      setSchedule(merged)
    }
  }, [listing])

  const updateDay = (index, field, value) => {
    setSchedule(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const handleSave = async () => {
    if (!listing) return
    setSaving(true)
    try {
      await saveWorkingHours({
        listingId: listing._id,
        workingHours: schedule,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save schedule error:', err)
    }
    setSaving(false)
  }

  if (!listing) {
    return (
      <div className="empty-state" style={{ padding: '2rem' }}>
        <p>لم يتم ربط حسابك بقائمة أعمال بعد. تواصل مع الإدارة.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="section-header">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>جدول العمل الأسبوعي</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {saved && <span style={{ color: '#059669', fontSize: '0.875rem' }}>تم الحفظ</span>}
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ الجدول'}
          </button>
        </div>
      </div>

      <div className="dash-card" style={{ marginBottom: '1.5rem' }}>
        {schedule.map((day, index) => {
          const dayInfo = DAYS.find(d => d.key === day.day)
          return (
            <div
              key={day.day}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.75rem 0',
                borderBottom: index < schedule.length - 1 ? '1px solid #f3f4f6' : 'none',
              }}
            >
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '120px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!day.isClosed}
                  onChange={e => updateDay(index, 'isClosed', !e.target.checked)}
                  style={{ accentColor: '#0D7A5F' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: day.isClosed ? '#9ca3af' : '#111827' }}>
                  {dayInfo?.ar}
                </span>
              </label>

              {!day.isClosed ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="time"
                    value={day.open}
                    onChange={e => updateDay(index, 'open', e.target.value)}
                    style={{
                      padding: '0.375rem 0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                    }}
                  />
                  <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>—</span>
                  <input
                    type="time"
                    value={day.close}
                    onChange={e => updateDay(index, 'close', e.target.value)}
                    style={{
                      padding: '0.375rem 0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>
              ) : (
                <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>مغلق</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// === Business Profile Tab ===
function BusinessProfileTab({ user }) {
  const updateProfile = useMutation(api.users.mutations.updateProfile)
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Update profile error:', err)
    }
    setSaving(false)
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.25rem' }}>الملف الشخصي</h2>

      <div className="dash-card">
        <div className="form-group">
          <label>البريد الإلكتروني</label>
          <input value={user?.email || ''} disabled style={{ background: '#f9fafb', color: '#9ca3af' }} />
        </div>

        <div className="form-group">
          <label>نوع العمل</label>
          <input value={user?.businessType || '-'} disabled style={{ background: '#f9fafb', color: '#9ca3af' }} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>الاسم الأول</label>
            <input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} />
          </div>
          <div className="form-group">
            <label>اسم العائلة</label>
            <input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} />
          </div>
        </div>

        <div className="form-group">
          <label>رقم الهاتف</label>
          <input
            value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="+966 5X XXX XXXX"
            dir="ltr"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          {saved && <span style={{ color: '#059669', fontSize: '0.875rem' }}>تم الحفظ</span>}
        </div>

        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            حالة الحساب: {' '}
            <span style={{ fontWeight: 500, color: user?.isApproved ? '#059669' : '#f59e0b' }}>
              {user?.isApproved ? 'مفعّل' : 'قيد المراجعة'}
            </span>
          </p>
          {user?.cvFileId && (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
              وثيقة العمل: مرفوعة
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
