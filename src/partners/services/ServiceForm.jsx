import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useQuerySafe } from '../../admin/useQuerySafe'
import { toastApi } from '../../admin/components/toast-context'
import ImageUploader from '../../admin/components/ImageUploader'
import { CITIES } from '../../admin/constants.js'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { usePartnerConfirm } from '../confirm'
import { errorText } from '../lib/errors'
import { ErrorState, PageSpinner, Spinner } from '../components/Ui'
import {
  EMPTY_SERVICE_FORM,
  MAX_DESCRIPTION,
  MAX_TITLE,
  SERVICE_PRICE_UNITS,
  SERVICE_TYPE_KEYS,
  editedServiceArgs,
  firstError,
  isLive,
  newServiceArgs,
  ownerStatusOf,
  sameValues,
  serviceFormFromService,
  validateServiceForm,
} from './servicePayload'
import { PRICE_UNIT_LABELS, SERVICE_TYPE_LABELS, cityName } from './labels'

const translations = {
  en: {
    newTitle: 'Add a service',
    editTitle: 'Edit service',
    newSubtitle: 'Our team reviews every new service before travellers can see it.',
    editNotice: 'Saving sends this back for review before it goes live again.',
    suspendedNotice: "Our team took this service down. You can still save changes, but it stays hidden until it's reinstated.",
    type: 'Type of service',
    titleEn: 'Name (English)',
    titleAr: 'Name (Arabic)',
    city: 'City',
    chooseCity: 'Choose a city',
    descEn: 'Description (English)',
    descAr: 'Description (Arabic)',
    price: 'Price (SAR)',
    priceHint: 'Whole riyals. Leave empty and the app shows "Contact" instead of "Book".',
    unit: 'Priced',
    group: 'Largest group',
    groupHint: 'Optional, up to 100 people.',
    availEn: 'Availability (English)',
    availAr: 'Availability (Arabic)',
    availPlaceholder: 'For example: weekends, 4–10 pm',
    phone: 'Contact phone',
    email: 'Contact email',
    languages: 'Languages spoken',
    languagesHint: 'Separate with commas, e.g. Arabic, English',
    optional: 'optional',
    save: 'Save changes',
    submit: 'Submit for review',
    cancel: 'Cancel',
    saving: 'Saving…',
    nothingChanged: 'Nothing has changed yet.',
    leaveTitle: 'Discard your changes?',
    leaveBody: 'What you typed on this page will be lost.',
    leave: 'Discard',
    liveTitle: 'Send this service back for review?',
    liveBody: "Until our team approves the changes, travellers won't see this service.",
    liveConfirm: 'Submit for review',
    submitted: 'Your service has been submitted for review.',
    updated: 'Saved. Your service is back in review.',
    savedSuspended: 'Your changes were saved.',
    missingTitle: 'This service was not found',
    missingHint: 'It may have been deleted. Go back to your services.',
    back: 'Back to my services',
    errorTitle: 'The service could not be loaded',
    retry: 'Try again',
    fixErrors: 'Check the highlighted fields.',
    errors: {
      title: 'Enter the name in English.',
      titleAr: 'Enter the name in Arabic.',
      city: 'Choose the city you work in.',
      description: 'Describe the service in English.',
      descriptionAr: 'Describe the service in Arabic.',
      price: 'Enter a whole price between 1 and 100,000 SAR.',
      maxGroupSize: 'Enter a whole number between 1 and 100.',
      contactPhone: 'That phone number does not look right.',
      contactEmail: 'That email address does not look right.',
    },
    photos: {
      title: 'Photos',
      hint: (count, max) => ` — the first is the cover in the app (${count}/${max})`,
      tooMany: (remaining, max) => `You can add ${remaining} more. The limit is ${max} photos.`,
      notImage: (name) => `"${name}" is not an image.`,
      tooBig: (name) => `"${name}" is larger than 5 MB.`,
      uploadFailed: (name, status) => `"${name}" failed to upload (${status}).`,
      noUrl: (name) => `Could not get a link for "${name}".`,
      uploaded: (n) => (n === 1 ? 'Photo uploaded.' : `${n} photos uploaded.`),
      photo: (i) => `Photo ${i}`,
      cover: 'Cover',
      earlier: 'Move earlier',
      earlierLabel: (i) => `Move photo ${i} earlier`,
      later: 'Move later',
      laterLabel: (i) => `Move photo ${i} later`,
      remove: 'Remove',
      removeLabel: (i) => `Remove photo ${i}`,
      uploading: (current, total) => `Uploading ${current} of ${total}…`,
      add: 'Add photos',
      full: 'Photo limit reached',
      formats: 'JPG, PNG or WebP, up to 5 MB each',
    },
    photosEmpty: 'No photos yet. Services with photos get more requests.',
  },
  ar: {
    newTitle: 'إضافة خدمة',
    editTitle: 'تعديل الخدمة',
    newSubtitle: 'يراجع فريقنا كل خدمة جديدة قبل أن يراها المسافرون.',
    editNotice: 'الحفظ يعيد الخدمة إلى المراجعة قبل نشرها من جديد.',
    suspendedNotice: 'أوقف فريقنا هذه الخدمة. يمكنك حفظ التعديلات، لكنها تبقى مخفية حتى يُعاد تفعيلها.',
    type: 'نوع الخدمة',
    titleEn: 'الاسم (بالإنجليزية)',
    titleAr: 'الاسم (بالعربية)',
    city: 'المدينة',
    chooseCity: 'اختر مدينة',
    descEn: 'الوصف (بالإنجليزية)',
    descAr: 'الوصف (بالعربية)',
    price: 'السعر (ر.س)',
    priceHint: 'بالريال دون كسور. اتركه فارغًا ليظهر في التطبيق زر «تواصل» بدل «احجز».',
    unit: 'التسعير',
    group: 'أكبر عدد للمجموعة',
    groupHint: 'اختياري، حتى 100 شخص.',
    availEn: 'التوفر (بالإنجليزية)',
    availAr: 'التوفر (بالعربية)',
    availPlaceholder: 'مثال: نهاية الأسبوع، من 4 إلى 10 مساءً',
    phone: 'هاتف التواصل',
    email: 'بريد التواصل',
    languages: 'اللغات',
    languagesHint: 'افصل بينها بفاصلة، مثل: العربية، الإنجليزية',
    optional: 'اختياري',
    save: 'حفظ التعديلات',
    submit: 'إرسال للمراجعة',
    cancel: 'إلغاء',
    saving: 'جارٍ الحفظ…',
    nothingChanged: 'لم تغيّر شيئًا بعد.',
    leaveTitle: 'تجاهل التعديلات؟',
    leaveBody: 'سيضيع ما كتبته في هذه الصفحة.',
    leave: 'تجاهل',
    liveTitle: 'إعادة الخدمة إلى المراجعة؟',
    liveBody: 'لن تظهر هذه الخدمة للمسافرين حتى يوافق فريقنا على التعديلات.',
    liveConfirm: 'إرسال للمراجعة',
    submitted: 'تم إرسال خدمتك للمراجعة.',
    updated: 'تم الحفظ. خدمتك الآن قيد المراجعة.',
    savedSuspended: 'تم حفظ تعديلاتك.',
    missingTitle: 'لم نجد هذه الخدمة',
    missingHint: 'ربما حُذفت. ارجع إلى خدماتك.',
    back: 'العودة إلى خدماتي',
    errorTitle: 'تعذّر تحميل الخدمة',
    retry: 'حاول مرة أخرى',
    fixErrors: 'راجع الحقول المحددة.',
    errors: {
      title: 'اكتب الاسم بالإنجليزية.',
      titleAr: 'اكتب الاسم بالعربية.',
      city: 'اختر المدينة التي تعمل فيها.',
      description: 'صف الخدمة بالإنجليزية.',
      descriptionAr: 'صف الخدمة بالعربية.',
      price: 'أدخل سعرًا صحيحًا بين 1 و100,000 ر.س.',
      maxGroupSize: 'أدخل عددًا صحيحًا بين 1 و100.',
      contactPhone: 'رقم الهاتف غير صحيح.',
      contactEmail: 'البريد الإلكتروني غير صحيح.',
    },
    photosEmpty: 'لا توجد صور بعد. الخدمات التي لها صور تتلقى طلبات أكثر.',
  },
}

