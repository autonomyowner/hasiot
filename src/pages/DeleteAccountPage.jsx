import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { authClient } from '../lib/auth-client'
import './AuthPages.css'

const translations = {
  ar: {
    title: 'حذف الحساب',
    subtitle: 'حذف حسابك وجميع بياناتك نهائياً',
    warning: 'تحذير: هذا الإجراء لا يمكن التراجع عنه',
    description: 'سيتم حذف جميع بياناتك بشكل دائم، بما في ذلك:',
    items: [
      'الملف الشخصي ومعلومات الحساب',
      'جميع الإعلانات والخدمات المنشورة',
      'الحجوزات والرحلات',
      'خطط السفر والمراجعات',
      'الملفات والصور المرفوعة',
    ],
    confirmLabel: 'اكتب "حذف" للتأكيد',
    confirmWord: 'حذف',
    deleteButton: 'حذف حسابي نهائياً',
    deleting: 'جاري الحذف...',
    success: 'تم حذف حسابك بنجاح',
    successDetail: 'تم حذف جميع بياناتك من خوادمنا.',
    error: 'فشل في حذف الحساب. يرجى المحاولة مرة أخرى.',
    signInFirst: 'يجب تسجيل الدخول أولاً لحذف حسابك',
    signIn: 'تسجيل الدخول',
    backHome: 'العودة للرئيسية',
    loading: 'جاري التحميل...',
    contact: 'إذا كنت تواجه مشكلة، تواصل معنا على',
  },
  en: {
    title: 'Delete Account',
    subtitle: 'Permanently delete your account and all data',
    warning: 'Warning: This action cannot be undone',
    description: 'All your data will be permanently deleted, including:',
    items: [
      'Profile and account information',
      'All posted listings and services',
      'Bookings and trips',
      'Travel plans and reviews',
      'Uploaded files and photos',
    ],
    confirmLabel: 'Type "delete" to confirm',
    confirmWord: 'delete',
    deleteButton: 'Permanently Delete My Account',
    deleting: 'Deleting...',
    success: 'Your account has been deleted',
    successDetail: 'All your data has been removed from our servers.',
    error: 'Failed to delete account. Please try again.',
    signInFirst: 'You must sign in first to delete your account',
    signIn: 'Sign In',
    backHome: 'Back to Home',
    loading: 'Loading...',
    contact: 'If you need help, contact us at',
  }
}

export default function DeleteAccountPage() {
  const [lang, setLang] = useState('ar')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleted, setDeleted] = useState(false)
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const deleteMyAccount = useMutation(api.users.mutations.deleteMyAccount)
  const t = translations[lang] || translations.ar

  const isConfirmed = confirmation.toLowerCase() === t.confirmWord.toLowerCase()

  const handleDelete = async () => {
    if (!isConfirmed || loading) return
    setError('')
    setLoading(true)

    try {
      await deleteMyAccount()
      await authClient.signOut()
      setDeleted(true)
    } catch {
      setError(t.error)
      setLoading(false)
    }
  }

  if (deleted) {
    return (
      <div className="auth-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <Link to="/" className="auth-logo">Hasio</Link>
              <h1 className="auth-title" style={{ color: '#0D7A5F' }}>{t.success}</h1>
              <p className="auth-subtitle">{t.successDetail}</p>
            </div>
            <div className="auth-footer">
              <Link to="/" className="auth-link-secondary">{t.backHome}</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <button className="auth-lang-toggle" onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}>
              {lang === 'ar' ? 'EN' : 'عربي'}
            </button>
            <Link to="/" className="auth-logo">Hasio</Link>
            <h1 className="auth-title">{t.title}</h1>
            <p className="auth-subtitle">{t.subtitle}</p>
          </div>

          {isLoading ? (
            <p style={{ textAlign: 'center', color: '#6b7280', padding: '2rem 0' }}>{t.loading}</p>
          ) : !isAuthenticated || !user ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ color: '#6b7280', marginBottom: '1rem' }}>{t.signInFirst}</p>
              <Link to="/sign-in" className="auth-link" style={{ fontSize: '1rem' }}>{t.signIn}</Link>
            </div>
          ) : (
            <>
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
                padding: '1rem', marginBottom: '1.5rem'
              }}>
                <p style={{ color: '#dc2626', fontWeight: 600, marginBottom: '0.5rem' }}>{t.warning}</p>
                <p style={{ color: '#7f1d1d', fontSize: '0.9rem', marginBottom: '0.75rem' }}>{t.description}</p>
                <ul style={{
                  color: '#7f1d1d', fontSize: '0.85rem', margin: 0,
                  paddingInlineStart: '1.25rem', lineHeight: 1.8
                }}>
                  {t.items.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>

              {error && <div className="auth-error">{error}</div>}

              <div className="auth-field" style={{ marginBottom: '1rem' }}>
                <label>{t.confirmLabel}</label>
                <input
                  type="text"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={t.confirmWord}
                  autoComplete="off"
                />
              </div>

              <button
                onClick={handleDelete}
                disabled={!isConfirmed || loading}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: 8, border: 'none',
                  background: isConfirmed ? '#dc2626' : '#e5e7eb',
                  color: isConfirmed ? '#fff' : '#9ca3af',
                  fontWeight: 600, fontSize: '1rem', cursor: isConfirmed ? 'pointer' : 'not-allowed',
                  transition: 'background 0.2s'
                }}
              >
                {loading ? t.deleting : t.deleteButton}
              </button>
            </>
          )}

          <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              {t.contact} <a href="mailto:support@hasio.xyz" style={{ color: '#0D7A5F' }}>support@hasio.xyz</a>
            </p>
            <Link to="/" className="auth-link-secondary">{t.backHome}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
