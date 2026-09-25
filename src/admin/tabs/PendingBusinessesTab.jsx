import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import FilterSelect from '../components/FilterSelect'
import { EmptyState, TableSkeleton } from '../components/States'
import { useSelection, describeBulkResult } from '../useSelection'
import { businessTypeLabel, formatDate, personName, realEmail, roleLabel } from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

/**
 * Where an unapproved business or provider account stands. Only "ready" is
 * work for an admin: the other two are waiting on their owner, and the
 * dashboard's queue counts only the ready ones (queues.accounts).
 */
function accountState(user) {
  if (user.accountRejectionReason) return 'rejected'
  if (!(user.hasDocument ?? Boolean(user.cvFileId))) return 'noDocument'
  return 'ready'
}

const STATE_BADGES = {
  ready: { label: 'جاهز للمراجعة', color: 'green' },
  noDocument: { label: 'بدون وثيقة', color: 'yellow' },
  rejected: { label: 'مرفوض — بانتظار وثيقة جديدة', color: 'red' },
}

/**
 * Business and service-provider accounts awaiting verification.
 *
 * Approving here is what lets an account post anything at all, and the uploaded
 * licence is the evidence. The document lives in Convex file storage under
 * `cvFileId` and is only ever resolved to a URL for an admin, through
 * users/queries:getBusinessDocUrl.
 *
 * An account that could not be approved used to sit in this list for ever: no
 * document meant a greyed-out button nobody could explain, and there was no
 * way to say no. Each row now says where it stands, «رفض» sends the owner a
 * reason they see on their verification screen (uploading a new document
 * clears it and brings the account back), and the list opens on the accounts
 * that are actually ready for a decision.
 */
