import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import ServiceDrawer from '../components/ServiceDrawer'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { useSelection, describeBulkResult } from '../useSelection'
import {
  SERVICE_TYPE_LABELS,
  cityLabel,
  formatDate,
  formatServicePrice,
  isPlaceholderEmail,
  realEmail,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

/**
 * Freelancer services (guides, photographers, drivers) awaiting a decision.
 *
 * A row opens the service in the drawer, and the decision is taken there, with
 * the photos, description, price and contact in front of whoever takes it. The
 * row used to offer «موافقة» beside a title and a price range, which is not
 * enough to judge what travellers are about to be shown. Bulk decisions stay
 * for clearing a queue already read.
 */
export default function ServiceApprovalTab() {
  const pending = useQuery(api.admin.queries.listPendingServices)
  const bulkApprove = useMutation(api.admin.mutations.bulkApproveServices)
  const bulkReject = useMutation(api.admin.mutations.bulkRejectServices)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const selection = useSelection(pending)
  const [bulkBusy, setBulkBusy] = useState(false)
  const [openId, setOpenId] = useState(null)

  const handleBulkApprove = async () => {
    const result = await confirm({
      title: `الموافقة على ${selection.count} خدمة؟`,
      message: 'ستظهر كل هذه الخدمات في التطبيق فوراً، وسيتم إشعار مقدميها.',
      confirmLabel: 'موافقة على الكل',
    })
    if (!result) return

    setBulkBusy(true)
    try {
      const outcome = await bulkApprove({ ids: selection.selectedIds })
      toast.success(describeBulkResult(outcome, 'تمت الموافقة على'))
      if (outcome.failed?.length) toast.error(outcome.failed[0].error)
      selection.clear()
    } catch (error) {
      toast.error(error)
    } finally {
      setBulkBusy(false)
    }
  }

  const handleBulkReject = async () => {
    const result = await confirm({
      title: `رفض ${selection.count} خدمة؟`,
      message: 'سيتلقى كل مقدم خدمة نفس السبب مع إشعار بالرفض.',
      confirmLabel: 'رفض الكل',
      destructive: true,
      reason: { label: 'سبب الرفض (اختياري)', placeholder: 'سبب واحد لكل الخدمات المحددة' },
    })
    if (!result) return

    setBulkBusy(true)
    try {
      const outcome = await bulkReject({
        ids: selection.selectedIds,
        reason: result.reason || undefined,
      })
      toast.success(describeBulkResult(outcome, 'تم رفض'))
      if (outcome.failed?.length) toast.error(outcome.failed[0].error)
      selection.clear()
    } catch (error) {
      toast.error(error)
    } finally {
      setBulkBusy(false)
    }
  }

  if (pending === undefined) return <TableSkeleton rows={4} cols={7} />

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title">طلبات الخدمات</h2>
          <p className="admin-page-subtitle">
            {pending.length === 0
              ? 'لا توجد خدمات بانتظار المراجعة'
              : `${pending.length} خدمة بانتظار قرارك — افتح الخدمة لمراجعتها قبل الموافقة`}
          </p>
        </div>
      </div>

      {pending.length === 0 ? (
        <EmptyState
          title="لا توجد خدمات بانتظار المراجعة"
          hint="خدمات المرشدين والمصورين والسائقين المرسلة من التطبيق تظهر هنا."
        />
      ) : (
        <>
          {selection.count > 0 && (
            <div className="admin-bulk-bar">
              <span>{selection.count} خدمة محددة</span>
              <div className="admin-actions">
                <button
                  className="admin-btn admin-btn-primary admin-btn-small"
                  onClick={handleBulkApprove}
                  disabled={bulkBusy}
                >
                  {bulkBusy ? 'جاري...' : 'موافقة على المحدد'}
                </button>
                <button
                  className="admin-btn admin-btn-danger admin-btn-small"
                  onClick={handleBulkReject}
                  disabled={bulkBusy}
                >
                  رفض المحدد
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
                <TableHead>العنوان</TableHead>
                <TableHead>نوع الخدمة</TableHead>
                <TableHead>مقدم الخدمة</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>تاريخ الإرسال</TableHead>
                <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((service) => (
                <TableRow key={service._id} className={selection.isSelected(service._id) ? 'is-selected' : ''}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selection.isSelected(service._id)}
                      onChange={() => selection.toggle(service._id)}
                      aria-label={`تحديد ${service.title_ar}`}
                    />
                  </TableCell>
                  <TableCell data-label="العنوان">
                    <div className="admin-pending-name">
                      {service.images?.length ? (
                        <img className="admin-row-thumb" src={service.images[0]} alt="" loading="lazy" />
                      ) : (
                        <span className="admin-row-thumb empty" title="لا توجد صور">—</span>
                      )}
                      <div>
                        <div className="admin-table-name">{service.title_ar}</div>
                        <div className="admin-table-sub" dir="ltr">{service.title_en}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-label="نوع الخدمة">{SERVICE_TYPE_LABELS[service.serviceType] || 'أخرى'}</TableCell>
                  <TableCell data-label="مقدم الخدمة">
                    <div className="admin-table-name">
                      {isPlaceholderEmail(service.ownerName) ? 'تسجيل بالهاتف' : service.ownerName || '—'}
                    </div>
                    {realEmail(service.ownerEmail) && (
                      <div className="admin-table-sub" dir="ltr">{service.ownerEmail}</div>
                    )}
                  </TableCell>
                  <TableCell data-label="المدينة">{service.city ? cityLabel(service.city) : '—'}</TableCell>
                  <TableCell data-label="السعر">
                    {formatServicePrice(service.price, service.priceUnit) || (
                      <span className="admin-table-sub">{service.priceRange || 'بدون سعر'}</span>
                    )}
                  </TableCell>
                  <TableCell data-label="تاريخ الإرسال">{formatDate(service.createdAt)}</TableCell>
                  <TableCell>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="admin-action-btn edit"
                        onClick={() => setOpenId(service._id)}
                      >
                        مراجعة
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {openId && (
        <ServiceDrawer key={openId} serviceId={openId} onClose={() => setOpenId(null)} />
      )}
      {confirmDialog}
    </motion.div>
  )
}
