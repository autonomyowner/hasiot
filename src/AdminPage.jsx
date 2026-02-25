import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import './AdminPage.css'

// Admin credentials
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin2026'

// Saudi cities
const SAUDI_CITIES = [
  "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Al Khobar", "Dhahran",
  "Tabuk", "Taif", "Abha", "Khamis Mushait", "Jizan", "Najran", "Hail",
  "Al Baha", "Arar", "Sakaka", "AlUla", "Yanbu", "Al Jubail"
]

const SAUDI_CITIES_AR = {
  "Riyadh": "الرياض",
  "Jeddah": "جدة",
  "Mecca": "مكة المكرمة",
  "Medina": "المدينة المنورة",
  "Dammam": "الدمام",
  "Al Khobar": "الخبر",
  "Dhahran": "الظهران",
  "Tabuk": "تبوك",
  "Taif": "الطائف",
  "Abha": "أبها",
  "Khamis Mushait": "خميس مشيط",
  "Jizan": "جازان",
  "Najran": "نجران",
  "Hail": "حائل",
  "Al Baha": "الباحة",
  "Arar": "عرعر",
  "Sakaka": "سكاكا",
  "AlUla": "العلا",
  "Yanbu": "ينبع",
  "Al Jubail": "الجبيل"
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

const KNOWLEDGE_CATEGORIES = [
  { value: "destinations", label: "الوجهات" },
  { value: "hotels", label: "الفنادق" },
  { value: "restaurants", label: "المطاعم" },
  { value: "culture", label: "الثقافة" },
  { value: "transport", label: "المواصلات" },
  { value: "tips", label: "نصائح السفر" },
  { value: "events", label: "الفعاليات" },
  { value: "general", label: "معلومات عامة" },
]

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    const session = sessionStorage.getItem('hasio_admin_auth')
    if (session === 'authenticated') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('hasio_admin_auth', 'authenticated')
      setLoginError('')
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('hasio_admin_auth')
  }

  if (!isAuthenticated) {
    return <LoginForm
      username={username}
      setUsername={setUsername}
      password={password}
      setPassword={setPassword}
      loginError={loginError}
      handleLogin={handleLogin}
    />
  }

  return (
    <div className="admin-layout" dir="rtl">
      <header className="admin-header">
        <div className="admin-header-inner">
          <Link to="/" className="admin-logo">لوحة تحكم هاسيو</Link>
          <div className="admin-header-right">
            <span className="admin-header-user">مرحباً، المدير</span>
            <button onClick={handleLogout} className="admin-btn admin-btn-secondary admin-btn-small">
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <nav className="admin-nav">
        <div className="admin-nav-inner">
          {[
            { id: 'dashboard', label: 'الإحصائيات' },
            { id: 'listings', label: 'الأماكن' },
            { id: 'content', label: 'محتوى معلق' },
            { id: 'pending', label: 'حسابات معلقة' },
            { id: 'knowledge', label: 'قاعدة المعرفة' },
            { id: 'bookings', label: 'الحجوزات' },
            { id: 'emails', label: 'البريد الإلكتروني' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`admin-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="admin-main">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && <DashboardTab key="dashboard" />}
          {activeTab === 'listings' && <ListingsTab key="listings" />}
          {activeTab === 'content' && <ContentApprovalTab key="content" />}
          {activeTab === 'pending' && <PendingBusinessesTab key="pending" />}
          {activeTab === 'knowledge' && <KnowledgeTab key="knowledge" />}
          {activeTab === 'bookings' && <BookingsTab key="bookings" />}
          {activeTab === 'emails' && <EmailCapturesTab key="emails" />}
        </AnimatePresence>
      </main>
    </div>
  )
}

function LoginForm({ username, setUsername, password, setPassword, loginError, handleLogin }) {
  return (
    <div className="admin-login" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="admin-login-card"
      >
        <div className="admin-login-header">
          <h1 className="admin-login-title">لوحة تحكم هاسيو</h1>
          <p className="admin-login-subtitle">سجّل الدخول للوصول إلى لوحة التحكم</p>
        </div>

        <form onSubmit={handleLogin} className="admin-form">
          {loginError && <div className="admin-error">{loginError}</div>}

          <div className="admin-form-group">
            <label className="admin-form-label">اسم المستخدم</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="admin-form-input"
              placeholder="أدخل اسم المستخدم"
            />
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">كلمة المرور</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-form-input"
              placeholder="أدخل كلمة المرور"
            />
          </div>

          <button type="submit" className="admin-btn admin-btn-primary">
            تسجيل الدخول
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/" className="admin-link">العودة للرئيسية</Link>
        </div>
      </motion.div>
    </div>
  )
}

function DashboardTab() {
  const stats = useQuery(api.admin.queries.getDashboardStats)

  if (!stats) return <LoadingState />

  const statCards = [
    { label: 'إجمالي الأماكن', value: stats.totalListings, color: 'blue' },
    { label: 'الأماكن النشطة', value: stats.activeListings, color: 'green' },
    { label: 'الموثقة', value: stats.verifiedListings, color: 'purple' },
    { label: 'محتوى معلق', value: stats.pendingContent ?? 0, color: 'yellow' },
    { label: 'إجمالي المستخدمين', value: stats.totalUsers, color: 'orange' },
    { label: 'الحجوزات', value: stats.totalBookings, color: 'pink' },
    { label: 'قاعدة المعرفة', value: stats.totalKnowledgeData, color: 'indigo' },
    { label: 'خطط السفر', value: stats.totalTravelPlans, color: 'teal' },
    { label: 'تسجيلات البريد', value: stats.totalEmailCaptures ?? 0, color: 'red' },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="admin-page-title">نظرة عامة</h2>

      <div className="admin-stats-grid">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="admin-stat-card"
          >
            <div className={`admin-stat-dot ${stat.color}`} />
            <div className="admin-stat-value">{stat.value}</div>
            <div className="admin-stat-label">{stat.label}</div>
          </motion.div>
        ))}
      </div>

      <div className="admin-breakdown-grid">
        <div className="admin-breakdown-card">
          <h3 className="admin-breakdown-title">حسب النوع</h3>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">فنادق</span>
            <span className="admin-breakdown-value">{stats.listingsByType?.hotel ?? 0}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">مطاعم</span>
            <span className="admin-breakdown-value">{stats.listingsByType?.restaurant ?? 0}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">معالم سياحية</span>
            <span className="admin-breakdown-value">{stats.listingsByType?.attraction ?? 0}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">فعاليات</span>
            <span className="admin-breakdown-value">{stats.listingsByType?.event ?? 0}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">جولات</span>
            <span className="admin-breakdown-value">{stats.listingsByType?.tour ?? 0}</span>
          </div>
        </div>

        <div className="admin-breakdown-card">
          <h3 className="admin-breakdown-title">الحجوزات حسب الحالة</h3>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">قيد الانتظار</span>
            <span className="admin-breakdown-value yellow">{stats.bookingsByStatus?.pending ?? 0}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">مؤكدة</span>
            <span className="admin-breakdown-value blue">{stats.bookingsByStatus?.confirmed ?? 0}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">مكتملة</span>
            <span className="admin-breakdown-value green">{stats.bookingsByStatus?.completed ?? 0}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">ملغاة</span>
            <span className="admin-breakdown-value red">{stats.bookingsByStatus?.cancelled ?? 0}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function ListingsTab() {
  const [showForm, setShowForm] = useState(false)
  const [editingListing, setEditingListing] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [filterCity, setFilterCity] = useState('')

  const listings = useQuery(api.admin.queries.listAllListings, {
    type: filterType || undefined,
    city: filterCity || undefined,
  })
  const createListing = useMutation(api.admin.mutations.createListing)
  const updateListing = useMutation(api.admin.mutations.updateListing)
  const deleteListing = useMutation(api.admin.mutations.deleteListing)

  const handleSubmit = async (formData) => {
    try {
      if (editingListing) {
        await updateListing({ id: editingListing._id, ...formData })
      } else {
        await createListing(formData)
      }
      setShowForm(false)
      setEditingListing(null)
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
      await deleteListing({ id })
    }
  }

  const handleEdit = (listing) => {
    setEditingListing(listing)
    setShowForm(true)
  }

  const typeLabels = {
    hotel: 'فندق',
    restaurant: 'مطعم',
    attraction: 'معلم سياحي',
    event: 'فعالية',
    tour: 'جولة'
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <h2 className="admin-page-title">الأماكن والخدمات</h2>
        <button
          onClick={() => { setShowForm(true); setEditingListing(null); }}
          className="admin-btn admin-btn-primary"
        >
          إضافة جديد
        </button>
      </div>

      <div className="admin-filters">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="admin-form-select"
        >
          <option value="">كل الأنواع</option>
          <option value="hotel">فندق</option>
          <option value="restaurant">مطعم</option>
          <option value="attraction">معلم سياحي</option>
          <option value="event">فعالية</option>
          <option value="tour">جولة</option>
        </select>
        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className="admin-form-select"
        >
          <option value="">كل المدن</option>
          {SAUDI_CITIES.map(c => <option key={c} value={c}>{SAUDI_CITIES_AR[c] || c}</option>)}
        </select>
      </div>

      <AnimatePresence>
        {showForm && (
          <ListingForm
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditingListing(null); }}
            initialData={editingListing}
          />
        )}
      </AnimatePresence>

      {!listings ? (
        <LoadingState />
      ) : listings.length === 0 ? (
        <div className="admin-empty">لا توجد أماكن أو خدمات. أضف أول واحد.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النوع</th>
                <th>الفئة</th>
                <th>المدينة</th>
                <th>الحالة</th>
                <th>حالة المراجعة</th>
                <th style={{ textAlign: 'left' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {listings.map(listing => (
                <tr key={listing._id}>
                  <td>
                    <div className="admin-table-name">{listing.name_ar}</div>
                    <div className="admin-table-sub">{listing.name_en}</div>
                  </td>
                  <td>{typeLabels[listing.type] || listing.type}</td>
                  <td>{listing.category_ar || listing.category}</td>
                  <td>{SAUDI_CITIES_AR[listing.city] || listing.city}</td>
                  <td>
                    <span className={`admin-badge ${listing.isActive !== false ? 'green' : 'gray'}`}>
                      {listing.isActive !== false ? 'نشط' : 'غير نشط'}
                    </span>
                    {listing.isVerified && (
                      <span className="admin-badge blue" style={{ marginRight: '0.5rem' }}>
                        موثق
                      </span>
                    )}
                  </td>
                  <td>
                    {listing.status === 'approved' ? (
                      <span className="admin-badge green">معتمد</span>
                    ) : listing.status === 'pending' ? (
                      <span className="admin-badge yellow">قيد المراجعة</span>
                    ) : listing.status === 'rejected' ? (
                      <span className="admin-badge red">مرفوض</span>
                    ) : (
                      <span className="admin-badge gray">أصلي</span>
                    )}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button onClick={() => handleEdit(listing)} className="admin-action-btn edit">
                        تعديل
                      </button>
                      <button onClick={() => handleDelete(listing._id)} className="admin-action-btn delete">
                        حذف
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

function ListingForm({ onSubmit, onClose, initialData }) {
  const [formData, setFormData] = useState({
    type: initialData?.type || 'hotel',
    category: initialData?.category || 'luxury_hotel',
    category_ar: initialData?.category_ar || '',
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
    isVerified: initialData?.isVerified || false,
    isActive: initialData?.isActive !== false,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const { lat, lng, ...rest } = formData
    onSubmit({
      ...rest,
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
      priceRange: rest.priceRange || undefined,
      website: rest.website || undefined,
      region: rest.region || undefined,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="admin-modal-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">
            {initialData ? 'تعديل مكان/خدمة' : 'إضافة مكان/خدمة جديد'}
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            <div className="admin-form" style={{ gap: '1rem' }}>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">النوع *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="admin-form-select"
                  >
                    <option value="hotel">فندق</option>
                    <option value="restaurant">مطعم</option>
                    <option value="attraction">معلم سياحي</option>
                    <option value="event">فعالية</option>
                    <option value="tour">جولة</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">الفئة *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const cat = CATEGORIES.find(c => c.value === e.target.value)
                      setFormData({
                        ...formData,
                        category: e.target.value,
                        category_ar: cat?.label || ''
                      })
                    }}
                    className="admin-form-select"
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">الاسم (بالعربية) *</label>
                  <input
                    type="text"
                    value={formData.name_ar}
                    onChange={(e) => setFormData({...formData, name_ar: e.target.value})}
                    className="admin-form-input"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">الاسم (بالإنجليزية) *</label>
                  <input
                    type="text"
                    value={formData.name_en}
                    onChange={(e) => setFormData({...formData, name_en: e.target.value})}
                    className="admin-form-input"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">العنوان *</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="admin-form-input"
                  required
                />
              </div>

              <div className="admin-form-row-3">
                <div className="admin-form-group">
                  <label className="admin-form-label">المدينة *</label>
                  <select
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="admin-form-select"
                  >
                    {SAUDI_CITIES.map(c => <option key={c} value={c}>{SAUDI_CITIES_AR[c] || c}</option>)}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">خط العرض *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({...formData, lat: e.target.value})}
                    className="admin-form-input"
                    dir="ltr"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">خط الطول *</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({...formData, lng: e.target.value})}
                    className="admin-form-input"
                    dir="ltr"
                    required
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">المنطقة</label>
                <input
                  type="text"
                  value={formData.region}
                  onChange={(e) => setFormData({...formData, region: e.target.value})}
                  className="admin-form-input"
                  placeholder="مثال: منطقة الرياض، المنطقة الشرقية"
                />
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">الهاتف</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="admin-form-input"
                    dir="ltr"
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">البريد الإلكتروني</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="admin-form-input"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">الموقع الإلكتروني</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({...formData, website: e.target.value})}
                    className="admin-form-input"
                    dir="ltr"
                    placeholder="https://example.com"
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">نطاق السعر</label>
                  <select
                    value={formData.priceRange}
                    onChange={(e) => setFormData({...formData, priceRange: e.target.value})}
                    className="admin-form-select"
                  >
                    <option value="">غير محدد</option>
                    <option value="$">$ اقتصادي</option>
                    <option value="$$">$$ متوسط</option>
                    <option value="$$$">$$$ مرتفع</option>
                    <option value="$$$$">$$$$ فاخر</option>
                  </select>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">الوصف (بالعربية)</label>
                  <textarea
                    value={formData.description_ar}
                    onChange={(e) => setFormData({...formData, description_ar: e.target.value})}
                    className="admin-form-textarea"
                    rows={3}
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">الوصف (بالإنجليزية)</label>
                  <textarea
                    value={formData.description_en}
                    onChange={(e) => setFormData({...formData, description_en: e.target.value})}
                    className="admin-form-textarea"
                    rows={3}
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="admin-checkbox-group">
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                  />
                  <span>نشط</span>
                </label>
                <label className="admin-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isVerified}
                    onChange={(e) => setFormData({...formData, isVerified: e.target.checked})}
                  />
                  <span>موثق</span>
                </label>
              </div>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">
              إلغاء
            </button>
            <button type="submit" className="admin-btn admin-btn-primary">
              {initialData ? 'تحديث' : 'إنشاء'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function KnowledgeTab() {
  const [showForm, setShowForm] = useState(false)
  const [editingData, setEditingData] = useState(null)
  const [filterCategory, setFilterCategory] = useState('')

  const knowledgeData = useQuery(api.admin.queries.listKnowledgeData, {
    category: filterCategory || undefined,
  })
  const createKnowledgeData = useMutation(api.admin.mutations.createKnowledgeData)
  const updateKnowledgeData = useMutation(api.admin.mutations.updateKnowledgeData)
  const deleteKnowledgeData = useMutation(api.admin.mutations.deleteKnowledgeData)

  const handleSubmit = async (formData) => {
    try {
      if (editingData) {
        await updateKnowledgeData({ id: editingData._id, ...formData })
      } else {
        await createKnowledgeData(formData)
      }
      setShowForm(false)
      setEditingData(null)
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذه البيانات؟')) {
      await deleteKnowledgeData({ id })
    }
  }

  const categoryLabels = {
    destinations: 'الوجهات',
    hotels: 'الفنادق',
    restaurants: 'المطاعم',
    culture: 'الثقافة',
    transport: 'المواصلات',
    tips: 'نصائح السفر',
    events: 'الفعاليات',
    general: 'معلومات عامة'
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <h2 className="admin-page-title">قاعدة المعرفة السياحية</h2>
        <button
          onClick={() => { setShowForm(true); setEditingData(null); }}
          className="admin-btn admin-btn-primary"
        >
          إضافة جديد
        </button>
      </div>

      <div className="admin-info-box">
        <p>
          أضف معلومات سياحية لتحسين مساعد السفر بالذكاء الاصطناعي. قم بتضمين الوجهات والفنادق
          والمطاعم والثقافة والمواصلات ونصائح السفر والفعاليات. سيستخدم الذكاء الاصطناعي هذه
          البيانات لتقديم توصيات أكثر دقة وملاءمة للمسافرين.
        </p>
      </div>

      <div className="admin-filters">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="admin-form-select"
        >
          <option value="">كل الفئات</option>
          {KNOWLEDGE_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <AnimatePresence>
        {showForm && (
          <KnowledgeForm
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditingData(null); }}
            initialData={editingData}
          />
        )}
      </AnimatePresence>

      {!knowledgeData ? (
        <LoadingState />
      ) : knowledgeData.length === 0 ? (
        <div className="admin-empty">لا توجد بيانات في قاعدة المعرفة. أضف أول إدخال لتعزيز مساعد السفر.</div>
      ) : (
        <div className="admin-list">
          {knowledgeData.map(item => (
            <div key={item._id} className="admin-list-item">
              <div className="admin-list-item-header">
                <div style={{ flex: 1 }}>
                  <div className="admin-list-item-badges">
                    <span className={`admin-badge ${item.isActive ? 'green' : 'gray'}`}>
                      {item.isActive ? 'نشط' : 'غير نشط'}
                    </span>
                    <span className="admin-badge blue">
                      {categoryLabels[item.category] || item.category}
                    </span>
                  </div>
                  <h3 className="admin-list-item-title">{item.title_ar || item.title}</h3>
                  {item.title_ar && item.title && (
                    <p className="admin-list-item-subtitle" dir="ltr">{item.title}</p>
                  )}
                  <p className="admin-list-item-content">{item.content_ar || item.content}</p>
                  {item.keywords?.length > 0 && (
                    <div className="admin-list-item-keywords">
                      {item.keywords.map(kw => (
                        <span key={kw} className="admin-keyword">{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="admin-actions" style={{ marginRight: '1rem' }}>
                  <button
                    onClick={() => { setEditingData(item); setShowForm(true); }}
                    className="admin-action-btn edit"
                  >
                    تعديل
                  </button>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="admin-action-btn delete"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function KnowledgeForm({ onSubmit, onClose, initialData }) {
  const [formData, setFormData] = useState({
    category: initialData?.category || 'destinations',
    title: initialData?.title || '',
    title_ar: initialData?.title_ar || '',
    content: initialData?.content || '',
    content_ar: initialData?.content_ar || '',
    keywords: initialData?.keywords?.join(', ') || '',
    source: initialData?.metadata?.source || '',
    relatedCity: initialData?.metadata?.relatedCity || '',
    isActive: initialData?.isActive !== false,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const keywords = formData.keywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean)

    onSubmit({
      category: formData.category,
      title: formData.title,
      title_ar: formData.title_ar || undefined,
      content: formData.content,
      content_ar: formData.content_ar || undefined,
      keywords: keywords.length > 0 ? keywords : undefined,
      metadata: (formData.source || formData.relatedCity) ? {
        source: formData.source || undefined,
        relatedCity: formData.relatedCity || undefined,
        lastReviewed: new Date().toISOString().split('T')[0],
      } : undefined,
      isActive: formData.isActive,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="admin-modal-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-modal-header">
          <h3 className="admin-modal-title">
            {initialData ? 'تعديل بيانات المعرفة' : 'إضافة بيانات معرفة جديدة'}
          </h3>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="admin-modal-body">
            <div className="admin-form" style={{ gap: '1rem' }}>
              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">الفئة *</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="admin-form-select"
                  >
                    {KNOWLEDGE_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">المدينة المتعلقة</label>
                  <select
                    value={formData.relatedCity}
                    onChange={(e) => setFormData({...formData, relatedCity: e.target.value})}
                    className="admin-form-select"
                  >
                    <option value="">عام (كل المدن)</option>
                    {SAUDI_CITIES.map(c => (
                      <option key={c} value={c}>{SAUDI_CITIES_AR[c] || c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <label className="admin-form-label">العنوان (بالعربية) *</label>
                  <input
                    type="text"
                    value={formData.title_ar}
                    onChange={(e) => setFormData({...formData, title_ar: e.target.value})}
                    className="admin-form-input"
                    required
                  />
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">العنوان (بالإنجليزية)</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="admin-form-input"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">المحتوى (بالعربية) *</label>
                <textarea
                  value={formData.content_ar}
                  onChange={(e) => setFormData({...formData, content_ar: e.target.value})}
                  className="admin-form-textarea"
                  rows={6}
                  placeholder="أدخل المعلومات السياحية التفصيلية، الوجهات، النصائح، الثقافة، إلخ."
                  required
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">المحتوى (بالإنجليزية)</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({...formData, content: e.target.value})}
                  className="admin-form-textarea"
                  rows={6}
                  dir="ltr"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">الكلمات المفتاحية (مفصولة بفواصل)</label>
                <input
                  type="text"
                  value={formData.keywords}
                  onChange={(e) => setFormData({...formData, keywords: e.target.value})}
                  className="admin-form-input"
                  placeholder="مثال: الرياض، سياحة، فنادق، تراث"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">المصدر</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  className="admin-form-input"
                  placeholder="مثال: هيئة السياحة، موقع رسمي، دليل سياحي"
                />
              </div>

              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                />
                <span>نشط (تضمين في قاعدة معرفة مساعد السفر)</span>
              </label>
            </div>
          </div>

          <div className="admin-modal-footer">
            <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">
              إلغاء
            </button>
            <button type="submit" className="admin-btn admin-btn-primary">
              {initialData ? 'تحديث' : 'إنشاء'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

function BookingsTab() {
  const [filterStatus, setFilterStatus] = useState('')

  const bookings = useQuery(api.admin.queries.listAllBookings, {
    status: filterStatus || undefined,
    limit: 100,
  })
  const updateStatus = useMutation(api.admin.mutations.updateBookingStatus)

  const handleStatusChange = async (id, status) => {
    await updateStatus({ id, status })
  }

  const statusColors = {
    pending: 'yellow',
    confirmed: 'blue',
    completed: 'green',
    cancelled: 'red',
    no_show: 'gray',
  }

  const statusLabels = {
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    completed: 'مكتمل',
    cancelled: 'ملغى',
    no_show: 'لم يحضر',
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <h2 className="admin-page-title">الحجوزات</h2>

      <div className="admin-filters">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="admin-form-select"
        >
          <option value="">كل الحالات</option>
          <option value="pending">قيد الانتظار</option>
          <option value="confirmed">مؤكد</option>
          <option value="completed">مكتمل</option>
          <option value="cancelled">ملغى</option>
          <option value="no_show">لم يحضر</option>
        </select>
      </div>

      {!bookings ? (
        <LoadingState />
      ) : bookings.length === 0 ? (
        <div className="admin-empty">لا توجد حجوزات.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>المستخدم</th>
                <th>المكان</th>
                <th>التاريخ والوقت</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'left' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(booking => (
                <tr key={booking._id}>
                  <td>
                    <div className="admin-table-name">{booking.userName}</div>
                    <div className="admin-table-sub">{booking.userEmail}</div>
                  </td>
                  <td>
                    <div>{booking.listingName_ar}</div>
                    <div className="admin-table-sub">{booking.listingName}</div>
                  </td>
                  <td>
                    <div>{booking.date}</div>
                    <div className="admin-table-sub">{booking.time}</div>
                  </td>
                  <td>
                    <span className={`admin-badge ${statusColors[booking.status]}`}>
                      {statusLabels[booking.status] || booking.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <select
                      value={booking.status}
                      onChange={(e) => handleStatusChange(booking._id, e.target.value)}
                      className="admin-form-select"
                      style={{ padding: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="pending">قيد الانتظار</option>
                      <option value="confirmed">مؤكد</option>
                      <option value="completed">مكتمل</option>
                      <option value="cancelled">ملغى</option>
                      <option value="no_show">لم يحضر</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

function ContentApprovalTab() {
  const pendingContent = useQuery(api.admin.queries.listPendingContent)
  const approveContent = useMutation(api.admin.mutations.approveContent)
  const rejectContent = useMutation(api.admin.mutations.rejectContent)
  const [actionId, setActionId] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const handleApprove = async (id) => {
    setActionId(id)
    try {
      await approveContent({ id })
    } catch (err) {
      console.error('Error approving content:', err)
    }
    setActionId(null)
  }

  const handleReject = async (id) => {
    setActionId(id)
    try {
      await rejectContent({ id, reason: rejectReason || undefined })
      setRejectModal(null)
      setRejectReason('')
    } catch (err) {
      console.error('Error rejecting content:', err)
    }
    setActionId(null)
  }

  const typeLabels = {
    hotel: 'فندق',
    restaurant: 'مطعم',
    attraction: 'معلم سياحي',
    event: 'فعالية',
    tour: 'جولة'
  }

  if (pendingContent === undefined) return <LoadingState />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-section-header">
        <h2 className="admin-section-title">محتوى معلق للمراجعة</h2>
        <span className="admin-badge admin-badge-warning">{pendingContent.length} عنصر</span>
      </div>

      {pendingContent.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          لا يوجد محتوى معلق للمراجعة
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النوع</th>
                <th>المدينة</th>
                <th>المالك</th>
                <th>تاريخ الإرسال</th>
                <th style={{ textAlign: 'left' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {pendingContent.map(listing => (
                <tr key={listing._id}>
                  <td>
                    <div className="admin-table-name">{listing.name_ar}</div>
                    <div className="admin-table-sub">{listing.name_en}</div>
                  </td>
                  <td>{typeLabels[listing.type] || listing.type}</td>
                  <td>{SAUDI_CITIES_AR[listing.city] || listing.city}</td>
                  <td>
                    <div className="admin-table-name">{listing.ownerName}</div>
                    <div className="admin-table-sub">{listing.ownerEmail}</div>
                  </td>
                  <td>{new Date(listing.createdAt).toLocaleDateString('ar-SA')}</td>
                  <td>
                    <div className="admin-actions">
                      <button
                        onClick={() => handleApprove(listing._id)}
                        className="admin-action-btn edit"
                        disabled={actionId === listing._id}
                      >
                        {actionId === listing._id ? 'جاري...' : 'موافقة'}
                      </button>
                      <button
                        onClick={() => setRejectModal(listing._id)}
                        className="admin-action-btn delete"
                        disabled={actionId === listing._id}
                      >
                        رفض
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AnimatePresence>
        {rejectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="admin-modal-overlay"
            onClick={() => setRejectModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="admin-modal"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '500px' }}
            >
              <div className="admin-modal-header">
                <h3 className="admin-modal-title">رفض المحتوى</h3>
              </div>
              <div className="admin-modal-body">
                <div className="admin-form-group">
                  <label className="admin-form-label">سبب الرفض (اختياري)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="admin-form-textarea"
                    rows={3}
                    placeholder="أدخل سبب الرفض ليراه صاحب المحتوى..."
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  onClick={() => setRejectModal(null)}
                  className="admin-btn admin-btn-secondary"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => handleReject(rejectModal)}
                  className="admin-btn admin-btn-primary"
                  style={{ background: '#ef4444' }}
                  disabled={actionId === rejectModal}
                >
                  {actionId === rejectModal ? 'جاري...' : 'تأكيد الرفض'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function PendingBusinessesTab() {
  const pendingBusinesses = useQuery(api.admin.queries.listPendingBusinesses)
  const approveBusiness = useMutation(api.users.mutations.approveBusinessAccount)
  const [approving, setApproving] = useState(null)

  const handleApprove = async (userId) => {
    setApproving(userId)
    try {
      await approveBusiness({ userId })
    } catch (err) {
      console.error('Error approving business:', err)
    }
    setApproving(null)
  }

  if (pendingBusinesses === undefined) return <LoadingState />

  const categoryLabels = {}
  CATEGORIES.forEach(c => { categoryLabels[c.value] = c.label })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="admin-section-header">
        <h2 className="admin-section-title">طلبات تسجيل مزودي الخدمات</h2>
        <span className="admin-badge admin-badge-warning">{pendingBusinesses.length} طلب</span>
      </div>

      {pendingBusinesses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          لا توجد طلبات معلقة
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>البريد الإلكتروني</th>
                <th>الدور</th>
                <th>الفئة</th>
                <th>وثائق العمل</th>
                <th>تاريخ التسجيل</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {pendingBusinesses.map(business => (
                <tr key={business._id}>
                  <td>{`${business.firstName || ''} ${business.lastName || ''}`.trim() || '-'}</td>
                  <td>{business.email}</td>
                  <td>{business.role === 'business_owner' ? 'صاحب عمل' : 'مزود خدمة'}</td>
                  <td>{categoryLabels[business.category] || business.category || '-'}</td>
                  <td>
                    {business.businessDocFileId ? (
                      <BusinessDocDownloadLink fileId={business.businessDocFileId} />
                    ) : (
                      <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>لم يُرفع بعد</span>
                    )}
                  </td>
                  <td>{new Date(business.createdAt).toLocaleDateString('ar-SA')}</td>
                  <td>
                    <button
                      className="admin-btn admin-btn-primary admin-btn-small"
                      onClick={() => handleApprove(business._id)}
                      disabled={approving === business._id || !business.businessDocFileId}
                      title={!business.businessDocFileId ? 'يجب رفع وثائق العمل أولاً' : ''}
                    >
                      {approving === business._id ? 'جاري...' : 'موافقة'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

function BusinessDocDownloadLink({ fileId }) {
  const docUrl = useQuery(api.users.queries.getBusinessDocUrl, { fileId })

  if (!docUrl) return <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>جاري التحميل...</span>

  return (
    <a
      href={docUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-btn admin-btn-secondary admin-btn-small"
      style={{ textDecoration: 'none', display: 'inline-block' }}
    >
      عرض الوثيقة
    </a>
  )
}

function EmailCapturesTab() {
  const emails = useQuery(api.emailCaptures.queries.listAll)

  if (!emails) return <LoadingState />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 className="admin-page-title" style={{ margin: 0 }}>تسجيلات البريد الإلكتروني</h2>
        <span style={{ background: '#0D7A5F14', color: '#0D7A5F', padding: '0.375rem 0.75rem', borderRadius: '1rem', fontSize: '0.875rem', fontWeight: 600 }}>
          {emails.length} تسجيل
        </span>
      </div>

      {emails.length === 0 ? (
        <div className="admin-empty">
          <p>لا توجد تسجيلات بريد إلكتروني بعد</p>
        </div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>#</th>
                <th>البريد الإلكتروني</th>
                <th>المصدر</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((entry, i) => (
                <tr key={entry._id}>
                  <td>{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{entry.email}</td>
                  <td>
                    <span style={{
                      background: '#f3f4f6', padding: '0.125rem 0.5rem',
                      borderRadius: '0.25rem', fontSize: '0.75rem', color: '#6b7280'
                    }}>
                      {entry.source || '—'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    {new Date(entry.createdAt).toLocaleDateString('ar-SA', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

function LoadingState() {
  return (
    <div className="admin-loading">
      <div className="admin-spinner" />
    </div>
  )
}
