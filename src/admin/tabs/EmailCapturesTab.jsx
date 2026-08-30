import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { formatDateTime } from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

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
        <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '48px' }}>#</TableHead>
                <TableHead>البريد الإلكتروني</TableHead>
                <TableHead>المصدر</TableHead>
                <TableHead>التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {emails.map((entry, index) => (
                <TableRow key={entry._id}>
                  <TableCell className="admin-table-sub">{index + 1}</TableCell>
                  <TableCell data-label="البريد الإلكتروني" className="admin-table-name" dir="ltr">{entry.email}</TableCell>
                  <TableCell data-label="المصدر"><span className="admin-badge gray">{entry.source || '—'}</span></TableCell>
                  <TableCell data-label="التاريخ" className="admin-table-sub">{formatDateTime(entry.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      )}
    </motion.div>
  )
}
