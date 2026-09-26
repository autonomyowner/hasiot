import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toastApi } from '../../admin/components/toast-context'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { usePartnerConfirm } from '../confirm'
import { errorText } from '../lib/errors'
import { toLatinDigits } from '../lib/phone'
import { EmptyState, PageSpinner, Spinner } from '../components/Ui'
import PhotoField from './PhotoField'
import { AMENITIES } from './amenities'
import { CITIES } from './cities'
import {
  MAX_PHOTOS,
  PLACE_CATEGORIES,
  STAY_TYPES,
  editPlacePayload,
  emptyForm,
  formFromListing,
  keptCounts,
  newPlacePayload,
  ownerStatusOf,
  sameValues,
  validateForm,
} from './placePayload'

const translations = {
  en: {
    newTitle: 'Add a place',
    editTitle: 'Edit place',
    kind: 'What are you listing?',
    kindStay: 'A place to stay',
    kindStayHint: 'Hotel, apartment, camp or homestay — bookable in the app.',
    kindPlace: 'A place to visit',
    kindPlaceHint: 'A historical, natural, cultural or recreational site.',
    type: 'Type',
    stay: { hotel: 'Hotel', apartment: 'Apartment', camp: 'Camp', homestay: 'Homestay' },
    place: { historical: 'Historical', natural: 'Natural', cultural: 'Cultural', recreational: 'Recreational', religious: 'Religious' },
    keptCategory: 'Current category is kept unless you pick another.',
    name: 'Name (English)',
    nameAr: 'Name (Arabic)',
    city: 'City',
    chooseCity: 'Choose a city',
    neighborhood: 'Neighbourhood',
    neighborhoodHint: 'Optional. Shown as the address.',
    address: 'Address',
    addressHint: 'Optional. The city is used if left empty.',
    phone: 'Phone',
    description: 'Description (English)',
    descriptionAr: 'Description (Arabic)',
    booking: 'Booking',
    bookingHint: 'Without a nightly price the stay is listed but cannot be booked in the app.',
    pricePerNight: 'Price per night (SAR)',
    maxGuests: 'Guests per booking',
    unitCount: 'Rooms or units',
    checkIn: 'Check-in',
    checkOut: 'Check-out',
    priceRange: 'Price range (shown on the card)',
    amenities: 'Amenities',
    kept: 'An emptied value cannot be removed here; the stored one is kept.',
    reviewNote: 'Every change goes back to our team for review before it is live again.',
    save: 'Send for review',
    saving: 'Saving…',
    cancel: 'Cancel',
    unchanged: 'Nothing has changed yet.',
    busyPhotos: 'Wait for the photos to finish uploading.',
    fixErrors: 'Check the highlighted fields.',
    created: 'Sent for review. We will let you know when it is live.',
    updated: 'Changes sent for review.',
    liveTitle: 'Send your changes for review?',
    liveBody: 'This place is live. It leaves the app until our team approves the changes.',
    leaveTitle: 'Leave without saving?',
    leaveBody: 'Your changes will be lost.',
    leave: 'Leave',
    missingTitle: 'Place not found',
    missingHint: 'It may have been deleted.',
    back: 'Back to my places',
    errors: {
      required: 'Required.',
      chooseCity: 'Choose a city.',
      price: 'A whole number from 1 to 100,000.',
      guests: 'A whole number from 1 to 20.',
      units: 'A whole number from 1 to 500.',
      time: 'Use HH:MM, for example 15:00.',
    },
  },
  ar: {
    newTitle: 'أضف مكانًا',
    editTitle: 'تعديل المكان',
    kind: 'ماذا تريد أن تضيف؟',
    kindStay: 'مكان للإقامة',
    kindStayHint: 'فندق أو شقة أو مخيم أو إقامة منزلية — يُحجز من التطبيق.',
    kindPlace: 'مكان للزيارة',
    kindPlaceHint: 'موقع تاريخي أو طبيعي أو ثقافي أو ترفيهي.',
    type: 'النوع',
    stay: { hotel: 'فندق', apartment: 'شقة', camp: 'مخيم', homestay: 'إقامة منزلية' },
    place: { historical: 'تاريخي', natural: 'طبيعي', cultural: 'ثقافي', recreational: 'ترفيهي', religious: 'ديني' },
    keptCategory: 'يبقى التصنيف الحالي ما لم تختر غيره.',
    name: 'الاسم (بالإنجليزية)',
    nameAr: 'الاسم (بالعربية)',
    city: 'المدينة',
    chooseCity: 'اختر مدينة',
    neighborhood: 'الحي',
    neighborhoodHint: 'اختياري. يظهر كعنوان.',
    address: 'العنوان',
    addressHint: 'اختياري. تُستخدم المدينة إن تُرك فارغًا.',
    phone: 'رقم الهاتف',
    description: 'الوصف (بالإنجليزية)',
    descriptionAr: 'الوصف (بالعربية)',
    booking: 'الحجز',
    bookingHint: 'بدون سعر لليلة يظهر المكان لكن لا يمكن حجزه من التطبيق.',
    pricePerNight: 'سعر الليلة (ر.س)',
    maxGuests: 'عدد الضيوف لكل حجز',
    unitCount: 'عدد الغرف أو الوحدات',
    checkIn: 'تسجيل الدخول',
    checkOut: 'تسجيل الخروج',
    priceRange: 'فئة السعر (تظهر على البطاقة)',
    amenities: 'المرافق',
    kept: 'لا يمكن حذف هذه القيمة من هنا؛ ستبقى القيمة المحفوظة.',
    reviewNote: 'كل تعديل يعود إلى فريقنا للمراجعة قبل أن يُنشر مجددًا.',
    save: 'إرسال للمراجعة',
    saving: 'جارٍ الحفظ…',
    cancel: 'إلغاء',
    unchanged: 'لم يتغير شيء بعد.',
    busyPhotos: 'انتظر حتى يكتمل رفع الصور.',
    fixErrors: 'راجع الحقول المظللة.',
    created: 'أُرسل للمراجعة. سنبلغك عند نشره.',
    updated: 'أُرسلت التعديلات للمراجعة.',
    liveTitle: 'إرسال التعديلات للمراجعة؟',
    liveBody: 'هذا المكان منشور، وسيُخفى من التطبيق حتى يعتمد فريقنا التعديلات.',
    leaveTitle: 'المغادرة دون حفظ؟',
    leaveBody: 'ستفقد تعديلاتك.',
    leave: 'مغادرة',
    missingTitle: 'المكان غير موجود',
    missingHint: 'ربما حُذف.',
    back: 'العودة إلى أماكني',
    errors: {
      required: 'مطلوب.',
      chooseCity: 'اختر مدينة.',
      price: 'رقم صحيح من 1 إلى 100,000.',
      guests: 'رقم صحيح من 1 إلى 20.',
      units: 'رقم صحيح من 1 إلى 500.',
      time: 'استخدم الصيغة HH:MM، مثل 15:00.',
    },
  },
}

