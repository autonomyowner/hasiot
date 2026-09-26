import { useRef, useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useToast } from './toast-context'

const MAX_FILE_BYTES = 5 * 1024 * 1024

// A failure this component words itself, as opposed to one the server raised.
// toast.error only shows a server error's own Arabic sentence, so these carry
// theirs and are passed on as text.
class UploadError extends Error {}

/**
 * Photo upload for the admin listing form.
 *
 * The admin panel had no uploader at all, so the only listings with photos were
 * the seeded ones and whatever business owners posted from the app. This uses
 * the same three-step Convex flow the mobile app uses in lib/convexUpload.ts —
 * generateUploadUrl → POST the bytes → resolve a URL — and stores the resulting
 * URL strings, which is the shape `listings.images` already holds.
 *
 * `images` is an array of URL strings and index 0 is the cover, so ordering is
 * a real editing operation, not decoration.
 */
// The panel's own wording. The partner portal passes `labels` to speak
// English too; anything it leaves out stays Arabic.
const AR_LABELS = {
  title: 'الصور',
  hint: (count, max) => ` — الأولى هي صورة الغلاف في التطبيق (${count}/${max})`,
  tooMany: (remaining, max) => `يمكن إضافة ${remaining} صورة فقط. الحد الأقصى ${max} صور.`,
  notImage: (name) => `"${name}" ليس ملف صورة.`,
  tooBig: (name) => `"${name}" أكبر من 5 ميجابايت.`,
  uploadFailed: (name, status) => `فشل رفع "${name}" (${status})`,
  noUrl: (name) => `تعذّر الحصول على رابط الصورة "${name}"`,
  uploaded: (n) => (n === 1 ? 'تم رفع الصورة' : `تم رفع ${n} صور`),
  photo: (i) => `صورة ${i}`,
  cover: 'الغلاف',
  earlier: 'تقديم',
  earlierLabel: (i) => `تقديم الصورة ${i}`,
  later: 'تأخير',
  laterLabel: (i) => `تأخير الصورة ${i}`,
  remove: 'حذف',
  removeLabel: (i) => `حذف الصورة ${i}`,
  uploading: (current, total) => `جاري الرفع ${current} من ${total}...`,
  add: 'إضافة صور',
  full: 'اكتمل الحد الأقصى',
  formats: 'JPG أو PNG أو WebP، حتى 5 ميجابايت للصورة',
}

export default function ImageUploader({
  images,
  onChange,
  max = 8,
  emptyHint = 'لا توجد صور. الأماكن بدون صور تظهر فارغة في التطبيق.',
  labels,
  onError,
}) {
  const L = { ...AR_LABELS, ...labels }
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const convex = useConvex()
  const toast = useToast()
  const inputRef = useRef(null)
  const [progress, setProgress] = useState(null)

  const remaining = max - images.length

  const handleFiles = async (event) => {
    const picked = Array.from(event.target.files || [])
    // Let the operator re-pick the same file after removing it.
    event.target.value = ''
    if (picked.length === 0) return

    if (picked.length > remaining) {
      toast.error(L.tooMany(remaining, max))
    }

    const accepted = []
    for (const file of picked.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        toast.error(L.notImage(file.name))
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(L.tooBig(file.name))
        continue
      }
      accepted.push(file)
    }
    if (accepted.length === 0) return

    const uploaded = []
    try {
      for (let i = 0; i < accepted.length; i++) {
        setProgress({ current: i + 1, total: accepted.length })
        const file = accepted[i]

        const postUrl = await generateUploadUrl()
        const response = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': file.type },
          body: file,
        })
        if (!response.ok) {
          throw new UploadError(L.uploadFailed(file.name, response.status))
        }

        const { storageId } = await response.json()
        const url = await convex.query(api.users.queries.getStorageUrl, { storageId })
        if (!url) throw new UploadError(L.noUrl(file.name))

        uploaded.push(url)
        // Commit after each file: if the fourth upload fails, the first three
        // are still on the form rather than lost.
        onChange([...images, ...uploaded])
      }
      toast.success(L.uploaded(uploaded.length))
    } catch (error) {
      // A caller with its own wording for server errors (the partner portal)
      // takes them; the panel's readableError handles the rest.
      if (error instanceof UploadError) toast.error(error.message)
      else if (onError) onError(error)
      else toast.error(error)
    } finally {
      setProgress(null)
    }
  }

  const move = (from, to) => {
    if (to < 0 || to >= images.length) return
    const next = [...images]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const remove = (index) => onChange(images.filter((_, i) => i !== index))

  return (
    <div className="admin-form-group">
      <label className="admin-form-label">
        {L.title}
        <span className="admin-form-hint">{L.hint(images.length, max)}</span>
      </label>

      {images.length > 0 && (
        <div className="admin-uploader-grid">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="admin-uploader-thumb">
              <img src={url} alt={L.photo(index + 1)} loading="lazy" />
              {index === 0 && <span className="admin-uploader-cover">{L.cover}</span>}
              <div className="admin-uploader-thumb-actions">
                <button
                  type="button"
                  title={L.earlier}
                  aria-label={L.earlierLabel(index + 1)}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ›
                </button>
                <button
                  type="button"
                  title={L.later}
                  aria-label={L.laterLabel(index + 1)}
                  disabled={index === images.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="danger"
                  title={L.remove}
                  aria-label={L.removeLabel(index + 1)}
                  onClick={() => remove(index)}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="admin-uploader-controls">
        <button
          type="button"
          className="admin-btn admin-btn-secondary admin-btn-small"
          onClick={() => inputRef.current?.click()}
          disabled={!!progress || remaining <= 0}
        >
          {progress
            ? L.uploading(progress.current, progress.total)
            : remaining > 0 ? L.add : L.full}
        </button>
        <span className="admin-form-hint">{L.formats}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleFiles}
        />
      </div>

      {images.length === 0 && !progress && (
        <p className="admin-uploader-empty">{emptyHint}</p>
      )}
    </div>
  )
}
