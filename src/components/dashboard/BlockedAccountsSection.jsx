import { useState } from 'react'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { SkeletonList } from '../Skeleton'

const translations = {
  ar: {
    title: 'الحسابات المحظورة',
    subtitle: 'لا يظهر لك أي محتوى من هذه الحسابات.',
    empty: 'لم تحظر أي حساب.',
    unblock: 'إلغاء الحظر',
    unblocking: 'جاري...',
    failed: 'تعذّر إلغاء الحظر. حاول مرة أخرى.',
    unnamed: 'مستخدم',
    roles: {
      tourist: 'سائح',
      business_owner: 'صاحب عمل',
      service_provider: 'مقدّم خدمة',
      admin: 'مشرف',
    },
  },
  en: {
    title: 'Blocked accounts',
    subtitle: 'You do not see any content from these accounts.',
    empty: 'You have not blocked anyone.',
    unblock: 'Unblock',
    unblocking: 'Working...',
    failed: 'Could not unblock. Please try again.',
    unnamed: 'User',
    roles: {
      tourist: 'Tourist',
      business_owner: 'Business owner',
      service_provider: 'Service provider',
      admin: 'Admin',
    },
  },
}

export default function BlockedAccountsSection({ lang = 'ar' }) {
  const t = translations[lang] || translations.ar

  const blocked = useQuery(api.moderation.queries.getMyBlockedUsers)
  const unblockUser = useMutation(api.moderation.mutations.unblockUser)

  const [pendingId, setPendingId] = useState(null)
  const [error, setError] = useState('')

  const handleUnblock = async (blockedUserId) => {
    if (pendingId) return
    setPendingId(blockedUserId)
    setError('')
    try {
      await unblockUser({ blockedUserId })
      // No local state to clear: getMyBlockedUsers is a live query and drops
      // the row on its own once the mutation lands.
    } catch {
      setError(t.failed)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div style={{ marginTop: '2.5rem' }}>
      <h2 className="dashboard-section-title">{t.title}</h2>
      <p style={{ color: 'var(--color-text-muted, #6b7280)', fontSize: '0.875rem', margin: '0 0 1rem' }}>
        {t.subtitle}
      </p>

      {error && (
        <p style={{ color: '#B91C1C', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p>
      )}

      {blocked === undefined ? (
        <SkeletonList count={2} />
      ) : blocked.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted, #6b7280)', fontSize: '0.9375rem' }}>{t.empty}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {blocked.map((b) => {
            const name = `${b.firstName || ''} ${b.lastName || ''}`.trim() || t.unnamed
            const busy = pendingId === b.blockedUserId
            return (
              <li
                key={b.blockId}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '1rem', padding: '0.75rem 1rem',
                  border: '1px solid var(--color-border, #e5e7eb)', borderRadius: '0.75rem',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{name}</div>
                  {b.role && (
                    <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted, #6b7280)' }}>
                      {t.roles[b.role] || b.role}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleUnblock(b.blockedUserId)}
                  disabled={busy}
                  style={{
                    padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                    border: '1px solid var(--color-border, #e5e7eb)', background: '#fff',
                    fontFamily: 'inherit', fontSize: '0.875rem',
                    cursor: busy ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {busy ? t.unblocking : t.unblock}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