const PLACES_PATH = '/partners/hotel/places'

/**
 * Add or edit a place, as the app's post-lodging.tsx (a stay) and
 * post-destination.tsx (a place to visit). Everything that decides what is
 * written lives in placePayload.js; this page only collects and words it.
 * The app sends no working hours from either form, so neither does this.
 */
export default function PlaceForm() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { id } = useParams()
  const isEditing = Boolean(id)
  const navigate = useNavigate()
  const confirm = usePartnerConfirm()
  const { guard } = usePartnerGate('hotel')
  const listings = useQuery(api.listings.queries.getMyListings, guard || !isEditing ? 'skip' : {})
  const submitListing = useMutation(api.listings.mutations.submitListing)
  const updateMyListing = useMutation(api.listings.mutations.updateMyListing)

  const existing = isEditing ? (listings ?? []).find((l) => l._id === id) : undefined
  const [form, setForm] = useState(() => emptyForm('stay'))
  const [saved, setSaved] = useState(() => emptyForm('stay'))
  const [loadedId, setLoadedId] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [notice, setNotice] = useState('')
  const busyRef = useRef(false)
  const doneRef = useRef(false)

  // Fill the editor once, when its listing arrives (adjusting state while
  // rendering, so there is no frame of an empty "new" form).
  if (existing && loadedId !== existing._id) {
    const filled = formFromListing(existing)
    setForm(filled)
    setSaved(filled)
    setLoadedId(existing._id)
  }

  const dirty = !sameValues(form, saved)

  // A closed or reloaded tab with unsaved work asks first.
  useEffect(() => {
    if (!dirty) return undefined
    const onBeforeUnload = (e) => {
      if (doneRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  if (guard) return guard
  if (isEditing && listings === undefined) return <PageSpinner />
  if (isEditing && !existing) {
    return (
      <div className="p-card">
        <EmptyState title={t.missingTitle} hint={t.missingHint} icon="building" />
        <div className="p-row h-center">
          <Link className="p-btn p-btn-outline" to={PLACES_PATH}>{t.back}</Link>
        </div>
      </div>
    )
  }

  const isStay = form.kind === 'stay'
  const status = ownerStatusOf(existing?.status)
  const canResubmit = status === 'rejected' || status === 'suspended'
  const kept = keptCounts(form, existing)

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
    setNotice('')
  }
  const setDigits = (key) => (e) => set(key, toLatinDigits(e.target.value))
  const setKind = (kind) => {
    const next = emptyForm(kind)
    setForm((f) => ({ ...next, name: f.name, nameAr: f.nameAr, city: f.city, phone: f.phone, description: f.description, descriptionAr: f.descriptionAr, images: f.images }))
    setErrors({})
  }
  const toggleAmenity = (key) =>
    set('amenities', form.amenities.includes(key) ? form.amenities.filter((a) => a !== key) : [...form.amenities, key])

  const cancel = async () => {
    if (dirty) {
      const ok = await confirm({ title: t.leaveTitle, message: t.leaveBody, destructive: true, confirmLabel: t.leave })
      if (!ok) return
    }
    doneRef.current = true
    navigate(PLACES_PATH)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (busyRef.current) return
    if (uploading) return setNotice(t.busyPhotos)
    if (isEditing && !dirty && !canResubmit) return setNotice(t.unchanged)
    const found = validateForm(form)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      setNotice(t.fixErrors)
      const first = document.querySelector('[aria-invalid="true"]')
      first?.focus?.()
      return
    }
    if (isEditing && status === 'approved') {
      const ok = await confirm({ title: t.liveTitle, message: t.liveBody, confirmLabel: t.save })
      if (!ok) return
    }

    busyRef.current = true
    setSaving(true)
    try {
      if (isEditing) {
        await updateMyListing({ listingId: existing._id, ...editPlacePayload(form, existing) })
        toastApi.success(t.updated)
      } else {
        await submitListing(newPlacePayload(form))
        toastApi.success(t.created)
      }
      doneRef.current = true
      navigate(PLACES_PATH)
    } catch (err) {
      toastApi.error(errorText(err, lang))
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  const err = (key) => (errors[key] ? t.errors[errors[key]] : null)
  const field = (key, label, props = {}) => (
    <label className="p-field">
      <span className="p-label">{label}</span>
      <input
        className="p-input"
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        aria-invalid={errors[key] ? 'true' : undefined}
        {...props}
      />
      {err(key) && <span className="p-field-error">{err(key)}</span>}
    </label>
  )
  const choices = isStay ? STAY_TYPES : PLACE_CATEGORIES
  const labels = isStay ? t.stay : t.place
  const categoryIsKnown = choices.includes(form.category)

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="p-title">{isEditing ? t.editTitle : t.newTitle}</h1>
      <p className="p-subtitle">{t.reviewNote}</p>

      <div className="p-card p-stack h-form">
        {!isEditing && (
          <div className="p-field">
            <span className="p-label">{t.kind}</span>
            <div className="p-grid-2">
              {[['stay', t.kindStay, t.kindStayHint], ['place', t.kindPlace, t.kindPlaceHint]].map(([k, title, hint]) => (
                <button
                  key={k}
                  type="button"
                  className={`p-choice${form.kind === k ? ' is-selected' : ''}`}
                  aria-pressed={form.kind === k}
                  onClick={() => setKind(k)}
                >
                  <span className="p-choice-body">
                    <span className="p-choice-title">{title}</span>
                    <span className="p-choice-hint">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-field">
          <span className="p-label">{t.type}</span>
          <div className="h-chips">
            {choices.map((c) => (
              <button key={c} type="button" className="h-chip" aria-pressed={form.category === c} onClick={() => set('category', c)}>
                {labels[c]}
              </button>
            ))}
          </div>
          {!categoryIsKnown && <span className="p-muted p-small">{t.keptCategory}</span>}
        </div>

        <div className="p-grid-2">
          {field('name', t.name, { dir: 'ltr', maxLength: 120 })}
          {field('nameAr', t.nameAr, { dir: 'rtl', maxLength: 120 })}
        </div>

        <div className="p-grid-2">
          <label className="p-field">
            <span className="p-label">{t.city}</span>
            <select
              className="p-input"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              aria-invalid={errors.city ? 'true' : undefined}
            >
              <option value="">{t.chooseCity}</option>
              {CITIES.map((c) => (
                <option key={c.key} value={c.key}>{lang === 'en' ? c.en : c.ar}</option>
              ))}
              {form.city && !CITIES.some((c) => c.key === form.city) && <option value={form.city}>{form.city}</option>}
            </select>
            {err('city') && <span className="p-field-error">{err('city')}</span>}
          </label>
          {isStay ? (
            <label className="p-field">
              <span className="p-label">{t.neighborhood}</span>
              <input className="p-input" value={form.neighborhood} onChange={(e) => set('neighborhood', e.target.value)} placeholder={t.neighborhoodHint} />
            </label>
          ) : (
            <label className="p-field">
              <span className="p-label">{t.address}</span>
              <input className="p-input" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder={t.addressHint} />
            </label>
          )}
        </div>

        {field('phone', t.phone, { dir: 'ltr', type: 'tel', inputMode: 'tel', onChange: setDigits('phone') })}

        <label className="p-field">
          <span className="p-label">{t.description}</span>
          <textarea className="p-input" rows={4} dir="ltr" value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label className="p-field">
          <span className="p-label">{t.descriptionAr}</span>
          <textarea className="p-input" rows={4} dir="rtl" value={form.descriptionAr} onChange={(e) => set('descriptionAr', e.target.value)} />
        </label>

        <PhotoField images={form.images} onChange={(images) => set('images', images)} max={MAX_PHOTOS} lang={lang} onBusy={setUploading} />
      </div>

      {isStay && (
        <div className="p-card p-stack h-form">
          <div>
            <h2 className="p-h">{t.booking}</h2>
            <p className="p-muted p-small">{t.bookingHint}</p>
          </div>
          <div className="p-grid-2">
            {field('pricePerNight', t.pricePerNight, { dir: 'ltr', inputMode: 'numeric', onChange: setDigits('pricePerNight') })}
            {field('priceRange', t.priceRange, { maxLength: 40 })}
            {field('maxGuests', t.maxGuests, { dir: 'ltr', inputMode: 'numeric', onChange: setDigits('maxGuests') })}
            {field('unitCount', t.unitCount, { dir: 'ltr', inputMode: 'numeric', onChange: setDigits('unitCount') })}
            {field('checkInTime', t.checkIn, { dir: 'ltr', placeholder: '15:00', onChange: setDigits('checkInTime') })}
            {field('checkOutTime', t.checkOut, { dir: 'ltr', placeholder: '12:00', onChange: setDigits('checkOutTime') })}
          </div>
          {kept.length > 0 && <p className="p-note">{t.kept}</p>}

          <div className="p-field">
            <span className="p-label">{t.amenities}</span>
            <div className="h-chips">
              {AMENITIES.map((a) => (
                <button key={a.key} type="button" className="h-chip" aria-pressed={form.amenities.includes(a.key)} onClick={() => toggleAmenity(a.key)}>
                  {lang === 'en' ? a.en : a.ar}
                </button>
              ))}
              {form.amenities
                .filter((a) => !AMENITIES.some((x) => x.key === a))
                .map((a) => (
                  <button key={a} type="button" className="h-chip" aria-pressed="true" onClick={() => toggleAmenity(a)}>
                    {a}
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      <div className="h-form-foot">
        {notice && <p className="p-field-error" role="status">{notice}</p>}
        <div className="p-row">
          <button type="submit" className="p-btn p-btn-primary" disabled={saving}>
            {saving ? <><Spinner /> {t.saving}</> : t.save}
          </button>
          <button type="button" className="p-btn p-btn-ghost" onClick={cancel} disabled={saving}>
            {t.cancel}
          </button>
        </div>
      </div>
    </form>
  )
}