/**
 * Post or edit a service — the app's provider/post-service.tsx on the web.
 * Photos upload as they are picked (the admin uploader), so what is saved is
 * already a list of URLs. Any edit sends the service back to review, unless
 * an admin suspended it; a live one asks first.
 */
export default function ServiceForm() {
  const { lang, isRtl } = usePartnerLang()
  const t = pick(translations, lang)
  const confirm = usePartnerConfirm()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)
  const { guard } = usePartnerGate('services')

  const myServices = useQuerySafe(api.services.queries.getMyServices, guard || !isEditing ? 'skip' : {})
  const submitService = useMutation(api.services.mutations.submitService)
  const updateMyService = useMutation(api.services.mutations.updateMyService)

  const [form, setForm] = useState(EMPTY_SERVICE_FORM)
  const [saved, setSaved] = useState(EMPTY_SERVICE_FORM)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [unchangedHint, setUnchangedHint] = useState(false)
  const busyRef = useRef(false)
  const fieldRefs = useRef({})

  const existing = isEditing ? (myServices.data ?? []).find((s) => s._id === id) : undefined

  // Filled once per service, during render, when it lands (as the app does).
  const [prefilledId, setPrefilledId] = useState(null)
  if (existing && prefilledId !== existing._id) {
    const values = serviceFormFromService(existing)
    setPrefilledId(existing._id)
    setForm(values)
    setSaved(values)
  }

  const dirty = !sameValues(form, saved)
  const guardLeave = dirty && !submitted

  // Closing or reloading the tab with unsaved work asks first.
  useEffect(() => {
    if (!guardLeave) return undefined
    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [guardLeave])

  if (guard) return guard

  const editorState = !isEditing
    ? 'ready'
    : myServices.error
      ? 'error'
      : myServices.data === undefined
        ? 'loading'
        : existing
          ? 'ready'
          : 'missing'

  const status = ownerStatusOf(existing?.status)
  const isSuspended = isEditing && status === 'suspended'
  // A rejected service may be resubmitted as it is; otherwise an unchanged
  // save would only send it back to review.
  const unchanged = isEditing && !dirty && status !== 'rejected'

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setUnchangedHint(false)
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const cancel = async () => {
    if (guardLeave) {
      const answer = await confirm({ title: t.leaveTitle, message: t.leaveBody, confirmLabel: t.leave, destructive: true })
      if (!answer) return
    }
    navigate('/partners/services/mine')
  }

  const save = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      if (isEditing) {
        await updateMyService({ serviceId: id, ...editedServiceArgs(form, form.images) })
      } else {
        await submitService(newServiceArgs(form, form.images))
      }
      setSubmitted(true)
      toastApi.success(isSuspended ? t.savedSuspended : isEditing ? t.updated : t.submitted)
      navigate('/partners/services/mine')
    } catch (err) {
      toastApi.error(errorText(err, lang))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    if (busyRef.current) return
    if (unchanged) {
      setUnchangedHint(true)
      return
    }
    const found = validateServiceForm(form)
    setErrors(found)
    const first = firstError(found)
    if (first) {
      const el = fieldRefs.current[first]
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el?.focus({ preventScroll: true })
      return
    }
    if (isEditing && isLive(existing?.status)) {
      const answer = await confirm({ title: t.liveTitle, message: t.liveBody, confirmLabel: t.liveConfirm })
      if (!answer) return
    }
    await save()
  }

  const heading = (
    <div>
      <Link to="/partners/services/mine" className="p-link p-small">{t.back}</Link>
      <h1 className="p-title" style={{ marginTop: 8 }}>{isEditing ? t.editTitle : t.newTitle}</h1>
      {!isEditing && <p className="p-subtitle">{t.newSubtitle}</p>}
    </div>
  )

  if (editorState === 'loading') return <>{heading}<PageSpinner /></>
  if (editorState === 'error') {
    return <>{heading}<ErrorState title={t.errorTitle} retryLabel={t.retry} onRetry={() => window.location.reload()} /></>
  }
  if (editorState === 'missing') {
    return (
      <>
        {heading}
        <ErrorState title={t.missingTitle} hint={t.missingHint} retryLabel={t.back} onRetry={() => navigate('/partners/services/mine')} />
      </>
    )
  }

  const typeLabels = SERVICE_TYPE_LABELS[lang === 'en' ? 'en' : 'ar']
  const unitLabels = PRICE_UNIT_LABELS[lang === 'en' ? 'en' : 'ar']
  const hasErrors = Object.keys(errors).length > 0

  // One text field: label, input, the field's own error under it.
  const field = (key, label, { textarea, max, dir, hint, optional, type = 'text', inputMode, placeholder } = {}) => {
    const Tag = textarea ? 'textarea' : 'input'
    const errorId = `svc-${key}-error`
    return (
      <div className="p-field">
        <label className="p-label" htmlFor={`svc-${key}`}>
          {label}
          {optional && <span className="p-muted p-small"> ({t.optional})</span>}
        </label>
        <Tag
          id={`svc-${key}`}
          ref={(el) => { fieldRefs.current[key] = el }}
          className="p-input"
          type={textarea ? undefined : type}
          rows={textarea ? 4 : undefined}
          maxLength={max}
          dir={dir}
          inputMode={inputMode}
          placeholder={placeholder}
          value={form[key]}
          aria-invalid={errors[key] ? 'true' : undefined}
          aria-describedby={errors[key] ? errorId : undefined}
          onChange={(e) => set(key, e.target.value)}
        />
        {hint && !errors[key] && <span className="p-small p-muted">{hint}</span>}
        {errors[key] && <span id={errorId} className="p-field-error">{t.errors[errors[key]]}</span>}
      </div>
    )
  }

  return (
    <form className="p-stack p-svc-form" onSubmit={onSubmit} noValidate>
      {heading}
      {isEditing && <p className="p-note" style={{ margin: 0 }}>{isSuspended ? t.suspendedNotice : t.editNotice}</p>}

      <fieldset className="p-card p-stack" disabled={busy}>
        <div className="p-field">
          <span className="p-label" id="svc-type-label">{t.type}</span>
          <div className="p-chips" role="radiogroup" aria-labelledby="svc-type-label" style={{ marginBottom: 0 }}>
            {SERVICE_TYPE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={form.serviceType === key}
                className={form.serviceType === key ? 'p-chip is-active' : 'p-chip'}
                onClick={() => set('serviceType', key)}
              >
                {typeLabels[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="p-grid-2">
          {field('title', t.titleEn, { max: MAX_TITLE, dir: 'ltr' })}
          {field('titleAr', t.titleAr, { max: MAX_TITLE, dir: 'rtl' })}
        </div>

        <div className="p-field">
          <label className="p-label" htmlFor="svc-city">{t.city}</label>
          <select
            id="svc-city"
            ref={(el) => { fieldRefs.current.city = el }}
            className="p-input"
            value={form.city}
            aria-invalid={errors.city ? 'true' : undefined}
            onChange={(e) => set('city', e.target.value)}
          >
            <option value="">{t.chooseCity}</option>
            {CITIES.map((city) => (
              <option key={city} value={city}>{cityName(city, lang)}</option>
            ))}
          </select>
          {errors.city && <span className="p-field-error">{t.errors.city}</span>}
        </div>

        {field('description', t.descEn, { textarea: true, max: MAX_DESCRIPTION, dir: 'ltr' })}
        {field('descriptionAr', t.descAr, { textarea: true, max: MAX_DESCRIPTION, dir: 'rtl' })}
      </fieldset>

      <fieldset className="p-card p-stack" disabled={busy}>
        <div className="p-grid-2">
          {field('price', t.price, { inputMode: 'numeric', dir: 'ltr', optional: true, hint: t.priceHint })}
          <div className="p-field">
            <label className="p-label" htmlFor="svc-unit">{t.unit}</label>
            <select id="svc-unit" className="p-input" value={form.priceUnit} onChange={(e) => set('priceUnit', e.target.value)}>
              {SERVICE_PRICE_UNITS.map((unit) => (
                <option key={unit} value={unit}>{unitLabels[unit].label}</option>
              ))}
            </select>
          </div>
        </div>
        {field('maxGroupSize', t.group, { inputMode: 'numeric', dir: 'ltr', optional: true, hint: t.groupHint })}
        <div className="p-grid-2">
          {field('availability', t.availEn, { optional: true, dir: 'ltr', placeholder: translations.en.availPlaceholder })}
          {field('availabilityAr', t.availAr, { optional: true, dir: 'rtl', placeholder: translations.ar.availPlaceholder })}
        </div>
      </fieldset>

      <fieldset className="p-card p-stack" disabled={busy}>
        <div className="p-grid-2">
          {field('contactPhone', t.phone, { type: 'tel', dir: 'ltr', optional: true })}
          {field('contactEmail', t.email, { type: 'email', dir: 'ltr', optional: true })}
        </div>
        {field('languages', t.languages, { optional: true, hint: t.languagesHint })}
      </fieldset>

      <div className="p-card p-svc-photos" dir={isRtl ? 'rtl' : 'ltr'}>
        <ImageUploader
          images={form.images}
          onChange={(images) => set('images', images)}
          max={8}
          emptyHint={t.photosEmpty}
          labels={lang === 'en' ? translations.en.photos : undefined}
          onError={(err) => toastApi.error(errorText(err, lang))}
        />
      </div>

      {hasErrors && <p className="p-field-error" role="alert" style={{ margin: 0 }}>{t.fixErrors}</p>}
      {unchangedHint && <p className="p-muted" role="status" style={{ margin: 0 }}>{t.nothingChanged}</p>}

      <div className="p-row p-svc-footer">
        <button type="button" className="p-btn p-btn-ghost" onClick={() => void cancel()} disabled={busy}>
          {t.cancel}
        </button>
        <button type="submit" className="p-btn p-btn-primary" disabled={busy}>
          {busy && <Spinner />}
          {busy ? t.saving : isEditing && status !== 'rejected' ? t.save : t.submit}
        </button>
      </div>
    </form>
  )
}
