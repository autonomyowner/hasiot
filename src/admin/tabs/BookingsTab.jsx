import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import FilterSelect from '../components/FilterSelect'
import { BOOKING_STATUSES, BOOKING_STATUS_COLORS, BOOKING_STATUS_LABELS, todayISO } from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

/**
 * Booking management, on behalf of the businesses.
 *
 * The booking backend has always been complete, but the only UI for it lived in
 * the web business dashboard, which was removed in Aug 2026 — and the mobile app
 * never had an owner-side screen. Until it does, this is the only place a
 * booking can be confirmed, so it is built to be worked from top to bottom:
 * today first, then upcoming, then history.
 *
 * Every transition goes through admin/mutations:updateBookingStatus rather than
 * the owner-facing confirmBooking/completeBooking, so all of them are validated,
 * admin-guarded and written to the action log the same way.
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
      if (booking.date === today) acc.today.push(booking)
      else if (booking.date > today) acc.upcoming.push(booking)
      else acc.past.push(booking)
      return acc
    }, empty)
  }, [bookings])

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
        message: `${booking.listingName_ar} — ${booking.date} ${booking.time} — ${booking.userName}`,
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
        message: `${booking.userName} — ${booking.date} ${booking.time}`,
        confirmLabel: 'تسجيل',
      },
    })

  if (bookings === undefined) return <TableSkeleton rows={5} cols={6} />

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
            {groups.today.length} اليوم · {groups.upcoming.length} قادمة · {bookings.length} معروضة
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
                    <TableHead>التفاصيل</TableHead>
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
                        <div className="admin-table-name" dir="ltr">{booking.date}</div>
                        <div className="admin-table-sub" dir="ltr">{booking.time}</div>
                      </TableCell>
                      <TableCell data-label="التفاصيل">
                        {booking.partySize ? <div>{booking.partySize} أشخاص</div> : null}
                        {booking.notes && <div className="admin-table-sub">{booking.notes}</div>}
                        {booking.cancellationReason && (
                          <div className="admin-table-sub">سبب الإلغاء: {booking.cancellationReason}</div>
                        )}
                        {!booking.partySize && !booking.notes && !booking.cancellationReason && '—'}
                      </TableCell>
                      <TableCell data-label="الحالة">
                        <span className={`admin-badge ${BOOKING_STATUS_COLORS[booking.status] || 'gray'}`}>
                          {BOOKING_STATUS_LABELS[booking.status] || booking.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="admin-actions">
                          {booking.status === 'pending' && (
                            <button
                              className="admin-action-btn edit"
                              onClick={() => confirmBooking(booking)}
                              disabled={busyId === booking._id}
                            >
                              {busyId === booking._id ? 'جاري...' : 'تأكيد'}
                            </button>
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
                          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                            <button
                              className="admin-action-btn delete"
                              onClick={() => cancelBooking(booking)}
                              disabled={busyId === booking._id}
                            >
                              إلغاء
                            </button>
                          )}
                          {(booking.status === 'cancelled' || booking.status === 'completed') && (
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
