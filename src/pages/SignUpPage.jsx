import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { authClient } from '../lib/auth-client'
import { useLanguage } from '../hooks/useLanguage'
import './AuthPages.css'

const BUSINESS_TYPES = [
  { value: "hotel", label_ar: "فندق", label_en: "Hotel" },
  { value: "restaurant", label_ar: "مطعم", label_en: "Restaurant" },
  { value: "tour_operator", label_ar: "منظم رحلات", label_en: "Tour Operator" },
  { value: "travel_agency", label_ar: "وكالة سفر", label_en: "Travel Agency" },
  { value: "car_rental", label_ar: "تأجير سيارات", label_en: "Car Rental" },
  { value: "attraction", label_ar: "معلم سياحي", label_en: "Attraction" },
  { value: "event_organizer", label_ar: "منظم فعاليات", label_en: "Event Organizer" },
  { value: "guide", label_ar: "مرشد سياحي", label_en: "Tour Guide" },
]

const translations = {
  ar: {
    title: 'إنشاء حساب',
    subtitle: 'انضم إلى Hasio اليوم',
    tourist: 'أنا سائح',
    business: 'صاحب عمل',
    firstName: 'الاسم الأول',
    lastName: 'اسم العائلة',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    confirmPassword: 'تأكيد كلمة المرور',
    passwordMismatch: 'كلمتا المرور غير متطابقتين',
    phone: 'رقم الهاتف',
    businessType: 'نوع العمل',
    selectBusinessType: 'اختر نوع العمل',
    signUp: 'إنشاء الحساب',
    hasAccount: 'لديك حساب بالفعل؟',
    signIn: 'تسجيل الدخول',
    backHome: 'العودة للرئيسية',
    error: 'حدث خطأ أثناء إنشاء الحساب',
    loading: 'جاري التحميل...',
    pendingTitle: 'تم إنشاء حسابك بنجاح',
    pendingMessage: 'حسابك قيد المراجعة من قبل الإدارة. سيتم إعلامك عند الموافقة على حسابك.',
    touristSuccess: 'تم إنشاء حسابك بنجاح! جاري التحويل...',
    goHome: 'الذهاب للرئيسية',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: '••••••••',
    confirmPasswordPlaceholder: '••••••••',
  },
  en: {
    title: 'Create Account',
    subtitle: 'Join Hasio today',
    tourist: "I'm a tourist",
    business: "Business owner",
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    passwordMismatch: 'Passwords do not match',
    phone: 'Phone Number',
    businessType: 'Business Type',
    selectBusinessType: 'Select business type',
    signUp: 'Create Account',
    hasAccount: 'Already have an account?',
    signIn: 'Sign In',
    backHome: 'Back to Home',
    error: 'An error occurred during sign up',
    loading: 'Loading...',
    pendingTitle: 'Account created successfully',
    pendingMessage: 'Your account is pending admin review. You will be notified when approved.',
    touristSuccess: 'Account created! Redirecting...',
    goHome: 'Go to Home',
    emailPlaceholder: 'name@example.com',
    passwordPlaceholder: '••••••••',
    confirmPasswordPlaceholder: '••••••••',
  }
}

export default function SignUpPage() {
  const [role, setRole] = useState('tourist')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { lang, toggleLang } = useLanguage()
  const t = translations[lang] || translations.ar
  const createUser = useMutation(api.users.mutations.createUser)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError(t.passwordMismatch)
      return
    }

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
        phone: phone || undefined,
        role,
        businessType: role === 'business_owner' ? businessType : undefined,
      })

      setSuccess(true)
      setLoading(false)

      // Redirect based on role
      setTimeout(() => {
        if (role === 'business_owner') {
          window.location.href = '/business'
        } else {
          window.location.href = '/home'
        }
      }, 1500)
    } catch {
      setError(t.error)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="auth-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        <div className="auth-card">
          <button
            className="auth-lang-toggle"
            type="button"
            onClick={() => toggleLang()}
          >
            {lang === 'ar' ? 'EN' : 'عربي'}
          </button>
          <Link to="/" className="auth-logo">Hasio</Link>
          <h1>{t.pendingTitle}</h1>
          <div className="auth-success">
            {role === 'tourist' ? (
              <p>{t.touristSuccess}</p>
            ) : (
              <p>{t.pendingMessage}</p>
            )}
          </div>
          <p className="auth-footer-text">
            <Link to="/">{t.goHome}</Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="auth-card">
        <button
          className="auth-lang-toggle"
          type="button"
          onClick={() => toggleLang()}
        >
          {lang === 'ar' ? 'EN' : 'عربي'}
        </button>

        <Link to="/" className="auth-logo">Hasio</Link>
        <h1>{t.title}</h1>
        <p className="auth-subtitle">{t.subtitle}</p>

        {/* Role Toggle */}
        <div className="auth-role-toggle">
          <button
            type="button"
            className={`role-btn ${role === 'tourist' ? 'active' : ''}`}
            onClick={() => setRole('tourist')}
          >
            {t.tourist}
          </button>
          <button
            type="button"
            className={`role-btn ${role === 'business_owner' ? 'active' : ''}`}
            onClick={() => setRole('business_owner')}
          >
            {t.business}
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-row">
            <div className="form-group-auth">
              <label className="form-label-auth">{t.firstName}</label>
              <input
                className="form-input-auth"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="form-group-auth">
              <label className="form-label-auth">{t.lastName}</label>
              <input
                className="form-input-auth"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group-auth">
            <label className="form-label-auth">{t.email}</label>
            <input
              className="form-input-auth"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder={t.emailPlaceholder}
            />
          </div>

          <div className="form-group-auth">
            <label className="form-label-auth">{t.phone}</label>
            <input
              className="form-input-auth"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoComplete="tel"
              placeholder="+966 55 123 4567"
              dir="ltr"
            />
          </div>

          <div className="form-group-auth">
            <label className="form-label-auth">{t.password}</label>
            <input
              className="form-input-auth"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder={t.passwordPlaceholder}
            />
          </div>

          <div className="form-group-auth">
            <label className="form-label-auth">{t.confirmPassword}</label>
            <input
              className="form-input-auth"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder={t.confirmPasswordPlaceholder}
            />
          </div>

          {role === 'business_owner' && (
            <div className="form-group-auth">
              <label className="form-label-auth">{t.businessType}</label>
              <select
                className="form-input-auth"
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value)}
                required
              >
                <option value="">{t.selectBusinessType}</option>
                {BUSINESS_TYPES.map(b => (
                  <option key={b.value} value={b.value}>
                    {lang === 'ar' ? b.label_ar : b.label_en}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button className="auth-btn-primary" type="submit" disabled={loading}>
            {loading ? t.loading : t.signUp}
          </button>
        </form>

        <p className="auth-footer-text">
          {t.hasAccount}{' '}
          <Link to="/sign-in">{t.signIn}</Link>
        </p>
        <p className="auth-legal">
          By continuing, you agree to our{' '}
          <Link to="/terms-of-service.html">Terms of Service</Link> and{' '}
          <Link to="/privacy-policy.html">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
