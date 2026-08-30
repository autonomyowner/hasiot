import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { useSelection, describeBulkResult } from '../useSelection'
import { ROLE_LABELS, formatDate } from '../constants'

/**
 * Business and service-provider accounts awaiting verification.
 *
 * Approving here is what lets an account post anything at all, and the uploaded
 * licence is the evidence. The document lives in Convex file storage under
 * `cvFileId` and is only ever resolved to a URL for an admin, through
 * users/queries:getBusinessDocUrl.
 */
export default function PendingBusinessesTab() {
  const pending = useQuery(api.admin.queries.listPendingBusinesses)
  const approveBusiness = useMutation(api.users.mutations.approveBusinessAccount)
  const bulkApprove = useMutation(api.admin.mutations.bulkApproveBusinesses)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const selection = useSelection(pending)
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const displayName = (user) =>
    `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email

  const handleApprove = async (user) => {
    const ok = await confirm({
      title: 'اعتماد هذا الحساب؟',
      message: `سيتمكن "${displayName(user)}" من نشر المحتوى في التطبيق بعد الاعتماد. راجع الوثيقة أولاً.`,
      confirmLabel: 'اعتماد',
    })
    if (!ok) return

    setBusyId(user._id)
    try {
      await approveBusiness({ userId: user._id })
      toast.success('تم اعتماد الحساب')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleBulkApprove = async () => {
    const ok = await confirm({
      title: `اعتماد ${selection.count} حساب؟`,
      message: 'الحسابات التي لم ترفع وثيقة عمل سيتم تخطيها.',
      confirmLabel: 'اعتماد الكل',
    })
    if (!ok) return

    setBulkBusy(true)
    try {
      const outcome = await bulkApprove({ userIds: selection.selectedIds })
      toast.success(describeBulkResult(outcome, 'تم اعتماد'))
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
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="admin-section-header">
        <h2 className="admin-section-title">حسابات بانتظار الاعتماد</h2>
        <span className="admin-badge admin-badge-warning">{pending.length} طلب</span>
      </div>

      {pending.length === 0 ? (
        <EmptyState
          title="لا توجد طلبات معلقة"
          hint="عندما يطلب مستخدم ترقية حسابه إلى صاحب عمل أو مزود خدمة من التطبيق، يظهر طلبه هنا."
        />
      ) : (
        <>
          {selection.count > 0 && (
            <div className="admin-bulk-bar">
              <span>{selection.count} حساب محدد</span>
              <div className="admin-actions">
                <button
                  className="admin-btn admin-btn-primary admin-btn-small"
                  onClick={handleBulkApprove}
                  disabled={bulkBusy}
                >
                  {bulkBusy ? 'جاري...' : 'اعتماد المحدد'}
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
                  <th>البريد الإلكتروني</th>
                  <th>الدور</th>
                  <th>نوع النشاط</th>
                  <th>وثيقة العمل</th>
                  <th>تاريخ التسجيل</th>
                  <th style={{ textAlign: 'left' }}>إجراء</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((user) => (
                  <tr key={user._id} className={selection.isSelected(user._id) ? 'is-selected' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selection.isSelected(user._id)}
                        onChange={() => selection.toggle(user._id)}
                        aria-label={`تحديد ${displayName(user)}`}
                      />
                    </td>
                    <td className="admin-table-name">{displayName(user)}</td>
                    <td dir="ltr">{user.email}</td>
                    <td>{ROLE_LABELS[user.role] || user.role}</td>
                    <td>{user.businessType || '—'}</td>
                    <td>
                      {user.cvFileId ? (
                        <BusinessDocLink fileId={user.cvFileId} />
                      ) : (
                        <span className="admin-badge yellow">لم تُرفع بعد</span>
                      )}
                    </td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <button
                        className="admin-btn admin-btn-primary admin-btn-small"
                        onClick={() => handleApprove(user)}
                        disabled={busyId === user._id || !user.cvFileId}
                        title={!user.cvFileId ? 'لا يمكن الاعتماد قبل رفع وثيقة العمل' : ''}
                      >
                        {busyId === user._id ? 'جاري...' : 'اعتماد'}
                      </button>
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

function BusinessDocLink({ fileId }) {
  const docUrl = useQuery(api.users.queries.getBusinessDocUrl, { fileId })

  if (docUrl === undefined) {
    return <span className="admin-table-sub">جاري التحميل...</span>
  }
  if (!docUrl) {
    return <span className="admin-badge red">الملف مفقود</span>
  }

  return (
    <a
      href={docUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="admin-btn admin-btn-secondary admin-btn-small admin-doc-link"
    >
      عرض الوثيقة
    </a>
  )
}
