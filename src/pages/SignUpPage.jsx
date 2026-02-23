import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { authClient } from '../lib/auth-client'
import './AuthPages.css'

const SPECIALTIES = [
  { value: "general", label_ar: "طب عام", label_en: "General Medicine" },
  { value: "cardiology", label_ar: "طب القلب", label_en: "Cardiology" },
  { value: "dermatology", label_ar: "طب الجلد", label_en: "Dermatology" },
  { value: "dentist", label_ar: "طب الأسنان", label_en: "Dentistry" },
  { value: "ophthalmology", label_ar: "طب العيون", label_en: "Ophthalmology" },
  { value: "pediatrics", label_ar: "طب الأطفال", label_en: "Pediatrics" },
  { value: "gynecology", label_ar: "طب النساء", label_en: "Gynecology" },
  { value: "orthopedics", label_ar: "طب العظام", label_en: "Orthopedics" },
  { value: "neurology", label_ar: "طب الأعصاب", label_en: "Neurology" },
  { value: "psychiatry", label_ar: "الطب النفسي", label_en: "Psychiatry" },
  { value: "ent", label_ar: "أنف أذن حنجرة", label_en: "ENT" },
  { value: "urology", label_ar: "طب المسالك البولية", label_en: "Urology" },
  { value: "radiology", label_ar: "الأشعة", label_en: "Radiology" },
  { value: "laboratory", label_ar: "مختبر تحاليل", label_en: "Laboratory" },
]

const translations = {
  ar: {
    title: 'إنشاء حساب',
    subtitle: 'انضم إلى تبرا اليوم',
    patient: 'أنا مريض',
    doctor: 'أنا طبيب',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    specialty: 'التخصص',
    selectSpecialty: 'اختر التخصص',
    signUp: 'إنشاء الحساب',
    hasAccount: 'لديك حساب بالفعل؟',
    signIn: 'تسجيل الدخول',
    backHome: 'العودة للرئيسية',
    error: 'حدث خطأ أثناء إنشاء الحساب',
    loading: 'جاري التحميل...',
    pendingTitle: 'تم إنشاء حسابك بنجاح',
    pendingMessage: 'حسابك قيد المراجعة من قبل الإدارة. سيتم إعلامك عند الموافقة على حسابك.',
    patientSuccess: 'تم إنشاء حسابك بنجاح! جاري التحويل...',
    goHome: 'الذهاب للرئيسية',
  },
  en: {
    title: 'Create Account',
    subtitle: 'Join Tabra today',
    patient: "I'm a patient",
    doctor: "I'm a doctor",
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
    specialty: 'Specialty',
    selectSpecialty: 'Select specialty',
    signUp: 'Create Account',
    hasAccount: 'Already have an account?',
    signIn: 'Sign In',
    backHome: 'Back to Home',
    error: 'An error occurred during sign up',
    loading: 'Loading...',
    pendingTitle: 'Account created successfully',
    pendingMessage: 'Your account is pending admin review. You will be notified when approved.',
    patientSuccess: 'Account created! Redirecting...',
    goHome: 'Go to Home',
  }
}

export default function SignUpPage() {
  const [role, setRole] = useState('patient')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [lang] = useState('ar')
  const t = translations[lang] || translations.ar
  const createUser = useMutation(api.users.mutations.createUser)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Sign up with better-auth
      const { error: signUpError } = await authClient.signUp.email({
        email,
        password,
        name: `${firstName} ${lastName}`.trim(),
      })

      if (signUpError) {
        setError(signUpError.message || t.error)
        setLoading(false)
        return
      }

      // 2. Create user record in our users table
      await createUser({
        email,
        firstName,
        lastName,
        role,
        specialty: role === 'doctor' ? specialty : undefined,
      })

      setSuccess(true)
      setLoading(false)

      // Redirect based on role
      setTimeout(() => {
        if (role === 'doctor') {
          window.location.href = '/doctor-dashboard'
        } else {
          window.location.href = '/'
        }
      }, 1500)
    } catch (err) {
      setError(t.error)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="auth-container">
          <div className="auth-card">
            <div className="auth-header">
              <Link to="/" className="auth-logo">تبرا</Link>
              <h1 className="auth-title">{t.pendingTitle}</h1>
            </div>
            <div className="auth-success">
              {role === 'patient' ? (
                <p>{t.patientSuccess}</p>
              ) : (
                <p>{t.pendingMessage}</p>
              )}
            </div>
            <div className="auth-footer">
              <Link to="/" className="auth-link-secondary">{t.goHome}</Link>
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
            <Link to="/" className="auth-logo">تبرا</Link>
            <h1 className="auth-title">{t.title}</h1>
            <p className="auth-subtitle">{t.subtitle}</p>
          </div>

          {/* Role Toggle */}
          <div className="auth-role-toggle">
            <button
              type="button"
              className={`role-btn ${role === 'patient' ? 'active' : ''}`}
              onClick={() => setRole('patient')}
            >
              {t.patient}
            </button>
            <button
              type="button"
              className={`role-btn ${role === 'doctor' ? 'active' : ''}`}
              onClick={() => setRole('doctor')}
            >
              {t.doctor}
            </button>
          </div>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-row">
              <div className="auth-field">
                <label>{t.firstName}</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="auth-field">
                <label>{t.lastName}</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="auth-field">
              <label>{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="name@example.com"
              />
            </div>

            <div className="auth-field">
              <label>{t.password}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
              />
            </div>

            {role === 'doctor' && (
              <div className="auth-field">
                <label>{t.specialty}</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  required
                >
                  <option value="">{t.selectSpecialty}</option>
                  {SPECIALTIES.map(s => (
                    <option key={s.value} value={s.value}>
                      {lang === 'ar' ? s.label_ar : s.label_en}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading ? t.loading : t.signUp}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              {t.hasAccount}{' '}
              <Link to="/sign-in" className="auth-link">{t.signIn}</Link>
            </p>
            <Link to="/" className="auth-link-secondary">{t.backHome}</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
