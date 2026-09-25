import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Modal from '../components/Modal'
import FilterSelect from '../components/FilterSelect'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, KeepLooking, LoadMore, TableSkeleton } from '../components/States'
import { usePagedList } from '../usePagedList'
import { useDebounced } from '../../hooks/useDebounced'
import {
  BOOKING_KINDS,
  BOOKING_KIND_LABELS,
  BOOKING_STATUSES,
  BOOKING_STATUS_COLORS,
  DAYS,
  GUESTS,
  HOURS,
  NIGHTS,
  PEOPLE,
  TERMINAL_BOOKING_STATUSES,
  arCount,
  bookingKindOf,
  bookingOwnerLabel,
  bookingStatusLabel,
  formatISODate,
  formatMoney,
  todayISO,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

const PAGE_SIZE = 25
// adminSearchBookings returns one array of at most this many.
const SEARCH_CAP = 50

const KIND_FILTERS = [{ value: '', label: 'الكل' }, ...BOOKING_KINDS.map((k) => ({ value: k.value, label: k.plural }))]

/** "2026-09-12" minus one day, for a service's exclusive checkOut. */
function dayBefore(iso) {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().split('T')[0]
}

/**
 * Where a booking sits against today (Riyadh): «اليوم», «قادم» or «سابق».
 * A stay counts as today through its checkout day — a guest leaving is
 * today's problem. A service's checkOut is the day after its last day, so
 * that day is not.
 */
function timing(booking, today) {
  const kind = bookingKindOf(booking)
  const start = booking.checkIn ?? booking.date
  const end = kind === 'service' && booking.checkOut
    ? dayBefore(booking.checkOut)
    : booking.checkOut ?? booking.date
  if (start <= today && end >= today) return { key: 'today', label: 'اليوم', color: 'green' }
  if (start > today) return { key: 'upcoming', label: 'قادم', color: 'blue' }
  return { key: 'past', label: 'سابق', color: 'gray' }
}

/** Hours until a pending request expires, or null when it carries no expiry. */
function hoursLeft(expiresAt) {
  if (!expiresAt) return null
  return Math.max(0, Math.round((expiresAt - Date.now()) / (60 * 60 * 1000)))
}

/** What was booked, in one line. */
function bookedThing(booking) {
  if (booking.service) return booking.service.title_ar || booking.service.title_en
  if (booking.listing) return booking.listing.name_ar || booking.listing.name_en
  return bookingKindOf(booking) === 'service' ? 'خدمة محذوفة' : 'مكان محذوف'
}

/**
 * Who is told when support moves a booking — the truth, read off
 * notifyAdminBookingChange in convex/admin/service.ts.
 */
function notificationNote(status, kind) {
  if (status === 'cancelled') {
    const also = kind === 'service' ? 'ولمقدم الخدمة' : kind === 'stay' ? 'وللمضيف' : 'وللمالك'
    return `سيصل إشعار بالإلغاء للضيف ${also} إن وُجد.`
  }
  if (status === 'confirmed' || status === 'declined' || status === 'expired') {
    return 'سيصل إشعار للضيف.'
  }
  return 'لن يُرسل أي إشعار.'
}

/**
 * Booking oversight: stays, service bookings and the old restaurant slots.
 *
 * Paged (adminListBookings) with a kind and a status filter, and searchable by
 * the confirmation code a guest reads out or by their phone number
 * (adminSearchBookings) — the two ways support is actually asked about a
 * booking. It used to load the newest hundred with no way to reach the rest.
 *
 * Every transition goes through admin/mutations:updateBookingStatus rather than
 * the owner-facing confirmBooking/declineBooking, so all of them are validated,
 * admin-guarded and written to the action log the same way. «تغيير الحالة
 * (للدعم)» reaches any status, the closed ones included, behind a confirmation
 * that names both statuses; reopening a closed booking is logged as
 * booking.force.
 */
export default function BookingsTab({ initialFilters }) {
  const [kind, setKind] = useState(initialFilters?.kind || '')
  const [status, setStatus] = useState(initialFilters?.status || '')
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput.trim())
  const isSearching = search.length > 0

  const searchResults = useQuery(
    api.admin.queries.adminSearchBookings,
    isSearching ? { search } : 'skip'
  )
  const browse = usePagedList(
    api.admin.queries.adminListBookings,
    isSearching ? 'skip' : { kind: kind || undefined, status: status || undefined },
    PAGE_SIZE
  )

  const updateStatus = useMutation(api.admin.mutations.updateBookingStatus)
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [busyId, setBusyId] = useState(null)
  const [changeFor, setChangeFor] = useState(null)

  // The search takes no filters of its own, so the kind and status chosen
  // above narrow its (at most fifty) results here.
  const rows = isSearching
    ? (searchResults ?? []).filter(
        (b) => (!kind || bookingKindOf(b) === kind) && (!status || b.status === status)
      )
    : browse.results
  const loading = isSearching
    ? searchResults === undefined
    : browse.status === 'LoadingFirstPage' ||
      (browse.results.length === 0 && browse.status === 'LoadingMore')
  const stalled = !isSearching && browse.results.length === 0 && browse.status === 'CanLoadMore'
  const hasFilters = Boolean(kind || status || isSearching)

  const today = todayISO()
  const todayCount = rows.filter((b) => timing(b, today).key === 'today').length
  const upcomingCount = rows.filter((b) => timing(b, today).key === 'upcoming').length

  const resetFilters = () => {
    setKind('')
    setStatus('')
    setSearchInput('')
  }

  const runTransition = async (booking, nextStatus, { confirmation, reason, successMessage } = {}) => {
    let finalReason = reason
    if (confirmation) {
      const result = await confirm(confirmation)
      if (!result) return false
      finalReason = result.reason || reason
    }

    setBusyId(booking._id)
    try {
      await updateStatus({
        id: booking._id,
        status: nextStatus,
        cancellationReason: finalReason || undefined,
      })
      toast.success(successMessage || 'تم تحديث الحجز')
      return true
    } catch (error) {
      toast.error(error)
      return false
    } finally {
      setBusyId(null)
    }
  }

  const describe = (booking) =>
    `${bookedThing(booking)} — ${booking.guest?.name || 'حساب محذوف'}${
      booking.confirmationCode ? ` — ${booking.confirmationCode}` : ''
    }`

  const confirmBooking = (booking) =>
    runTransition(booking, 'confirmed', { successMessage: 'تم تأكيد الحجز وإشعار الضيف' })

  // Declining on the host's behalf. Distinct from cancelling: the guest is
  // told the place could not take them, not that their booking was undone.
  const declineBooking = (booking) =>
    runTransition(booking, 'declined', {
      successMessage: 'تم رفض الطلب',
      confirmation: {
        title: `رفض هذا الطلب نيابة عن ${bookingOwnerLabel(bookingKindOf(booking))}؟`,
        message: describe(booking),
        confirmLabel: 'رفض الطلب',
        destructive: true,
        reason: {
          label: 'سبب الرفض (يظهر للضيف)',
          placeholder: 'مثال: لا توجد غرف متاحة في هذه التواريخ',
        },
      },
    })

  // Completing a request nobody accepted says the stay or the service took
  // place without the host or provider ever answering — worth a second look.
  const completeBooking = (booking) => {
    const owner = bookingOwnerLabel(bookingKindOf(booking))
    return runTransition(booking, 'completed', {
      successMessage: 'تم إتمام الحجز',
      confirmation: booking.status === 'pending'
        ? {
            title: 'إتمام طلب لم يُؤكَّد بعد؟',
            message: `هذا الطلب ما زال بانتظار رد ${owner}. «إتمام» يعني أن الحجز تمّ فعلًا، ويتيح للضيف تقييمه. ${describe(booking)}`,
            confirmLabel: 'إتمام الطلب',
          }
        : undefined,
    })
  }

  const cancelBooking = (booking) =>
    runTransition(booking, 'cancelled', {
      successMessage: 'تم إلغاء الحجز',
      confirmation: {
        title: 'إلغاء هذا الحجز؟',
        message: `${describe(booking)}. ${notificationNote('cancelled', bookingKindOf(booking))}`,
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
        message: describe(booking),
        confirmLabel: 'تسجيل',
      },
    })

  /** The support override, after its dialog picked a status: one more, explicit, yes. */
  const forceStatus = async (booking, nextStatus, reason) => {
    const bookingKind = bookingKindOf(booking)
    const from = bookingStatusLabel(booking.status, bookingKind)
    const to = bookingStatusLabel(nextStatus, bookingKind)
    const reopening = TERMINAL_BOOKING_STATUSES.includes(booking.status)
    const done = await runTransition(booking, nextStatus, {
      reason,
      successMessage: `تغيّرت حالة الحجز إلى «${to}»`,
      confirmation: {
        title: 'تغيير حالة الحجز؟',
        message: `من «${from}» إلى «${to}» — ${describe(booking)}. ${
          reopening ? 'الحجز مغلق، وإعادة فتحه تُسجَّل في السجل كتجاوز للمسار العادي. ' : ''
        }${notificationNote(nextStatus, bookingKind)}`,
        confirmLabel: 'تغيير الحالة',
        destructive: true,
      },
    })
    if (done) setChangeFor(null)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title">الحجوزات</h2>
          <p className="admin-page-subtitle">
            {loading
              ? 'جاري التحميل...'
              : `${rows.length} ${isSearching ? 'نتيجة' : 'حجز معروض'} · ${todayCount} اليوم · ${upcomingCount} قادم${
                  !isSearching && browse.status === 'CanLoadMore' ? ' — هناك المزيد' : ''
                }`}
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <div className="admin-segmented" role="group" aria-label="نوع الحجز">
          {KIND_FILTERS.map((option) => (
            <button
              key={option.value || 'all'}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => setKind(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="كل الحالات"
          options={[
            { value: '', label: 'كل الحالات' },
            ...BOOKING_STATUSES.map((s) => ({ value: s.value, label: s.label })),
          ]}
        />
        <input
          type="search"
          className="admin-form-input admin-search-input"
          placeholder="رمز التأكيد (HSO-XXXXX) أو جوال الضيف"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="بحث برمز التأكيد أو رقم الجوال"
          dir="auto"
        />
        {hasFilters && (
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-small" onClick={resetFilters}>
            مسح الفلاتر
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : stalled ? (
        <KeepLooking onLoadMore={browse.loadMore} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={isSearching ? 'لا توجد حجوزات مطابقة' : hasFilters ? 'لا توجد حجوزات بهذه الفلاتر' : 'لا توجد حجوزات بعد'}
          hint={isSearching
            ? 'أدخل رمز التأكيد كاملًا (مثل HSO-7K3M2، الحروف الكبيرة أو الصغيرة) أو رقم جوال الضيف (05xxxxxxxx أو +9665xxxxxxxx).'
            : 'الحجوزات التي يقوم بها المسافرون من التطبيق تظهر هنا.'}
          action={hasFilters
            ? <button type="button" className="admin-btn admin-btn-secondary" onClick={resetFilters}>مسح الفلاتر</button>
            : null}
        />
      ) : (
        <>
          <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead>الضيف</TableHead>
                <TableHead>الحجز</TableHead>
                <TableHead>الموعد</TableHead>
                <TableHead>المبلغ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((booking) => (
                <BookingRow
                  key={booking._id}
                  booking={booking}
                  today={today}
                  busy={busyId === booking._id}
                  onConfirm={confirmBooking}
                  onDecline={declineBooking}
                  onComplete={completeBooking}
                  onCancel={cancelBooking}
                  onNoShow={markNoShow}
                  onChangeStatus={setChangeFor}
                />
              ))}
            </TableBody>
          </Table>

          {!isSearching && (
            <LoadMore status={browse.status} onLoadMore={browse.loadMore} cols={6} />
          )}
          {isSearching && (searchResults?.length ?? 0) >= SEARCH_CAP && (
            <p className="admin-inline-hint">تُعرض أحدث {SEARCH_CAP} نتيجة فقط.</p>
          )}
        </>
      )}

      {changeFor && (
        <StatusChangeModal
          key={changeFor._id}
          booking={changeFor}
          busy={busyId === changeFor._id}
          onClose={() => setChangeFor(null)}
          onSubmit={(next, reason) => forceStatus(changeFor, next, reason)}
        />
      )}
      {confirmDialog}
    </motion.div>
  )
}

function BookingRow({ booking, today, busy, onConfirm, onDecline, onComplete, onCancel, onNoShow, onChangeStatus }) {
  const kind = bookingKindOf(booking)
  const when = timing(booking, today)
  const expiresIn = booking.status === 'pending' ? hoursLeft(booking.expiresAt) : null

  return (
    <TableRow className={busy ? 'is-busy' : ''}>
      <TableCell data-label="الضيف">
        {booking.guest ? (
          <>
            <div className="admin-table-name">{booking.guest.name}</div>
            {booking.guest.phone && (
              <div className="admin-table-sub" dir="ltr">{booking.guest.phone}</div>
            )}
            {!booking.guest.phoneVerified && (
              <span className="admin-badge gray">جوال غير موثق</span>
            )}
          </>
        ) : (
          <span className="admin-table-sub">حساب محذوف</span>
        )}
      </TableCell>

      <TableCell data-label="الحجز">
        <div className="admin-table-name">
          <span className={`admin-badge ${kind === 'service' ? 'blue' : kind === 'stay' ? 'green' : 'gray'}`}>
            {BOOKING_KIND_LABELS[kind]}
          </span>{' '}
          {bookedThing(booking)}
        </div>
        {booking.owner ? (
          <div className="admin-table-sub">
            {bookingOwnerLabel(kind)}: {booking.owner.name}
            {booking.owner.phone && <> · <span dir="ltr">{booking.owner.phone}</span></>}
          </div>
        ) : (
          <div className="admin-table-sub" title="لا أحد يستقبل طلبات هذا الحجز">
            {bookingOwnerLabel(kind)}: غير معيّن
          </div>
        )}
      </TableCell>

      <TableCell data-label="الموعد" className="admin-cell-wrap">
        <span className={`admin-badge ${when.color}`}>{when.label}</span>
        {kind === 'stay' ? (
          <>
            <div className="admin-table-name">
              {formatISODate(booking.checkIn)} ← {formatISODate(booking.checkOut)}
            </div>
            <div className="admin-table-sub">
              {booking.nights ? arCount(booking.nights, NIGHTS) : ''}
              {booking.guests ? ` · ${arCount(booking.guests, GUESTS)}` : ''}
            </div>
          </>
        ) : (
          <>
            <div className="admin-table-name">
              {formatISODate(booking.date)} · <span dir="ltr">{booking.time}</span>
            </div>
            <div className="admin-table-sub">
              {kind === 'service' && booking.priceUnit === 'per_hour' && booking.quantity
                ? `${arCount(booking.quantity, HOURS)} · ` : ''}
              {kind === 'service' && booking.priceUnit === 'per_day' && booking.quantity
                ? `${arCount(booking.quantity, DAYS)} · ` : ''}
              {booking.partySize ? arCount(booking.partySize, PEOPLE) : ''}
            </div>
          </>
        )}
        {booking.notes && <div className="admin-table-sub">ملاحظة الضيف: {booking.notes}</div>}
        {/* A reopened booking keeps the reason it was closed with (the
            forced change leaves the field in place), so beside «مؤكد» a bare
            «سبب الإلغاء» read as if the booking were still cancelled. The
            reason is only "the" reason while the status still says so. */}
        {booking.declineReason && (
          <div className="admin-table-sub">
            {booking.status === 'declined' ? 'سبب الرفض' : 'سبب رفض سابق'}: {booking.declineReason}
          </div>
        )}
        {booking.cancellationReason && (
          <div className="admin-table-sub">
            {booking.status === 'cancelled' ? 'سبب الإلغاء' : 'سبب إلغاء سابق'}: {booking.cancellationReason}
          </div>
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

      <TableCell data-label="الحالة">
        <span className={`admin-badge ${BOOKING_STATUS_COLORS[booking.status] || 'gray'}`}>
          {bookingStatusLabel(booking.status, kind)}
        </span>
        {expiresIn !== null && (
          <div className="admin-table-sub">
            {expiresIn === 0 ? 'ينتهي الآن' : `ينتهي خلال ${expiresIn} ساعة`}
          </div>
        )}
      </TableCell>

      <TableCell>
        <div className="admin-actions">
          {booking.status === 'pending' && (
            <>
              <button className="admin-action-btn edit" onClick={() => onConfirm(booking)} disabled={busy}>
                {busy ? 'جاري...' : 'تأكيد'}
              </button>
              <button className="admin-action-btn delete" onClick={() => onDecline(booking)} disabled={busy}>
                رفض
              </button>
            </>
          )}
          {(booking.status === 'pending' || booking.status === 'confirmed') && (
            <button className="admin-action-btn" onClick={() => onComplete(booking)} disabled={busy}>
              إتمام
            </button>
          )}
          {booking.status === 'confirmed' && when.key !== 'upcoming' && (
            <button className="admin-action-btn" onClick={() => onNoShow(booking)} disabled={busy}>
              لم يحضر
            </button>
          )}
          {!TERMINAL_BOOKING_STATUSES.includes(booking.status) && (
            <button className="admin-action-btn delete" onClick={() => onCancel(booking)} disabled={busy}>
              إلغاء
            </button>
          )}
          <button
            className="admin-action-btn"
            onClick={() => onChangeStatus(booking)}
            disabled={busy}
            title="تغيير الحالة خارج المسار العادي، بما في ذلك إعادة فتح حجز مغلق"
          >
            تغيير الحالة (للدعم)
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}

/**
 * Pick the status support wants to force, and a reason. Submitting does not
 * change anything yet: the tab asks once more, naming both statuses.
 */
function StatusChangeModal({ booking, busy, onClose, onSubmit }) {
  const kind = bookingKindOf(booking)
  const [next, setNext] = useState('')
  const [reason, setReason] = useState('')

  const options = BOOKING_STATUSES
    .filter((s) => s.value !== booking.status)
    .map((s) => ({ value: s.value, label: bookingStatusLabel(s.value, kind) }))

  return (
    <Modal
      title="تغيير الحالة (للدعم)"
      subtitle={`${bookedThing(booking)}${booking.confirmationCode ? ` — ${booking.confirmationCode}` : ''}`}
      onClose={onClose}
      width="520px"
      footer={
        <>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="admin-btn admin-btn-primary"
            disabled={!next || busy}
            onClick={() => onSubmit(next, reason.trim())}
          >
            متابعة
          </button>
        </>
      }
    >
      <div className="admin-modal-body">
        <p className="admin-callout">
          هذا تغيير دعم فني يتجاوز المسار العادي للحجز، ويُسجَّل في السجل باسمك. استخدمه لإصلاح حجز
          وصل إلى حالة خاطئة.
        </p>

        <div className="admin-form" style={{ gap: '1rem' }}>
          <div className="admin-form-group">
            <span className="admin-form-label">الحالة الحالية</span>
            <span>
              <span className={`admin-badge ${BOOKING_STATUS_COLORS[booking.status] || 'gray'}`}>
                {bookingStatusLabel(booking.status, kind)}
              </span>
            </span>
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label">الحالة الجديدة</label>
            <FilterSelect
              value={next}
              onChange={setNext}
              placeholder="اختر الحالة الجديدة"
              className="w-full"
              options={options}
            />
            {next && <p className="admin-form-hint">{notificationNote(next, kind)}</p>}
          </div>

          <div className="admin-form-group">
            <label className="admin-form-label" htmlFor="force-reason">السبب</label>
            <textarea
              id="force-reason"
              className="admin-form-textarea"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="يُحفظ في السجل، ويظهر للضيف عند الرفض أو الإلغاء"
            />
          </div>
        </div>
      </div>
    </Modal>
  )
}
