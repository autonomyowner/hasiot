import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Modal from './Modal'
import ImageUploader from './ImageUploader'
import FilterSelect from './FilterSelect'
import { useToast } from './toast-context'
import {
  CITY_OPTIONS, PRICE_UNITS, SERVICE_TYPE_OPTIONS, canonicalCity,
} from '../constants'

// The server's limits (convex/services/logic.ts), checked here first so a long
// form is not filled in only to be refused.
const MAX_TITLE = 100
const MAX_DESCRIPTION = 2000
const MAX_PRICE = 100000
const MAX_GROUP = 100
const MAX_IMAGES = 5

/** Split on both commas: an Arabic keyboard types «،». */
const splitList = (text) => text.split(/[,،]/).map((s) => s.trim()).filter(Boolean)

const numberOrBlank = (value) => (value === undefined || value === null ? '' : String(value))

function toForm(service) {
  return {
    serviceType: service.serviceType || 'other',
    title_ar: service.title_ar || '',
    title_en: service.title_en || '',
    description_ar: service.description_ar || '',
    description_en: service.description_en || '',
    price: numberOrBlank(service.price),
    priceUnit: service.priceUnit || '',
    maxGroupSize: numberOrBlank(service.maxGroupSize),
    priceRange: service.priceRange || '',
    city: service.city ? canonicalCity(service.city) : '',
    availability_ar: service.availability_ar || '',
    availability_en: service.availability_en || '',
    contactPhone: service.contactPhone || '',
    contactEmail: service.contactEmail || '',
    languages: (service.languages || []).join('، '),
  }
}

/**
 * Edit a service as support, through admin.mutations.adminUpdateService.
 *
 * The server checks it with the same validateServiceInput a provider's edit
 * goes through, but — unlike the provider's own edit — leaves its status
 * alone: fixing a typo on a live service must not take it off the app until
 * someone re-approves it. The form says so.
 *
 * Only what changed is sent. That keeps the log's "edited" honest, and it is
 * what lets a cleared price or group size mean "remove it" (null), where
 * sending every field would also rewrite the ones nobody touched.
 */
