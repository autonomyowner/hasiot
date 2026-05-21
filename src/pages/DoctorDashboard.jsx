import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useConvex } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { authClient } from '../lib/auth-client'
import { motion, AnimatePresence } from 'framer-motion'
import './DoctorDashboard.css'

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

  // Set default active tab based on role
  useEffect(() => {
    if (user && activeTab === null) {
      setActiveTab(user.role === 'service_provider' ? 'services' : 'overview')
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--color-bg)' }}>
        <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-arabic)' }}>جاري التحميل...</p>
      </div>
    )
  }

  if (!user) return null

  const needsDoc = !user.isApproved && !user.cvFileId && !uploadSuccess
  const pendingReview = !user.isApproved && (user.cvFileId || uploadSuccess)
  const isApproved = user.isApproved === true
  const isServiceProvider = user.role === 'service_provider'

  return (
    <div className="partner-dashboard" dir="rtl">
      {/* Sidebar */}
      <aside className="partner-sidebar">
        <div className="sidebar-logo">
          <Link to="/">Hasio</Link>
        </div>

        <nav className="sidebar-nav">
          {/* Overview only for business owners */}
          {!isServiceProvider && (
            <button
              className={`sidebar-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span className="nav-icon">📊</span>
              نظرة عامة
            </button>
          )}

          {/* Listings tab for business owners */}
          {!isServiceProvider && (
            <button
              className={`sidebar-nav-item ${activeTab === 'listings' ? 'active' : ''}`}
              onClick={() => setActiveTab('listings')}
            >
              <span className="nav-icon">🏛️</span>
              قوائمي
            </button>
          )}

          {/* Services tab for service providers */}
          {isServiceProvider && (
            <button
              className={`sidebar-nav-item ${activeTab === 'services' ? 'active' : ''}`}
              onClick={() => setActiveTab('services')}
            >
              <span className="nav-icon">⚙️</span>
              خدماتي
            </button>
          )}

          <button
            className={`sidebar-nav-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            <span className="nav-icon">📅</span>
            الحجوزات
          </button>

          {/* Schedule tab only for business owners */}
          {!isServiceProvider && (
            <button
              className={`sidebar-nav-item ${activeTab === 'schedule' ? 'active' : ''}`}
              onClick={() => setActiveTab('schedule')}
            >
              <span className="nav-icon">🕐</span>
              جدول العمل
            </button>
          )}

          <button
            className={`sidebar-nav-item ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="nav-icon">👤</span>
            الملف الشخصي
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button
            style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: '8px', width: '100%' }}
            onClick={async () => { await authClient.signOut(); window.location.href = '/home' }}
          >
            <span>🚪</span>
            تسجيل الخروج
          </button>
          <Link to="/" className="back-link">
            <span>→</span>
            العودة للرئيسية
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="partner-main">
        {/* Document Upload Banner */}
        {needsDoc && (
          <div style={{
            background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem', marginBottom: '24px'
          }}>
            <h3 style={{ color: '#92400e', margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 600 }}>
              مطلوب: رفع وثيقة العمل
            </h3>
            <p style={{ color: '#92400e', margin: '0 0 0.875rem', fontSize: '0.875rem', lineHeight: 1.6 }}>
              لتفعيل حسابك، يرجى رفع رخصة العمل أو وثيقة تثبت نشاطك التجاري.
              سيقوم فريق الإدارة بمراجعتها والموافقة على حسابك.
            </p>
            <label style={{
              display: 'inline-block', padding: '0.5rem 1.125rem',
              background: 'var(--color-primary)', color: 'white',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              fontSize: '0.875rem', fontWeight: 600
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
            background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 'var(--radius-lg)',
            padding: '1.25rem 1.5rem', marginBottom: '24px'
          }}>
            <h3 style={{ color: '#1e40af', margin: '0 0 0.375rem', fontSize: '0.9375rem', fontWeight: 600 }}>
              حسابك قيد المراجعة
            </h3>
            <p style={{ color: '#1e40af', margin: 0, fontSize: '0.875rem', lineHeight: 1.6 }}>
              تم استلام وثيقتك بنجاح. فريق الإدارة يراجع طلبك حالياً.
              سيتم تفعيل حسابك بعد الموافقة.
            </p>
          </div>
        )}

        {/* Tab content — disabled overlay if not approved */}
        <div style={{ opacity: isApproved ? 1 : 0.5, pointerEvents: isApproved ? 'auto' : 'none' }}>
          {activeTab === 'overview' && !isServiceProvider && <OverviewTab user={user} setActiveTab={setActiveTab} />}
          {activeTab === 'listings' && !isServiceProvider && <MyListingsTab user={user} />}
          {activeTab === 'services' && isServiceProvider && <MyServicesTab user={user} />}
          {activeTab === 'bookings' && <BusinessBookingsTab />}
          {activeTab === 'schedule' && !isServiceProvider && <ScheduleTab user={user} />}
          {activeTab === 'profile' && <BusinessProfileTab user={user} />}
        </div>
      </main>
    </div>
  )
}

// === Overview Tab ===
function OverviewTab({ user, setActiveTab }) {
  const myListings = useQuery(api.listings.queries.getMyListings, {})

  const total = myListings?.length ?? 0
  const approved = myListings?.filter(l => l.status === 'approved').length ?? 0
  const pending = myListings?.filter(l => l.status === 'pending').length ?? 0
  const rejected = myListings?.filter(l => l.status === 'rejected').length ?? 0

  const typeLabels = { hotel: 'فندق', restaurant: 'مطعم', attraction: 'معلم سياحي', event: 'فعالية', tour: 'جولة' }

  return (
    <div>
      <div className="partner-main-header">
        <h1>مرحباً، {user?.firstName || user?.email} 👋</h1>
        <p>نظرة عامة على نشاطك التجاري</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-icon">🏛️</div>
          <div className="stat-card-label">إجمالي القوائم</div>
          <div className="stat-card-value">{total}</div>
          <div className="stat-card-trend neutral">جميع الحالات</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-label">معتمدة</div>
          <div className="stat-card-value">{approved}</div>
          <div className="stat-card-trend up">نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-label">قيد المراجعة</div>
          <div className="stat-card-value">{pending}</div>
          <div className="stat-card-trend neutral">بانتظار الموافقة</div>
        </div>
      </div>

      {/* Recent listings table */}
      <div className="section-card">
        <div className="section-card-header">
          <h2>آخر القوائم</h2>
          <button className="btn-sm primary" onClick={() => setActiveTab('listings')}>
            عرض الكل
          </button>
        </div>
        <div className="section-card-body">
          {myListings === undefined ? (
            <p style={{ padding: '20px 24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>جاري التحميل...</p>
          ) : myListings.length === 0 ? (
            <p style={{ padding: '20px 24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>لا توجد قوائم بعد.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>المدينة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {myListings.slice(0, 5).map(l => (
                  <tr key={l._id}>
                    <td>
                      <div className="table-listing-name">{l.name_ar || l.name_en}</div>
                      <div className="table-listing-type">{typeLabels[l.type] || l.type}</div>
                    </td>
                    <td>{l.city}</td>
                    <td>
                      <span className={`status-badge ${l.status || 'pending'}`}>
                        {l.status === 'approved' ? 'معتمد' : l.status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Rejection summary */}
      {rejected > 0 && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-lg)',
          padding: '16px 20px', fontSize: '14px', color: '#991B1B'
        }}>
          لديك {rejected} قائمة مرفوضة. راجع <button
            onClick={() => setActiveTab('listings')}
            style={{ background: 'none', border: 'none', color: '#991B1B', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '14px' }}
          >قوائمي</button> لمعرفة السبب وإعادة التقديم.
        </div>
      )}
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

  return (
    <div>
      <div className="partner-main-header">
        <h1>قوائمي</h1>
        <p>إدارة قوائم الفنادق والمطاعم والمعالم السياحية</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-icon">🏛️</div>
          <div className="stat-card-label">الإجمالي</div>
          <div className="stat-card-value">{(myListings || []).length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-label">معتمدة</div>
          <div className="stat-card-value">{approved}</div>
          <div className="stat-card-trend up">نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-label">قيد المراجعة</div>
          <div className="stat-card-value">{pending}</div>
        </div>
      </div>

      {/* Listings table */}
      <div className="section-card">
        <div className="section-card-header">
          <h2>القوائم ({(myListings || []).length})</h2>
          <button
            className="btn-sm primary"
            onClick={() => { setShowForm(true); setEditingListing(null) }}
          >
            + إضافة جديد
          </button>
        </div>
        <div className="section-card-body">
          {myListings === undefined ? (
            <p style={{ padding: '20px 24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>جاري التحميل...</p>
          ) : myListings.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '15px' }}>لم تقم بإضافة أي قوائم بعد.</p>
              <button
                className="btn-sm primary"
                style={{ marginTop: '12px' }}
                onClick={() => { setShowForm(true); setEditingListing(null) }}
              >
                إضافة أول قائمة
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>المدينة</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {myListings.map(listing => {
                  const sc = statusConfig[listing.status] || statusConfig.pending
                  return (
                    <tr key={listing._id}>
                      <td>
                        <div className="table-listing-name">{listing.name_ar}</div>
                        <div className="table-listing-type">{typeLabels[listing.type] || listing.type}</div>
                        {listing.status === 'rejected' && listing.rejectionReason && (
                          <div style={{
                            marginTop: '4px', padding: '4px 8px',
                            background: '#fee2e2', borderRadius: '6px',
                            fontSize: '12px', color: '#991b1b'
                          }}>
                            سبب الرفض: {listing.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>{SAUDI_CITIES_AR[listing.city] || listing.city}</td>
                      <td>
                        <span className={`status-badge ${listing.status || 'pending'}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn-sm primary"
                            onClick={() => { setEditingListing(listing); setShowForm(true) }}
                          >
                            تعديل
                          </button>
                          <button
                            className="btn-sm danger"
                            onClick={() => handleDelete(listing._id)}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                width: '100%', maxWidth: '600px', maxHeight: '85vh',
                overflow: 'auto', boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{
                padding: '20px 24px', borderBottom: '1px solid var(--color-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {editingListing ? 'تعديل القائمة' : 'إضافة قائمة جديدة'}
                </h2>
                <button
                  onClick={() => { setShowForm(false); setEditingListing(null) }}
                  style={{ fontSize: '22px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                >
                  &times;
                </button>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '20px 24px 24px' }}>
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

        <button
          className="btn-submit"
          type="submit"
          disabled={submitting}
          style={{ width: '100%' }}
        >
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

  const filtered = filter === 'all' ? all : all.filter(s => s.status === filter)

  return (
    <div>
      <div className="partner-main-header">
        <h1>خدماتي</h1>
        <p>إدارة الخدمات السياحية المقدمة</p>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-card-icon">⚙️</div>
          <div className="stat-card-label">الإجمالي</div>
          <div className="stat-card-value">{all.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-label">معتمدة</div>
          <div className="stat-card-value">{approved}</div>
          <div className="stat-card-trend up">نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">⏳</div>
          <div className="stat-card-label">قيد المراجعة</div>
          <div className="stat-card-value">{pending}</div>
        </div>
      </div>

      {/* Table card */}
      <div className="section-card">
        <div className="section-card-header">
          <h2>الخدمات ({all.length})</h2>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Filter buttons */}
            {[
              { id: 'all', label: 'الكل' },
              { id: 'pending', label: 'مراجعة' },
              { id: 'approved', label: 'معتمد' },
              { id: 'rejected', label: 'مرفوض' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '4px 10px', fontSize: '12px', fontWeight: 600,
                  borderRadius: '20px', border: 'none', cursor: 'pointer',
                  background: filter === f.id ? 'var(--color-primary)' : 'var(--color-bg)',
                  color: filter === f.id ? 'white' : 'var(--color-text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
            <button
              className="btn-sm primary"
              onClick={() => { setShowForm(true); setEditingService(null) }}
            >
              + نشر خدمة
            </button>
          </div>
        </div>
        <div className="section-card-body">
          {myServices === undefined ? (
            <p style={{ padding: '20px 24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>جاري التحميل...</p>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <p style={{ fontSize: '15px' }}>
                {filter === 'all' ? 'لم تقم بإضافة أي خدمات بعد.' : 'لا توجد خدمات بهذه الحالة.'}
              </p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>الخدمة</th>
                  <th>النوع</th>
                  <th>السعر</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(service => {
                  const sc = statusConfig[service.status] || statusConfig.pending
                  return (
                    <tr key={service._id}>
                      <td>
                        <div className="table-listing-name">{service.title_ar}</div>
                        <div className="table-listing-type">{service.title_en}</div>
                        {service.status === 'rejected' && service.rejectionReason && (
                          <div style={{
                            marginTop: '4px', padding: '4px 8px',
                            background: '#fee2e2', borderRadius: '6px',
                            fontSize: '12px', color: '#991b1b'
                          }}>
                            سبب الرفض: {service.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: '13px' }}>{serviceTypeLabels[service.serviceType] || service.serviceType}</td>
                      <td style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: 600 }}>
                        {service.price != null ? `${service.price} ر.س ${priceUnitLabels[service.priceUnit] || ''}` : '—'}
                      </td>
                      <td>
                        <span className={`status-badge ${service.status || 'pending'}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn-sm primary"
                            onClick={() => { setEditingService(service); setShowForm(true) }}
                          >
                            تعديل
                          </button>
                          <button
                            className="btn-sm danger"
                            onClick={() => handleDelete(service._id)}
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit Service Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                width: '100%', maxWidth: '600px', maxHeight: '85vh',
                overflow: 'auto', boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{
                padding: '20px 24px', borderBottom: '1px solid var(--color-border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>
                  {editingService ? 'تعديل الخدمة' : 'نشر خدمة جديدة'}
                </h2>
                <button
                  onClick={() => { setShowForm(false); setEditingService(null) }}
                  style={{ fontSize: '22px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                >
                  &times;
                </button>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '20px 24px 24px' }}>
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

        <button
          className="btn-submit"
          type="submit"
          disabled={submitting}
          style={{ width: '100%' }}
        >
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
      <div className="partner-main-header">
        <h1>الحجوزات</h1>
        <p>إدارة حجوزات العملاء</p>
      </div>

      {/* Stats */}
      <div className="stats-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-card-icon">🕐</div>
          <div className="stat-card-label">في الانتظار</div>
          <div className="stat-card-value">{pending.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">📅</div>
          <div className="stat-card-label">حجوزات اليوم</div>
          <div className="stat-card-value">{todaysBookings.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">✅</div>
          <div className="stat-card-label">مؤكدة اليوم</div>
          <div className="stat-card-value">{confirmedToday}</div>
          <div className="stat-card-trend up">نشطة</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-icon">🏆</div>
          <div className="stat-card-label">مكتملة (أسبوع)</div>
          <div className="stat-card-value">{thisWeekCompleted}</div>
        </div>
      </div>

      {/* Today's bookings */}
      {todaysBookings.length > 0 && (
        <div className="section-card" style={{ marginBottom: '24px' }}>
          <div className="section-card-header">
            <h2>حجوزات اليوم</h2>
          </div>
          <div className="section-card-body" style={{ padding: '8px 0' }}>
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
        </div>
      )}

      {/* Upcoming */}
      <div className="section-card">
        <div className="section-card-header">
          <h2>الحجوزات القادمة</h2>
        </div>
        <div className="section-card-body" style={{ padding: '8px 0' }}>
          {bookings === undefined ? (
            <p style={{ padding: '20px 24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>جاري التحميل...</p>
          ) : upcoming.length === 0 ? (
            <p style={{ padding: '20px 24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>لا توجد حجوزات قادمة.</p>
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
      </div>

      {/* Complete modal */}
      <AnimatePresence>
        {showCompleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowCompleteModal(null)}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              zIndex: 1000, padding: '20px'
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                width: '100%', maxWidth: '440px', padding: '24px',
                boxShadow: 'var(--shadow-lg)'
              }}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: '16px'
              }}>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>إتمام الحجز</h2>
                <button
                  onClick={() => setShowCompleteModal(null)}
                  style={{ fontSize: '22px', color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  &times;
                </button>
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>ملاحظات (اختياري)</label>
                <textarea
                  value={completeNotes}
                  onChange={e => setCompleteNotes(e.target.value)}
                  rows={3}
                  placeholder="أضف ملاحظات..."
                  style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>
              <button
                className="btn-submit"
                onClick={() => handleComplete(showCompleteModal)}
                disabled={actionId === showCompleteModal}
                style={{ width: '100%' }}
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

  const statusClass = {
    pending: 'pending',
    confirmed: 'approved',
    completed: 'approved',
    cancelled: 'rejected',
  }

  return (
    <div style={{
      padding: '16px 24px', borderBottom: '1px solid var(--color-border)',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
          {booking.tourist?.firstName} {booking.tourist?.lastName || booking.tourist?.email}
        </div>
        {booking.tourist?.phone && (
          <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '2px' }}>
            {booking.tourist.phone}
          </div>
        )}
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)' }}>
          {formatDate(booking.date)} · {booking.time}
          {booking.partySize && ` · ${booking.partySize} أشخاص`}
        </div>
        {booking.notes && (
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
            {booking.notes}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
        <span className={`status-badge ${statusClass[booking.status] || 'pending'}`}>
          {statusLabel[booking.status] || booking.status}
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          {booking.status === 'pending' && (
            <button
              className="btn-sm primary"
              onClick={() => onConfirm(booking._id)}
              disabled={actionId === booking._id}
            >
              تأكيد
            </button>
          )}
          {(booking.status === 'pending' || booking.status === 'confirmed') && (
            <>
              <button
                className="btn-sm primary"
                onClick={() => onComplete(booking._id)}
                disabled={actionId === booking._id}
                style={{ background: '#059669' }}
              >
                إتمام
              </button>
              <button
                className="btn-sm danger"
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

  return (
    <div>
      <div className="partner-main-header">
        <h1>جدول العمل</h1>
        <p>ضبط أوقات الدوام الأسبوعي</p>
      </div>

      {!listing ? (
        <div className="section-card">
          <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '15px' }}>
            لم يتم ربط حسابك بقائمة أعمال بعد. تواصل مع الإدارة.
          </div>
        </div>
      ) : (
        <div className="section-card">
          <div className="section-card-header">
            <h2>جدول العمل الأسبوعي</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {saved && <span style={{ color: 'var(--color-success)', fontSize: '14px' }}>تم الحفظ ✓</span>}
              <button className="btn-sm primary" onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ الجدول'}
              </button>
            </div>
          </div>
          <div className="section-card-body" style={{ padding: '8px 24px 24px' }}>
            {schedule.map((day, index) => {
              const dayInfo = DAYS.find(d => d.key === day.day)
              return (
                <div
                  key={day.day}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '12px 0',
                    borderBottom: index < schedule.length - 1 ? '1px solid var(--color-border)' : 'none',
                  }}
                >
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '120px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!day.isClosed}
                      onChange={e => updateDay(index, 'isClosed', !e.target.checked)}
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: day.isClosed ? '#9ca3af' : 'var(--color-text)' }}>
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
                          border: '1.5px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>—</span>
                      <input
                        type="time"
                        value={day.close}
                        onChange={e => updateDay(index, 'close', e.target.value)}
                        style={{
                          padding: '0.375rem 0.5rem',
                          border: '1.5px solid var(--color-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                          outline: 'none',
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
      )}
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
      <div className="partner-main-header">
        <h1>الملف الشخصي</h1>
        <p>إدارة معلومات حسابك</p>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h2>معلومات الحساب</h2>
        </div>
        <div className="section-card-body" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input
                value={user?.email || ''}
                disabled
                style={{ padding: '10px 14px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '15px', background: 'var(--color-bg)', color: 'var(--color-text-muted)', width: '100%' }}
              />
            </div>

            <div className="form-group">
              <label>نوع العمل</label>
              <input
                value={user?.businessType || '-'}
                disabled
                style={{ padding: '10px 14px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '15px', background: 'var(--color-bg)', color: 'var(--color-text-muted)', width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group">
                <label>الاسم الأول</label>
                <input
                  value={form.firstName}
                  onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))}
                  style={{ padding: '10px 14px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '15px', fontFamily: 'inherit', outline: 'none', width: '100%' }}
                />
              </div>
              <div className="form-group">
                <label>اسم العائلة</label>
                <input
                  value={form.lastName}
                  onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))}
                  style={{ padding: '10px 14px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '15px', fontFamily: 'inherit', outline: 'none', width: '100%' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label>رقم الهاتف</label>
              <input
                value={form.phone}
                onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="+966 5X XXX XXXX"
                dir="ltr"
                style={{ padding: '10px 14px', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-md)', fontSize: '15px', fontFamily: 'inherit', outline: 'none', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '8px' }}>
              <button className="btn-submit" onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
              {saved && <span style={{ color: 'var(--color-success)', fontSize: '14px' }}>تم الحفظ ✓</span>}
            </div>

            <div style={{ marginTop: '8px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
              <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
                حالة الحساب:{' '}
                <span style={{ fontWeight: 600, color: user?.isApproved ? 'var(--color-success)' : '#f59e0b' }}>
                  {user?.isApproved ? 'مفعّل' : 'قيد المراجعة'}
                </span>
              </p>
              {user?.cvFileId && (
                <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                  وثيقة العمل: مرفوعة
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
