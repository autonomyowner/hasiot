import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { authClient } from '../lib/auth-client'
import './AuthPages.css'

export default function DoctorDashboard() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const saveCvFile = useMutation(api.users.mutations.saveCvFile)
  const [uploading, setUploading] = useState(false)
  const [uploadSuccess, setUploadSuccess] = useState(false)

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
      // 1. Get upload URL from Convex
      const uploadUrl = await generateUploadUrl()

      // 2. Upload file to Convex storage
      const result = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      const { storageId } = await result.json()

      // 3. Save file reference to user record
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

  return (
    <div className="doctor-dashboard" dir="rtl">
      <header className="doctor-header">
        <div className="doctor-header-inner">
          <Link to="/" className="auth-logo">تبرا</Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ color: '#6b7280' }}>
              مرحباً، {user.role === 'doctor' ? 'د. ' : ''}{user.firstName || user.email}
            </span>
            <button
              onClick={async () => { await authClient.signOut(); window.location.href = '/' }}
              style={{
                padding: '0.5rem 1rem', border: '1px solid #e5e7eb', borderRadius: '8px',
                background: 'transparent', cursor: 'pointer', fontSize: '0.8125rem', color: '#6b7280'
              }}
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '2rem auto', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1.5rem' }}>
          لوحة تحكم الطبيب
        </h1>

        {/* CV Upload Banner — needs to upload CV */}
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
              color: 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '0.875rem',
              fontWeight: '500'
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

        {/* Pending Review Banner — CV uploaded, waiting for admin */}
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

        {/* Dashboard content — visible but disabled when not approved */}
        <div style={{ opacity: user.isApproved ? 1 : 0.5, pointerEvents: user.isApproved ? 'auto' : 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'المواعيد القادمة', value: '0' },
              { label: 'المرضى', value: '0' },
              { label: 'التقييم', value: '-' },
            ].map((stat, i) => (
              <div key={i} style={{
                background: 'white', borderRadius: '12px', padding: '1.5rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center'
              }}>
                <p style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: '0 0 0.25rem' }}>{stat.value}</p>
                <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: 0 }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div style={{
            background: 'white', borderRadius: '12px', padding: '2rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'center', color: '#6b7280'
          }}>
            <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              إدارة المواعيد والمرضى
            </p>
            <p>هذه الصفحة قيد التطوير. ستتمكن قريباً من إدارة مواعيدك ومرضاك من هنا.</p>
          </div>
        </div>
      </main>
    </div>
  )
}