export default function PendingBusinessesTab() {
  const pending = useQuery(api.admin.queries.listPendingBusinesses)
  const approveBusiness = useMutation(api.users.mutations.approveBusinessAccount)
  const rejectBusiness = useMutation(api.admin.mutations.rejectBusinessAccount)
  const bulkApprove = useMutation(api.admin.mutations.bulkApproveBusinesses)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [view, setView] = useState('ready')
  const [busyId, setBusyId] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const all = pending ?? []
  const counts = {
    ready: all.filter((u) => accountState(u) === 'ready').length,
    noDocument: all.filter((u) => accountState(u) === 'noDocument').length,
    rejected: all.filter((u) => accountState(u) === 'rejected').length,
  }
  const rows = view ? all.filter((u) => accountState(u) === view) : all
  const selection = useSelection(pending === undefined ? undefined : rows)

  const handleApprove = async (user) => {
    const ok = await confirm({
      title: 'اعتماد هذا الحساب؟',
      message: `سيتمكن "${personName(user)}" من نشر المحتوى في التطبيق بعد الاعتماد، وسيتم إشعاره. راجع الوثيقة أولاً.`,
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

  const handleReject = async (user) => {
    const result = await confirm({
      title: 'رفض هذا الحساب؟',
      message: `سيرى "${personName(user)}" سبب الرفض في شاشة التوثيق في التطبيق مع إشعار بالرفض، ويعود طلبه إلى هنا عندما يرفع وثيقة جديدة.`,
      confirmLabel: 'رفض الحساب',
      destructive: true,
      reason: {
        label: 'سبب الرفض (يظهر لصاحب الحساب)',
        placeholder: 'مثال: الوثيقة غير واضحة أو منتهية الصلاحية',
        required: true,
      },
    })
    if (!result) return

    setBusyId(user._id)
    try {
      await rejectBusiness({ userId: user._id, reason: result.reason })
      toast.success('تم رفض الحساب وإبلاغ صاحبه بالسبب')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleBulkApprove = async () => {
    const ok = await confirm({
      title: `اعتماد ${selection.count} حساب؟`,
      message: 'الحسابات التي لم ترفع وثيقة عمل سيتم تخطيها. سيتم إشعار أصحاب الحسابات المعتمدة.',
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

  const viewOptions = [
    { value: 'ready', label: `جاهزة للمراجعة (${counts.ready})` },
    { value: 'noDocument', label: `بدون وثيقة (${counts.noDocument})` },
    { value: 'rejected', label: `مرفوضة (${counts.rejected})` },
    { value: '', label: `الكل (${all.length})` },
  ]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title">الحسابات</h2>
          <p className="admin-page-subtitle">
            {`${counts.ready} جاهز للمراجعة · ${counts.noDocument} بدون وثيقة · ${counts.rejected} مرفوض`}
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <FilterSelect value={view} onChange={setView} placeholder="الحالة" options={viewOptions} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={
            view === 'ready' ? 'لا توجد حسابات جاهزة للمراجعة'
              : view === 'noDocument' ? 'لا توجد حسابات بدون وثيقة'
                : view === 'rejected' ? 'لا توجد حسابات مرفوضة'
                  : 'لا توجد طلبات معلقة'
          }
          hint={view === 'ready'
            ? 'عندما يرفع صاحب منشأة أو مقدم خدمة وثيقته من التطبيق، يظهر طلبه هنا.'
            : 'عندما يطلب مستخدم ترقية حسابه إلى صاحب منشأة أو مقدم خدمة من التطبيق، يظهر طلبه هنا.'}
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
                <TableHead>الدور</TableHead>
                <TableHead>نوع النشاط</TableHead>
                <TableHead>وثيقة العمل</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>تاريخ التسجيل</TableHead>
                <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => {
                const state = accountState(user)
                const hasDocument = user.hasDocument ?? Boolean(user.cvFileId)
                return (
                  <TableRow key={user._id} className={selection.isSelected(user._id) ? 'is-selected' : ''}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selection.isSelected(user._id)}
                        onChange={() => selection.toggle(user._id)}
                        aria-label={`تحديد ${personName(user)}`}
                      />
                    </TableCell>
                    <TableCell data-label="الاسم">
                      <div className="admin-table-name">{personName(user)}</div>
                      {realEmail(user.email) ? (
                        <div className="admin-table-sub" dir="ltr">{user.email}</div>
                      ) : user.phone ? (
                        <div className="admin-table-sub" dir="ltr">{user.phone}</div>
                      ) : null}
                    </TableCell>
                    <TableCell data-label="الدور">{roleLabel(user.role)}</TableCell>
                    <TableCell data-label="نوع النشاط">{businessTypeLabel(user.businessType)}</TableCell>
                    <TableCell data-label="وثيقة العمل">
                      {hasDocument ? (
                        <BusinessDocLink fileId={user.cvFileId} />
                      ) : (
                        <span className="admin-badge yellow">بدون وثيقة</span>
                      )}
                    </TableCell>
                    <TableCell data-label="الحالة" className="admin-cell-wrap">
                      <span className={`admin-badge ${STATE_BADGES[state].color}`}>{STATE_BADGES[state].label}</span>
                      {user.accountRejectionReason && (
                        <div className="admin-table-sub">سبب الرفض: {user.accountRejectionReason}</div>
                      )}
                    </TableCell>
                    <TableCell data-label="تاريخ التسجيل">{formatDate(user.createdAt)}</TableCell>
                    <TableCell>
                      <div className="admin-actions">
                        <button
                          className="admin-action-btn edit"
                          onClick={() => handleApprove(user)}
                          disabled={busyId === user._id || !hasDocument}
                          title={!hasDocument ? 'لا يمكن الاعتماد قبل رفع وثيقة العمل' : undefined}
                        >
                          {busyId === user._id ? 'جاري...' : 'اعتماد'}
                        </button>
                        <button
                          className="admin-action-btn delete"
                          onClick={() => handleReject(user)}
                          disabled={busyId === user._id}
                        >
                          رفض
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
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
