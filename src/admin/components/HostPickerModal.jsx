import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Modal from './Modal'
import { useToast } from './toast-context'
import { useDebounced } from '../hooks/useDebounced'
import { EmptyState } from './States'

// Only these two can answer a booking: the host inbox is keyed on ownerId, and
// a tourist would receive requests they have no screen to act on. The server
// enforces this too — this is only so an operator is not offered a dead end.
const CAN_HOST = ['business_owner', 'admin']

const ROLE_LABELS = {
  tourist: 'سائح',
  business_owner: 'مالك نشاط',
  service_provider: 'مزود خدمة',
  admin: 'مشرف',
}

function displayName(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.email || user.phone || '—'
}

export default function HostPickerModal({ listing, onClose }) {
  const toast = useToast()
  const [term, setTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const debounced = useDebounced(term)

  const assignHost = useMutation(api.admin.mutations.assignListingHost)

  // The backend returns nothing under two characters, so there is no point
  // asking. "skip" also keeps the query from running on an empty box.
  const results = useQuery(
    api.admin.users.adminSearchUsers,
    debounced.trim().length >= 2 ? { searchQuery: debounced.trim() } : 'skip'
  )

  const assign = async (ownerId, label) => {
    setSaving(true)
    try {
      await assignHost({ listingId: listing._id, ownerId })
      toast.success(ownerId ? `تم تعيين ${label} مضيفًا` : 'تم إلغاء تعيين المضيف')
      onClose()
    } catch (error) {
      toast.error(error?.message || 'تعذر حفظ التغيير')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="تعيين مضيف"
      subtitle={listing.name_ar || listing.name_en}
    >
      <div className="admin-modal-body">
        <div className="admin-form-section">
          <label className="admin-form-label">ابحث بالاسم أو الهاتف أو البريد</label>
          <input
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
            className="admin-btn admin-btn-secondary"
            disabled={saving}
            onClick={() => assign(null, '')}
          >
            إزالة المضيف الحالي
          </button>
        )}

        <div className="admin-host-results">
          {debounced.trim().length < 2 ? null : results === undefined ? (
            <p className="admin-page-subtitle">جارٍ البحث…</p>
          ) : results.length === 0 ? (
            <EmptyState title="لا توجد نتائج" hint="جرّب اسمًا أو رقمًا آخر" />
          ) : (
            results.map((user) => {
              const eligible = CAN_HOST.includes(user.role)
              return (
                <button
                  key={user._id}
                  type="button"
                  className="admin-host-row"
                  disabled={!eligible || saving}
                  title={eligible ? undefined : 'هذا الحساب لا يمكنه استقبال الحجوزات'}
                  onClick={() => assign(user._id, displayName(user))}
                >
                  <span className="admin-host-name">{displayName(user)}</span>
                  <span className="admin-badge gray">{ROLE_LABELS[user.role] || user.role}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </Modal>
  )
}