export default function ServiceForm({ service, onClose }) {
  const updateService = useMutation(api.admin.mutations.adminUpdateService)
  const toast = useToast()
  const [form, setForm] = useState(() => toForm(service))
  const [images, setImages] = useState(service.images || [])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  const buildChanges = () => {
    const original = toForm(service)
    const changes = {}

    if (form.serviceType !== original.serviceType) changes.serviceType = form.serviceType
    for (const key of ['title_ar', 'title_en', 'description_ar', 'description_en']) {
      // An emptied description is sent as "", which the server takes as
      // "remove it"; a title cannot be emptied (checked below).
      if (form[key].trim() !== original[key].trim()) changes[key] = form[key].trim()
    }
    for (const key of ['priceRange', 'availability_ar', 'availability_en', 'contactPhone', 'contactEmail']) {
      // Stored as sent — the same "" for an emptied field the app's own edit
      // sends (post-service.tsx).
      if (form[key].trim() !== original[key].trim()) changes[key] = form[key].trim()
    }
    if (form.priceUnit && form.priceUnit !== original.priceUnit) changes.priceUnit = form.priceUnit
    // null clears the price or the group size; the server has no other way
    // to hear "remove it".
    for (const key of ['price', 'maxGroupSize']) {
      if (form[key].trim() !== original[key]) {
        changes[key] = form[key].trim() === '' ? null : Number(form[key])
      }
    }
    // A city can be changed but not removed: the server checks any city it
    // is sent against the thirteen, and "" is not one of them.
    if (form.city && form.city !== original.city) changes.city = form.city
    const languages = splitList(form.languages)
    if (languages.join('|') !== splitList(original.languages).join('|')) changes.languages = languages
    if (JSON.stringify(images) !== JSON.stringify(service.images || [])) changes.images = images

    return changes
  }

  const validate = (changes) => {
    if (!form.title_ar.trim() || !form.title_en.trim()) return 'أدخل عنوان الخدمة بالعربية والإنجليزية.'
    if (form.title_ar.trim().length > MAX_TITLE || form.title_en.trim().length > MAX_TITLE) {
      return `العنوان طويل جدًا (${MAX_TITLE} حرف كحد أقصى).`
    }
    if (form.description_ar.trim().length > MAX_DESCRIPTION || form.description_en.trim().length > MAX_DESCRIPTION) {
      return `الوصف طويل جدًا (${MAX_DESCRIPTION} حرف كحد أقصى).`
    }
    if (typeof changes.price === 'number') {
      if (!Number.isFinite(changes.price) || changes.price < 1 || changes.price > MAX_PRICE) {
        return `أدخل سعرًا صحيحًا بين 1 و ${MAX_PRICE} ريال.`
      }
      if (!Number.isInteger(changes.price)) return 'السعر يجب أن يكون رقمًا صحيحًا.'
    }
    if (typeof changes.maxGroupSize === 'number') {
      if (!Number.isInteger(changes.maxGroupSize) || changes.maxGroupSize < 1 || changes.maxGroupSize > MAX_GROUP) {
        return `الحد الأقصى للأشخاص بين 1 و ${MAX_GROUP}.`
      }
    }
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (saving) return

    const changes = buildChanges()
    const problem = validate(changes)
    if (problem) {
      setError(problem)
      return
    }
    if (Object.keys(changes).length === 0) {
      toast.info('لم يتغيّر شيء')
      onClose()
      return
    }

    setError('')
    setSaving(true)
    try {
      await updateService({ serviceId: service._id, ...changes })
      toast.success('تم حفظ تعديلات الخدمة')
      onClose()
    } catch (err) {
      // Kept open and filled in, so nothing typed is lost.
      toast.error(err)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="تعديل خدمة"
      subtitle={service.title_ar || service.title_en}
      onClose={onClose}
      width="760px"
    >
      <form onSubmit={handleSubmit}>
        <div className="admin-modal-body">
          <div className="admin-info-box">
            <p>
              تعديلات الإدارة تُحفظ مباشرة ولا تغيّر حالة الخدمة: الخدمة المنشورة تبقى منشورة ولا تعود
              للمراجعة.
            </p>
          </div>

          {error && <div className="admin-error">{error}</div>}

          <div className="admin-form" style={{ gap: '1rem' }}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">نوع الخدمة *</label>
                <FilterSelect
                  value={form.serviceType}
                  onChange={(v) => set({ serviceType: v })}
                  placeholder="نوع الخدمة"
                  className="w-full"
                  options={SERVICE_TYPE_OPTIONS}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">المدينة</label>
                <FilterSelect
                  value={form.city}
                  onChange={(v) => set({ city: v })}
                  placeholder="غير محددة"
                  className="w-full"
                  options={service.city ? CITY_OPTIONS : [{ value: '', label: 'غير محددة' }, ...CITY_OPTIONS]}
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">العنوان (بالعربية) *</label>
                <input
                  className="admin-form-input"
                  value={form.title_ar}
                  maxLength={MAX_TITLE}
                  onChange={(e) => set({ title_ar: e.target.value })}
                  required
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">العنوان (بالإنجليزية) *</label>
                <input
                  className="admin-form-input"
                  dir="ltr"
                  value={form.title_en}
                  maxLength={MAX_TITLE}
                  onChange={(e) => set({ title_en: e.target.value })}
                  required
                />
              </div>
            </div>

            <ImageUploader
              images={images}
              onChange={setImages}
              max={MAX_IMAGES}
              emptyHint="لا توجد صور. الخدمة بدون صور تظهر بغلاف فارغ في التطبيق."
            />

            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">السعر (ر.س)</label>
                <input
                  className="admin-form-input"
                  type="number"
                  min="1"
                  max={MAX_PRICE}
                  step="1"
                  dir="ltr"
                  value={form.price}
                  onChange={(e) => set({ price: e.target.value })}
                  placeholder="150"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">وحدة السعر</label>
                <FilterSelect
                  value={form.priceUnit}
                  onChange={(v) => set({ priceUnit: v })}
                  placeholder="غير محددة"
                  className="w-full"
                  options={service.priceUnit ? PRICE_UNITS : [{ value: '', label: 'غير محددة' }, ...PRICE_UNITS]}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">الحد الأقصى للأشخاص</label>
                <input
                  className="admin-form-input"
                  type="number"
                  min="1"
                  max={MAX_GROUP}
                  step="1"
                  dir="ltr"
                  value={form.maxGroupSize}
                  onChange={(e) => set({ maxGroupSize: e.target.value })}
                  placeholder="20"
                />
              </div>
            </div>
            <p className="admin-form-hint">
              بدون سعر رقمي تظهر الخدمة بزر «تواصل» بدل «احجز». الحد الأقصى للأشخاص الافتراضي 20.
              لإزالة السعر أو الحد امسح الحقل واحفظ.
            </p>

            <div className="admin-form-group">
              <label className="admin-form-label">نطاق السعر (نص قديم يظهر للمسافر)</label>
              <input
                className="admin-form-input"
                value={form.priceRange}
                onChange={(e) => set({ priceRange: e.target.value })}
                placeholder="مثال: 100–200 ريال"
              />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">الوصف (بالعربية)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={4}
                  maxLength={MAX_DESCRIPTION}
                  value={form.description_ar}
                  onChange={(e) => set({ description_ar: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">الوصف (بالإنجليزية)</label>
                <textarea
                  className="admin-form-textarea"
                  rows={4}
                  dir="ltr"
                  maxLength={MAX_DESCRIPTION}
                  value={form.description_en}
                  onChange={(e) => set({ description_en: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">أوقات التوفر (بالعربية)</label>
                <input
                  className="admin-form-input"
                  value={form.availability_ar}
                  onChange={(e) => set({ availability_ar: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">أوقات التوفر (بالإنجليزية)</label>
                <input
                  className="admin-form-input"
                  dir="ltr"
                  value={form.availability_en}
                  onChange={(e) => set({ availability_en: e.target.value })}
                />
              </div>
            </div>

            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">هاتف التواصل</label>
                <input
                  className="admin-form-input"
                  type="tel"
                  dir="ltr"
                  value={form.contactPhone}
                  onChange={(e) => set({ contactPhone: e.target.value })}
                  placeholder="+966 5X XXX XXXX"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">بريد التواصل</label>
                <input
                  className="admin-form-input"
                  type="email"
                  dir="ltr"
                  value={form.contactEmail}
                  onChange={(e) => set({ contactEmail: e.target.value })}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">اللغات (مفصولة بفواصل)</label>
                <input
                  className="admin-form-input"
                  value={form.languages}
                  onChange={(e) => set({ languages: e.target.value })}
                  placeholder="العربية، English"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">
            إلغاء
          </button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
