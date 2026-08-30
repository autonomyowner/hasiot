import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { useSelection, describeBulkResult } from '../useSelection'
import { TYPE_LABELS, cityLabel, formatDate } from '../constants'

/**
 * Listings submitted from the mobile app, waiting on a decision. This is the
 * queue that gates whether a business owner's hotel ever appears to tourists,
 * so it leads the panel's "needs action" list.
 */
export default function ContentApprovalTab() {
  const pending = useQuery(api.admin.queries.listPendingContent)
  const approve = useMutation(api.admin.mutations.approveContent)
  const reject = useMutation(api.admin.mutations.rejectContent)
  const bulkApprove = useMutation(api.admin.mutations.bulkApproveContent)
  const bulkReject = useMutation(api.admin.mutations.bulkRejectContent)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const selection = useSelection(pending)
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const handleApprove = async (listing) => {
    setBusyId(listing._id)
    try {
      await approve({ id: listing._id })
      toast.success(`تمت الموافقة على "${listing.name_ar || listing.name_en}"`)
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleReject = async (listing) => {
    const result = await confirm({
      title: 'رفض هذا المحتوى؟',
      message: `سيظهر سبب الرفض لصاحب "${listing.name_ar || listing.name_en}" في التطبيق، ويمكنه التعديل وإعادة الإرسال.`,
      confirmLabel: 'تأكيد الرفض',
      destructive: true,
      reason: { label: 'سبب الرفض (اختياري)', placeholder: 'مثال: الصور غير واضحة، العنوان غير صحيح...' },
    })
    if (!result) return

    setBusyId(listing._id)
    try {
      await reject({ id: listing._id, reason: result.reason || undefined })
      toast.success('تم رفض المحتوى')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleBulkApprove = async () => {
    const result = await confirm({
      title: `الموافقة على ${selection.count} عنصر؟`,
      message: 'ستظهر كل هذه الأماكن في التطبيق فوراً.',
      confirmLabel: 'موافقة على الكل',
    })
    if (!result) return

    setBulkBusy(true)
    try {
      const outcome = await bulkApprove({ ids: selection.selectedIds })
      toast.success(describeBulkResult(outcome, 'تمت الموافقة على'))
      if (outcome.failed?.length) toast.error(outcome.failed[0].error)
      selection.clear()
    } catch (error) {
      toast.error(error)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReject = async () => {
    const result = await confirm({
      title: `رفض ${selection.count} عنصر؟`,
      message: 'سيتلقى كل صاحب محتوى نفس السبب.',
      confirmLabel: 'رفض الكل',
      destructive: true,
      reason: { label: 'سبب الرفض (اختياري)', placeholder: 'سبب واحد لكل العناصر المحددة' },
    })
    if (!result) return

    setBulkBusy(true)
    try {
      const outcome = await bulkReject({
        ids: selection.selectedIds,
        reason: result.reason || undefined,
      })
      toast.success(describeBulkResult(outcome, 'تم رفض'))
      if (outcome.failed?.length) toast.error(outcome.failed[0].error)
      selection.clear()
    } catch (error) {
      toast.error(error)
    } finally {
      setBulkBusy(false)
    }
  }

  if (pending === undefined) return <TableSkeleton rows={4} cols={6} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-section-header">
        <h2 className="admin-section-title">محتوى معلق للمراجعة</h2>
        <span className="admin-badge admin-badge-warning">{pending.length} عنصر</span>
      </div>

      {pending.length === 0 ? (
        <EmptyState
          title="لا يوجد محتوى بانتظار المراجعة"
          hint="الأماكن التي يضيفها أصحاب الأعمال من التطبيق تظهر هنا قبل نشرها."
        />
      ) : (
        <>
          {selection.count > 0 && (
            <div className="admin-bulk-bar">
              <span>{selection.count} عنصر محدد</span>
              <div className="admin-actions">
                <button
                  className="admin-btn admin-btn-primary admin-btn-small"
                  onClick={handleBulkApprove}
                  disabled={bulkBusy}
                >
                  {bulkBusy ? 'جاري...' : 'موافقة على المحدد'}
                </button>
                <button
                  className="admin-btn admin-btn-danger admin-btn-small"
                  onClick={handleBulkReject}
                  disabled={bulkBusy}
                >
                  رفض المحدد
                </button>
                <button
                  className="admin-btn admin-btn-secondary admin-btn-small"
                  onClick={selection.clear}
                  disabled={bulkBusy}
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>
          )}

          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selection.allSelected}
                      onChange={selection.toggleAll}
                      aria-label="تحديد الكل"
                    />
                  </th>
                  <th>الاسم</th>
                  <th>النوع</th>
                  <th>المدينة</th>
                  <th>المالك</th>
                  <th>تاريخ الإرسال</th>
                  <th style={{ textAlign: 'left' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((listing) => (
                  <tr key={listing._id} className={selection.isSelected(listing._id) ? 'is-selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selection.isSelected(listing._id)}
                        onChange={() => selection.toggle(listing._id)}
                        aria-label={`تحديد ${listing.name_ar}`}
                      />
                    </td>
                    <td>
                      <div className="admin-pending-name">
                        {listing.images?.length ? (
                          <img className="admin-row-thumb" src={listing.images[0]} alt="" loading="lazy" />
                        ) : (
                          <span className="admin-row-thumb empty" title="لا توجد صور">—</span>
                        )}
                        <div>
                          <div className="admin-table-name">{listing.name_ar}</div>
                          <div className="admin-table-sub" dir="ltr">{listing.name_en}</div>
                        </div>
                      </div>
                    </td>
                    <td>{TYPE_LABELS[listing.type] || listing.type}</td>
                    <td>{cityLabel(listing.city)}</td>
                    <td>
                      <div className="admin-table-name">{listing.ownerName || '—'}</div>
                      <div className="admin-table-sub" dir="ltr">{listing.ownerEmail}</div>
                    </td>
                    <td>{formatDate(listing.createdAt)}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          onClick={() => handleApprove(listing)}
                          className="admin-action-btn edit"
                          disabled={busyId === listing._id}
                        >
                          {busyId === listing._id ? 'جاري...' : 'موافقة'}
                        </button>
                        <button
                          onClick={() => handleReject(listing)}
                          className="admin-action-btn delete"
                          disabled={busyId === listing._id}
                        >
                          رفض
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {confirmDialog}
    </motion.div>
  )
}
