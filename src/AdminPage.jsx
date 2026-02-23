import { useState, useEffect } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../convex/_generated/api'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import './AdminPage.css'

// Admin credentials
const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin2026'

// Algerian wilayas
const WILAYAS = [
  "أدرار", "الشلف", "الأغواط", "أم البواقي", "باتنة", "بجاية", "بسكرة",
  "بشار", "البليدة", "البويرة", "تمنراست", "تبسة", "تلمسان", "تيارت",
  "تيزي وزو", "الجزائر", "الجلفة", "جيجل", "سطيف", "سعيدة", "سكيكدة",
  "سيدي بلعباس", "عنابة", "قالمة", "قسنطينة", "المدية", "مستغانم",
  "المسيلة", "معسكر", "ورقلة", "وهران", "البيض", "إليزي", "برج بوعريريج",
  "بومرداس", "الطارف", "تندوف", "تيسمسيلت", "الوادي", "خنشلة",
  "سوق أهراس", "تيبازة", "ميلة", "عين الدفلى", "النعامة", "عين تموشنت",
  "غرداية", "غليزان", "المغير", "المنيعة", "أولاد جلال", "برج باجي مختار",
  "بني عباس", "تيميمون", "تقرت", "جانت", "عين صالح", "عين قزام"
]

const SPECIALTIES = [
  { value: "general", label_en: "General Medicine", label_ar: "طب عام" },
  { value: "cardiology", label_en: "Cardiology", label_ar: "طب القلب" },
  { value: "dermatology", label_en: "Dermatology", label_ar: "طب الجلد" },
  { value: "dentist", label_en: "Dentistry", label_ar: "طب الأسنان" },
  { value: "ophthalmology", label_en: "Ophthalmology", label_ar: "طب العيون" },
  { value: "pediatrics", label_en: "Pediatrics", label_ar: "طب الأطفال" },
  { value: "gynecology", label_en: "Gynecology", label_ar: "طب النساء" },
  { value: "orthopedics", label_en: "Orthopedics", label_ar: "طب العظام" },
  { value: "neurology", label_en: "Neurology", label_ar: "طب الأعصاب" },
  { value: "psychiatry", label_en: "Psychiatry", label_ar: "الطب النفسي" },
  { value: "ent", label_en: "ENT", label_ar: "أنف أذن حنجرة" },
  { value: "urology", label_en: "Urology", label_ar: "طب المسالك البولية" },
  { value: "radiology", label_en: "Radiology", label_ar: "الأشعة" },
  { value: "laboratory", label_en: "Laboratory", label_ar: "مختبر تحاليل" },
]

