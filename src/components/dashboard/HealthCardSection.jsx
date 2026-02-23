import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { motion, AnimatePresence } from 'framer-motion'

const translations = {
  ar: {
    title: 'البطاقة الصحية',
    createCard: 'إنشاء البطاقة الصحية',
    editCard: 'تعديل البطاقة',
    saveCard: 'حفظ',
    saving: 'جاري الحفظ...',
    cardNumber: 'رقم البطاقة',
    copied: 'تم النسخ!',
    bloodType: 'فصيلة الدم',
    allergies: 'الحساسية',
    chronicConditions: 'الأمراض المزمنة',
    medications: 'الأدوية الحالية',
    medName: 'اسم الدواء',
    dosage: 'الجرعة',
    frequency: 'التكرار',
    emergencyContact: 'جهة اتصال الطوارئ',
    contactName: 'الاسم',
    contactPhone: 'الهاتف',
    contactRelation: 'العلاقة',
    emergencyPin: 'رمز الطوارئ',
    noCard: 'لم تقم بإنشاء بطاقة صحية بعد',
    createFirst: 'أنشئ بطاقتك الصحية لحفظ معلوماتك الطبية في مكان واحد',
    records: 'السجلات الطبية',
    addRecord: 'إضافة سجل',
    all: 'الكل',
    prescription: 'وصفة طبية',
    lab_result: 'نتيجة مخبرية',
    diagnosis: 'تشخيص',
    vaccination: 'تطعيم',
    surgery: 'عملية جراحية',
    note: 'ملاحظة',
    recordTitle: 'العنوان',
    recordDate: 'التاريخ',
    description: 'الوصف',
    doctorName: 'اسم الطبيب',
    recordType: 'نوع السجل',
    noRecords: 'لا توجد سجلات طبية',
    addFirst: 'أضف سجلك الطبي الأول',
    delete: 'حذف',
    deleteConfirm: 'هل تريد حذف هذا السجل؟',
    addAllergy: 'إضافة حساسية...',
    addCondition: 'إضافة حالة مزمنة...',
    addMed: 'إضافة دواء',
    removeMed: 'حذف',
  },
  en: {
    title: 'Health Card',
    createCard: 'Create Health Card',
    editCard: 'Edit Card',
    saveCard: 'Save',
    saving: 'Saving...',
    cardNumber: 'Card Number',
    copied: 'Copied!',
    bloodType: 'Blood Type',
    allergies: 'Allergies',
    chronicConditions: 'Chronic Conditions',
    medications: 'Current Medications',
    medName: 'Medication name',
    dosage: 'Dosage',
    frequency: 'Frequency',
    emergencyContact: 'Emergency Contact',
    contactName: 'Name',
    contactPhone: 'Phone',
    contactRelation: 'Relationship',
    emergencyPin: 'Emergency PIN',
    noCard: 'You haven\'t created a health card yet',
    createFirst: 'Create your health card to keep your medical information in one place',
    records: 'Medical Records',
    addRecord: 'Add Record',
    all: 'All',
    prescription: 'Prescription',
    lab_result: 'Lab Result',
    diagnosis: 'Diagnosis',
    vaccination: 'Vaccination',
    surgery: 'Surgery',
    note: 'Note',
    recordTitle: 'Title',
    recordDate: 'Date',
    description: 'Description',
    doctorName: 'Doctor name',
    recordType: 'Record type',
    noRecords: 'No medical records',
    addFirst: 'Add your first medical record',
    delete: 'Delete',
    deleteConfirm: 'Are you sure you want to delete this record?',
    addAllergy: 'Add allergy...',
    addCondition: 'Add condition...',
    addMed: 'Add medication',
    removeMed: 'Remove',
  }
}

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const RECORD_TYPES = ['prescription', 'lab_result', 'diagnosis', 'vaccination', 'surgery', 'note']

