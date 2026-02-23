import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import './PublicHealthCard.css'

const translations = {
  ar: {
    title: 'البطاقة الصحية',
    subtitle: 'منصة تبرا الصحية',
    cardNotFound: 'البطاقة غير موجودة',
    cardNotFoundDesc: 'تحقق من رقم البطاقة وحاول مرة أخرى',
    name: 'الاسم',
    bloodType: 'فصيلة الدم',
    allergies: 'الحساسية',
    emergencyContact: 'جهة اتصال الطوارئ',
    enterPin: 'أدخل رمز الوصول',
    enterPinDesc: 'أدخل الرمز السري لعرض السجلات الطبية الكاملة',
    pin: 'الرمز السري',
    unlock: 'عرض السجلات',
    wrongPin: 'الرمز غير صحيح',
    medicalRecords: 'السجلات الطبية',
    chronicConditions: 'الأمراض المزمنة',
    medications: 'الأدوية الحالية',
    noRecords: 'لا توجد سجلات طبية',
    loading: 'جاري التحميل...',
    backHome: 'الرئيسية',
    prescription: 'وصفة طبية',
    lab_result: 'نتيجة مخبرية',
    diagnosis: 'تشخيص',
    vaccination: 'تطعيم',
    surgery: 'عملية جراحية',
    note: 'ملاحظة',
    basicInfo: 'المعلومات الأساسية',
    fullAccess: 'الوصول الكامل',
    noAllergies: 'لا توجد حساسية مسجلة',
    noPinSet: 'لم يتم تعيين رمز سري',
  },
  en: {
    title: 'Health Card',
    subtitle: 'Tabra Health Platform',
    cardNotFound: 'Card Not Found',
    cardNotFoundDesc: 'Check the card number and try again',
    name: 'Name',
    bloodType: 'Blood Type',
    allergies: 'Allergies',
    emergencyContact: 'Emergency Contact',
    enterPin: 'Enter Access PIN',
    enterPinDesc: 'Enter the PIN to view full medical records',
    pin: 'PIN',
    unlock: 'View Records',
    wrongPin: 'Incorrect PIN',
    medicalRecords: 'Medical Records',
    chronicConditions: 'Chronic Conditions',
    medications: 'Current Medications',
    noRecords: 'No medical records',
    loading: 'Loading...',
    backHome: 'Home',
    prescription: 'Prescription',
    lab_result: 'Lab Result',
    diagnosis: 'Diagnosis',
    vaccination: 'Vaccination',
    surgery: 'Surgery',
    note: 'Note',
    basicInfo: 'Basic Information',
    fullAccess: 'Full Access',
    noAllergies: 'No allergies recorded',
    noPinSet: 'No PIN set',
  }
}

