import { useMemo, useState } from 'react'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import {
  CATEGORIES, CATEGORIES_BY_TYPE, CATEGORY_LABELS,
  CITIES, CITY_LABELS, LISTING_TYPES, PRICE_RANGES,
} from '../constants'

// Al-Ahsa oasis, so a new listing starts on the map where the app is centred
// rather than at 0,0 in the Gulf of Guinea.
const DEFAULT_COORDS = { lat: 25.3854, lng: 49.5683 }

export default function ListingForm({ initialData, onSubmit, onClose }) {
  const [form, setForm] = useState({
    type: initialData?.type || 'hotel',
    category: initialData?.category || 'luxury_hotel',
    category_ar: initialData?.category_ar || '',
    name_en: initialData?.name_en || '',
    name_ar: initialData?.name_ar || '',
    description_en: initialData?.description_en || '',
    description_ar: initialData?.description_ar || '',
    address: initialData?.address || '',
    city: initialData?.city || 'Hofuf',
    region: initialData?.region || 'Eastern Province',
    lat: initialData?.coordinates?.lat ?? DEFAULT_COORDS.lat,
    lng: initialData?.coordinates?.lng ?? DEFAULT_COORDS.lng,
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    website: initialData?.website || '',
    priceRange: initialData?.priceRange || '',
    isVerified: initialData?.isVerified || false,
    isActive: initialData?.isActive !== false,
  })
  const [images, setImages] = useState(initialData?.images || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // Only offer categories that belong to the chosen type, but never hide the
  // category a listing already has — seed data predates this grouping.
  const categoryOptions = useMemo(() => {
    const allowed = CATEGORIES_BY_TYPE[form.type] || []
    const values = new Set(allowed)
    if (form.category) values.add(form.category)
    return CATEGORIES.filter((c) => values.has(c.value))
  }, [form.type, form.category])

  const handleTypeChange = (type) => {
    const allowed = CATEGORIES_BY_TYPE[type] || []
    // Switching hotel → event must not leave "فندق فاخر" selected.
    const category = allowed.includes(form.category) ? form.category : allowed[0] || form.category
    set({ type, category, category_ar: CATEGORY_LABELS[category] || '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return

    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('الإحداثيات غير صحيحة.')
      return
    }
    // Al-Ahsa sits well inside this box. Catching a swapped lat/lng here saves a
    // pin dropped in the sea and a support message from a confused owner.
    if (lat < 24 || lat > 27 || lng < 48 || lng > 51) {
      setError('الإحداثيات خارج نطاق الأحساء. تحقق من خط العرض وخط الطول.')
      return
    }

    setError('')
    setSaving(true)
    try {
      await onSubmit({
        type: form.type,
        category: form.category,
        category_ar: form.category_ar || CATEGORY_LABELS[form.category] || undefined,
        name_en: form.name_en.trim(),
        name_ar: form.name_ar.trim(),
        description_en: form.description_en.trim() || undefined,
        description_ar: form.description_ar.trim() || undefined,
        address: form.address.trim(),
        city: form.city,
        region: form.region.trim() || undefined,
        coordinates: { lat, lng },
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        priceRange: form.priceRange || undefined,
        images,
        isVerified: form.isVerified,
        isActive: form.isActive,
      })
    } catch (err) {
      // The tab reports the failure through a toast; keep the form open and
      // populated so nothing typed is lost.
      setSaving(false)
      throw err
    }
  }

  return (
    <Modal
      title={initialData ? 'تعديل مكان' : 'إضافة مكان جديد'}
      subtitle={initialData ? (initialData.name_ar || initialData.name_en) : undefined}
      onClose={onClose}
      width="760px"
    >
      <form onSubmit={handleSubmit}>
        <div className="admin-modal-body">
          {error && <div className="admin-error">{error}</div>}

          <div className="admin-form" style={{ gap: '1rem' }}>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">النوع *</label>
                <select
                  value={form.type}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="admin-form-select"
                >
                  {LISTING_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">الفئة *</label>
                <select
                  value={form.category}
                  onChange={(e) => set({
                    category: e.target.value,
                    category_ar: CATEGORY_LABELS[e.target.value] || '',
                  })}
                  className="admin-form-select"
                >
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">الاسم (بالعربية) *</label>
                <input
                  type="text"
                  value={form.name_ar}
                  onChange={(e) => set({ name_ar: e.target.value })}
                  className="admin-form-input"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">الاسم (بالإنجليزية) *</label>
                <input
                  type="text"
                  value={form.name_en}
                  onChange={(e) => set({ name_en: e.target.value })}
                  className="admin-form-input"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <ImageUploader images={images} onChange={setImages} />

            <div className="admin-form-group">
              <label className="admin-form-label">العنوان *</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => set({ address: e.target.value })}
                className="admin-form-input"
                required
              />
            </div>

            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">المدينة *</label>
                <select
                  value={form.city}
                  onChange={(e) => set({ city: e.target.value })}
                  className="admin-form-select"
                >
                  {CITIES.map((c) => (
                    <option key={c} value={c}>{CITY_LABELS[c] || c}</option>
                  ))}
                </select>
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">خط العرض *</label>
                <input
                  type="number"
                  step="any"
                  value={form.lat}
                  onChange={(e) => set({ lat: e.target.value })}
                  className="admin-form-input"
                  dir="ltr"
                  required
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">خط الطول *</label>
                <input
                  type="number"
                  step="any"
                  value={form.lng}
                  onChange={(e) => set({ lng: e.target.value })}
                  className="admin-form-input"
                  dir="ltr"
                  required
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">المنطقة</label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => set({ region: e.target.value })}
                  className="admin-form-input"
                  placeholder="المنطقة الشرقية"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">نطاق السعر</label>
                <select
                  value={form.priceRange}
                  onChange={(e) => set({ priceRange: e.target.value })}
                  className="admin-form-select"
                >
                  <option value="">غير محدد</option>
                  {PRICE_RANGES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-row-3">
              <div className="admin-form-group">
                <label className="admin-form-label">الهاتف</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set({ phone: e.target.value })}
                  className="admin-form-input"
                  dir="ltr"
                  placeholder="+966 5X XXX XXXX"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">البريد الإلكتروني</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  className="admin-form-input"
                  dir="ltr"
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">الموقع الإلكتروني</label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => set({ website: e.target.value })}
                  className="admin-form-input"
                  dir="ltr"
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label className="admin-form-label">الوصف (بالعربية)</label>
                <textarea
                  value={form.description_ar}
                  onChange={(e) => set({ description_ar: e.target.value })}
                  className="admin-form-textarea"
                  rows={3}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">الوصف (بالإنجليزية)</label>
                <textarea
                  value={form.description_en}
                  onChange={(e) => set({ description_en: e.target.value })}
                  className="admin-form-textarea"
                  rows={3}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="admin-checkbox-group">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => set({ isActive: e.target.checked })}
                />
                <span>نشط (ظاهر في التطبيق)</span>
              </label>
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isVerified}
                  onChange={(e) => set({ isVerified: e.target.checked })}
                />
                <span>موثق</span>
              </label>
            </div>
          </div>
        </div>

        <div className="admin-modal-footer">
          <button type="button" onClick={onClose} className="admin-btn admin-btn-secondary">
            إلغاء
          </button>
          <button type="submit" className="admin-btn admin-btn-primary" disabled={saving}>
            {saving ? 'جاري الحفظ...' : initialData ? 'حفظ التعديلات' : 'إنشاء'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
