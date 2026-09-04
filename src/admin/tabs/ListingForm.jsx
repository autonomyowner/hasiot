import { useMemo, useState } from 'react'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import FilterSelect from '../components/FilterSelect'
import {
  AMENITIES, CATEGORIES, CATEGORIES_BY_TYPE, CATEGORY_LABELS,
  CITIES, CITY_LABELS, LISTING_TYPES, PRICE_RANGES,
} from '../constants'

// Al-Ahsa oasis, so a new listing starts on the map where the app is centred
// rather than at 0,0 in the Gulf of Guinea.
const DEFAULT_COORDS = { lat: 25.3854, lng: 49.5683 }

/** Empty string means "not set", which is different from zero. */
function numberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

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
    // Booking fields. Only meaningful on a hotel, and only a nightly price
    // makes the place bookable at all.
    pricePerNight: initialData?.pricePerNight ?? '',
    maxGuests: initialData?.maxGuests ?? '',
    unitCount: initialData?.unitCount ?? '',
    checkInTime: initialData?.checkInTime || '15:00',
    checkOutTime: initialData?.checkOutTime || '12:00',
    isVerified: initialData?.isVerified || false,
    isActive: initialData?.isActive !== false,
  })
  const [images, setImages] = useState(initialData?.images || [])
  // Canonical keys. A listing saved before this field existed carries free
  // text, which no toggle matches — it is kept as it is rather than dropped,
  // and shows up on the row below the grid.
  const [amenities, setAmenities] = useState(initialData?.amenities || [])
  const toggleAmenity = (key) =>
    setAmenities((current) =>
      current.includes(key) ? current.filter((a) => a !== key) : [...current, key]
    )
  const customAmenities = amenities.filter(
    (a) => !AMENITIES.some((known) => known.key === a)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }))

  // Only stays take bookings, so the pricing block is hidden for everything
  // else rather than offering a hotel's fields to a restaurant.
  const isHotel = form.type === 'hotel'

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

    // Catch these here rather than letting the server reject after the form
    // has been filled in — the same rules as convex/listings/pricing.ts.
    const price = numberOrUndefined(form.pricePerNight)
    if (price !== undefined && (!Number.isInteger(price) || price <= 0 || price > 100000)) {
      setError('سعر الليلة يجب أن يكون رقمًا صحيحًا بين 1 و 100000 ريال.')
      return
    }
    const guests = numberOrUndefined(form.maxGuests)
    if (guests !== undefined && (!Number.isInteger(guests) || guests < 1 || guests > 20)) {
      setError('الحد الأقصى للضيوف يجب أن يكون بين 1 و 20.')
      return
    }
    const units = numberOrUndefined(form.unitCount)
    if (units !== undefined && (!Number.isInteger(units) || units < 1 || units > 500)) {
      setError('عدد الوحدات يجب أن يكون بين 1 و 500.')
      return
    }
    const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/
    if (isHotel && (!hhmm.test(form.checkInTime) || !hhmm.test(form.checkOutTime))) {
      setError('أوقات الوصول والمغادرة يجب أن تكون بصيغة HH:MM.')
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
        // Blank means "leave it unset", which is why these are undefined
        // rather than 0 — a listing with no nightly price is not bookable,
        // and 0 would be a free room.
        pricePerNight: numberOrUndefined(form.pricePerNight),
        currency: numberOrUndefined(form.pricePerNight) === undefined ? undefined : 'SAR',
        maxGuests: numberOrUndefined(form.maxGuests),
        unitCount: numberOrUndefined(form.unitCount),
        checkInTime: isHotel ? form.checkInTime || undefined : undefined,
        checkOutTime: isHotel ? form.checkOutTime || undefined : undefined,
        images,
        amenities,
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
                <FilterSelect
                  value={form.type}
                  onChange={handleTypeChange}
                  placeholder="النوع"
                  className="w-full"
                  options={LISTING_TYPES}
                />
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">الفئة *</label>
                <FilterSelect
                  value={form.category}
                  onChange={(v) => set({ category: v, category_ar: CATEGORY_LABELS[v] || '' })}
                  placeholder="الفئة"
                  className="w-full"
                  options={categoryOptions}
                />
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
                <FilterSelect
                  value={form.city}
                  onChange={(v) => set({ city: v })}
                  placeholder="المدينة"
                  className="w-full"
                  options={CITIES.map((c) => ({ value: c, label: CITY_LABELS[c] || c }))}
                />
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
                <FilterSelect
                  value={form.priceRange}
                  onChange={(v) => set({ priceRange: v })}
                  placeholder="غير محدد"
                  className="w-full"
                  options={[{ value: '', label: 'غير محدد' }, ...PRICE_RANGES]}
                />
              </div>
            </div>

            {/* Booking & pricing — stays only. Leaving the nightly price blank
                keeps the listing in the directory without a Book button. */}
            {isHotel && (
              <>
                <div className="admin-form-row-3">
                  <div className="admin-form-group">
                    <label className="admin-form-label">سعر الليلة (ر.س)</label>
                    <input
                      className="admin-form-input"
                      type="number"
                      min="0"
                      step="1"
                      dir="ltr"
                      value={form.pricePerNight}
                      onChange={(e) => set({ pricePerNight: e.target.value })}
                      placeholder="450"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">الحد الأقصى للضيوف</label>
                    <input
                      className="admin-form-input"
                      type="number"
                      min="1"
                      max="20"
                      step="1"
                      dir="ltr"
                      value={form.maxGuests}
                      onChange={(e) => set({ maxGuests: e.target.value })}
                      placeholder="4"
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">عدد الوحدات</label>
                    <input
                      className="admin-form-input"
                      type="number"
                      min="1"
                      max="500"
                      step="1"
                      dir="ltr"
                      value={form.unitCount}
                      onChange={(e) => set({ unitCount: e.target.value })}
                      placeholder="10"
                    />
                  </div>
                </div>

                <div className="admin-form-row">
                  <div className="admin-form-group">
                    <label className="admin-form-label">وقت تسجيل الوصول</label>
                    <input
                      className="admin-form-input"
                      type="time"
                      dir="ltr"
                      value={form.checkInTime}
                      onChange={(e) => set({ checkInTime: e.target.value })}
                    />
                  </div>
                  <div className="admin-form-group">
                    <label className="admin-form-label">وقت تسجيل المغادرة</label>
                    <input
                      className="admin-form-input"
                      type="time"
                      dir="ltr"
                      value={form.checkOutTime}
                      onChange={(e) => set({ checkOutTime: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="admin-form-group">
              <label className="admin-form-label">المرافق</label>
              <div className="admin-amenity-grid">
                {AMENITIES.map((amenity) => (
                  <button
                    key={amenity.key}
                    type="button"
                    className={`admin-amenity${amenities.includes(amenity.key) ? ' active' : ''}`}
                    aria-pressed={amenities.includes(amenity.key)}
                    onClick={() => toggleAmenity(amenity.key)}
                  >
                    {amenity.label}
                  </button>
                ))}
              </div>
              {customAmenities.length > 0 && (
                <p className="admin-form-hint">
                  مرافق مكتوبة يدوياً على هذا المكان، تُعرض كما هي:{' '}
                  {customAmenities.join('، ')}
                </p>
              )}
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
