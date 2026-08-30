import { useRef, useState } from 'react'
import { useConvex, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useToast } from './toast-context'

const MAX_FILE_BYTES = 5 * 1024 * 1024

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
export default function ImageUploader({ images, onChange, max = 8 }) {
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
      toast.error(`يمكن إضافة ${remaining} صورة فقط. الحد الأقصى ${max} صور.`)
    }

    const accepted = []
    for (const file of picked.slice(0, remaining)) {
      if (!file.type.startsWith('image/')) {
        toast.error(`"${file.name}" ليس ملف صورة.`)
        continue
      }
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`"${file.name}" أكبر من 5 ميجابايت.`)
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
          throw new Error(`فشل رفع "${file.name}" (${response.status})`)
        }

        const { storageId } = await response.json()
        const url = await convex.query(api.users.queries.getStorageUrl, { storageId })
        if (!url) throw new Error(`تعذّر الحصول على رابط الصورة "${file.name}"`)

        uploaded.push(url)
        // Commit after each file: if the fourth upload fails, the first three
        // are still on the form rather than lost.
        onChange([...images, ...uploaded])
      }
      toast.success(
        uploaded.length === 1 ? 'تم رفع الصورة' : `تم رفع ${uploaded.length} صور`
      )
    } catch (error) {
      toast.error(error)
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
        الصور
        <span className="admin-form-hint"> — الأولى هي صورة الغلاف في التطبيق ({images.length}/{max})</span>
      </label>

      {images.length > 0 && (
        <div className="admin-uploader-grid">
          {images.map((url, index) => (
            <div key={`${url}-${index}`} className="admin-uploader-thumb">
              <img src={url} alt={`صورة ${index + 1}`} loading="lazy" />
              {index === 0 && <span className="admin-uploader-cover">الغلاف</span>}
              <div className="admin-uploader-thumb-actions">
                <button
                  type="button"
                  title="تقديم"
                  aria-label={`تقديم الصورة ${index + 1}`}
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  ›
                </button>
                <button
                  type="button"
                  title="تأخير"
                  aria-label={`تأخير الصورة ${index + 1}`}
                  disabled={index === images.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="danger"
                  title="حذف"
                  aria-label={`حذف الصورة ${index + 1}`}
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
            ? `جاري الرفع ${progress.current} من ${progress.total}...`
            : remaining > 0 ? 'إضافة صور' : 'اكتمل الحد الأقصى'}
        </button>
        <span className="admin-form-hint">JPG أو PNG أو WebP، حتى 5 ميجابايت للصورة</span>
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
        <p className="admin-uploader-empty">
          لا توجد صور. الأماكن بدون صور تظهر فارغة في التطبيق.
        </p>
      )}
    </div>
  )
}
