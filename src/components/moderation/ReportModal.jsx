import { useState } from 'react'
import { useMutation } from 'convex/react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { api } from '../../../convex/_generated/api'
import { useCurrentUser } from '../../hooks/useCurrentUser'

const translations = {
  ar: {
    title: 'الإبلاغ عن محتوى',
    subtitle: 'اختر سبب الإبلاغ. يراجع فريقنا كل بلاغ خلال 24 ساعة.',
    spam: 'محتوى مزعج أو دعائي',
    inappropriate: 'محتوى غير لائق',
    offensive: 'محتوى مسيء أو تحريضي',
    fraud: 'احتيال أو معلومات مضللة',
    other: 'سبب آخر',
    detailsPlaceholder: 'تفاصيل إضافية (اختياري)',
    submit: 'إرسال البلاغ',
    submitting: 'جاري الإرسال...',
    cancel: 'إلغاء',
    success: 'تم استلام بلاغك. شكراً لك.',
    alreadyReported: 'سبق أن أبلغت عن هذا المحتوى.',
    failed: 'تعذّر إرسال البلاغ. حاول مرة أخرى.',
    signInRequired: 'سجّل الدخول للإبلاغ عن المحتوى.',
    blockUser: 'حظر هذا الحساب',
    blockConfirm: 'سيتم إخفاء كل محتوى هذا الحساب عنك. هل تريد المتابعة؟',
    blockSuccess: 'تم حظر الحساب.',
    blockFailed: 'تعذّر حظر الحساب.',
    confirm: 'حظر',
  },
  en: {
    title: 'Report content',
    subtitle: 'Choose a reason. Our team reviews every report within 24 hours.',
    spam: 'Spam or advertising',
    inappropriate: 'Inappropriate content',
    offensive: 'Offensive or hateful',
    fraud: 'Fraud or misleading information',
    other: 'Something else',
    detailsPlaceholder: 'Additional details (optional)',
    submit: 'Submit report',
    submitting: 'Submitting...',
    cancel: 'Cancel',
    success: 'Report received. Thank you.',
    alreadyReported: 'You have already reported this content.',
    failed: 'Could not send the report. Please try again.',
    signInRequired: 'Sign in to report content.',
    blockUser: 'Block this account',
    blockConfirm: 'All content from this account will be hidden from you. Continue?',
    blockSuccess: 'Account blocked.',
    blockFailed: 'Could not block the account.',
    confirm: 'Block',
  },
}

// Keys must match VALID_REASONS in convex/moderation/mutations.ts
const REASONS = ['spam', 'inappropriate', 'offensive', 'fraud', 'other']

const MAX_DETAILS = 500

/**
 * Report + block dialog, shared by listing cards, service cards, the listing
 * detail page and individual reviews.
 *
 * `ownerId` is optional: without it the block action is hidden. Anonymous
 * reviews deliberately arrive without one (see getListingReviews), so they can
 * be reported but not blocked.
 */
