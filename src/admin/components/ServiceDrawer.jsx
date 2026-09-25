import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Drawer, { DrawerSection, DrawerSkeleton, Facts, Gallery } from './Drawer'
import ServiceForm from './ServiceForm'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './toast-context'
import { EmptyState, ErrorState } from './States'
import { useQuerySafe } from '../useQuerySafe'
import {
  PRICE_UNIT_LABELS,
  SERVICE_STATUS_COLORS,
  SERVICE_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  arCount,
  BOOKING_STATUS_COLORS,
  bookingStatusLabel,
  cityLabel,
  formatDate,
  formatISODate,
  formatMoney,
  formatServicePrice,
  isLiveService,
  PEOPLE,
  personName,
} from '../constants'

// A traveller is still waiting on these: the server will not delete a service
// that has one (SERVICE_ERRORS.HAS_OPEN_BOOKINGS).
const OPEN = ['pending', 'confirmed']

/**
 * Everything about one service, and every decision on it, in one place.
 *
 * Opened from the live-services tab and from the approval queue, so a service
 * is always read — photos, description, price, contact, who offers it — before
 * it is approved, rejected, suspended or deleted. The record is live
 * (adminGetService): an action taken here, or by another admin, shows at once,
 * and the buttons follow the status.
 *
 * Approving, rejecting and deleting close the drawer — each takes the service
 * out of the queue it was opened from. Suspending, reinstating and editing
 * keep it open, showing the new state.
 */
