import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '../../../convex/_generated/api'
import { EmptyState, KeepLooking, LoadMore, TableSkeleton } from '../components/States'
import FilterSelect from '../components/FilterSelect'
import { usePagedList } from '../usePagedList'
import {
  ACTIVITY_ACTION_LABELS,
  ACTIVITY_TARGET_LABELS,
  ACTIVITY_TONE,
  activityDetails,
  activitySummary,
  formatDateTime,
  formatRelative,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

const PAGE_SIZE = 30

/**
 * The admin action log.
 *
 * Until now nothing recorded who did what: a listing that vanished or an account
 * that was approved left no trace beyond the changed document. Rows are written
 * inside the same transaction as the action, so the log cannot claim something
 * that did not commit.
 *
 * The labels live in constants.js, with the helpers that put a row's details
 * into Arabic: the server writes status and role changes with their stored keys
 * ("confirmed → cancelled"), which read as English in an Arabic table.
 */
export default function ActivityTab() {
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')

  const log = usePagedList(
    api.admin.queries.listAdminActivity,
    { action: action || undefined, targetType: targetType || undefined },
    PAGE_SIZE
  )

  const loading =
    log.status === 'LoadingFirstPage' || (log.results.length === 0 && log.status === 'LoadingMore')
  const stalled = log.results.length === 0 && log.status === 'CanLoadMore'
  const hasFilters = Boolean(action || targetType)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title">سجل الإجراءات</h2>
          <p className="admin-page-subtitle">
            {loading
              ? 'جاري التحميل...'
              : `${log.results.length} إجراء معروض${log.status === 'CanLoadMore' ? ' — هناك المزيد' : ''}`}
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <FilterSelect
          value={action}
          onChange={setAction}
          placeholder="كل الإجراءات"
          options={[
            { value: '', label: 'كل الإجراءات' },
            ...Object.entries(ACTIVITY_ACTION_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <FilterSelect
          value={targetType}
          onChange={setTargetType}
          placeholder="كل الأنواع"
          options={[
            { value: '', label: 'كل الأنواع' },
            ...Object.entries(ACTIVITY_TARGET_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        {hasFilters && (
          <button
            className="admin-btn admin-btn-secondary admin-btn-small"
            onClick={() => { setAction(''); setTargetType('') }}
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={5} />
      ) : stalled ? (
        <KeepLooking onLoadMore={log.loadMore} />
      ) : log.results.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'لا توجد إجراءات مطابقة' : 'السجل فارغ'}
          hint={hasFilters
            ? 'جرّب فلاتر أخرى.'
            : 'سيظهر هنا كل إجراء تقوم به: الموافقات، التعديلات، الحذف، وتحديثات الحجوزات.'}
        />
      ) : (
        <>
          <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '160px' }}>الوقت</TableHead>
                <TableHead>الإجراء</TableHead>
                <TableHead>العنصر</TableHead>
                <TableHead>المدير</TableHead>
                <TableHead>ملاحظات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.results.map((row) => (
                <TableRow key={row._id}>
                  <TableCell data-label="الوقت" title={formatDateTime(row.createdAt)}>
                    <div className="admin-table-name">{formatRelative(row.createdAt)}</div>
                    <div className="admin-table-sub">{formatDateTime(row.createdAt)}</div>
                  </TableCell>
                  <TableCell data-label="الإجراء">
                    <span className={`admin-badge ${ACTIVITY_TONE[row.action] || 'blue'}`}>
                      {ACTIVITY_ACTION_LABELS[row.action] || 'إجراء آخر'}
                    </span>
                  </TableCell>
                  <TableCell data-label="العنصر">
                    <div className="admin-table-name">{activitySummary(row)}</div>
                    <div className="admin-table-sub">
                      {ACTIVITY_TARGET_LABELS[row.targetType] || row.targetType}
                    </div>
                  </TableCell>
                  <TableCell data-label="المدير" className="admin-table-sub" dir="ltr">{row.adminEmail}</TableCell>
                  <TableCell data-label="ملاحظات" className="admin-table-sub admin-cell-wrap">
                    {activityDetails(row) || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <LoadMore status={log.status} onLoadMore={log.loadMore} cols={5} />
        </>
      )}
    </motion.div>
  )
}
