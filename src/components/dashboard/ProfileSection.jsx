import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

const SAUDI_CITIES = [
  'Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Dhahran',
  'Tabuk', 'Abha', 'Taif', 'Hail', 'Buraidah', 'Najran', 'Jizan',
  'Yanbu', 'Al Kharj', 'AlUla', 'NEOM', 'Jubail', 'Khamis Mushait'
]

const translations = {
  ar: {
    title: 'الملف الشخصي',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    city: 'المدينة',
    selectCity: 'اختر المدينة',
    language: 'اللغة المفضلة',
    arabic: 'العربية',
    english: 'English',
    save: 'حفظ التعديلات',
    saving: 'جاري الحفظ...',
    saved: 'تم الحفظ بنجاح',
    role: 'نوع الحساب',
    tourist: 'سائح',
    business_owner: 'صاحب عمل',
    service_provider: 'مقدم خدمة',
  },
  en: {
    title: 'Profile',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone Number',
    city: 'City',
    selectCity: 'Select city',
    language: 'Preferred Language',
    arabic: 'العربية',
    english: 'English',
    save: 'Save Changes',
    saving: 'Saving...',
    saved: 'Saved successfully',
    role: 'Account Type',
    tourist: 'Tourist',
    business_owner: 'Business Owner',
    service_provider: 'Service Provider',
  }
}

export default function ProfileSection({ lang = 'ar', user }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'

  const updateProfile = useMutation(api.users.mutations.updateProfile)

  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    city: user?.city || '',
    preferredLanguage: user?.preferredLanguage || 'ar',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await updateProfile({
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        city: form.city || undefined,
        preferredLanguage: form.preferredLanguage,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Update profile error:', err)
    }
    setSaving(false)
  }

  const roleLabel = (role) => {
    if (role === 'tourist') return t.tourist
    if (role === 'business_owner') return t.business_owner
    if (role === 'service_provider') return t.service_provider
    return role
  }

  return (
    <div className="profile-section">
      <h2 className="dashboard-section-title">{t.title}</h2>

      <div className="dash-card">
        {/* Email (read-only) */}
        <div className="form-group">
          <label>{t.email}</label>
          <input value={user?.email || ''} disabled style={{ background: '#f9fafb', color: '#9ca3af' }} />
        </div>

        {/* Role (read-only) */}
        <div className="form-group">
          <label>{t.role}</label>
          <input value={roleLabel(user?.role)} disabled style={{ background: '#f9fafb', color: '#9ca3af' }} />
        </div>

        {/* Name */}
        <div className="form-row">
          <div className="form-group">
            <label>{t.firstName}</label>
            <input
              value={form.firstName}
              onChange={e => setForm(prev => ({ ...prev, firstName: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label>{t.lastName}</label>
            <input
              value={form.lastName}
              onChange={e => setForm(prev => ({ ...prev, lastName: e.target.value }))}
            />
          </div>
        </div>

        {/* Phone */}
        <div className="form-group">
          <label>{t.phone}</label>
          <input
            value={form.phone}
            onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="+966 55 123 4567"
            dir="ltr"
          />
        </div>

        {/* City */}
        <div className="form-group">
          <label>{t.city}</label>
          <select
            value={form.city}
            onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
          >
            <option value="">{t.selectCity}</option>
            {SAUDI_CITIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Language */}
        <div className="form-group">
          <label>{t.language}</label>
          <select
            value={form.preferredLanguage}
            onChange={e => setForm(prev => ({ ...prev, preferredLanguage: e.target.value }))}
          >
            <option value="ar">{t.arabic}</option>
            <option value="en">{t.english}</option>
          </select>
        </div>

        {/* Save */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? t.saving : t.save}
          </button>
          {saved && (
            <span style={{ color: '#059669', fontSize: '0.875rem' }}>{t.saved}</span>
          )}
        </div>
      </div>
    </div>
  )
}