export default function HealthCardSection({ lang = 'ar', user }) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'

  const healthCard = useQuery(api.healthCards.queries.getMyHealthCard)
  const records = useQuery(api.healthCards.queries.getMyMedicalRecords, {})
  const createCard = useMutation(api.healthCards.mutations.createHealthCard)
  const updateCard = useMutation(api.healthCards.mutations.updateHealthCard)
  const addRecord = useMutation(api.healthCards.mutations.addMedicalRecord)
  const deleteRecord = useMutation(api.healthCards.mutations.deleteMedicalRecord)

  const [showEdit, setShowEdit] = useState(false)
  const [showAddRecord, setShowAddRecord] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  // Card form state
  const [cardForm, setCardForm] = useState({
    bloodType: '',
    allergies: [],
    chronicConditions: [],
    currentMedications: [],
    emergencyContact: { name: '', phone: '', relationship: '' },
    emergencyAccessPin: '',
  })

  // Record form state
  const [recordForm, setRecordForm] = useState({
    type: 'diagnosis',
    title: '',
    description: '',
    recordDate: new Date().toISOString().split('T')[0],
    doctorName: '',
  })

  const [allergyInput, setAllergyInput] = useState('')
  const [conditionInput, setConditionInput] = useState('')

  const initEditForm = () => {
    if (healthCard) {
      setCardForm({
        bloodType: healthCard.bloodType || '',
        allergies: healthCard.allergies || [],
        chronicConditions: healthCard.chronicConditions || [],
        currentMedications: healthCard.currentMedications || [],
        emergencyContact: healthCard.emergencyContact || { name: '', phone: '', relationship: '' },
        emergencyAccessPin: '',
      })
    }
    setShowEdit(true)
  }

  const handleSaveCard = async () => {
    setSaving(true)
    try {
      const data = {
        bloodType: cardForm.bloodType || undefined,
        allergies: cardForm.allergies,
        chronicConditions: cardForm.chronicConditions,
        currentMedications: cardForm.currentMedications,
        emergencyContact: cardForm.emergencyContact.name
          ? cardForm.emergencyContact
          : undefined,
        emergencyAccessPin: cardForm.emergencyAccessPin || undefined,
      }

      if (healthCard) {
        await updateCard(data)
      } else {
        await createCard(data)
      }
      setShowEdit(false)
    } catch (err) {
      console.error('Save card error:', err)
    }
    setSaving(false)
  }

  const handleAddRecord = async () => {
    setSaving(true)
    try {
      await addRecord({
        type: recordForm.type,
        title: recordForm.title,
        description: recordForm.description || undefined,
        recordDate: recordForm.recordDate,
        doctorName: recordForm.doctorName || undefined,
      })
      setShowAddRecord(false)
      setRecordForm({
        type: 'diagnosis',
        title: '',
        description: '',
        recordDate: new Date().toISOString().split('T')[0],
        doctorName: '',
      })
    } catch (err) {
      console.error('Add record error:', err)
    }
    setSaving(false)
  }

  const handleDeleteRecord = async (recordId) => {
    if (!confirm(t.deleteConfirm)) return
    try {
      await deleteRecord({ recordId })
    } catch (err) {
      console.error('Delete record error:', err)
    }
  }

  const copyCardNumber = () => {
    if (healthCard?.cardNumber) {
      navigator.clipboard.writeText(healthCard.cardNumber)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const addArrayItem = (field, value, setInput) => {
    if (!value.trim()) return
    setCardForm(prev => ({
      ...prev,
      [field]: [...prev[field], value.trim()]
    }))
    setInput('')
  }

  const removeArrayItem = (field, index) => {
    setCardForm(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }))
  }

  const addMedication = () => {
    setCardForm(prev => ({
      ...prev,
      currentMedications: [...prev.currentMedications, { name: '', dosage: '', frequency: '' }]
    }))
  }

  const updateMedication = (index, field, value) => {
    setCardForm(prev => ({
      ...prev,
      currentMedications: prev.currentMedications.map((med, i) =>
        i === index ? { ...med, [field]: value } : med
      )
    }))
  }

  const removeMedication = (index) => {
    setCardForm(prev => ({
      ...prev,
      currentMedications: prev.currentMedications.filter((_, i) => i !== index)
    }))
  }

  const filteredRecords = (records || []).filter(
    r => filterType === 'all' || r.type === filterType
  )

  const recordTypeIcon = (type) => {
    const icons = {
      prescription: { bg: '#dbeafe', color: '#2563eb', label: 'Rx' },
      lab_result: { bg: '#fef3c7', color: '#d97706', label: '🧪' },
      diagnosis: { bg: '#fce7f3', color: '#db2777', label: 'Dx' },
      vaccination: { bg: '#d1fae5', color: '#059669', label: '💉' },
      surgery: { bg: '#fee2e2', color: '#DC2626', label: '🔬' },
      note: { bg: '#f3f4f6', color: '#6b7280', label: '📝' },
    }
    return icons[type] || icons.note
  }

  if (healthCard === undefined) {
    return <div style={{ textAlign: 'center', color: '#9ca3af', padding: '3rem' }}>
      {isRTL ? 'جاري التحميل...' : 'Loading...'}
    </div>
  }

  return (
    <div>
      <div className="section-header">
        <h2>{t.title}</h2>
        {healthCard && (
          <button className="btn-secondary" onClick={initEditForm}>
            {t.editCard}
          </button>
        )}
      </div>

      {/* Health Card Visual or Create */}
      {!healthCard ? (
        <div className="empty-state">
          <CardEmptyIcon />
          <h3>{t.noCard}</h3>
          <p>{t.createFirst}</p>
          <button className="btn-primary" onClick={() => {
            setCardForm({
              bloodType: '',
              allergies: [],
              chronicConditions: [],
              currentMedications: [],
              emergencyContact: { name: '', phone: '', relationship: '' },
              emergencyAccessPin: '',
            })
            setShowEdit(true)
          }}>
            + {t.createCard}
          </button>
        </div>
      ) : (
        <>
          {/* Visual Card */}
          <div className="health-card-visual">
            <div className="hc-header">
              <span className="hc-logo">تبرا</span>
              <span className="hc-number" onClick={copyCardNumber} title={t.cardNumber}>
                {healthCard.cardNumber}
                {copied ? ' ✓' : ' 📋'}
              </span>
            </div>
            <div className="hc-name">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="hc-details">
              {healthCard.bloodType && (
                <div className="hc-detail-item">
                  <span className="hc-detail-label">{t.bloodType}</span>
                  <span className="hc-detail-value">{healthCard.bloodType}</span>
                </div>
              )}
              {healthCard.emergencyContact?.name && (
                <div className="hc-detail-item">
                  <span className="hc-detail-label">{t.emergencyContact}</span>
                  <span className="hc-detail-value">
                    {healthCard.emergencyContact.name} · {healthCard.emergencyContact.phone}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card details */}
          {(healthCard.allergies?.length > 0 || healthCard.chronicConditions?.length > 0) && (
            <div className="dash-card" style={{ marginBottom: '1rem' }}>
              {healthCard.allergies?.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.375rem', fontWeight: 500 }}>
                    {t.allergies}
                  </p>
                  <div className="tag-list">
                    {healthCard.allergies.map((a, i) => (
                      <span key={i} className="tag tag-red">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {healthCard.chronicConditions?.length > 0 && (
                <div style={{ marginBottom: '0.75rem' }}>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.375rem', fontWeight: 500 }}>
                    {t.chronicConditions}
                  </p>
                  <div className="tag-list">
                    {healthCard.chronicConditions.map((c, i) => (
                      <span key={i} className="tag tag-blue">{c}</span>
                    ))}
                  </div>
                </div>
              )}
              {healthCard.currentMedications?.length > 0 && (
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.375rem', fontWeight: 500 }}>
                    {t.medications}
                  </p>
                  {healthCard.currentMedications.map((med, i) => (
                    <p key={i} style={{ fontSize: '0.8125rem', color: '#374151', margin: '0.125rem 0' }}>
                      {med.name} {med.dosage && `· ${med.dosage}`} {med.frequency && `· ${med.frequency}`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Medical Records */}
          <div className="section-header" style={{ marginTop: '2rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', margin: 0 }}>{t.records}</h3>
            <button className="btn-primary" onClick={() => setShowAddRecord(true)} style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}>
              + {t.addRecord}
            </button>
          </div>

          {/* Filter tabs */}
          <div className="filter-tabs">
            {['all', ...RECORD_TYPES].map(type => (
              <button
                key={type}
                className={`filter-tab ${filterType === type ? 'active' : ''}`}
                onClick={() => setFilterType(type)}
              >
                {t[type] || type}
              </button>
            ))}
          </div>

          {/* Records list */}
          {filteredRecords.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem' }}>
              <p>{t.noRecords}</p>
            </div>
          ) : (
            filteredRecords.map(record => {
              const icon = recordTypeIcon(record.type)
              return (
                <div key={record._id} className="record-card">
                  <div className="record-header">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                      <div
                        className="record-type-icon"
                        style={{ background: icon.bg, color: icon.color }}
                      >
                        {icon.label}
                      </div>
                      <div>
                        <p className="record-title">{record.title}</p>
                        <p className="record-meta">
                          {new Date(record.recordDate + 'T00:00:00').toLocaleDateString(isRTL ? 'ar-DZ' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                          {record.doctorName && ` · ${record.doctorName}`}
                          {record.doctor && ` · ${isRTL ? record.doctor.name_ar : record.doctor.name_en}`}
                        </p>
                      </div>
                    </div>
                    <button
                      className="record-delete"
                      onClick={() => handleDeleteRecord(record._id)}
                      title={t.delete}
                    >
                      ✕
                    </button>
                  </div>
                  {record.description && (
                    <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0.5rem 0 0', paddingRight: isRTL ? '2.75rem' : 0, paddingLeft: isRTL ? 0 : '2.75rem' }}>
                      {record.description}
                    </p>
                  )}
                  {record.labResults?.length > 0 && (
                    <div style={{ marginTop: '0.5rem', paddingRight: isRTL ? '2.75rem' : 0, paddingLeft: isRTL ? 0 : '2.75rem' }}>
                      {record.labResults.map((lab, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: '0.25rem 0', borderBottom: '1px solid #f3f4f6' }}>
                          <span style={{ color: '#374151' }}>{lab.testName}</span>
                          <span style={{ color: lab.isAbnormal ? '#DC2626' : '#059669', fontWeight: 500 }}>
                            {lab.result} {lab.normalRange && <span style={{ color: '#9ca3af', fontWeight: 400 }}>({lab.normalRange})</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </>
      )}

      {/* Edit/Create Card Modal */}
      <AnimatePresence>
        {showEdit && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowEdit(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="modal-header">
                <h2>{healthCard ? t.editCard : t.createCard}</h2>
                <button className="modal-close" onClick={() => setShowEdit(false)}>&times;</button>
              </div>

              {/* Blood Type */}
              <div className="form-group">
                <label>{t.bloodType}</label>
                <select
                  value={cardForm.bloodType}
                  onChange={e => setCardForm(prev => ({ ...prev, bloodType: e.target.value }))}
                >
                  <option value="">--</option>
                  {BLOOD_TYPES.map(bt => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>

              {/* Allergies */}
              <div className="form-group">
                <label>{t.allergies}</label>
                <div className="tag-list" style={{ marginBottom: '0.375rem' }}>
                  {cardForm.allergies.map((a, i) => (
                    <span key={i} className="tag tag-red" style={{ cursor: 'pointer' }} onClick={() => removeArrayItem('allergies', i)}>
                      {a} ✕
                    </span>
                  ))}
                </div>
                <input
                  value={allergyInput}
                  onChange={e => setAllergyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArrayItem('allergies', allergyInput, setAllergyInput))}
                  placeholder={t.addAllergy}
                />
              </div>

              {/* Chronic Conditions */}
              <div className="form-group">
                <label>{t.chronicConditions}</label>
                <div className="tag-list" style={{ marginBottom: '0.375rem' }}>
                  {cardForm.chronicConditions.map((c, i) => (
                    <span key={i} className="tag tag-blue" style={{ cursor: 'pointer' }} onClick={() => removeArrayItem('chronicConditions', i)}>
                      {c} ✕
                    </span>
                  ))}
                </div>
                <input
                  value={conditionInput}
                  onChange={e => setConditionInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addArrayItem('chronicConditions', conditionInput, setConditionInput))}
                  placeholder={t.addCondition}
                />
              </div>

              {/* Medications */}
              <div className="form-group">
                <label>{t.medications}</label>
                {cardForm.currentMedications.map((med, i) => (
                  <div key={i} className="form-row" style={{ marginBottom: '0.5rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input
                        value={med.name}
                        onChange={e => updateMedication(i, 'name', e.target.value)}
                        placeholder={t.medName}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <input
                        value={med.dosage || ''}
                        onChange={e => updateMedication(i, 'dosage', e.target.value)}
                        placeholder={t.dosage}
                      />
                    </div>
                    <button
                      type="button"
                      className="apt-action-btn danger"
                      onClick={() => removeMedication(i)}
                      style={{ marginBottom: '0' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-secondary" onClick={addMedication} style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}>
                  + {t.addMed}
                </button>
              </div>

              {/* Emergency Contact */}
              <div className="form-group">
                <label>{t.emergencyContact}</label>
                <div className="form-row" style={{ marginBottom: '0.5rem' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      value={cardForm.emergencyContact.name}
                      onChange={e => setCardForm(prev => ({
                        ...prev,
                        emergencyContact: { ...prev.emergencyContact, name: e.target.value }
                      }))}
                      placeholder={t.contactName}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <input
                      value={cardForm.emergencyContact.phone}
                      onChange={e => setCardForm(prev => ({
                        ...prev,
                        emergencyContact: { ...prev.emergencyContact, phone: e.target.value }
                      }))}
                      placeholder={t.contactPhone}
                    />
                  </div>
                </div>
                <input
                  value={cardForm.emergencyContact.relationship || ''}
                  onChange={e => setCardForm(prev => ({
                    ...prev,
                    emergencyContact: { ...prev.emergencyContact, relationship: e.target.value }
                  }))}
                  placeholder={t.contactRelation}
                />
              </div>

              {/* Emergency PIN */}
              <div className="form-group">
                <label>{t.emergencyPin}</label>
                <input
                  type="password"
                  value={cardForm.emergencyAccessPin}
                  onChange={e => setCardForm(prev => ({ ...prev, emergencyAccessPin: e.target.value }))}
                  placeholder="****"
                  maxLength={6}
                />
              </div>

              <button
                className="btn-primary"
                onClick={handleSaveCard}
                disabled={saving}
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              >
                {saving ? t.saving : t.saveCard}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Record Modal */}
      <AnimatePresence>
        {showAddRecord && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => e.target === e.currentTarget && setShowAddRecord(false)}
          >
            <motion.div
              className="modal-content"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className="modal-header">
                <h2>{t.addRecord}</h2>
                <button className="modal-close" onClick={() => setShowAddRecord(false)}>&times;</button>
              </div>

              <div className="form-group">
                <label>{t.recordType}</label>
                <select
                  value={recordForm.type}
                  onChange={e => setRecordForm(prev => ({ ...prev, type: e.target.value }))}
                >
                  {RECORD_TYPES.map(type => (
                    <option key={type} value={type}>{t[type]}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>{t.recordTitle}</label>
                <input
                  value={recordForm.title}
                  onChange={e => setRecordForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t.recordDate}</label>
                  <input
                    type="date"
                    value={recordForm.recordDate}
                    onChange={e => setRecordForm(prev => ({ ...prev, recordDate: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>{t.doctorName}</label>
                  <input
                    value={recordForm.doctorName}
                    onChange={e => setRecordForm(prev => ({ ...prev, doctorName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t.description}</label>
                <textarea
                  value={recordForm.description}
                  onChange={e => setRecordForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <button
                className="btn-primary"
                onClick={handleAddRecord}
                disabled={saving || !recordForm.title}
                style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
              >
                {saving ? t.saving : t.addRecord}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CardEmptyIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
      <circle cx="12" cy="15" r="1" />
    </svg>
  )
}