export default function ServiceDrawer({ serviceId, onClose }) {
  const { data: service, error } = useQuerySafe(api.admin.queries.adminGetService, { serviceId })

  const approve = useMutation(api.admin.mutations.approveService)
  const reject = useMutation(api.admin.mutations.rejectService)
  const suspend = useMutation(api.admin.mutations.suspendService)
  const reinstate = useMutation(api.admin.mutations.reinstateService)
  const remove = useMutation(api.admin.mutations.deleteService)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)

  const name = service ? service.title_ar || service.title_en : ''

  /** Run one decision: busy state, a toast either way, the server's words on failure. */
  const run = async (action, success, { close = false } = {}) => {
    setBusy(true)
    try {
      await action()
      toast.success(success)
      if (close) onClose()
    } catch (err) {
      toast.error(err)
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async () => {
    const ok = await confirm({
      title: 'الموافقة على هذه الخدمة؟',
      message: `ستظهر "${name}" للمسافرين في التطبيق، وسيتم إشعار مقدم الخدمة بالموافقة.`,
      confirmLabel: 'موافقة ونشر',
    })
    if (!ok) return
    await run(() => approve({ id: serviceId }), `تمت الموافقة على "${name}"`, { close: true })
  }

  const handleReject = async () => {
    const result = await confirm({
      title: 'رفض هذه الخدمة؟',
      message: `سيظهر السبب لمقدم "${name}" في التطبيق مع إشعار بالرفض، ويمكنه التعديل وإعادة الإرسال.`,
      confirmLabel: 'تأكيد الرفض',
      destructive: true,
      reason: { label: 'سبب الرفض (اختياري)', placeholder: 'مثال: الوصف غير كافٍ، السعر غير واضح...' },
    })
    if (!result) return
    await run(
      () => reject({ id: serviceId, reason: result.reason || undefined }),
      'تم رفض الخدمة',
      { close: true }
    )
  }

  const handleSuspend = async () => {
    const result = await confirm({
      title: 'إيقاف هذه الخدمة؟',
      message: `ستختفي "${name}" من التطبيق ولن تقبل حجوزات جديدة، والحجوزات القائمة لا تتأثر. سيتم إشعار مقدم الخدمة بالسبب.`,
      confirmLabel: 'إيقاف الخدمة',
      destructive: true,
      reason: { label: 'سبب الإيقاف (يصل لمقدم الخدمة)', placeholder: 'مثال: شكاوى متكررة من المسافرين', required: true },
    })
    if (!result) return
    await run(() => suspend({ serviceId, reason: result.reason }), 'تم إيقاف الخدمة')
  }

  const handleReinstate = async () => {
    const ok = await confirm({
      title: 'إعادة نشر هذه الخدمة؟',
      message: `ستعود "${name}" للظهور في التطبيق وتقبل الحجوزات من جديد.`,
      confirmLabel: 'إعادة النشر',
    })
    if (!ok) return
    await run(() => reinstate({ serviceId }), 'أُعيد نشر الخدمة')
  }

  const handleDelete = async () => {
    const open = (service.recentBookings || []).filter((b) => OPEN.includes(b.status)).length
    const ok = await confirm({
      title: 'حذف هذه الخدمة نهائيًا؟',
      message: open > 0
        ? `لدى "${name}" حجوزات قائمة (${open} على الأقل)، ولن تُحذف حتى تُلغى أو تكتمل. للإخفاء فورًا استخدم «إيقاف».`
        : `ستُحذف "${name}" نهائيًا من التطبيق. لا يمكن التراجع عن هذا الإجراء.`,
      confirmLabel: 'حذف نهائي',
      destructive: true,
    })
    if (!ok) return
    // A refusal (open bookings) comes back as the server's own sentence.
    await run(() => remove({ serviceId }), 'تم حذف الخدمة', { close: true })
  }

  let body
  if (error) {
    body = <ErrorState title="تعذّر تحميل الخدمة" error={error} />
  } else if (service === undefined) {
    body = <DrawerSkeleton />
  } else if (service === null) {
    body = <EmptyState title="لم تعد هذه الخدمة موجودة" hint="ربما حُذفت للتو." />
  } else {
    body = <ServiceDetails service={service} />
  }

  const footer = service ? (
    <>
      {service.status === 'pending' && (
        <>
          <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={handleApprove}>
            موافقة
          </button>
          <button type="button" className="admin-btn admin-btn-danger" disabled={busy} onClick={handleReject}>
            رفض
          </button>
        </>
      )}
      {/* Only a live service can be suspended: reinstating sets "approved",
          so suspending a pending one would publish it unreviewed. */}
      {isLiveService(service) && (
        <button type="button" className="admin-btn admin-btn-danger" disabled={busy} onClick={handleSuspend}>
          إيقاف
        </button>
      )}
      {service.status === 'suspended' && (
        <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={handleReinstate}>
          إعادة النشر
        </button>
      )}
      <button type="button" className="admin-btn admin-btn-secondary" disabled={busy} onClick={() => setEditing(true)}>
        تعديل
      </button>
      <span className="admin-drawer-foot-end">
        <button type="button" className="admin-action-btn delete" disabled={busy} onClick={handleDelete}>
          حذف
        </button>
      </span>
    </>
  ) : null

  return (
    <>
      <Drawer
        title={service ? name : 'تفاصيل الخدمة'}
        subtitle={service?.title_en}
        badges={service ? (
          <>
            <span className={`admin-badge ${SERVICE_STATUS_COLORS[service.status] || 'gray'}`}>
              {SERVICE_STATUS_LABELS[service.status] || service.status}
            </span>
            <span className="admin-badge gray">{SERVICE_TYPE_LABELS[service.serviceType] || 'أخرى'}</span>
            {service.openReports > 0 && (
              <span className="admin-badge red">{service.openReports} تبليغ مفتوح</span>
            )}
          </>
        ) : null}
        onClose={onClose}
        footer={footer}
        width={600}
      >
        {body}
      </Drawer>

      {editing && service && (
        <ServiceForm key={service._id} service={service} onClose={() => setEditing(false)} />
      )}
      {confirmDialog}
    </>
  )
}

function ServiceDetails({ service }) {
  const owner = service.owner
  const price = formatServicePrice(service.price, service.priceUnit)

  return (
    <>
      {service.status === 'suspended' && service.suspendedReason && (
        <p className="admin-callout danger"><strong>سبب الإيقاف:</strong> {service.suspendedReason}</p>
      )}
      {service.status === 'rejected' && service.rejectionReason && (
        <p className="admin-callout danger"><strong>سبب الرفض:</strong> {service.rejectionReason}</p>
      )}
      {/* D16: a service with no numeric price stays visible and shows
          Contact instead of Book, so older services keep working. */}
      {!price && (
        <p className="admin-callout">
          لا يوجد سعر رقمي لهذه الخدمة، فتظهر للمسافر بزر «تواصل» بدل «احجز».
        </p>
      )}
      {owner?.isSuspended && (
        <p className="admin-callout danger">
          حساب مقدم الخدمة موقوف، فالخدمة مخفية عن المسافرين مهما كانت حالتها.
        </p>
      )}

      <DrawerSection title="الصور">
        <Gallery images={service.images} emptyText="لا توجد صور لهذه الخدمة." />
      </DrawerSection>

      <DrawerSection title="التفاصيل">
        <Facts
          items={[
            { label: 'السعر', value: price || 'غير محدد' },
            { label: 'وحدة السعر', value: PRICE_UNIT_LABELS[service.priceUnit] || 'غير محددة' },
            { label: 'نطاق السعر (نص)', value: service.priceRange },
            {
              label: 'الحد الأقصى للأشخاص',
              value: service.maxGroupSize
                ? arCount(service.maxGroupSize, PEOPLE)
                : '20 شخصًا (افتراضي)',
            },
            { label: 'المدينة', value: service.city ? cityLabel(service.city) : 'غير محددة' },
            { label: 'اللغات', value: service.languages?.length ? service.languages.join('، ') : null },
            { label: 'أوقات التوفر', value: service.availability_ar || service.availability_en, wide: true },
            {
              label: 'التقييم',
              value: service.reviewCount
                ? `${Number(service.rating ?? 0).toFixed(1)} من 5 (${service.reviewCount} تقييم)`
                : 'لا توجد تقييمات',
            },
            { label: 'تاريخ الإرسال', value: formatDate(service.createdAt) },
            { label: 'آخر تحديث', value: formatDate(service.updatedAt) },
          ]}
        />
      </DrawerSection>

      {(service.description_ar || service.description_en) && (
        <DrawerSection title="الوصف">
          {service.description_ar && <p className="admin-prose">{service.description_ar}</p>}
          {service.description_en && <p className="admin-prose" dir="ltr">{service.description_en}</p>}
        </DrawerSection>
      )}

      <DrawerSection title="التواصل">
        <Facts
          items={[
            { label: 'هاتف الخدمة', value: service.contactPhone || 'غير محدد', ltr: Boolean(service.contactPhone) },
            { label: 'بريد الخدمة', value: service.contactEmail || 'غير محدد', ltr: Boolean(service.contactEmail) },
          ]}
        />
      </DrawerSection>

      <DrawerSection title="مقدم الخدمة">
        {owner ? (
          <Facts
            items={[
              { label: 'الاسم', value: personName(owner) },
              { label: 'الجوال', value: owner.phone || '—', ltr: Boolean(owner.phone) },
              { label: 'البريد', value: owner.email || 'تسجيل بالهاتف', ltr: Boolean(owner.email) },
              { label: 'الحساب', value: owner.isSuspended ? 'موقوف' : 'نشط' },
            ]}
          />
        ) : (
          <p className="admin-inline-hint">حساب مقدم الخدمة محذوف.</p>
        )}
      </DrawerSection>

      <DrawerSection title={`آخر الحجوزات (${service.recentBookings?.length ?? 0})`}>
        {service.recentBookings?.length ? (
          <ul className="admin-mini-list">
            {service.recentBookings.map((booking) => (
              <li key={booking._id}>
                <div className="admin-mini-main">
                  <div className="admin-table-name">{booking.guest?.name || 'حساب محذوف'}</div>
                  <div className="admin-table-sub">
                    <span dir="ltr">{formatISODate(booking.date)} {booking.time}</span>
                    {booking.partySize ? ` · ${arCount(booking.partySize, PEOPLE)}` : ''}
                    {booking.confirmationCode ? (
                      <> · <code dir="ltr">{booking.confirmationCode}</code></>
                    ) : null}
                  </div>
                </div>
                <div className="admin-mini-side">
                  <span className={`admin-badge ${BOOKING_STATUS_COLORS[booking.status] || 'gray'}`}>
                    {bookingStatusLabel(booking.status, 'service')}
                  </span>
                  {booking.totalAmount != null && (
                    <span className="admin-table-sub">{formatMoney(booking.totalAmount)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-inline-hint">لا توجد حجوزات لهذه الخدمة بعد.</p>
        )}
      </DrawerSection>

      <DrawerSection title="التبليغات">
        <p className="admin-inline-hint">
          {service.openReports > 0
            ? `${service.openReports} تبليغ مفتوح عن هذه الخدمة — تجدها في قسم «التبليغات».`
            : 'لا توجد تبليغات مفتوحة عن هذه الخدمة.'}
        </p>
      </DrawerSection>
    </>
  )
}
