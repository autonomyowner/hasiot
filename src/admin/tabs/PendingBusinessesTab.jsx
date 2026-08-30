import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { useSelection, describeBulkResult } from '../useSelection'
import { ROLE_LABELS, formatDate } from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

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

          <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={selection.allSelected}
                      onChange={selection.toggleAll}
                      aria-label="تحديد الكل"
                    />
                  </TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead>الدور</TableHead>
                  <TableHead>نوع النشاط</TableHead>
                  <TableHead>وثيقة العمل</TableHead>
                  <TableHead>تاريخ التسجيل</TableHead>
                  <TableHead style={{ textAlign: 'left' }}>إجراء</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((user) => (
                  <TableRow key={user._id} className={selection.isSelected(user._id) ? 'is-selected' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selection.isSelected(user._id)}
                        onChange={() => selection.toggle(user._id)}
                        aria-label={`تحديد ${displayName(user)}`}
                      />
                    </TableCell>
                    <TableCell data-label="الاسم" className="admin-table-name">{displayName(user)}</TableCell>
                    <TableCell data-label="البريد الإلكتروني" dir="ltr">{user.email}</TableCell>
                    <TableCell data-label="الدور">{ROLE_LABELS[user.role] || user.role}</TableCell>
                    <TableCell data-label="نوع النشاط">{user.businessType || '—'}</TableCell>
                    <TableCell data-label="وثيقة العمل">
                      {user.cvFileId ? (
                        <BusinessDocLink fileId={user.cvFileId} />
                      ) : (
                        <span className="admin-badge yellow">لم تُرفع بعد</span>
                      )}
                    </TableCell>
                    <TableCell data-label="تاريخ التسجيل">{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <button
                        className="admin-btn admin-btn-primary admin-btn-small"
                        onClick={() => handleApprove(user)}
                        disabled={busyId === user._id || !user.cvFileId}
                        title={!user.cvFileId ? 'لا يمكن الاعتماد قبل رفع وثيقة العمل' : ''}
                      >
                        {busyId === user._id ? 'جاري...' : 'اعتماد'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
