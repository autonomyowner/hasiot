import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import FilterSelect from '../components/FilterSelect'
import {
  REPORT_REASONS_AR, REPORT_STATUSES, REPORT_TARGET_TYPES_AR, formatDate,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

/**
 * User-submitted content reports (the UGC-compliance queue both stores require).
 *
 * "إزالة المحتوى" rejects the reported item and then closes the report — in that
 * order, so a failure to unpublish leaves the report open rather than closing a
 * report whose content is still live.
 */
export default function ReportsTab() {
  const [status, setStatus] = useState('pending')
  const reports = useQuery(api.moderation.queries.listPendingReports, { status })
  const resolveReport = useMutation(api.moderation.mutations.resolveReport)
  const rejectContent = useMutation(api.admin.mutations.rejectContent)
  const rejectService = useMutation(api.admin.mutations.rejectService)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [busyId, setBusyId] = useState(null)

  const handleDismiss = async (report) => {
    const ok = await confirm({
      title: 'رفض هذا التبليغ؟',
      message: 'سيبقى المحتوى المبلغ عنه منشوراً كما هو.',
      confirmLabel: 'رفض التبليغ',
    })
    if (!ok) return

    setBusyId(report._id)
    try {
      await resolveReport({ reportId: report._id, status: 'dismissed' })
      toast.success('تم إغلاق التبليغ')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleTakedown = async (report) => {
    const ok = await confirm({
      title: 'إزالة المحتوى المبلغ عنه؟',
      message: `سيُخفى "${report.target?.title || 'المحتوى'}" من التطبيق ويُبلَّغ صاحبه بالسبب.`,
      confirmLabel: 'إزالة المحتوى',
      destructive: true,
    })
    if (!ok) return

    setBusyId(report._id)
    const reason = `تبليغ: ${REPORT_REASONS_AR[report.reason] || report.reason}`
    try {
      if (report.targetType === 'listing') {
        await rejectContent({ id: report.targetId, reason })
      } else if (report.targetType === 'service') {
        await rejectService({ id: report.targetId, reason })
      }
      await resolveReport({ reportId: report._id, status: 'actioned' })
      toast.success('تمت إزالة المحتوى وإغلاق التبليغ')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  if (reports === undefined) return <TableSkeleton rows={4} cols={7} />

  const statusLabel = REPORT_STATUSES.find((s) => s.value === status)?.label

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-section-header">
        <h2 className="admin-section-title">تبليغات المستخدمين</h2>
        <span className="admin-badge admin-badge-warning">{reports.length} تبليغ</span>
      </div>

      <div className="admin-filters">
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="الحالة"
          options={REPORT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title={`لا توجد تبليغات (${statusLabel})`}
          hint="التبليغات التي يرسلها المستخدمون من التطبيق عن محتوى مخالف تظهر هنا."
        />
      ) : (
        <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead>المحتوى المبلغ عنه</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>السبب</TableHead>
                <TableHead>التفاصيل</TableHead>
                <TableHead>المُبلِّغ</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report._id} className={busyId === report._id ? 'is-busy' : ''}>
                  <TableCell data-label="المحتوى">
                    {report.target ? (
                      <>
                        <div className="admin-table-name">{report.target.title || '—'}</div>
                        <div className="admin-table-sub">
                          {report.target.subtitle}
                          {report.target.status ? ` · ${report.target.status}` : ''}
                        </div>
                      </>
                    ) : (
                      <span className="admin-badge gray">المحتوى محذوف</span>
                    )}
                  </TableCell>
                  <TableCell data-label="النوع">{REPORT_TARGET_TYPES_AR[report.targetType] || report.targetType}</TableCell>
                  <TableCell data-label="السبب">{REPORT_REASONS_AR[report.reason] || report.reason}</TableCell>
                  <TableCell data-label="التفاصيل" style={{ maxWidth: '240px', whiteSpace: 'pre-wrap' }}>{report.details || '—'}</TableCell>
                  <TableCell data-label="المُبلِّغ">
                    {report.reporter ? (
                      <>
                        <div className="admin-table-name">
                          {[report.reporter.firstName, report.reporter.lastName].filter(Boolean).join(' ') || '—'}
                        </div>
                        <div className="admin-table-sub" dir="ltr">{report.reporter.email}</div>
                      </>
                    ) : (
                      <span className="admin-table-sub">—</span>
                    )}
                  </TableCell>
                  <TableCell data-label="التاريخ">{formatDate(report.createdAt)}</TableCell>
                  <TableCell>
                    {report.status === 'pending' ? (
                      <div className="admin-actions">
                        {report.target && report.targetType !== 'review' && (
                          <button
                            onClick={() => handleTakedown(report)}
                            className="admin-action-btn delete"
                            disabled={busyId === report._id}
                          >
                            {busyId === report._id ? 'جاري...' : 'إزالة المحتوى'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(report)}
                          className="admin-action-btn edit"
                          disabled={busyId === report._id}
                        >
                          رفض التبليغ
                        </button>
                      </div>
                    ) : (
                      <span className="admin-table-sub">
                        {REPORT_STATUSES.find((s) => s.value === report.status)?.label || report.status}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      )}

      {confirmDialog}
    </motion.div>
  )
}
