import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useConvex } from 'convex/react'
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

export default function DoctorDashboard() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const saveBusinessDoc = useMutation(api.users.mutations.saveBusinessDoc)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState(null)

  // Role-adaptive tabs
  const tabs = user?.role === 'service_provider'
    ? [
        { id: 'services', label: 'خدماتي' },
        { id: 'bookings', label: 'الحجوزات' },
        { id: 'profile', label: 'الملف الشخصي' },
      ]
    : [
        { id: 'listings', label: 'قوائمي' },
        { id: 'bookings', label: 'الحجوزات' },
        { id: 'schedule', label: 'جدول العمل' },
        { id: 'profile', label: 'الملف الشخصي' },
      ]

  // Set default active tab based on role
  useEffect(() => {
    if (user && activeTab === null) {
      setActiveTab(user.role === 'service_provider' ? 'services' : 'listings')
    }
  }, [user, activeTab])

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
              onClick={async () => { await authClient.signOut(); window.location.href = '/home' }}
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
          {activeTab === 'services' && <MyServicesTab user={user} />}
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
    "Hofuf", "Mubarraz", "Al Oyoun", "Al Omran", "Al Jafer",
    "Al Battaliyah", "Al Taraf", "Al Shuqaiq", "Al Qarah", "Al Kilabiyah",
    "Al Jishshah", "Al Fudhool", "Al Marah", "Al Hulaila", "Al Salhiyah"
  ]
  const SAUDI_CITIES_AR = {
    "Hofuf": "الهفوف", "Mubarraz": "المبرز", "Al Oyoun": "العيون", "Al Omran": "العمران",
    "Al Jafer": "الجفر", "Al Battaliyah": "البطالية", "Al Taraf": "الطرف", "Al Shuqaiq": "الشقيق",
    "Al Qarah": "القارة", "Al Kilabiyah": "الكلابية", "Al Jishshah": "الجشة", "Al Fudhool": "الفضول",
    "Al Marah": "المراح", "Al Hulaila": "الحليلة", "Al Salhiyah": "الصالحية"
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

// === Image Uploader Component ===
function ImageUploader({ images, setImages }) {
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const convex = useConvex()
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 5 - images.length
    if (remaining <= 0) return
    const toUpload = files.slice(0, remaining)

    setUploading(true)
    try {
      for (const file of toUpload) {
        const postUrl = await generateUploadUrl()
        const result = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        const { storageId } = await result.json()
        const url = await convex.query(api.users.queries.getStorageUrl, { storageId })
        if (url) {
          setImages(prev => [...prev, { storageId, url }])
        }
      }
    } catch (err) {
      console.error('Image upload error:', err)
    }
    setUploading(false)
    e.target.value = ''
  }

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="form-group">
      <label>الصور (حتى 5)</label>
      {images.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          {images.map((img, i) => (
            <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => removeImage(i)}
                style={{
                  position: 'absolute', top: '2px', left: '2px',
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'rgba(220,38,38,0.85)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: '0.75rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length < 5 && (
        <label style={{
          display: 'inline-block', padding: '0.5rem 1rem',
          background: '#f3f4f6', border: '1px dashed #d1d5db',
          borderRadius: '10px', cursor: 'pointer', fontSize: '0.8125rem',
          color: '#6b7280', textAlign: 'center',
        }}>
          {uploading ? 'جاري الرفع...' : `اختر صور (${images.length}/5)`}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            disabled={uploading}
            style={{ display: 'none' }}
          />
        </label>
      )}
    </div>
  )
}

function CreateListingForm({ onSubmit, submitting, initialData, allowedTypes, categories, cities, citiesAr }) {
  const [images, setImages] = useState(
    (initialData?.images || []).map(url => ({ storageId: null, url }))
  )
  const [amenitiesInput, setAmenitiesInput] = useState(
    (initialData?.amenities || []).join('، ')
  )
  const [form, setForm] = useState({
    type: initialData?.type || allowedTypes[0]?.value || 'hotel',
    category: initialData?.category || categories[0]?.value || '',
    category_ar: initialData?.category_ar || categories[0]?.label || '',
    name_en: initialData?.name_en || '',
    name_ar: initialData?.name_ar || '',
    description_en: initialData?.description_en || '',
    description_ar: initialData?.description_ar || '',
    address: initialData?.address || '',
    city: initialData?.city || 'Hofuf',
    region: initialData?.region || '',
    lat: initialData?.coordinates?.lat || 25.3854,
    lng: initialData?.coordinates?.lng || 49.5683,
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    website: initialData?.website || '',
    priceRange: initialData?.priceRange || '',
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const { lat, lng, ...rest } = form
    const amenities = amenitiesInput
      .split(/[,،]/)
      .map(s => s.trim())
      .filter(Boolean)
    onSubmit({
      ...rest,
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
      images: images.map(i => i.url).filter(Boolean),
      amenities: amenities.length > 0 ? amenities : undefined,
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

  // Parse amenities for chips display
  const amenitiesChips = amenitiesInput
    .split(/[,،]/)
    .map(s => s.trim())
    .filter(Boolean)

  const removeAmenity = (index) => {
    const updated = amenitiesChips.filter((_, i) => i !== index)
    setAmenitiesInput(updated.join('، '))
  }

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

        {/* Image Upload */}
        <ImageUploader images={images} setImages={setImages} />

        {/* Amenities */}
        <div className="form-group">
          <label>المرافق والخدمات (مفصولة بفاصلة)</label>
          <input
            value={amenitiesInput}
            onChange={e => setAmenitiesInput(e.target.value)}
            placeholder="واي فاي، مسبح، موقف سيارات، مطعم"
          />
          {amenitiesChips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.5rem' }}>
              {amenitiesChips.map((chip, i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.25rem 0.625rem', background: '#ecfdf5',
                    color: '#065f46', borderRadius: '9999px', fontSize: '0.75rem',
                    fontWeight: 500,
                  }}
                >
                  {chip}
                  <button
                    type="button"
                    onClick={() => removeAmenity(i)}
                    style={{
                      background: 'none', border: 'none', color: '#065f46',
                      cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1,
                      padding: '0 0.125rem',
                    }}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button className="btn-primary" type="submit" disabled={submitting} style={{ width: '100%', justifyContent: 'center' }}>
          {submitting ? 'جاري الإرسال...' : initialData ? 'تحديث (سيعاد للمراجعة)' : 'إرسال للمراجعة'}
        </button>
      </div>
    </form>
  )
}

// === My Services Tab (Service Providers) ===
const SERVICE_TYPES = [
  { value: 'tour_guide', label: 'مرشد سياحي' },
  { value: 'photographer', label: 'مصور' },
  { value: 'driver', label: 'سائق' },
  { value: 'translator', label: 'مترجم' },
  { value: 'event_planner', label: 'منظم فعاليات' },
  { value: 'catering', label: 'تقديم طعام' },
  { value: 'equipment_rental', label: 'تأجير معدات' },
  { value: 'other', label: 'أخرى' },
]
const PRICE_UNITS = [
  { value: 'per_hour', label: 'بالساعة' },
  { value: 'per_day', label: 'باليوم' },
  { value: 'per_event', label: 'للفعالية' },
  { value: 'fixed', label: 'سعر ثابت' },
]

function MyServicesTab({ user }) {
  const myServices = useQuery(api.services.queries.getMyServices, {})
  const submitService = useMutation(api.services.mutations.submitService)
  const updateMyService = useMutation(api.services.mutations.updateMyService)
  const deleteMyService = useMutation(api.services.mutations.deleteMyService)
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [filter, setFilter] = useState('all')

  const statusConfig = {
    pending: { label: 'قيد المراجعة', color: '#f59e0b', bg: '#fef3c7' },
    approved: { label: 'معتمد', color: '#059669', bg: '#d1fae5' },
    rejected: { label: 'مرفوض', color: '#dc2626', bg: '#fee2e2' },
  }

  const serviceTypeLabels = Object.fromEntries(SERVICE_TYPES.map(t => [t.value, t.label]))
  const priceUnitLabels = Object.fromEntries(PRICE_UNITS.map(u => [u.value, u.label]))

  const handleSubmit = async (formData) => {
    setSubmitting(true)
    try {
      if (editingService) {
        await updateMyService({ serviceId: editingService._id, ...formData })
      } else {
        await submitService(formData)
      }
      setShowForm(false)
      setEditingService(null)
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
    setSubmitting(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه الخدمة؟')) return
    try {
      await deleteMyService({ serviceId: id })
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
  }

  const all = myServices || []
  const pending = all.filter(s => s.status === 'pending').length
  const approved = all.filter(s => s.status === 'approved').length
  const rejected = all.filter(s => s.status === 'rejected').length

  const filtered = filter === 'all' ? all : all.filter(s => s.status === filter)

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'الإجمالي', value: all.length, color: '#6b7280' },
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

      {/* Add New + Filter */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          className="btn-primary"
          onClick={() => { setShowForm(true); setEditingService(null); }}
        >
          نشر خدمة جديدة
        </button>
        <div className="filter-tabs">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'pending', label: 'قيد المراجعة' },
            { id: 'approved', label: 'معتمد' },
            { id: 'rejected', label: 'مرفوض' },
          ].map(f => (
            <button
              key={f.id}
              className={`filter-tab ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Service Cards */}
      {myServices === undefined ? (
        <div className="dash-card" style={{ textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ padding: '2rem' }}>
          <p>{filter === 'all' ? 'لم تقم بإضافة أي خدمات بعد. اضغط "نشر خدمة جديدة" للبدء.' : 'لا توجد خدمات بهذه الحالة.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map(service => {
            const sc = statusConfig[service.status] || statusConfig.pending
            return (
              <div key={service._id} className="dash-card">
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
                        {serviceTypeLabels[service.serviceType] || service.serviceType}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 600 }}>{service.title_ar}</h3>
                    <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>{service.title_en}</p>
                    {service.price != null && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#059669', fontWeight: 500 }}>
                        {service.price} ر.س {priceUnitLabels[service.priceUnit] || ''}
                      </p>
                    )}
                    {service.city && (
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem', color: '#9ca3af' }}>
                        {service.city}
                      </p>
                    )}
                    {service.status === 'rejected' && service.rejectionReason && (
                      <div style={{
                        marginTop: '0.5rem', padding: '0.5rem 0.75rem',
                        background: '#fee2e2', borderRadius: '8px',
                        fontSize: '0.8125rem', color: '#991b1b'
                      }}>
                        سبب الرفض: {service.rejectionReason}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="apt-action-btn"
                      onClick={() => { setEditingService(service); setShowForm(true); }}
                      style={{ fontSize: '0.8125rem' }}
                    >
                      تعديل
                    </button>
                    <button
                      className="apt-action-btn danger"
                      onClick={() => handleDelete(service._id)}
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

      {/* Create/Edit Service Modal */}
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
                <h2>{editingService ? 'تعديل الخدمة' : 'نشر خدمة جديدة'}</h2>
                <button className="modal-close" onClick={() => { setShowForm(false); setEditingService(null); }}>&times;</button>
              </div>
              <CreateServiceForm
                onSubmit={handleSubmit}
                submitting={submitting}
                initialData={editingService}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CreateServiceForm({ onSubmit, submitting, initialData }) {
  const [images, setImages] = useState(
    (initialData?.images || []).map(url => ({ storageId: null, url }))
  )
  const [form, setForm] = useState({
    serviceType: initialData?.serviceType || SERVICE_TYPES[0].value,
    title_ar: initialData?.title_ar || '',
    title_en: initialData?.title_en || '',
    description_ar: initialData?.description_ar || '',
    description_en: initialData?.description_en || '',
    price: initialData?.price ?? '',
    priceUnit: initialData?.priceUnit || PRICE_UNITS[0].value,
    city: initialData?.city || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
  })

  const u = (field, value) => setForm(p => ({ ...p, [field]: value }))

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      ...form,
      price: form.price !== '' ? parseFloat(form.price) : undefined,
      priceUnit: form.price !== '' ? form.priceUnit : undefined,
      images: images.map(i => i.url).filter(Boolean),
      phone: form.phone || undefined,
      email: form.email || undefined,
      description_en: form.description_en || undefined,
      description_ar: form.description_ar || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '0 0 1rem' }}>
        <div className="form-group">
          <label>نوع الخدمة *</label>
          <select value={form.serviceType} onChange={e => u('serviceType', e.target.value)}>
            {SERVICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>عنوان الخدمة (بالعربية) *</label>
            <input value={form.title_ar} onChange={e => u('title_ar', e.target.value)} required />
          </div>
          <div className="form-group">
            <label>عنوان الخدمة (بالإنجليزية) *</label>
            <input value={form.title_en} onChange={e => u('title_en', e.target.value)} dir="ltr" required />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>السعر (ر.س)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={form.price}
              onChange={e => u('price', e.target.value)}
              dir="ltr"
              placeholder="مثال: 250"
            />
          </div>
          <div className="form-group">
            <label>وحدة السعر</label>
            <select value={form.priceUnit} onChange={e => u('priceUnit', e.target.value)}>
              {PRICE_UNITS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>المدينة</label>
            <input value={form.city} onChange={e => u('city', e.target.value)} placeholder="مثال: الرياض" />
          </div>
          <div className="form-group">
            <label>الهاتف</label>
            <input value={form.phone} onChange={e => u('phone', e.target.value)} dir="ltr" placeholder="+966 5X XXX XXXX" />
          </div>
        </div>

        <div className="form-group">
          <label>البريد الإلكتروني</label>
          <input type="email" value={form.email} onChange={e => u('email', e.target.value)} dir="ltr" />
        </div>

        <div className="form-group">
          <label>الوصف (بالعربية)</label>
          <textarea value={form.description_ar} onChange={e => u('description_ar', e.target.value)} rows={3} />
        </div>
        <div className="form-group">
          <label>الوصف (بالإنجليزية)</label>
          <textarea value={form.description_en} onChange={e => u('description_en', e.target.value)} rows={3} dir="ltr" />
        </div>

        {/* Image Upload */}
        <ImageUploader images={images} setImages={setImages} />

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
