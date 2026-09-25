import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { emailSourceLabel, formatDateTime, todayISO } from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

// emailCaptures/queries:listAll returns the newest this many.
const SERVER_CAP = 500

/**
 * One CSV cell. Quoted when it holds a comma, a quote or a line break; and an
 * address typed into a public form that starts with = + - or @ is prefixed
 * with an apostrophe, so a spreadsheet opens it as text instead of running it
 * as a formula.
 */
function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

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

  // A file rather than the clipboard, for a mailing tool or a spreadsheet.
  // The byte-order mark is what makes Excel read the Arabic headers as UTF-8
  // instead of mojibake.
  const exportCsv = () => {
    const header = ['البريد الإلكتروني', 'المصدر', 'تاريخ التسجيل']
    const rows = emails.map((entry) => [
      entry.email,
      emailSourceLabel(entry.source),
      new Date(entry.createdAt).toISOString(),
    ])
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')

    try {
      const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `hasio-emails-${todayISO()}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Revoked on the next tick: the download has been handed off by then.
      setTimeout(() => URL.revokeObjectURL(url), 0)
      toast.success(`تم تصدير ${emails.length} عنوان`)
    } catch (error) {
      console.error('[admin] CSV export failed:', error)
      toast.error('تعذّر إنشاء الملف. جرّب «نسخ كل العناوين» بدلًا من ذلك.')
    }
  }

  if (emails === undefined) return <TableSkeleton rows={5} cols={4} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <div>
          <h2 className="admin-page-title">تسجيلات البريد الإلكتروني</h2>
          <p className="admin-page-subtitle">
            {emails.length} تسجيل{emails.length >= SERVER_CAP ? ` — تُعرض أحدث ${SERVER_CAP}` : ''}
          </p>
        </div>
        {emails.length > 0 && (
          <div className="admin-actions">
            <button className="admin-btn admin-btn-secondary" onClick={copyAll}>
              نسخ كل العناوين
            </button>
            <button className="admin-btn admin-btn-primary" onClick={exportCsv}>
              تصدير CSV
            </button>
          </div>
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
                <TableCell data-label="المصدر">
                  <span className="admin-badge gray" title={entry.source || undefined}>
                    {emailSourceLabel(entry.source)}
                  </span>
                </TableCell>
                <TableCell data-label="التاريخ" className="admin-table-sub">{formatDateTime(entry.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </motion.div>
  )
}
