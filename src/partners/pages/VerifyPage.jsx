import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toastApi } from '../../admin/components/toast-context'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { dashboardPath } from '../lib/gate'
import { errorText } from '../lib/errors'
import { Icon, Spinner } from '../components/Ui'

const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png']

const translations = {
  en: {
    title: 'Verification',
    subtitleBusiness: 'Upload your commercial registration or a licence for your place.',
    subtitleProvider: 'Upload your ID, freelance permit or commercial registration.',
    upload: 'Choose a file',
    uploadAgain: 'Upload a new document',
    replace: 'Replace the document',
    drop: 'PDF, JPG or PNG, up to 10 MB',
    tooBig: 'That file is larger than 10 MB.',
    wrongType: 'Use a PDF, JPG or PNG file.',
    uploading: 'Uploading…',
    uploaded: 'Document sent for review.',
    uploadFailed: 'The upload failed. Check your connection and try again.',
    noneTitle: 'No document yet',
    noneBody: 'Your account is ready. Upload a document so our team can approve it.',
    pendingTitle: 'Under review',
    pendingBody: 'We have your document. Approval usually takes one to two working days; we will notify you in the app.',
    rejectedTitle: 'Not approved',
    rejectedBody: 'Your document was not accepted. Upload a new one and we will review it again.',
    reason: 'Reason:',
    approvedTitle: 'Approved',
    approvedBody: 'Your account is verified. You can manage everything from your dashboard.',
    goDashboard: 'Go to dashboard',
  },
  ar: {
    title: 'التوثيق',
    subtitleBusiness: 'ارفع السجل التجاري أو ترخيص منشأتك.',
    subtitleProvider: 'ارفع هويتك أو وثيقة العمل الحر أو السجل التجاري.',
    upload: 'اختر ملفًا',
    uploadAgain: 'ارفع مستندًا جديدًا',
    replace: 'استبدال المستند',
    drop: 'PDF أو JPG أو PNG، حتى 10 ميجابايت',
    tooBig: 'حجم الملف أكبر من 10 ميجابايت.',
    wrongType: 'استخدم ملف PDF أو JPG أو PNG.',
    uploading: 'جارٍ الرفع…',
    uploaded: 'أُرسل المستند للمراجعة.',
    uploadFailed: 'تعذّر رفع الملف. تحقق من اتصالك وحاول مرة أخرى.',
    noneTitle: 'لا يوجد مستند بعد',
    noneBody: 'حسابك جاهز. ارفع مستندًا ليتمكن فريقنا من اعتماده.',
    pendingTitle: 'قيد المراجعة',
    pendingBody: 'استلمنا مستندك. تستغرق المراجعة عادة يوم إلى يومي عمل، وسنبلغك في التطبيق.',
    rejectedTitle: 'لم يُعتمد',
    rejectedBody: 'لم يُقبل مستندك. ارفع مستندًا جديدًا وسنراجعه مرة أخرى.',
    reason: 'السبب:',
    approvedTitle: 'معتمد',
    approvedBody: 'تم توثيق حسابك. يمكنك إدارة كل شيء من لوحة التحكم.',
    goDashboard: 'الذهاب إلى لوحة التحكم',
  },
}

/** Which of the four states the account is in, from the users row. */
function stateOf(user) {
  if (user?.isApproved) return 'approved'
  if (user?.accountRejectionReason) return 'rejected'
  if (user?.cvFileId) return 'pending'
  return 'none'
}

/**
 * The document step, as the app's verification screen: generateUploadUrl ->
 * POST the file -> saveBusinessDoc. A new document clears an earlier
 * rejection server-side, which puts the account back in the admin's queue.
 * Also the approved partner's "Verification" nav item, so it accepts the
 * dashboard routes too.
 */
export default function VerifyPage() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard, user, route } = usePartnerGate(['verify', 'hotel', 'services'])
  const generateUploadUrl = useMutation(api.users.mutations.generateUploadUrl)
  const saveBusinessDoc = useMutation(api.users.mutations.saveBusinessDoc)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const inputRef = useRef(null)
  const busyRef = useRef(false)

  if (guard) return guard

  const state = stateOf(user)
  const isProvider = user?.role === 'service_provider'

  const upload = async (file) => {
    if (!file || busyRef.current) return
    if (!ACCEPTED.includes(file.type)) return setError(t.wrongType)
    if (file.size > MAX_BYTES) return setError(t.tooBig)
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      const url = await generateUploadUrl()
      let storageId
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
        if (!res.ok) throw new Error(`upload ${res.status}`)
        storageId = (await res.json()).storageId
      } catch (err) {
        console.error('[partners] upload failed:', err)
        setError(t.uploadFailed)
        return
      }
      await saveBusinessDoc({ fileId: storageId })
      toastApi.success(t.uploaded)
    } catch (err) {
      setError(errorText(err, lang))
    } finally {
      busyRef.current = false
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const status = {
    none: { cls: '', icon: 'upload', title: t.noneTitle, body: t.noneBody },
    pending: { cls: '', icon: 'clock', title: t.pendingTitle, body: t.pendingBody },
    rejected: { cls: 'p-status-bad', icon: 'alert', title: t.rejectedTitle, body: t.rejectedBody },
    approved: { cls: 'p-status-ok', icon: 'check', title: t.approvedTitle, body: t.approvedBody },
  }[state]

  const uploadLabel = state === 'rejected' ? t.uploadAgain : state === 'pending' ? t.replace : t.upload

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="p-title">{t.title}</h1>
      <p className="p-subtitle">{isProvider ? t.subtitleProvider : t.subtitleBusiness}</p>

      <div className="p-card p-stack">
        <div className={`p-status ${status.cls}`} role="status">
          <span className="p-status-icon"><Icon name={status.icon} size={22} /></span>
          <div>
            <p className="p-h2" style={{ marginBottom: 4 }}>{status.title}</p>
            <p className="p-muted" style={{ margin: 0 }}>{status.body}</p>
            {state === 'rejected' && (
              <p style={{ margin: '8px 0 0' }}>
                <strong>{t.reason}</strong> {user.accountRejectionReason}
              </p>
            )}
          </div>
        </div>

        {state === 'approved' ? (
          route !== 'verify' && (
            <Link to={dashboardPath(route)} className="p-btn p-btn-primary" style={{ alignSelf: 'flex-start' }}>
              {t.goDashboard}
            </Link>
          )
        ) : (
          <>
            <label
              className={over ? 'p-drop is-over' : 'p-drop'}
              onDragOver={(e) => {
                e.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setOver(false)
                void upload(e.dataTransfer.files?.[0])
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                // Visually hidden, not `hidden`: a hidden input leaves the label
                // with nothing focusable, so the upload is unreachable by keyboard.
                className="p-visually-hidden"
                aria-label={uploadLabel}
                disabled={busy}
                onChange={(e) => void upload(e.target.files?.[0])}
              />
              {busy ? <Spinner /> : <Icon name="upload" size={26} />}
              <span className="p-btn p-btn-outline p-btn-sm" aria-hidden="true">
                {busy ? t.uploading : uploadLabel}
              </span>
              <span className="p-small">{t.drop}</span>
            </label>
            {error && <p className="p-field-error" role="alert">{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}
