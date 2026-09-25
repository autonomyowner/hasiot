import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import FilterSelect from '../components/FilterSelect'
import {
  REPORT_REASONS_AR,
  REPORT_STATUSES,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_TYPES_AR,
  contentStatusLabel,
  formatDate,
  personName,
  realEmail,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

/**
 * What taking a reported item down means for it, by what it is and where it
 * stands.
 *
 * Only a live listing or service can be suspended — reinstating sets
 * "approved", so suspending a submission would be a way to publish it
 * unreviewed, and the server refuses it. A reported item still waiting for
 * review is rejected instead. One already suspended or rejected is off the app
 * already, so there is nothing left to take down. A review is removed, which
 * recomputes the rating it counted towards.
 */
function takedownFor(report) {
  const target = report.target
  if (!target) return null
  if (report.targetType === 'listing') {
    if (!target.status || target.status === 'approved') return 'suspendListing'
    if (target.status === 'pending') return 'rejectListing'
    return null
  }
  if (report.targetType === 'service') {
    if (target.status === 'approved') return 'suspendService'
    if (target.status === 'pending') return 'rejectService'
    return null
  }
  if (report.targetType === 'review') return 'removeReview'
  return null
}

// A sentence per filter: the status words do not read as one adjective.
const EMPTY_TEXT = {
  pending: 'لا توجد تبليغات مفتوحة',
  actioned: 'لا توجد تبليغات اتُّخذ فيها إجراء',
  dismissed: 'لا توجد تبليغات مرفوضة',
  reviewed: 'لا توجد تبليغات تمت مراجعتها',
}
const COUNT_TEXT = {
  pending: (n) => `${n} تبليغ مفتوح بانتظار قرارك`,
  actioned: (n) => `${n} تبليغ اتُّخذ فيه إجراء`,
  dismissed: (n) => `${n} تبليغ مرفوض`,
  reviewed: (n) => `${n} تبليغ تمت مراجعته`,
}

const TAKEDOWN_LABELS = {
  suspendListing: 'إيقاف المكان',
  rejectListing: 'رفض المكان',
  suspendService: 'إيقاف الخدمة',
  rejectService: 'رفض الخدمة',
  removeReview: 'حذف التقييم',
}

/**
 * User-submitted content reports (the UGC-compliance queue both stores require).
 *
 * The takedown runs first and the report is closed after it — in that order,
 * so a failure to take the content down leaves the report open rather than
 * closing a report whose content is still live. (removeReview closes every
 * open report about its review itself.) Each dialog says who will be told:
 * the owner of a listing or service is notified with the reason; a review's
 * author is not, because there is no such notice.
 */
export default function ReportsTab() {
  const [status, setStatus] = useState('pending')
  const reports = useQuery(api.moderation.queries.listPendingReports, { status })
  const resolveReport = useMutation(api.moderation.mutations.resolveReport)
  const rejectContent = useMutation(api.admin.mutations.rejectContent)
  const rejectService = useMutation(api.admin.mutations.rejectService)
  const suspendListing = useMutation(api.admin.mutations.suspendListing)
  const suspendService = useMutation(api.admin.mutations.suspendService)
  const removeReview = useMutation(api.admin.mutations.removeReview)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [busyId, setBusyId] = useState(null)

  const handleDismiss = async (report) => {
    const ok = await confirm({
      title: 'رفض هذا التبليغ؟',
      message: 'سيبقى المحتوى المبلغ عنه كما هو، ويُغلق التبليغ.',
      confirmLabel: 'رفض التبليغ',
    })
    if (!ok) return

    setBusyId(report._id)
    try {
      await resolveReport({ reportId: report._id, status: 'dismissed' })
      toast.success('تم رفض التبليغ')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  // Nothing to take down: a planner reply lives only on the phone, and a
  // listing or service already suspended or rejected is off the app already.
  const handleReviewed = async (report) => {
    setBusyId(report._id)
    try {
      await resolveReport({ reportId: report._id, status: 'reviewed' })
      toast.success('أُغلق التبليغ بعد المراجعة')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleTakedown = async (report) => {
    const kind = takedownFor(report)
    const target = report.target
    const title = target?.title || 'المحتوى'
    const reasonLabel = REPORT_REASONS_AR[report.reason] || 'مخالفة'
    // A seed listing has no owner, so there is nobody to tell.
    const ownerNote = report.targetType === 'listing' && !target?.ownerId
      ? 'لا يوجد صاحب مرتبط بهذا المكان لإشعاره.'
      : 'سيتم إشعار صاحب المحتوى بالسبب.'

    const dialogs = {
      suspendListing: {
        title: 'إيقاف هذا المكان؟',
        message: `سيختفي "${title}" من التطبيق ولن يقبل حجوزات جديدة، والحجوزات القائمة لا تتأثر. ${ownerNote}`,
        confirmLabel: 'إيقاف المكان',
        reason: { label: 'سبب الإيقاف', required: true, initial: `تبليغ: ${reasonLabel}` },
      },
      rejectListing: {
        title: 'رفض هذا المكان؟',
        message: `"${title}" لم يُنشر بعد (قيد المراجعة)، فيُرفض بدل أن يُوقف. ${ownerNote}`,
        confirmLabel: 'رفض المكان',
        reason: { label: 'سبب الرفض', initial: `تبليغ: ${reasonLabel}` },
      },
      suspendService: {
        title: 'إيقاف هذه الخدمة؟',
        message: `ستختفي "${title}" من التطبيق ولن تقبل حجوزات جديدة، والحجوزات القائمة لا تتأثر. ${ownerNote}`,
        confirmLabel: 'إيقاف الخدمة',
        reason: { label: 'سبب الإيقاف', required: true, initial: `تبليغ: ${reasonLabel}` },
      },
      rejectService: {
        title: 'رفض هذه الخدمة؟',
        message: `"${title}" لم تُنشر بعد (قيد المراجعة)، فتُرفض بدل أن تُوقف. ${ownerNote}`,
        confirmLabel: 'رفض الخدمة',
        reason: { label: 'سبب الرفض', initial: `تبليغ: ${reasonLabel}` },
      },
      removeReview: {
        title: 'حذف هذا التقييم؟',
        message: `سيُحذف التقييم${target?.reviewOf ? ` عن "${target.reviewOf.title}"` : ''} ويُعاد حساب التقييم العام، وتُغلق كل التبليغات المفتوحة عنه. لن يُرسل إشعار لكاتب التقييم.`,
        confirmLabel: 'حذف التقييم',
        reason: { label: 'سبب الحذف (يُحفظ في السجل)', required: true, initial: `تبليغ: ${reasonLabel}` },
      },
    }

    const result = await confirm({ ...dialogs[kind], destructive: true })
    if (!result) return

    setBusyId(report._id)
    try {
      if (kind === 'removeReview') {
        await removeReview({ reviewId: report.targetId, reason: result.reason, reportId: report._id })
      } else {
        if (kind === 'suspendListing') await suspendListing({ id: report.targetId, reason: result.reason })
        if (kind === 'rejectListing') await rejectContent({ id: report.targetId, reason: result.reason || undefined })
        if (kind === 'suspendService') await suspendService({ serviceId: report.targetId, reason: result.reason })
        if (kind === 'rejectService') await rejectService({ id: report.targetId, reason: result.reason || undefined })
        await resolveReport({ reportId: report._id, status: 'actioned' })
      }
      toast.success(`تم: ${TAKEDOWN_LABELS[kind]}، وأُغلق التبليغ`)
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  if (reports === undefined) return <TableSkeleton rows={4} cols={7} />

  const emptyText = EMPTY_TEXT[status] || 'لا توجد تبليغات'

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title">التبليغات</h2>
          <p className="admin-page-subtitle">
            {reports.length === 0 ? emptyText : (COUNT_TEXT[status] || String)(reports.length)}
            {reports.length >= 200 ? ' — تُعرض أحدث 200' : ''}
          </p>
        </div>
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
          title={emptyText}
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
            {reports.map((report) => {
              const takedown = report.status === 'pending' ? takedownFor(report) : null
              const busy = busyId === report._id
              return (
                <TableRow key={report._id} className={busy ? 'is-busy' : ''}>
                  <TableCell data-label="المحتوى" className="admin-cell-wrap">
                    <ReportedContent report={report} />
                  </TableCell>
                  <TableCell data-label="النوع">
                    {REPORT_TARGET_TYPES_AR[report.targetType] || 'أخرى'}
                  </TableCell>
                  <TableCell data-label="السبب">{REPORT_REASONS_AR[report.reason] || 'أخرى'}</TableCell>
                  <TableCell data-label="التفاصيل" className="admin-cell-wrap">
                    {/* A planner report's details are the message itself,
                        shown as the reported content. */}
                    {report.targetType === 'ai_message' ? '—' : report.details || '—'}
                  </TableCell>
                  <TableCell data-label="المُبلِّغ">
                    {report.reporter ? (
                      <>
                        <div className="admin-table-name">{personName(report.reporter)}</div>
                        {realEmail(report.reporter.email) && (
                          <div className="admin-table-sub" dir="ltr">{report.reporter.email}</div>
                        )}
                      </>
                    ) : (
                      <span className="admin-table-sub">حساب محذوف</span>
                    )}
                  </TableCell>
                  <TableCell data-label="التاريخ">{formatDate(report.createdAt)}</TableCell>
                  <TableCell>
                    {report.status === 'pending' ? (
                      <div className="admin-actions">
                        {takedown ? (
                          <button
                            onClick={() => handleTakedown(report)}
                            className="admin-action-btn delete"
                            disabled={busy}
                          >
                            {busy ? 'جاري...' : TAKEDOWN_LABELS[takedown]}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReviewed(report)}
                            className="admin-action-btn"
                            disabled={busy}
                            title={report.targetType === 'ai_message'
                              ? 'الرسالة محفوظة على هاتف المستخدم فقط، فلا يوجد ما يُحذف'
                              : 'المحتوى غير منشور حاليًا'}
                          >
                            تمت المراجعة
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(report)}
                          className="admin-action-btn edit"
                          disabled={busy}
                        >
                          رفض التبليغ
                        </button>
                      </div>
                    ) : (
                      <span className="admin-table-sub">
                        {REPORT_STATUS_LABELS[report.status] || report.status}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}

      {confirmDialog}
    </motion.div>
  )
}

/** The reported item, drawn for what it is. */
function ReportedContent({ report }) {
  const target = report.target
  if (!target) return <span className="admin-badge gray">المحتوى محذوف</span>

  if (report.targetType === 'review') {
    return (
      <>
        <div className="admin-table-name admin-clamp">
          {target.title ? `«${target.title}»` : 'تقييم بلا نص'}
        </div>
        <div className="admin-table-sub">
          التقييم: <span dir="ltr">{target.subtitle}</span>
          {target.reviewOf && (
            <> · عن {REPORT_TARGET_TYPES_AR[target.reviewOf.type]}: {target.reviewOf.title}</>
          )}
        </div>
      </>
    )
  }

  if (report.targetType === 'ai_message') {
    return (
      <>
        <div className="admin-table-name admin-clamp">
          {target.title ? `«${target.title}»` : 'رسالة بلا نص'}
        </div>
        <div className="admin-table-sub">رد من المساعد الذكي في تطبيق المستخدم</div>
      </>
    )
  }

  const statusText = contentStatusLabel(report.targetType, target.status)
  return (
    <>
      <div className="admin-table-name">{target.title || '—'}</div>
      <div className="admin-table-sub">
        {target.subtitle && <span dir="ltr">{target.subtitle}</span>}
        {statusText ? ` · ${statusText}` : ''}
      </div>
    </>
  )
}