const TRAINING_CATEGORIES = [
  { value: "symptoms", label: "الأعراض" },
  { value: "conditions", label: "الحالات الطبية" },
  { value: "specialties", label: "التخصصات" },
  { value: "medications", label: "الأدوية" },
  { value: "general", label: "معلومات عامة" },
]

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [activeTab, setActiveTab] = useState('dashboard')

  useEffect(() => {
    const session = sessionStorage.getItem('tabra_admin_auth')
    if (session === 'authenticated') {
      setIsAuthenticated(true)
    }
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      sessionStorage.setItem('tabra_admin_auth', 'authenticated')
      setLoginError('')
    } else {
      setLoginError('اسم المستخدم أو كلمة المرور غير صحيحة')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('tabra_admin_auth')
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
          <Link to="/" className="admin-logo">لوحة تحكم طبرة</Link>
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
            { id: 'dashboard', label: 'لوحة التحكم' },
            { id: 'doctors', label: 'الأطباء والعيادات' },
            { id: 'pending', label: 'طلبات الأطباء' },
            { id: 'training', label: 'بيانات تدريب الذكاء الاصطناعي' },
            { id: 'appointments', label: 'المواعيد' },
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
          {activeTab === 'doctors' && <DoctorsTab key="doctors" />}
          {activeTab === 'pending' && <PendingDoctorsTab key="pending" />}
          {activeTab === 'training' && <TrainingTab key="training" />}
          {activeTab === 'appointments' && <AppointmentsTab key="appointments" />}
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
          <h1 className="admin-login-title">لوحة تحكم طبرة</h1>
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
    { label: 'إجمالي الأطباء/العيادات', value: stats.totalDoctors, color: 'blue' },
    { label: 'الأطباء النشطون', value: stats.activeDoctors, color: 'green' },
    { label: 'الموثقون', value: stats.verifiedDoctors, color: 'purple' },
    { label: 'إجمالي المستخدمين', value: stats.totalUsers, color: 'orange' },
    { label: 'المواعيد', value: stats.totalAppointments, color: 'pink' },
    { label: 'بيانات التدريب', value: stats.totalTrainingData, color: 'indigo' },
    { label: 'تحليلات الأعراض', value: stats.totalSymptomAnalyses, color: 'teal' },
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
            <span className="admin-breakdown-label">أطباء</span>
            <span className="admin-breakdown-value">{stats.doctorsByType.doctor}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">عيادات</span>
            <span className="admin-breakdown-value">{stats.doctorsByType.clinic}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">مستشفيات</span>
            <span className="admin-breakdown-value">{stats.doctorsByType.hospital}</span>
          </div>
        </div>

        <div className="admin-breakdown-card">
          <h3 className="admin-breakdown-title">المواعيد حسب الحالة</h3>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">قيد الانتظار</span>
            <span className="admin-breakdown-value yellow">{stats.appointmentsByStatus.pending}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">مؤكدة</span>
            <span className="admin-breakdown-value blue">{stats.appointmentsByStatus.confirmed}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">مكتملة</span>
            <span className="admin-breakdown-value green">{stats.appointmentsByStatus.completed}</span>
          </div>
          <div className="admin-breakdown-row">
            <span className="admin-breakdown-label">ملغاة</span>
            <span className="admin-breakdown-value red">{stats.appointmentsByStatus.cancelled}</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function DoctorsTab() {
  const [showForm, setShowForm] = useState(false)
  const [editingDoctor, setEditingDoctor] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [filterWilaya, setFilterWilaya] = useState('')

  const doctors = useQuery(api.admin.queries.listAllDoctors, {
    type: filterType || undefined,
    wilaya: filterWilaya || undefined,
  })
  const createDoctor = useMutation(api.admin.mutations.createDoctor)
  const updateDoctor = useMutation(api.admin.mutations.updateDoctor)
  const deleteDoctor = useMutation(api.admin.mutations.deleteDoctor)

  const handleSubmit = async (formData) => {
    try {
      if (editingDoctor) {
        await updateDoctor({ id: editingDoctor._id, ...formData })
      } else {
        await createDoctor(formData)
      }
      setShowForm(false)
      setEditingDoctor(null)
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذا العنصر؟')) {
      await deleteDoctor({ id })
    }
  }

  const handleEdit = (doctor) => {
    setEditingDoctor(doctor)
    setShowForm(true)
  }

  const typeLabels = {
    doctor: 'طبيب',
    clinic: 'عيادة',
    hospital: 'مستشفى'
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <h2 className="admin-page-title">الأطباء والعيادات</h2>
        <button
          onClick={() => { setShowForm(true); setEditingDoctor(null); }}
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
          <option value="doctor">طبيب</option>
          <option value="clinic">عيادة</option>
          <option value="hospital">مستشفى</option>
        </select>
        <select
          value={filterWilaya}
          onChange={(e) => setFilterWilaya(e.target.value)}
          className="admin-form-select"
        >
          <option value="">كل الولايات</option>
          {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </div>

      <AnimatePresence>
        {showForm && (
          <DoctorForm
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditingDoctor(null); }}
            initialData={editingDoctor}
          />
        )}
      </AnimatePresence>

      {!doctors ? (
        <LoadingState />
      ) : doctors.length === 0 ? (
        <div className="admin-empty">لا يوجد أطباء/عيادات. أضف أول واحد.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>النوع</th>
                <th>التخصص</th>
                <th>الولاية</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'left' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map(doctor => (
                <tr key={doctor._id}>
                  <td>
                    <div className="admin-table-name">{doctor.name_ar}</div>
                    <div className="admin-table-sub">{doctor.name_en}</div>
                  </td>
                  <td>{typeLabels[doctor.type] || doctor.type}</td>
                  <td>{doctor.specialty_ar || doctor.specialty}</td>
                  <td>{doctor.wilaya}</td>
                  <td>
                    <span className={`admin-badge ${doctor.isActive !== false ? 'green' : 'gray'}`}>
                      {doctor.isActive !== false ? 'نشط' : 'غير نشط'}
                    </span>
                    {doctor.isVerified && (
                      <span className="admin-badge blue" style={{ marginRight: '0.5rem' }}>
                        موثق
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="admin-actions">
                      <button onClick={() => handleEdit(doctor)} className="admin-action-btn edit">
                        تعديل
                      </button>
                      <button onClick={() => handleDelete(doctor._id)} className="admin-action-btn delete">
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

function DoctorForm({ onSubmit, onClose, initialData }) {
  const [formData, setFormData] = useState({
    type: initialData?.type || 'doctor',
    name_en: initialData?.name_en || '',
    name_ar: initialData?.name_ar || '',
    specialty: initialData?.specialty || 'general',
    specialty_ar: initialData?.specialty_ar || '',
    description_en: initialData?.description_en || '',
    description_ar: initialData?.description_ar || '',
    address: initialData?.address || '',
    wilaya: initialData?.wilaya || 'الجزائر',
    lat: initialData?.coordinates?.lat || 36.7538,
    lng: initialData?.coordinates?.lng || 3.0588,
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    consultationFee: initialData?.consultationFee || '',
    isVerified: initialData?.isVerified || false,
    isActive: initialData?.isActive !== false,
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const { lat, lng, consultationFee, ...rest } = formData
    onSubmit({
      ...rest,
      coordinates: { lat: parseFloat(lat), lng: parseFloat(lng) },
      consultationFee: consultationFee ? parseInt(consultationFee) : undefined,
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
            {initialData ? 'تعديل طبيب/عيادة' : 'إضافة طبيب/عيادة جديد'}
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
                    <option value="doctor">طبيب</option>
                    <option value="clinic">عيادة</option>
                    <option value="hospital">مستشفى</option>
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">التخصص *</label>
                  <select
                    value={formData.specialty}
                    onChange={(e) => {
                      const spec = SPECIALTIES.find(s => s.value === e.target.value)
                      setFormData({
                        ...formData,
                        specialty: e.target.value,
                        specialty_ar: spec?.label_ar || ''
                      })
                    }}
                    className="admin-form-select"
                  >
                    {SPECIALTIES.map(s => (
                      <option key={s.value} value={s.value}>{s.label_ar}</option>
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
                  <label className="admin-form-label">الولاية *</label>
                  <select
                    value={formData.wilaya}
                    onChange={(e) => setFormData({...formData, wilaya: e.target.value})}
                    className="admin-form-select"
                  >
                    {WILAYAS.map(w => <option key={w} value={w}>{w}</option>)}
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

              <div className="admin-form-group">
                <label className="admin-form-label">رسوم الاستشارة (دج)</label>
                <input
                  type="number"
                  value={formData.consultationFee}
                  onChange={(e) => setFormData({...formData, consultationFee: e.target.value})}
                  className="admin-form-input"
                  dir="ltr"
                  placeholder="مثال: 2000"
                />
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

function TrainingTab() {
  const [showForm, setShowForm] = useState(false)
  const [editingData, setEditingData] = useState(null)
  const [filterCategory, setFilterCategory] = useState('')

  const trainingData = useQuery(api.admin.queries.listTrainingData, {
    category: filterCategory || undefined,
  })
  const createTrainingData = useMutation(api.admin.mutations.createTrainingData)
  const updateTrainingData = useMutation(api.admin.mutations.updateTrainingData)
  const deleteTrainingData = useMutation(api.admin.mutations.deleteTrainingData)

  const handleSubmit = async (formData) => {
    try {
      if (editingData) {
        await updateTrainingData({ id: editingData._id, ...formData })
      } else {
        await createTrainingData(formData)
      }
      setShowForm(false)
      setEditingData(null)
    } catch (error) {
      alert('خطأ: ' + error.message)
    }
  }

  const handleDelete = async (id) => {
    if (confirm('هل أنت متأكد من حذف هذه البيانات التدريبية؟')) {
      await deleteTrainingData({ id })
    }
  }

  const categoryLabels = {
    symptoms: 'الأعراض',
    conditions: 'الحالات الطبية',
    specialties: 'التخصصات',
    medications: 'الأدوية',
    general: 'معلومات عامة'
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <h2 className="admin-page-title">بيانات تدريب الذكاء الاصطناعي</h2>
        <button
          onClick={() => { setShowForm(true); setEditingData(null); }}
          className="admin-btn admin-btn-primary"
        >
          إضافة جديد
        </button>
      </div>

      <div className="admin-info-box">
        <p>
          أضف المعرفة الطبية لتحسين فاحص الأعراض بالذكاء الاصطناعي. قم بتضمين الأعراض والحالات
          والتخصصات والأدوية ومعلومات الرعاية الصحية العامة. سيستخدم الذكاء الاصطناعي هذه
          البيانات لتقديم استجابات أكثر دقة وملاءمة.
        </p>
      </div>

      <div className="admin-filters">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="admin-form-select"
        >
          <option value="">كل الفئات</option>
          {TRAINING_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      <AnimatePresence>
        {showForm && (
          <TrainingForm
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setEditingData(null); }}
            initialData={editingData}
          />
        )}
      </AnimatePresence>

      {!trainingData ? (
        <LoadingState />
      ) : trainingData.length === 0 ? (
        <div className="admin-empty">لا توجد بيانات تدريبية. أضف أول إدخال لتعزيز الذكاء الاصطناعي.</div>
      ) : (
        <div className="admin-list">
          {trainingData.map(item => (
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

function TrainingForm({ onSubmit, onClose, initialData }) {
  const [formData, setFormData] = useState({
    category: initialData?.category || 'symptoms',
    title: initialData?.title || '',
    title_ar: initialData?.title_ar || '',
    content: initialData?.content || '',
    content_ar: initialData?.content_ar || '',
    keywords: initialData?.keywords?.join(', ') || '',
    source: initialData?.metadata?.source || '',
    specialty: initialData?.metadata?.specialty || '',
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
      metadata: (formData.source || formData.specialty) ? {
        source: formData.source || undefined,
        specialty: formData.specialty || undefined,
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
            {initialData ? 'تعديل بيانات التدريب' : 'إضافة بيانات تدريب جديدة'}
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
                    {TRAINING_CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="admin-form-group">
                  <label className="admin-form-label">التخصص المتعلق</label>
                  <select
                    value={formData.specialty}
                    onChange={(e) => setFormData({...formData, specialty: e.target.value})}
                    className="admin-form-select"
                  >
                    <option value="">لا يوجد</option>
                    {SPECIALTIES.map(s => (
                      <option key={s.value} value={s.value}>{s.label_ar}</option>
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
                  placeholder="أدخل المعلومات الطبية التفصيلية، الأعراض، الحالات، العلاجات، إلخ."
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
                  placeholder="مثال: صداع، شقيقة، ألم، توتر"
                />
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">المصدر</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({...formData, source: e.target.value})}
                  className="admin-form-input"
                  placeholder="مثال: منظمة الصحة العالمية، مجلة طبية، كتاب"
                />
              </div>

              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                />
                <span>نشط (تضمين في تدريب الذكاء الاصطناعي)</span>
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

function AppointmentsTab() {
  const [filterStatus, setFilterStatus] = useState('')

  const appointments = useQuery(api.admin.queries.listAllAppointments, {
    status: filterStatus || undefined,
    limit: 100,
  })
  const updateStatus = useMutation(api.admin.mutations.updateAppointmentStatus)

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
      <h2 className="admin-page-title">المواعيد</h2>

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

      {!appointments ? (
        <LoadingState />
      ) : appointments.length === 0 ? (
        <div className="admin-empty">لا توجد مواعيد.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>المريض</th>
                <th>الطبيب</th>
                <th>التاريخ والوقت</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'left' }}>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(apt => (
                <tr key={apt._id}>
                  <td>
                    <div className="admin-table-name">{apt.userName}</div>
                    <div className="admin-table-sub">{apt.userEmail}</div>
                  </td>
                  <td>
                    <div>{apt.doctorName_ar}</div>
                    <div className="admin-table-sub">{apt.doctorName}</div>
                  </td>
                  <td>
                    <div>{apt.date}</div>
                    <div className="admin-table-sub">{apt.time}</div>
                  </td>
                  <td>
                    <span className={`admin-badge ${statusColors[apt.status]}`}>
                      {statusLabels[apt.status] || apt.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'left' }}>
                    <select
                      value={apt.status}
                      onChange={(e) => handleStatusChange(apt._id, e.target.value)}
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

function PendingDoctorsTab() {
  const pendingDoctors = useQuery(api.admin.queries.listPendingDoctors)
  const approveDoctor = useMutation(api.users.mutations.approveDoctorAccount)
  const [approving, setApproving] = useState(null)

  const handleApprove = async (userId) => {
    setApproving(userId)
    try {
      await approveDoctor({ userId })
    } catch (err) {
      console.error('Error approving doctor:', err)
    }
    setApproving(null)
  }

  if (pendingDoctors === undefined) return <LoadingState />

  const specialtyLabels = {}
  SPECIALTIES.forEach(s => { specialtyLabels[s.value] = s.label_ar })

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <div className="admin-section-header">
        <h2 className="admin-section-title">طلبات تسجيل الأطباء</h2>
        <span className="admin-badge admin-badge-warning">{pendingDoctors.length} طلب</span>
      </div>

      {pendingDoctors.length === 0 ? (
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
                <th>التخصص</th>
                <th>السيرة الذاتية</th>
                <th>تاريخ التسجيل</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {pendingDoctors.map(doctor => (
                <tr key={doctor._id}>
                  <td>{`${doctor.firstName || ''} ${doctor.lastName || ''}`.trim() || '-'}</td>
                  <td>{doctor.email}</td>
                  <td>{doctor.role === 'doctor' ? 'طبيب' : 'عيادة'}</td>
                  <td>{specialtyLabels[doctor.specialty] || doctor.specialty || '-'}</td>
                  <td>
                    {doctor.cvFileId ? (
                      <CvDownloadLink fileId={doctor.cvFileId} />
                    ) : (
                      <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>لم يُرفع بعد</span>
                    )}
                  </td>
                  <td>{new Date(doctor.createdAt).toLocaleDateString('ar-DZ')}</td>
                  <td>
                    <button
                      className="admin-btn admin-btn-primary admin-btn-small"
                      onClick={() => handleApprove(doctor._id)}
                      disabled={approving === doctor._id || !doctor.cvFileId}
                      title={!doctor.cvFileId ? 'يجب رفع السيرة الذاتية أولاً' : ''}
                    >
                      {approving === doctor._id ? 'جاري...' : 'موافقة'}
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

function CvDownloadLink({ fileId }) {
  const cvUrl = useQuery(api.users.queries.getCvUrl, { fileId })

  if (!cvUrl) return <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>جاري التحميل...</span>

  return (
    <a
      href={cvUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-btn admin-btn-secondary admin-btn-small"
      style={{ textDecoration: 'none', display: 'inline-block' }}
    >
      عرض CV
    </a>
  )
}

function LoadingState() {
  return (
    <div className="admin-loading">
      <div className="admin-spinner" />
    </div>
  )
}
