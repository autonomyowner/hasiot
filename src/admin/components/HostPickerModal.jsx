import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Modal from './Modal'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './toast-context'
import { useDebounced } from '../../hooks/useDebounced'
import { useQuerySafe } from '../useQuerySafe'
import { EmptyState } from './States'
import { personName, roleLabel } from '../constants'

// Only these two can answer a booking: the host inbox is keyed on ownerId, and
// a tourist would receive requests they have no screen to act on. The server
// enforces this too — this is only so an operator is not offered a dead end.
const CAN_HOST = ['business_owner', 'admin']

/**
 * Point a listing at the account that answers its booking requests.
 *
 * It says who hosts the place now, before anyone is replaced. Suspended
 * accounts are left out of the results: a suspended account reads as signed
 * out everywhere, so every request sent to its inbox would expire unanswered,
 * and the server refuses it anyway. Failures read as the server's own Arabic
 * sentence rather than a raw error.
 */
export default function HostPickerModal({ listing, onClose }) {
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [term, setTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const debounced = useDebounced(term)

  const assignHost = useMutation(api.admin.mutations.assignListingHost)

  // Who hosts it now. Beside the search rather than instead of it, so a
  // failure here costs the line, not the picker.
  const current = useQuerySafe(
    api.admin.queries.adminGetUser,
    listing.ownerId ? { userId: listing.ownerId } : 'skip'
  )

  // The backend returns nothing under two characters, so there is no point
  // asking. "skip" also keeps the query from running on an empty box.
  const results = useQuery(
    api.admin.users.adminSearchUsers,
    debounced.trim().length >= 2 ? { searchQuery: debounced.trim() } : 'skip'
  )
  const candidates = results?.filter((user) => !user.isSuspended) ?? []
  const hiddenSuspended = (results?.length ?? 0) - candidates.length

  const assign = async (ownerId, label) => {
    setSaving(true)
    try {
      const outcome = await assignHost({ listingId: listing._id, ownerId })
      const moved = outcome?.movedBookings ?? 0
      toast.success(
        ownerId
          ? `تم تعيين ${label} مضيفًا${moved > 0 ? ` ونُقل إليه ${moved} من الحجوزات المفتوحة` : ''}`
          : `تم إلغاء تعيين المضيف${moved > 0 ? ` — ${moved} من الحجوزات المفتوحة بلا مضيف الآن` : ''}`
      )
      onClose()
    } catch (error) {
      toast.error(error)
    } finally {
      setSaving(false)
    }
  }

  // Taking the host away leaves the place's open requests with nobody to
  // answer them until someone else is assigned, so it asks first.
  const removeHost = async () => {
    const ok = await confirm({
      title: 'إزالة المضيف الحالي؟',
      message: 'الطلبات والحجوزات المفتوحة لهذا المكان ستبقى بلا مضيف يرد عليها حتى تعيّن مضيفًا آخر، والطلب الذي لا يُرد عليه ينتهي بعد 48 ساعة.',
      confirmLabel: 'إزالة المضيف',
      destructive: true,
    })
    if (ok) await assign(null, '')
  }

  let currentLine
  if (!listing.ownerId) {
    currentLine = 'المضيف الحالي: لا يوجد — طلبات الحجز لهذا المكان لا تصل لأحد.'
  } else if (current.error) {
    currentLine = 'المضيف الحالي: تعذّر تحميل بياناته.'
  } else if (current.data === undefined) {
    currentLine = 'المضيف الحالي: جارٍ التحميل…'
  } else if (current.data === null) {
    currentLine = 'المضيف الحالي: حساب محذوف.'
  } else {
    const host = current.data
    currentLine = `المضيف الحالي: ${personName(host)} (${roleLabel(host.role)})${host.phone ? ` — ${host.phone}` : ''}${host.isSuspended ? ' — الحساب موقوف' : ''}`
  }

  return (
    <Modal
      onClose={onClose}
      title="تعيين مضيف"
      subtitle={listing.name_ar || listing.name_en}
    >
      <div className="admin-modal-body">
        <div className="admin-info-box">
          <p>{currentLine}</p>
        </div>

        <div className="admin-form-group">
          <label className="admin-form-label" htmlFor="host-search">ابحث بالاسم أو الهاتف أو البريد</label>
          <input
            id="host-search"
            className="admin-form-input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="حرفان على الأقل"
            autoFocus
          />
        </div>

        {listing.ownerId && (
          <button
            type="button"
            className="admin-btn admin-btn-secondary admin-btn-small"
            style={{ marginTop: '0.75rem' }}
            disabled={saving}
            onClick={removeHost}
          >
            إزالة المضيف الحالي
          </button>
        )}

        <div className="admin-host-results">
          {debounced.trim().length < 2 ? null : results === undefined ? (
            <p className="admin-page-subtitle">جارٍ البحث…</p>
          ) : candidates.length === 0 ? (
            <EmptyState
              title="لا توجد نتائج"
              hint={hiddenSuspended > 0
                ? 'الحسابات الموقوفة لا تظهر هنا لأنها لا تستطيع استقبال الحجوزات.'
                : 'جرّب اسمًا أو رقمًا آخر'}
            />
          ) : (
            <>
              {candidates.map((user) => {
                const isCurrent = user._id === listing.ownerId
                const eligible = CAN_HOST.includes(user.role)
                return (
                  <button
                    key={user._id}
                    type="button"
                    className="admin-host-row"
                    disabled={!eligible || isCurrent || saving}
                    title={
                      isCurrent ? 'هذا هو المضيف الحالي'
                        : eligible ? undefined
                          : 'هذا الحساب لا يمكنه استقبال الحجوزات'
                    }
                    onClick={() => assign(user._id, personName(user))}
                  >
                    <span className="admin-host-name">{personName(user)}</span>
                    <span>
                      {isCurrent && <span className="admin-badge green">المضيف الحالي</span>}
                      <span className="admin-badge gray">{roleLabel(user.role)}</span>
                    </span>
                  </button>
                )
              })}
              {hiddenSuspended > 0 && (
                <p className="admin-inline-hint">
                  أُخفي {hiddenSuspended} من الحسابات الموقوفة، فهي لا تستطيع استقبال الحجوزات.
                </p>
              )}
            </>
          )}
        </div>
      </div>
      {confirmDialog}
    </Modal>
  )
}
