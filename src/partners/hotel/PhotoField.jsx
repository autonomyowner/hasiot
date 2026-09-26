import { useRef, useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toastApi } from '../../admin/components/toast-context'
import { errorText } from '../lib/errors'
import { Icon, Spinner } from '../components/Ui'

const MAX_FILE_BYTES = 5 * 1024 * 1024

const translations = {
  en: {
    label: 'Photos',
    hint: (n, max) => `The first is the cover (${n}/${max})`,
    add: 'Add photos',
    full: 'Photo limit reached',
    uploading: (i, n) => `Uploading ${i} of ${n}…`,
    formats: 'JPG, PNG or WebP, up to 5 MB each',
    notImage: (name) => `"${name}" is not an image.`,
    tooBig: (name) => `"${name}" is larger than 5 MB.`,
    tooMany: (n) => `Only ${n} more can be added.`,
    failed: 'A photo could not be uploaded. Check your connection and try again.',
    cover: 'Cover',
    earlier: 'Move earlier',
    later: 'Move later',
    remove: 'Remove',
    empty: 'No photos yet. Places with photos are the ones travellers open.',
  },
  ar: {
    label: 'الصور',
    hint: (n, max) => `الأولى هي صورة الغلاف (${n}/${max})`,
    add: 'إضافة صور',
    full: 'اكتمل الحد الأقصى',
    uploading: (i, n) => `جارٍ رفع ${i} من ${n}…`,
    formats: 'JPG أو PNG أو WebP، حتى 5 ميجابايت للصورة',
    notImage: (name) => `"${name}" ليس ملف صورة.`,
    tooBig: (name) => `"${name}" أكبر من 5 ميجابايت.`,
    tooMany: (n) => `يمكن إضافة ${n} فقط.`,
    failed: 'تعذّر رفع صورة. تحقق من اتصالك وحاول مرة أخرى.',
    cover: 'الغلاف',
    earlier: 'تقديم',
    later: 'تأخير',
    remove: 'حذف',
    empty: 'لا توجد صور بعد. الأماكن ذات الصور هي التي يفتحها المسافرون.',
  },
}

/**
 * The place form's photos: the same three-step Convex upload as the app's
 * lib/convexUpload.ts and the admin ImageUploader (generateUploadUrl -> POST
 * -> getStorageUrl), storing URL strings with index 0 as the cover. A
 * bilingual sibling of the admin component rather than a prop on it, because
 * that one is styled by the admin stylesheet, which the portal does not load.
 * Uploads land immediately, so a photo is on the form before the form saves.
 */
export default function PhotoField({ images, onChange, max, lang, onBusy }) {
  const t = lang === 'en' ? translations.en : translations.ar
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const convex = useConvex()
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null)
  const remaining = max - images.length

  const handleFiles = async (event) => {
    const picked = Array.from(event.target.files || [])
    event.target.value = ''
    if (picked.length === 0) return
    if (picked.length > remaining) toastApi.error(t.tooMany(remaining))

    const accepted = []
    for (const file of picked.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) toastApi.error(t.notImage(file.name))
      else if (file.size > MAX_FILE_BYTES) toastApi.error(t.tooBig(file.name))
      else accepted.push(file)
    }
    if (accepted.length === 0) return

    const uploaded = []
    onBusy?.(true)
    try {
      for (let i = 0; i < accepted.length; i++) {
        setProgress({ current: i + 1, total: accepted.length })
        const file = accepted[i]
        const postUrl = await generateUploadUrl()
        const res = await fetch(postUrl, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
        if (!res.ok) throw new Error(`upload ${res.status}`)
        const { storageId } = await res.json()
        const url = await convex.query(api.users.queries.getStorageUrl, { storageId })
        if (!url) throw new Error('no storage url')
        uploaded.push(url)
        // After each file, so a failure on the fourth keeps the first three.
        onChange([...images, ...uploaded])
      }
    } catch (err) {
      if (err?.data) toastApi.error(errorText(err, lang))
      else {
        console.error('[partners] photo upload failed:', err)
        toastApi.error(t.failed)
      }
    } finally {
      setProgress(null)
      onBusy?.(false)
    }
  }

  const move = (from, to) => {
    if (to < 0 || to >= images.length) return
    const next = [...images]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  return (
    <div className="p-field">
      <span className="p-label">
        {t.label} <span className="p-muted p-small">— {t.hint(images.length, max)}</span>
      </span>
      {images.length > 0 ? (
        <div className="h-photos">
          {images.map((url, index) => (
            <div key={url} className="h-photo">
              <img src={url} alt="" loading="lazy" />
              {index === 0 && <span className="h-photo-cover">{t.cover}</span>}
              <div className="h-photo-actions">
                <button type="button" aria-label={t.earlier} title={t.earlier} disabled={index === 0} onClick={() => move(index, index - 1)}>
                  <Icon name="chevron" size={14} className="h-flip" />
                </button>
                <button type="button" aria-label={t.later} title={t.later} disabled={index === images.length - 1} onClick={() => move(index, index + 1)}>
                  <Icon name="chevron" size={14} />
                </button>
                <button type="button" aria-label={t.remove} title={t.remove} onClick={() => onChange(images.filter((_, i) => i !== index))}>
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !progress && <p className="p-muted p-small">{t.empty}</p>
      )}
      <div className="p-row">
        <button
          type="button"
          className="p-btn p-btn-outline p-btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={!!progress || remaining <= 0}
        >
          {progress ? <><Spinner /> {t.uploading(progress.current, progress.total)}</> : (
            <><Icon name="upload" size={16} /> {remaining > 0 ? t.add : t.full}</>
          )}
        </button>
        <span className="p-muted p-small">{t.formats}</span>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={handleFiles} />
      </div>
    </div>
  )
}
