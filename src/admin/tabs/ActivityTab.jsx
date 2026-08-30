import { useState } from 'react'
import { motion } from 'framer-motion'
import { usePaginatedQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { EmptyState, TableSkeleton } from '../components/States'
import { formatDateTime, formatRelative } from '../constants'

const PAGE_SIZE = 30

// Keys are the `action` strings written by convex/admin/activity.ts.
const ACTION_LABELS = {
  'listing.create': 'إضافة مكان',
  'listing.update': 'تعديل مكان',
  'listing.delete': 'حذف مكان',
  'listing.import': 'استيراد أماكن',
  'listing.hours': 'تحديث أوقات العمل',
  'content.approve': 'الموافقة على محتوى',
  'content.reject': 'رفض محتوى',
  'service.approve': 'الموافقة على خدمة',
  'service.reject': 'رفض خدمة',
  'account.approve': 'اعتماد حساب',
  'knowledge.create': 'إضافة معلومة',
  'knowledge.update': 'تعديل معلومة',
  'knowledge.delete': 'حذف معلومة',
  'booking.confirmed': 'تأكيد حجز',
  'booking.completed': 'إتمام حجز',
  'booking.cancelled': 'إلغاء حجز',
  'booking.no_show': 'تسجيل عدم حضور',
  'booking.pending': 'إرجاع حجز للانتظار',
  'report.actioned': 'إزالة محتوى مبلغ عنه',
  'report.dismissed': 'رفض تبليغ',
  'report.reviewed': 'مراجعة تبليغ',
}

const TARGET_LABELS = {
  listing: 'مكان',
  service: 'خدمة',
  user: 'حساب',
  booking: 'حجز',
  knowledge: 'معلومة',
  report: 'تبليغ',
}

// Destructive actions are tinted so a scan down the log finds them first.
const TONE = {
  'listing.delete': 'red',
  'knowledge.delete': 'red',
  'content.reject': 'red',
  'service.reject': 'red',
  'booking.cancelled': 'red',
  'report.actioned': 'red',
  'content.approve': 'green',
  'service.approve': 'green',
  'account.approve': 'green',
  'booking.confirmed': 'green',
  'booking.completed': 'green',
}

/**
 * The admin action log.
 *
 * Until now nothing recorded who did what: a listing that vanished or an account
 * that was approved left no trace beyond the changed document. Rows are written
 * inside the same transaction as the action, so the log cannot claim something
 * that did not commit.
 */
export default function ActivityTab() {
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')

  const log = usePaginatedQuery(
    api.admin.queries.listAdminActivity,
    { action: action || undefined, targetType: targetType || undefined },
    { initialNumItems: PAGE_SIZE }
  )

  if (log.status === 'LoadingFirstPage') return <TableSkeleton rows={6} cols={4} />

  const hasFilters = Boolean(action || targetType)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <div>
          <h2 className="admin-page-title" style={{ margin: 0 }}>سجل الإجراءات</h2>
          <p className="admin-page-subtitle">كل إجراء يقوم به المديرون من هذه اللوحة</p>
        </div>
      </div>

      <div className="admin-filters">
        <select value={action} onChange={(e) => setAction(e.target.value)} className="admin-form-select">
          <option value="">كل الإجراءات</option>
          {Object.entries(ACTION_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select value={targetType} onChange={(e) => setTargetType(e.target.value)} className="admin-form-select">
          <option value="">كل الأنواع</option>
          {Object.entries(TARGET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            className="admin-btn admin-btn-secondary admin-btn-small"
            onClick={() => { setAction(''); setTargetType('') }}
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      {log.results.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'لا توجد إجراءات مطابقة' : 'السجل فارغ'}
          hint={hasFilters
            ? 'جرّب فلاتر أخرى.'
            : 'سيظهر هنا كل إجراء تقوم به: الموافقات، التعديلات، الحذف، وتحديثات الحجوزات.'}
        />
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>الوقت</th>
                  <th>الإجراء</th>
                  <th>العنصر</th>
                  <th>المدير</th>
                  <th>ملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {log.results.map((row) => (
                  <tr key={row._id}>
                    <td data-label="الوقت" title={formatDateTime(row.createdAt)}>
                      <div className="admin-table-name">{formatRelative(row.createdAt)}</div>
                      <div className="admin-table-sub">{formatDateTime(row.createdAt)}</div>
                    </td>
                    <td data-label="الإجراء">
                      <span className={`admin-badge ${TONE[row.action] || 'blue'}`}>
                        {ACTION_LABELS[row.action] || row.action}
                      </span>
                    </td>
                    <td data-label="العنصر">
                      <div className="admin-table-name">{row.summary || '—'}</div>
                      <div className="admin-table-sub">
                        {TARGET_LABELS[row.targetType] || row.targetType}
                      </div>
                    </td>
                    <td data-label="المدير" className="admin-table-sub" dir="ltr">{row.adminEmail}</td>
                    <td data-label="ملاحظات" className="admin-table-sub">{row.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {log.status === 'CanLoadMore' && (
            <div className="admin-load-more">
              <button className="admin-btn admin-btn-secondary" onClick={() => log.loadMore(PAGE_SIZE)}>
                تحميل المزيد
              </button>
            </div>
          )}
          {log.status === 'LoadingMore' && <TableSkeleton rows={2} cols={5} />}
        </>
      )}
    </motion.div>
  )
}
