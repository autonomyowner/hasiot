import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'

const WILAYAS = [
  'Adrar', 'Chlef', 'Laghouat', 'Oum El Bouaghi', 'Batna', 'Béjaïa', 'Biskra',
  'Béchar', 'Blida', 'Bouira', 'Tamanrasset', 'Tébessa', 'Tlemcen', 'Tiaret',
  'Tizi Ouzou', 'Alger', 'Djelfa', 'Jijel', 'Sétif', 'Saïda', 'Skikda',
  'Sidi Bel Abbès', 'Annaba', 'Guelma', 'Constantine', 'Médéa', 'Mostaganem',
  'M\'Sila', 'Mascara', 'Ouargla', 'Oran', 'El Bayadh', 'Illizi',
  'Bordj Bou Arréridj', 'Boumerdès', 'El Tarf', 'Tindouf', 'Tissemsilt',
  'El Oued', 'Khenchela', 'Souk Ahras', 'Tipaza', 'Mila', 'Aïn Defla',
  'Naâma', 'Aïn Témouchent', 'Ghardaïa', 'Relizane',
  'El M\'Ghair', 'El Menia', 'Ouled Djellal', 'Bordj Badji Mokhtar',
  'Béni Abbès', 'Timimoun', 'Touggourt', 'Djanet', 'In Salah', 'In Guezzam'
]

const translations = {
  ar: {
    title: 'الملف الشخصي',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    phone: 'رقم الهاتف',
    wilaya: 'الولاية',
    selectWilaya: 'اختر الولاية',
    language: 'اللغة المفضلة',
    arabic: 'العربية',
    english: 'English',
    save: 'حفظ التعديلات',
    saving: 'جاري الحفظ...',
    saved: 'تم الحفظ بنجاح',
    role: 'نوع الحساب',
    patient: 'مريض',
    doctor: 'طبيب',
    clinic: 'عيادة',
  },
  en: {
    title: 'Profile',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone Number',
    wilaya: 'Wilaya',
    selectWilaya: 'Select wilaya',
    language: 'Preferred Language',
    arabic: 'العربية',
    english: 'English',
    save: 'Save Changes',
    saving: 'Saving...',
    saved: 'Saved successfully',
    role: 'Account Type',
    patient: 'Patient',
    doctor: 'Doctor',
    clinic: 'Clinic',
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
    wilaya: user?.wilaya || '',
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
        wilaya: form.wilaya || undefined,
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
    if (role === 'patient') return t.patient
    if (role === 'doctor') return t.doctor
    if (role === 'clinic') return t.clinic
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
            placeholder="+213 XX XXX XXXX"
            dir="ltr"
          />
        </div>

        {/* Wilaya */}
        <div className="form-group">
          <label>{t.wilaya}</label>
          <select
            value={form.wilaya}
            onChange={e => setForm(prev => ({ ...prev, wilaya: e.target.value }))}
          >
            <option value="">{t.selectWilaya}</option>
            {WILAYAS.map((w, i) => (
              <option key={w} value={w}>{`${String(i + 1).padStart(2, '0')} - ${w}`}</option>
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