export default function ReportModal({
  isOpen,
  onClose,
  targetType,
  targetId,
  ownerId = null,
  targetLabel,
  lang = 'ar',
}) {
  const t = translations[lang] || translations.ar
  const isRTL = lang === 'ar'
  const { user } = useCurrentUser()

  const reportContent = useMutation(api.moderation.mutations.reportContent)
  const blockUser = useMutation(api.moderation.mutations.blockUser)

  const [reason, setReason] = useState(null)
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null) // { kind: 'success' | 'error', text }
  const [confirmingBlock, setConfirmingBlock] = useState(false)

  const close = () => {
    setReason(null)
    setDetails('')
    setBusy(false)
    setResult(null)
    setConfirmingBlock(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!user) {
      setResult({ kind: 'error', text: t.signInRequired })
      return
    }
    if (!reason || busy) return

    setBusy(true)
    setResult(null)
    try {
      const res = await reportContent({
        targetType,
        targetId,
        reason,
        details: details.trim() || undefined,
      })
      setResult({
        kind: 'success',
        text: res.alreadyReported ? t.alreadyReported : t.success,
      })
      setTimeout(close, 1800)
    } catch (err) {
      // The backend throws a bilingual message for the daily reporting cap;
      // surface it rather than replacing it with the generic failure text.
      setResult({ kind: 'error', text: err?.message || t.failed })
      setBusy(false)
    }
  }

  const handleBlock = async () => {
    if (!user || !ownerId || busy) return
    setBusy(true)
    setResult(null)
    try {
      await blockUser({ blockedUserId: ownerId })
      setResult({ kind: 'success', text: t.blockSuccess })
      setTimeout(close, 1500)
    } catch (err) {
      setResult({ kind: 'error', text: err?.message || t.blockFailed })
      setBusy(false)
      setConfirmingBlock(false)
    }
  }

  if (!isOpen) return null

  const canSubmit = Boolean(reason) && !busy

  return (
    <AnimatePresence>
      <Motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem',
        }}
      >
        <Motion.div
          className="modal-content"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          dir={isRTL ? 'rtl' : 'ltr'}
          role="dialog"
          aria-modal="true"
          aria-label={t.title}
          style={{
            background: '#fff', borderRadius: '1rem', padding: '1.5rem',
            width: '100%', maxWidth: '440px', maxHeight: '85vh', overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600 }}>{t.title}</h3>
            <button
              onClick={close}
              aria-label={t.cancel}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280', lineHeight: 1, padding: '0.25rem' }}
            >
              &times;
            </button>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5 }}>
            {t.subtitle}
          </p>

          {targetLabel && (
            <p style={{ fontSize: '0.875rem', color: '#374151', margin: '0 0 1rem', padding: '0.5rem 0.75rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
              {targetLabel}
            </p>
          )}

          {REASONS.map((key) => {
            const active = reason === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setReason(key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%',
                  padding: '0.75rem 0.875rem', marginBottom: '0.5rem', cursor: 'pointer',
                  borderRadius: '0.75rem', textAlign: isRTL ? 'right' : 'left',
                  border: `1px solid ${active ? '#0D7A5F' : '#e5e7eb'}`,
                  background: active ? '#F0FAF6' : '#fff',
                  color: active ? '#0D7A5F' : '#374151',
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.9375rem',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${active ? '#0D7A5F' : '#9ca3af'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  {active && <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#0D7A5F' }} />}
                </span>
                {t[key]}
              </button>
            )
          })}

          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t.detailsPlaceholder}
            maxLength={MAX_DETAILS}
            rows={3}
            style={{
              width: '100%', marginTop: '0.5rem', padding: '0.75rem',
              border: '1px solid #e5e7eb', borderRadius: '0.75rem',
              fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical',
              textAlign: isRTL ? 'right' : 'left',
            }}
          />

          {result && (
            <p
              role="status"
              style={{
                margin: '0.75rem 0 0', padding: '0.625rem 0.75rem', borderRadius: '0.5rem',
                fontSize: '0.875rem',
                background: result.kind === 'success' ? '#F0FAF6' : '#FEF2F2',
                color: result.kind === 'success' ? '#0D7A5F' : '#B91C1C',
              }}
            >
              {result.text}
            </p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              width: '100%', marginTop: '1rem', padding: '0.8125rem',
              border: 'none', borderRadius: '0.75rem', fontSize: '1rem', fontWeight: 600,
              fontFamily: 'inherit', color: '#fff',
              background: canSubmit ? '#0D7A5F' : '#A7D4C4',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {busy ? t.submitting : t.submit}
          </button>

          {ownerId && user && (
            confirmingBlock ? (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', border: '1px solid #FCA5A5', borderRadius: '0.75rem' }}>
                <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: '#374151' }}>{t.blockConfirm}</p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={handleBlock}
                    disabled={busy}
                    style={{
                      flex: 1, padding: '0.625rem', border: 'none', borderRadius: '0.5rem',
                      background: '#DC2626', color: '#fff', fontWeight: 600, fontFamily: 'inherit',
                      cursor: busy ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
                    }}
                  >
                    {t.confirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingBlock(false)}
                    style={{
                      flex: 1, padding: '0.625rem', borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb', background: '#fff', color: '#374151',
                      fontFamily: 'inherit', cursor: 'pointer', fontSize: '0.875rem',
                    }}
                  >
                    {t.cancel}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingBlock(true)}
                style={{
                  width: '100%', marginTop: '0.75rem', padding: '0.6875rem',
                  border: '1px solid #FCA5A5', borderRadius: '0.75rem',
                  background: '#fff', color: '#DC2626', fontSize: '0.9375rem',
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
              >
                {t.blockUser}
              </button>
            )
          )}
        </Motion.div>
      </Motion.div>
    </AnimatePresence>
  )
}
