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
  { id: 'appointments', label: 'المواعيد' },
  { id: 'schedule', label: 'جدول العمل' },
  { id: 'profile', label: 'الملف الشخصي' },
]

export default function DoctorDashboard() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const saveCvFile = useMutation(api.users.mutations.saveCvFile)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [activeTab, setActiveTab] = useState('appointments')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/sign-in'
    }
  }, [isLoading, isAuthenticated])

  const handleCvUpload = async (e) => {
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
      await saveCvFile({ fileId: storageId })
      setUploadSuccess(true)
    } catch (err) {
      console.error('CV upload error:', err)
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

  const needsCv = !user.isApproved && !user.cvFileId && !uploadSuccess
  const pendingReview = !user.isApproved && (user.cvFileId || uploadSuccess)
  const isApproved = user.isApproved === true

  return (
    <div className="patient-dashboard" dir="rtl">
      {/* Header */}
      <header className="dashboard-header">
        <div className="dashboard-header-inner">
          <Link to="/" className="auth-logo">تبرا</Link>
          <div className="dashboard-user-info">
            <span className="dashboard-user-name">
              مرحباً، {user.role === 'doctor' ? 'د. ' : ''}{user.firstName || user.email}
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
        {/* CV Upload Banner */}
        {needsCv && (
          <div style={{
            background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '12px',
            padding: '1.5rem', marginBottom: '1.5rem'
          }}>
            <h3 style={{ color: '#92400e', margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: '600' }}>
              مطلوب: رفع السيرة الذاتية
            </h3>
            <p style={{ color: '#92400e', margin: '0 0 1rem', fontSize: '0.875rem', lineHeight: '1.6' }}>
              لتفعيل حسابك، يرجى رفع سيرتك الذاتية (CV) أو وثيقة تثبت ممارستك للمهنة.
              سيقوم فريق الإدارة بمراجعتها والموافقة على حسابك.
            </p>
            <label style={{
              display: 'inline-block', padding: '0.625rem 1.25rem', background: '#DC2626',
              color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: '500'
            }}>
              {uploading ? 'جاري الرفع...' : 'رفع السيرة الذاتية (PDF)'}
              <input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleCvUpload}
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
              تم استلام سيرتك الذاتية بنجاح. فريق الإدارة يراجع طلبك حالياً.
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

          {activeTab === 'appointments' && <DoctorAppointmentsTab />}
          {activeTab === 'schedule' && <ScheduleTab user={user} />}
          {activeTab === 'profile' && <DoctorProfileTab user={user} />}
        </div>
      </main>
    </div>
  )
}

// === Appointments Tab ===
function DoctorAppointmentsTab() {
  const appointments = useQuery(api.appointments.queries.getDoctorAppointments, {})
  const confirmAppointment = useMutation(api.appointments.mutations.confirmAppointment)
  const completeAppointment = useMutation(api.appointments.mutations.completeAppointment)
  const cancelAppointment = useMutation(api.appointments.mutations.cancelAppointment)

  const [actionId, setActionId] = useState(null)
  const [completeNotes, setCompleteNotes] = useState('')
  const [showCompleteModal, setShowCompleteModal] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  const todaysAppts = (appointments || []).filter(
    a => a.date === today && a.status !== 'cancelled'
  ).sort((a, b) => a.time.localeCompare(b.time))

  const upcoming = (appointments || []).filter(
    a => a.date > today && (a.status === 'pending' || a.status === 'confirmed')
  ).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  const pending = (appointments || []).filter(a => a.status === 'pending')

  const handleConfirm = async (id) => {
    setActionId(id)
    try { await confirmAppointment({ appointmentId: id }) } catch (e) { console.error(e) }
    setActionId(null)
  }

  const handleComplete = async (id) => {
    setActionId(id)
    try {
      await completeAppointment({ appointmentId: id, notes: completeNotes || undefined })
      setShowCompleteModal(null)
      setCompleteNotes('')
    } catch (e) { console.error(e) }
    setActionId(null)
  }

  const handleCancel = async (id) => {
    if (!confirm('هل تريد إلغاء هذا الموعد؟')) return
    setActionId(id)
    try { await cancelAppointment({ appointmentId: id }) } catch (e) { console.error(e) }
    setActionId(null)
  }

  const statusLabel = { pending: 'قيد الانتظار', confirmed: 'مؤكد', completed: 'مكتمل', cancelled: 'ملغي' }

  // Stats
  const confirmedToday = todaysAppts.filter(a => a.status === 'confirmed').length
  const thisWeekCompleted = (appointments || []).filter(a => {
    if (a.status !== 'completed') return false
    const d = new Date(a.date)
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
          { label: 'مواعيد اليوم', value: todaysAppts.length, color: '#3b82f6' },
          { label: 'مؤكدة اليوم', value: confirmedToday, color: '#059669' },
          { label: 'مكتملة هذا الأسبوع', value: thisWeekCompleted, color: '#6366f1' },
        ].map((stat, i) => (
          <div key={i} className="dash-card" style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color, margin: '0 0 0.25rem' }}>{stat.value}</p>
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Today's appointments */}
      {todaysAppts.length > 0 && (
        <div className="subsection">
          <h3 className="subsection-title">مواعيد اليوم</h3>
          {todaysAppts.map(apt => (
            <AppointmentRow
              key={apt._id}
              apt={apt}
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
        <h3 className="subsection-title">المواعيد القادمة</h3>
        {appointments === undefined ? (
          <div className="dash-card" style={{ textAlign: 'center', color: '#9ca3af' }}>جاري التحميل...</div>
        ) : upcoming.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem' }}>
            <p>لا توجد مواعيد قادمة</p>
          </div>
        ) : (
          upcoming.map(apt => (
            <AppointmentRow
              key={apt._id}
              apt={apt}
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
                <h2>إتمام الموعد</h2>
                <button className="modal-close" onClick={() => setShowCompleteModal(null)}>&times;</button>
              </div>
              <div className="form-group">
                <label>ملاحظات الطبيب (اختياري)</label>
                <textarea
                  value={completeNotes}
                  onChange={e => setCompleteNotes(e.target.value)}
                  rows={3}
                  placeholder="أضف ملاحظات حول الزيارة..."
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

function AppointmentRow({ apt, statusLabel, actionId, onConfirm, onComplete, onCancel }) {
  const formatDate = (dateStr) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('ar-DZ', {
      weekday: 'short', month: 'short', day: 'numeric'
    })
  }

  return (
    <div className="dash-card">
      <div className="apt-card">
        <div className="apt-info">
          <h3>{apt.patient?.firstName} {apt.patient?.lastName || apt.patient?.email}</h3>
          <p>{apt.patient?.phone || ''}</p>
          <p className="apt-datetime">{formatDate(apt.date)} · {apt.time}</p>
          {apt.notes && <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.25rem' }}>{apt.notes}</p>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
          <span className={`status-badge status-${apt.status}`}>
            {statusLabel[apt.status] || apt.status}
          </span>
          <div className="apt-actions">
            {apt.status === 'pending' && (
              <button
                className="apt-action-btn confirm"
                onClick={() => onConfirm(apt._id)}
                disabled={actionId === apt._id}
              >
                تأكيد
              </button>
            )}
            {(apt.status === 'pending' || apt.status === 'confirmed') && (
              <>
                <button
                  className="apt-action-btn"
                  onClick={() => onComplete(apt._id)}
                  disabled={actionId === apt._id}
                >
                  إتمام
                </button>
                <button
                  className="apt-action-btn danger"
                  onClick={() => onCancel(apt._id)}
                  disabled={actionId === apt._id}
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
  // Find doctor record by user email
  const doctors = useQuery(api.doctors.queries.listDoctors, { limit: 100 })
  const saveWorkingHours = useMutation(api.doctors.mutations.saveWorkingHours)

  const doctor = doctors?.find(d => d.email === user?.email)

  const [schedule, setSchedule] = useState(
    DAYS.map(day => ({
      day: day.key,
      open: '08:00',
      close: '16:00',
      isClosed: day.key === 'friday',
    }))
  )
  const [fee, setFee] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (doctor?.workingHours?.length) {
      const merged = DAYS.map(day => {
        const existing = doctor.workingHours.find(wh => wh.day === day.key)
        return existing || { day: day.key, open: '08:00', close: '16:00', isClosed: true }
      })
      setSchedule(merged)
    }
    if (doctor?.consultationFee) {
      setFee(String(doctor.consultationFee))
    }
  }, [doctor])

  const updateDay = (index, field, value) => {
    setSchedule(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  const handleSave = async () => {
    if (!doctor) return
    setSaving(true)
    try {
      await saveWorkingHours({
        doctorId: doctor._id,
        workingHours: schedule,
        consultationFee: fee ? Number(fee) : undefined,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Save schedule error:', err)
    }
    setSaving(false)
  }

  if (!doctor) {
    return (
      <div className="empty-state" style={{ padding: '2rem' }}>
        <p>لم يتم ربط حسابك بملف طبيب بعد. تواصل مع الإدارة.</p>
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

      {/* Weekly schedule grid */}
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
              {/* Day toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '120px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={!day.isClosed}
                  onChange={e => updateDay(index, 'isClosed', !e.target.checked)}
                  style={{ accentColor: '#DC2626' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 500, color: day.isClosed ? '#9ca3af' : '#111827' }}>
                  {dayInfo?.ar}
                </span>
              </label>

              {/* Time inputs */}
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

      {/* Consultation fee */}
      <div className="dash-card">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>سعر الاستشارة (دج)</label>
          <input
            type="number"
            value={fee}
            onChange={e => setFee(e.target.value)}
            placeholder="2000"
            dir="ltr"
            style={{ maxWidth: '200px' }}
          />
        </div>
      </div>
    </div>
  )
}

// === Doctor Profile Tab ===
function DoctorProfileTab({ user }) {
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
          <label>التخصص</label>
          <input value={user?.specialty || '-'} disabled style={{ background: '#f9fafb', color: '#9ca3af' }} />
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
            placeholder="+213 XX XXX XXXX"
            dir="ltr"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
          {saved && <span style={{ color: '#059669', fontSize: '0.875rem' }}>تم الحفظ</span>}
        </div>

        {/* CV status */}
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
            حالة الحساب: {' '}
            <span style={{ fontWeight: 500, color: user?.isApproved ? '#059669' : '#f59e0b' }}>
              {user?.isApproved ? 'مفعّل' : 'قيد المراجعة'}
            </span>
          </p>
          {user?.cvFileId && (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: '0.25rem' }}>
              السيرة الذاتية: مرفوعة
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
