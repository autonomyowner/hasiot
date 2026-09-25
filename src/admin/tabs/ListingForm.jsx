import { useMemo, useState } from 'react'
import Modal from '../components/Modal'
import ImageUploader from '../components/ImageUploader'
import FilterSelect from '../components/FilterSelect'
import {
  AMENITIES, CATEGORIES, CATEGORIES_BY_TYPE, CATEGORY_LABELS,
  CITY_LABELS, CITY_OPTIONS, LISTING_TYPES, PIN_WARNING_KM, PRICE_RANGES,
  SAUDI_BOUNDS, canonicalCity, cityCentre, defaultPin, distanceKm, insideSaudiArabia,
} from '../constants'

const DEFAULT_CITY = 'Al Ahsa'

/** Empty string means "not set", which is different from zero. */
function numberOrUndefined(value) {
  if (value === '' || value === null || value === undefined) return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : NaN
}

/**
 * How far the pin is from its city's centre, when both are known. Null for a
 * pin that is not a number yet, or a city with no confirmed centre (Al Udayd,
 * Al Bayda).
 */
function pinDistance(form) {
  const lat = parseFloat(form.lat)
  const lng = parseFloat(form.lng)
  const centre = cityCentre(form.city)
  if (!centre || Number.isNaN(lat) || Number.isNaN(lng)) return null
  return distanceKm({ lat, lng }, centre)
}

export default function ListingForm({ initialData, onSubmit, onClose }) {
  const isEdit = Boolean(initialData)
  // Folded to the city above it: listings predating the Eastern Province list
  // carry an Al-Ahsa village, which is no longer one of the options. Saving
  // then writes the canonical name, which is the migration.
  const initialCity = canonicalCity(initialData?.city) || DEFAULT_CITY
  const initialPin = initialData?.coordinates ?? defaultPin(initialCity)

  const [form, setForm] = useState({
    type: initialData?.type || 'hotel',
    category: initialData?.category || 'luxury_hotel',
    category_ar: initialData?.category_ar || '',
    name_en: initialData?.name_en || '',
    name_ar: initialData?.name_ar || '',
    description_en: initialData?.description_en || '',
    description_ar: initialData?.description_ar || '',
    address: initialData?.address || '',
    city: initialCity,
    region: initialData?.region || 'Eastern Province',
    lat: initialPin.lat,
    lng: initialPin.lng,
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

  // A pin still sitting on the old city's centre was never placed by hand, so
  // it follows the city. One the operator typed stays where they put it.
  const handleCityChange = (city) => {
    const previous = defaultPin(form.city)
    const untouched =
      Number(form.lat) === previous.lat && Number(form.lng) === previous.lng
    const next = defaultPin(city)
    set(untouched ? { city, lat: next.lat, lng: next.lng } : { city })
  }

  // A warning, not a block: a resort between two cities, or a desert camp,
  // can legitimately be far from the centre of the city it is listed under.
  const distance = pinDistance(form)
  const farFromCity = distance !== null && distance > PIN_WARNING_KM
  const noCentre = !cityCentre(form.city)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return

    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      setError('الإحداثيات غير صحيحة.')
      return
    }
    // Every city Hasio covers is well inside this box. A point outside it is
    // a typo or a swapped latitude and longitude — a pin dropped in the sea,
    // and a confused owner.
    if (!insideSaudiArabia(lat, lng)) {
      setError(
        `الإحداثيات خارج المملكة العربية السعودية. خط العرض بين ${SAUDI_BOUNDS.minLat} و${SAUDI_BOUNDS.maxLat}، وخط الطول بين ${SAUDI_BOUNDS.minLng} و${SAUDI_BOUNDS.maxLng} — تحقق أنهما غير معكوسين.`
      )
      return
    }

    // Catch these here rather than letting the server reject after the form
    // has been filled in — the same rules as convex/listings/pricing.ts.
    if (isHotel) {
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
      if (!hhmm.test(form.checkInTime) || !hhmm.test(form.checkOutTime)) {
        setError('أوقات الوصول والمغادرة يجب أن تكون بصيغة HH:MM.')
        return
      }
    }

    // A blank field means "not set". An edit says so with null, which the
    // server's updateListing takes as "remove this field"; leaving it out
    // would keep the old value, so a phone number or a nightly rate could never
    // be taken off. A new listing simply leaves the field out.
    const blank = isEdit ? null : undefined
    const text = (value) => value.trim() || blank
    const number = (value) => numberOrUndefined(value) ?? blank

    // Only a hotel carries booking terms. Anything else has them cleared: a
    // hotel changed into a restaurant must not keep a nightly rate it can no
    // longer be booked at.
    const pricing = isHotel
      ? {
          pricePerNight: number(form.pricePerNight),
          maxGuests: number(form.maxGuests),
          unitCount: number(form.unitCount),
          checkInTime: form.checkInTime || blank,
          checkOutTime: form.checkOutTime || blank,
        }
      : {
          pricePerNight: blank,
          maxGuests: blank,
          unitCount: blank,
          checkInTime: blank,
          checkOutTime: blank,
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
        description_en: text(form.description_en),
        description_ar: text(form.description_ar),
        address: form.address.trim(),
        city: form.city,
        region: form.region.trim() || undefined,
        coordinates: { lat, lng },
        phone: text(form.phone),
        email: text(form.email),
        website: text(form.website),
        priceRange: form.priceRange || blank,
        ...pricing,
        // The server attaches SAR to a price and drops it with a cleared one;
        // saying so here keeps the two in step on a create too.
        currency: typeof pricing.pricePerNight === 'number' ? 'SAR' : undefined,
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
                  onChange={handleCityChange}
                  placeholder="المدينة"
                  className="w-full"
                  options={CITY_OPTIONS}
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

            {farFromCity && (
              <p className="admin-form-warning" role="status">
                هذه النقطة تبعد نحو {Math.round(distance)} كم عن مركز {CITY_LABELS[form.city] || form.city}.
                تأكد أن الإحداثيات تخص هذا المكان وأن المدينة صحيحة — يمكنك الحفظ على أي حال.
              </p>
            )}
            {noCentre && (
              <p className="admin-form-hint">
                لا يوجد مركز مؤكد لمدينة {CITY_LABELS[form.city] || form.city}، فلا يمكن التحقق من
                بُعد النقطة عنها. أدخل إحداثيات المكان الفعلية.
              </p>
            )}

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
                keeps the listing in the directory without a Book button;
                emptying it on an edit takes the Book button away. */}
            {isHotel && (
              <>
                <div className="admin-form-row-3">
                  <div className="admin-form-group">
                    <label className="admin-form-label">سعر الليلة (ر.س)</label>
                    <input
                      className="admin-form-input"
                      type="number"
                      min="1"
                      max="100000"
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
                <p className="admin-form-hint">
                  بدون سعر لليلة يظهر الفندق في الدليل دون زر الحجز. لإزالة السعر امسح الحقل واحفظ.
                </p>

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