export default function PublicHealthCard() {
  const { cardNumber } = useParams()
  const [lang, setLang] = useState('ar')
  const [pin, setPin] = useState('')
  const [submittedPin, setSubmittedPin] = useState(null)

  const t = translations[lang]
  const isRTL = lang === 'ar'

  const cardData = useQuery(api.healthCards.queries.getHealthCardByNumber, {
    cardNumber: cardNumber || '',
    emergencyPin: submittedPin || undefined,
  })

  const handlePinSubmit = (e) => {
    e.preventDefault()
    if (pin.trim()) {
      setSubmittedPin(pin.trim())
    }
  }

  const recordTypeLabel = (type) => {
    return t[type] || type
  }

  const recordTypeIcon = (type) => {
    const icons = {
      prescription: { bg: '#dbeafe', color: '#2563eb', label: 'Rx' },
      lab_result: { bg: '#fef3c7', color: '#d97706', label: 'Lab' },
      diagnosis: { bg: '#fce7f3', color: '#db2777', label: 'Dx' },
      vaccination: { bg: '#d1fae5', color: '#059669', label: 'Vx' },
      surgery: { bg: '#fee2e2', color: '#DC2626', label: 'Sx' },
      note: { bg: '#f3f4f6', color: '#6b7280', label: 'N' },
    }
    return icons[type] || icons.note
  }

  if (cardData === undefined) {
    return (
      <div className="public-card-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="public-card-container">
          <p style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>{t.loading}</p>
        </div>
      </div>
    )
  }

  if (cardData === null) {
    return (
      <div className="public-card-page" dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="public-card-container">
          <div className="public-card-header">
            <Link to="/" className="public-card-logo">tabra</Link>
            <button className="lang-toggle" onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}>
              {lang === 'ar' ? 'EN' : 'AR'}
            </button>
          </div>
          <div className="card-not-found">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <line x1="2" y1="10" x2="22" y2="10" />
            </svg>
            <h2>{t.cardNotFound}</h2>
            <p>{t.cardNotFoundDesc}</p>
            <Link to="/" className="btn-back-home">{t.backHome}</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="public-card-page" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="public-card-container">
        {/* Header */}
        <div className="public-card-header">
          <Link to="/" className="public-card-logo">tabra</Link>
          <button className="lang-toggle" onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}>
            {lang === 'ar' ? 'EN' : 'AR'}
          </button>
        </div>

        {/* Card Visual */}
        <div className="public-id-card">
          <div className="public-id-top">
            <span className="public-id-brand">tabra</span>
            <span className="public-id-number">{cardData.cardNumber}</span>
          </div>
          <div className="public-id-name">{cardData.userName}</div>
          {cardData.bloodType && (
            <div className="public-id-blood">
              <span className="public-id-blood-label">{t.bloodType}</span>
              <span className="public-id-blood-value">{cardData.bloodType}</span>
            </div>
          )}
        </div>

        {/* Basic Info Section */}
        <div className="public-section">
          <h3 className="public-section-title">{t.basicInfo}</h3>

          {/* Allergies */}
          <div className="public-info-block">
            <p className="public-info-label">{t.allergies}</p>
            {cardData.allergies?.length > 0 ? (
              <div className="public-tag-list">
                {cardData.allergies.map((a, i) => (
                  <span key={i} className="public-tag public-tag-red">{a}</span>
                ))}
              </div>
            ) : (
              <p className="public-info-empty">{t.noAllergies}</p>
            )}
          </div>

          {/* Emergency Contact */}
          {cardData.emergencyContact?.name && (
            <div className="public-info-block">
              <p className="public-info-label">{t.emergencyContact}</p>
              <p className="public-info-value">
                {cardData.emergencyContact.name} &middot; {cardData.emergencyContact.phone}
                {cardData.emergencyContact.relationship && ` (${cardData.emergencyContact.relationship})`}
              </p>
            </div>
          )}
        </div>

        {/* PIN Section - show if card has a PIN and not yet verified */}
        {cardData.hasPin && !cardData.pinVerified && (
          <div className="public-pin-section">
            <h3 className="public-section-title">{t.enterPin}</h3>
            <p className="public-pin-desc">{t.enterPinDesc}</p>
            <form onSubmit={handlePinSubmit} className="public-pin-form">
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                placeholder="****"
                maxLength={6}
                className="public-pin-input"
              />
              <button type="submit" className="public-pin-btn" disabled={!pin.trim()}>
                {t.unlock}
              </button>
            </form>
            {cardData.pinError && (
              <p className="public-pin-error">{t.wrongPin}</p>
            )}
          </div>
        )}

        {/* Full Medical Info - only with PIN */}
        {cardData.pinVerified && (
          <>
            {/* Chronic Conditions */}
            {cardData.chronicConditions?.length > 0 && (
              <div className="public-section">
                <h3 className="public-section-title">{t.chronicConditions}</h3>
                <div className="public-tag-list">
                  {cardData.chronicConditions.map((c, i) => (
                    <span key={i} className="public-tag public-tag-blue">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Current Medications */}
            {cardData.currentMedications?.length > 0 && (
              <div className="public-section">
                <h3 className="public-section-title">{t.medications}</h3>
                {cardData.currentMedications.map((med, i) => (
                  <div key={i} className="public-med-item">
                    <span className="public-med-name">{med.name}</span>
                    {med.dosage && <span className="public-med-detail">{med.dosage}</span>}
                    {med.frequency && <span className="public-med-detail">{med.frequency}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Medical Records */}
            <div className="public-section">
              <h3 className="public-section-title">{t.medicalRecords}</h3>
              {cardData.medicalRecords.length === 0 ? (
                <p className="public-info-empty">{t.noRecords}</p>
              ) : (
                cardData.medicalRecords.map((record, i) => {
                  const icon = recordTypeIcon(record.type)
                  return (
                    <div key={i} className="public-record-card">
                      <div className="public-record-header">
                        <div
                          className="public-record-icon"
                          style={{ background: icon.bg, color: icon.color }}
                        >
                          {icon.label}
                        </div>
                        <div className="public-record-info">
                          <p className="public-record-title">{record.title}</p>
                          <p className="public-record-meta">
                            {recordTypeLabel(record.type)}
                            {record.recordDate && ` · ${record.recordDate}`}
                            {record.doctorName && ` · ${record.doctorName}`}
                          </p>
                        </div>
                      </div>
                      {record.description && (
                        <p className="public-record-desc">{record.description}</p>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="public-card-footer">
          <p>{t.subtitle}</p>
        </div>
      </div>
    </div>
  )
}
