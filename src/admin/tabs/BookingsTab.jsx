import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import FilterSelect from '../components/FilterSelect'
import {
  BOOKING_STATUSES,
  BOOKING_STATUS_COLORS,
  BOOKING_STATUS_LABELS,
  formatISODate,
  formatMoney,
  todayISO,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

// Statuses that no longer offer an action: the booking is closed. Support can
// still force a change through the status filter and the log records it.
const TERMINAL = ['cancelled', 'completed', 'declined', 'expired', 'no_show']

/** One line describing when a booking is, whichever shape it has. */
function bookingWhen(booking) {
  return booking.kind === 'stay'
    ? `${booking.checkIn} → ${booking.checkOut}`
    : `${booking.date} ${booking.time}`
}

/**
 * Booking oversight.
 *
 * This was the only place a booking could be confirmed until hosts got their
 * own inbox in the app. It stays as the support view: everything, both stays
 * and slot reservations, with the ability to force a transition the normal
 * flow cannot reach.
 *
 * Every transition goes through admin/mutations:updateBookingStatus rather than
 * the owner-facing confirmBooking/declineBooking, so all of them are validated,
 * admin-guarded and written to the action log the same way — and reopening a
 * closed booking is logged as booking.force rather than looking routine.
 */
export default function BookingsTab() {
  const [status, setStatus] = useState('')
  const bookings = useQuery(api.admin.queries.listAllBookings, {
    status: status || undefined,
    limit: 100,
  })
  const updateStatus = useMutation(api.admin.mutations.updateBookingStatus)

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [busyId, setBusyId] = useState(null)

  const groups = useMemo(() => {
    const today = todayISO()
    const empty = { today: [], upcoming: [], past: [] }
    if (!bookings) return empty

    return bookings.reduce((acc, booking) => {
      // A stay spans days, so it belongs to "today" for its whole run — a
      // guest who is mid-stay is very much today's problem.
      const start = booking.checkIn ?? booking.date
      const end = booking.checkOut ?? booking.date

      if (start <= today && end >= today) acc.today.push(booking)
      else if (start > today) acc.upcoming.push(booking)
      else acc.past.push(booking)
      return acc
    }, empty)
  }, [bookings])

  const awaitingOwner = (bookings ?? []).filter(
    (b) => b.kind === 'stay' && b.status === 'pending'
  ).length

  const runTransition = async (booking, nextStatus, options = {}) => {
    if (options.confirmation) {
      const result = await confirm(options.confirmation)
      if (!result) return
      options.reason = result.reason
    }

    setBusyId(booking._id)
    try {
      await updateStatus({
        id: booking._id,
        status: nextStatus,
        cancellationReason: options.reason || undefined,
      })
      toast.success(options.successMessage || 'تم تحديث الحجز')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const confirmBooking = (booking) =>
    runTransition(booking, 'confirmed', { successMessage: 'تم تأكيد الحجز' })

  const completeBooking = (booking) =>
    runTransition(booking, 'completed', { successMessage: 'تم إتمام الحجز' })

  const cancelBooking = (booking) =>
    runTransition(booking, 'cancelled', {
      successMessage: 'تم إلغاء الحجز',
      confirmation: {
        title: 'إلغاء هذا الحجز؟',
        message: `${booking.listingName_ar} — ${bookingWhen(booking)} — ${booking.userName}`,
        confirmLabel: 'تأكيد الإلغاء',
        destructive: true,
        reason: { label: 'سبب الإلغاء (اختياري)', placeholder: 'مثال: المكان مغلق في هذا التاريخ' },
      },
    })

  const markNoShow = (booking) =>
    runTransition(booking, 'no_show', {
      successMessage: 'تم تسجيل عدم الحضور',
      confirmation: {
        title: 'تسجيل عدم حضور؟',
        message: `${booking.userName} — ${bookingWhen(booking)}`,
        confirmLabel: 'تسجيل',
      },
    })

  // Declining on the host's behalf. Distinct from cancelling: the guest is
  // told the place could not take them, not that their booking was undone.
  const declineBooking = (booking) =>
    runTransition(booking, 'declined', {
      successMessage: 'تم رفض الطلب',
      confirmation: {
        title: 'رفض هذا الطلب نيابة عن المالك؟',
        message: `${booking.listingName_ar} — ${bookingWhen(booking)} — ${booking.userName}`,
        confirmLabel: 'رفض الطلب',
        destructive: true,
        reason: {
          label: 'سبب الرفض (يظهر للضيف)',
          placeholder: 'مثال: لا توجد غرف متاحة في هذه التواريخ',
        },
      },
    })

  if (bookings === undefined) return <TableSkeleton rows={5} cols={7} />

  const sections = [
    { key: 'today', title: 'اليوم', rows: groups.today },
    { key: 'upcoming', title: 'قادمة', rows: groups.upcoming },
    { key: 'past', title: 'سابقة', rows: groups.past },
  ].filter((section) => section.rows.length > 0)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <div>
          <h2 className="admin-page-title" style={{ margin: 0 }}>الحجوزات</h2>
          <p className="admin-page-subtitle">
            {groups.today.length} اليوم · {groups.upcoming.length} قادمة
            {awaitingOwner > 0 ? ` · ${awaitingOwner} بانتظار المالك` : ''} · {bookings.length} معروضة
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="كل الحالات"
          options={[
            { value: '', label: 'كل الحالات' },
            ...BOOKING_STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          title={status ? 'لا توجد حجوزات بهذه الحالة' : 'لا توجد حجوزات بعد'}
          hint="الحجوزات التي يقوم بها السياح من التطبيق تظهر هنا لتأكيدها نيابة عن المكان."
        />
      ) : (
        sections.map((section) => (
          <section key={section.key} className="admin-booking-section">
            <div className="admin-section-header">
              <h3 className="admin-subsection-title">{section.title}</h3>
              <span className="admin-badge gray">{section.rows.length}</span>
            </div>

            <Table className="admin-table">
                <TableHeader>
                  <TableRow>
                    <TableHead>السائح</TableHead>
                    <TableHead>المكان</TableHead>
                    <TableHead>الموعد</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>المالك</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.map((booking) => (
                    <TableRow key={booking._id} className={busyId === booking._id ? 'is-busy' : ''}>
                      <TableCell data-label="السائح">
                        <div className="admin-table-name">{booking.userName}</div>
                        <div className="admin-table-sub" dir="ltr">{booking.userEmail}</div>
                        {booking.userPhone && (
                          <div className="admin-table-sub" dir="ltr">{booking.userPhone}</div>
                        )}
                      </TableCell>
                      <TableCell data-label="المكان">
                        <div className="admin-table-name">{booking.listingName_ar}</div>
                        <div className="admin-table-sub" dir="ltr">{booking.listingName}</div>
                        {booking.listingPhone && (
                          <div className="admin-table-sub" dir="ltr">{booking.listingPhone}</div>
                        )}
                        {!booking.listingHasHours && (
                          <span className="admin-badge yellow" title="المكان بلا أوقات عمل محددة">
                            بلا أوقات عمل
                          </span>
                        )}
                      </TableCell>
                      <TableCell data-label="الموعد">
                        {booking.kind === 'stay' ? (
                          <>
                            <span className="admin-badge blue">إقامة</span>
                            <div className="admin-table-name" dir="ltr">
                              {formatISODate(booking.checkIn)} ← {formatISODate(booking.checkOut)}
                            </div>
                            <div className="admin-table-sub">
                              {booking.nights} ليالٍ
                              {booking.guests ? ` · ${booking.guests} ضيوف` : ''}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="admin-table-name" dir="ltr">{booking.date}</div>
                            <div className="admin-table-sub" dir="ltr">{booking.time}</div>
                            {booking.partySize ? (
                              <div className="admin-table-sub">{booking.partySize} أشخاص</div>
                            ) : null}
                          </>
                        )}
                        {booking.notes && <div className="admin-table-sub">{booking.notes}</div>}
                        {booking.declineReason && (
                          <div className="admin-table-sub">سبب الرفض: {booking.declineReason}</div>
                        )}
                        {booking.cancellationReason && (
                          <div className="admin-table-sub">سبب الإلغاء: {booking.cancellationReason}</div>
                        )}
                      </TableCell>
                      <TableCell data-label="المبلغ">
                        {booking.totalAmount != null ? (
                          <div className="admin-table-name">{formatMoney(booking.totalAmount)}</div>
                        ) : (
                          <span className="admin-table-sub">—</span>
                        )}
                        {booking.confirmationCode && (
                          <div className="admin-table-sub" dir="ltr">
                            <code>{booking.confirmationCode}</code>
                          </div>
                        )}
                      </TableCell>
                      <TableCell data-label="المالك">
                        {booking.ownerName ? (
                          <>
                            <div className="admin-table-name">{booking.ownerName}</div>
                            {booking.ownerPhone && (
                              <div className="admin-table-sub" dir="ltr">{booking.ownerPhone}</div>
                            )}
                          </>
                        ) : (
                          <span className="admin-table-sub" title="مكان بلا مالك مرتبط">—</span>
                        )}
                      </TableCell>
                      <TableCell data-label="الحالة">
                        <span className={`admin-badge ${BOOKING_STATUS_COLORS[booking.status] || 'gray'}`}>
                          {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="admin-actions">
                          {booking.status === 'pending' && (
                            <>
                              <button
                                className="admin-action-btn edit"
                                onClick={() => confirmBooking(booking)}
                                disabled={busyId === booking._id}
                              >
                                {busyId === booking._id ? 'جاري...' : 'تأكيد'}
                              </button>
                              <button
                                className="admin-action-btn delete"
                                onClick={() => declineBooking(booking)}
                                disabled={busyId === booking._id}
                              >
                                رفض
                              </button>
                            </>
                          )}
                          {(booking.status === 'pending' || booking.status === 'confirmed') && (
                            <button
                              className="admin-action-btn"
                              onClick={() => completeBooking(booking)}
                              disabled={busyId === booking._id}
                            >
                              إتمام
                            </button>
                          )}
                          {booking.status === 'confirmed' && section.key !== 'upcoming' && (
                            <button
                              className="admin-action-btn"
                              onClick={() => markNoShow(booking)}
                              disabled={busyId === booking._id}
                            >
                              لم يحضر
                            </button>
                          )}
                          {!TERMINAL.includes(booking.status) && (
                            <button
                              className="admin-action-btn delete"
                              onClick={() => cancelBooking(booking)}
                              disabled={busyId === booking._id}
                            >
                              إلغاء
                            </button>
                          )}
                          {TERMINAL.includes(booking.status) && (
                            <span className="admin-table-sub">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          </section>
        ))
      )}

      {confirmDialog}
    </motion.div>
  )
}
