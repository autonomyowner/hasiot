import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { formatDateTime } from '../constants'

/** Early-access email signups. Read-only — these are only ever exported. */
export default function EmailCapturesTab() {
  const emails = useQuery(api.emailCaptures.queries.listAll)
  const toast = useToast()

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(emails.map((e) => e.email).join(', '))
      toast.success(`تم نسخ ${emails.length} عنوان بريد`)
    } catch {
      // Clipboard access is refused outside a secure context or when the
      // browser blocks it; say so rather than appearing to have copied.
      toast.error('تعذّر النسخ. انسخ العناوين يدوياً من الجدول.')
    }
  }

  if (emails === undefined) return <TableSkeleton rows={5} cols={4} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <div>
          <h2 className="admin-page-title" style={{ margin: 0 }}>تسجيلات البريد الإلكتروني</h2>
          <p className="admin-page-subtitle">{emails.length} تسجيل</p>
        </div>
        {emails.length > 0 && (
          <button className="admin-btn admin-btn-secondary" onClick={copyAll}>
            نسخ كل العناوين
          </button>
        )}
      </div>

      {emails.length === 0 ? (
        <EmptyState
          title="لا توجد تسجيلات بعد"
          hint="عناوين البريد التي يتركها الزوار للوصول المبكر تظهر هنا."
        />
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '48px' }}>#</th>
                <th>البريد الإلكتروني</th>
                <th>المصدر</th>
                <th>التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((entry, index) => (
                <tr key={entry._id}>
                  <td className="admin-table-sub">{index + 1}</td>
                  <td className="admin-table-name" dir="ltr">{entry.email}</td>
                  <td><span className="admin-badge gray">{entry.source || '—'}</span></td>
                  <td className="admin-table-sub">{formatDateTime(entry.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}
