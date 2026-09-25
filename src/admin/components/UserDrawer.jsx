import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Drawer, { DrawerSection, DrawerSkeleton, Facts } from './Drawer'
import Modal from './Modal'
import FilterSelect from './FilterSelect'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './toast-context'
import { EmptyState, ErrorState } from './States'
import { useQuerySafe } from '../useQuerySafe'
import {
  ASSIGNABLE_ROLES,
  BOOKING_STATUS_COLORS,
  LISTING_STATUS_COLORS,
  LISTING_STATUS_LABELS,
  REPORT_REASONS_AR,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_TYPES_AR,
  SERVICE_STATUS_COLORS,
  SERVICE_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  TYPE_LABELS,
  bookingKindOf,
  bookingStatusLabel,
  formatDate,
  formatDateTime,
  formatISODate,
  personName,
  realEmail,
  roleLabel,
} from '../constants'

const isBusinessRole = (role) => role === 'business_owner' || role === 'service_provider'

/** Where a business or provider account stands in review. */
function approvalLabel(user) {
  if (!isBusinessRole(user.role)) return null
  if (user.isApproved) return 'معتمد'
  if (user.accountRejectionReason) return 'مرفوض'
  return 'بانتظار الاعتماد'
}

/**
 * One account, whole: who it is, what it booked, what it publishes, and what
 * has been reported against it (adminGetUser).
 *
 * The panel could list people but not look at one, so dealing with a
 * fraudulent booker or an abusive host meant reading rows in the Convex
 * dashboard. From here support can change the account's role or suspend it;
 * an admin account, and the operator's own, can be neither — the server
 * refuses both, so the buttons are not offered.
 *
 * Suspending is the users tab's own action, passed in, so the table and the
 * drawer ask the same question in the same words.
 */
export default function UserDrawer({ userId, currentUserId, onClose, onSuspend, onUnsuspend, busy }) {
  const { data: user, error } = useQuerySafe(api.admin.queries.adminGetUser, { userId })
  const [changingRole, setChangingRole] = useState(false)

  const locked = user && (user.role === 'admin' || user._id === currentUserId)

  let body
  if (error) body = <ErrorState title="تعذّر تحميل الحساب" error={error} />
  else if (user === undefined) body = <DrawerSkeleton />
  else if (user === null) body = <EmptyState title="لم يعد هذا الحساب موجودًا" />
  else body = <UserDetails user={user} />

  const footer = user && !locked ? (
    <>
      <button
        type="button"
        className="admin-btn admin-btn-secondary"
        disabled={busy}
        onClick={() => setChangingRole(true)}
      >
        تغيير الدور
      </button>
      <span className="admin-drawer-foot-end">
        {user.isSuspended ? (
          <button type="button" className="admin-action-btn edit" disabled={busy} onClick={() => onUnsuspend(user)}>
            إلغاء الإيقاف
          </button>
        ) : (
          <button type="button" className="admin-action-btn delete" disabled={busy} onClick={() => onSuspend(user)}>
            إيقاف الحساب
          </button>
        )}
      </span>
    </>
  ) : null

  return (
    <>
      <Drawer
        title={user ? personName(user) : 'تفاصيل الحساب'}
        subtitle={user ? realEmail(user.email) || (user.isPlaceholderEmail ? 'تسجيل بالهاتف' : undefined) : undefined}
        badges={user ? (
          <>
            <span className="admin-badge gray">{roleLabel(user.role)}</span>
            {approvalLabel(user) && (
              <span className={`admin-badge ${user.isApproved ? 'green' : user.accountRejectionReason ? 'red' : 'yellow'}`}>
                {approvalLabel(user)}
              </span>
            )}
            <span className={`admin-badge ${user.isSuspended ? 'red' : 'green'}`}>
              {user.isSuspended ? 'موقوف' : 'نشط'}
            </span>
          </>
        ) : null}
        onClose={onClose}
        footer={footer}
        width={600}
      >
        {body}
        {locked && (
          <p className="admin-inline-hint">
            {user.role === 'admin'
              ? 'لا يمكن تغيير دور حساب مدير أو إيقافه من اللوحة.'
              : 'هذا حسابك: لا يمكنك تغيير دوره أو إيقافه.'}
          </p>
        )}
      </Drawer>

      {changingRole && user && (
        <RoleChangeModal user={user} onClose={() => setChangingRole(false)} />
      )}
    </>
  )
}

function UserDetails({ user }) {
  return (
    <>
      {user.isSuspended && (
        <p className="admin-callout danger">
          <strong>الحساب موقوف{user.suspendedAt ? ` منذ ${formatDate(user.suspendedAt)}` : ''}:</strong>{' '}
          {user.suspendedReason || 'بدون سبب مسجّل'}
        </p>
      )}
      {user.accountRejectionReason && !user.isApproved && (
        <p className="admin-callout">
          <strong>رُفض طلب التوثيق{user.accountRejectedAt ? ` في ${formatDate(user.accountRejectedAt)}` : ''}:</strong>{' '}
          {user.accountRejectionReason}
        </p>
      )}

      <DrawerSection title="الحساب">
        <Facts
          items={[
            {
              label: 'الجوال',
              value: user.phone ? `${user.phone} ${user.phoneVerified ? '(موثق)' : '(غير موثق)'}` : 'لا يوجد',
              ltr: Boolean(user.phone),
            },
            { label: 'البريد', value: realEmail(user.email) || 'تسجيل بالهاتف', ltr: Boolean(realEmail(user.email)) },
            { label: 'الدور', value: roleLabel(user.role) },
            { label: 'الاعتماد', value: approvalLabel(user) },
            { label: 'تاريخ التسجيل', value: formatDateTime(user.createdAt) },
          ]}
        />
      </DrawerSection>

      <DrawerSection title={`الحجوزات كضيف (${user.bookings?.length ?? 0})`}>
        {user.bookings?.length ? (
          <ul className="admin-mini-list">
            {user.bookings.map((booking) => {
              const kind = bookingKindOf(booking)
              const thing = booking.service?.title_ar || booking.service?.title_en
                || booking.listing?.name_ar || booking.listing?.name_en
                || (kind === 'service' ? 'خدمة محذوفة' : 'مكان محذوف')
              return (
                <li key={booking._id}>
                  <div className="admin-mini-main">
                    <div className="admin-table-name">{thing}</div>
                    <div className="admin-table-sub">
                      {formatISODate(booking.checkIn ?? booking.date)}
                      {booking.confirmationCode ? <> · <code dir="ltr">{booking.confirmationCode}</code></> : null}
                    </div>
                  </div>
                  <div className="admin-mini-side">
                    <span className={`admin-badge ${BOOKING_STATUS_COLORS[booking.status] || 'gray'}`}>
                      {bookingStatusLabel(booking.status, kind)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="admin-inline-hint">لم يحجز شيئًا بعد.</p>
        )}
        {user.bookings?.length >= 20 && <p className="admin-inline-hint">تُعرض آخر 20 حجزًا.</p>}
      </DrawerSection>

      {(user.listings?.length > 0 || user.role === 'business_owner') && (
        <DrawerSection title={`الأماكن المملوكة (${user.listings?.length ?? 0})`}>
          {user.listings?.length ? (
            <ul className="admin-mini-list">
              {user.listings.map((listing) => {
                const status = listing.status || 'seed'
                return (
                  <li key={listing._id}>
                    <div className="admin-mini-main">
                      <div className="admin-table-name">{listing.name_ar || listing.name_en}</div>
                      <div className="admin-table-sub">{TYPE_LABELS[listing.type] || listing.type}</div>
                    </div>
                    <div className="admin-mini-side">
                      <span className={`admin-badge ${LISTING_STATUS_COLORS[status] || 'gray'}`}>
                        {LISTING_STATUS_LABELS[status] || status}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="admin-inline-hint">لا يملك أماكن.</p>
          )}
        </DrawerSection>
      )}

      {(user.services?.length > 0 || user.role === 'service_provider') && (
        <DrawerSection title={`الخدمات (${user.services?.length ?? 0})`}>
          {user.services?.length ? (
            <ul className="admin-mini-list">
              {user.services.map((service) => (
                <li key={service._id}>
                  <div className="admin-mini-main">
                    <div className="admin-table-name">{service.title_ar || service.title_en}</div>
                    <div className="admin-table-sub">{SERVICE_TYPE_LABELS[service.serviceType] || 'أخرى'}</div>
                  </div>
                  <div className="admin-mini-side">
                    <span className={`admin-badge ${SERVICE_STATUS_COLORS[service.status] || 'gray'}`}>
                      {SERVICE_STATUS_LABELS[service.status] || service.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-inline-hint">لا يقدم خدمات بعد.</p>
          )}
        </DrawerSection>
      )}

      <DrawerSection title={`التبليغات ضد محتواه (${user.reports?.length ?? 0})`}>
        {user.reports?.length ? (
          <ul className="admin-mini-list">
            {user.reports.map((report) => (
              <li key={report._id}>
                <div className="admin-mini-main">
                  <div className="admin-table-name">{report.targetTitle || '—'}</div>
                  <div className="admin-table-sub">
                    {REPORT_TARGET_TYPES_AR[report.targetType] || 'أخرى'} ·{' '}
                    {REPORT_REASONS_AR[report.reason] || 'أخرى'} · {formatDate(report.createdAt)}
                  </div>
                </div>
                <div className="admin-mini-side">
                  <span className={`admin-badge ${report.status === 'pending' ? 'yellow' : 'gray'}`}>
                    {REPORT_STATUS_LABELS[report.status] || report.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="admin-inline-hint">لا توجد تبليغات ضد محتوى هذا الحساب.</p>
        )}
      </DrawerSection>
    </>
  )
}

/**
 * Pick the new role, then confirm it by name. Moving an account to business
 * owner or service provider does not approve it: it waits for its document
 * like any other, which the dialog says before anyone commits.
 */
function RoleChangeModal({ user, onClose }) {
  const setRole = useMutation(api.admin.mutations.setUserRoleAsAdmin)
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [role, setRoleChoice] = useState('')
  const [saving, setSaving] = useState(false)

  const current = user.role || 'tourist'
  const options = ASSIGNABLE_ROLES
    .filter((value) => value !== current)
    .map((value) => ({ value, label: roleLabel(value) }))

  const submit = async () => {
    if (!role || saving) return
    const pendingApproval = isBusinessRole(role)
    const ok = await confirm({
      title: 'تغيير دور هذا الحساب؟',
      message: `سيتغير دور "${personName(user)}" من «${roleLabel(current)}» إلى «${roleLabel(role)}».${
        pendingApproval
          ? ' سيبقى الحساب بانتظار الاعتماد حتى يرفع وثيقته وتُراجع.'
          : ''
      } يُسجَّل التغيير في السجل.`,
      confirmLabel: 'تغيير الدور',
      destructive: true,
    })
    if (!ok) return

    setSaving(true)
    try {
      await setRole({ userId: user._id, role })
      toast.success(`أصبح الدور «${roleLabel(role)}»`)
      onClose()
    } catch (error) {
      toast.error(error)
      setSaving(false)
    }
  }

  return (
    <Modal
      title="تغيير الدور"
      subtitle={personName(user)}
      onClose={onClose}
      width="480px"
      footer={
        <>
          <button type="button" className="admin-btn admin-btn-secondary" onClick={onClose}>
            إلغاء
          </button>
          <button type="button" className="admin-btn admin-btn-primary" disabled={!role || saving} onClick={submit}>
            {saving ? 'جاري...' : 'متابعة'}
          </button>
        </>
      }
    >
      <div className="admin-modal-body">
        <div className="admin-form" style={{ gap: '1rem' }}>
          <div className="admin-form-group">
            <span className="admin-form-label">الدور الحالي</span>
            <span><span className="admin-badge gray">{roleLabel(current)}</span></span>
          </div>
          <div className="admin-form-group">
            <label className="admin-form-label">الدور الجديد</label>
            <FilterSelect
              value={role}
              onChange={setRoleChoice}
              placeholder="اختر الدور الجديد"
              className="w-full"
              options={options}
            />
            {isBusinessRole(role) && (
              <p className="admin-form-hint">
                صاحب المنشأة ومقدم الخدمة يحتاجان إلى رفع وثيقة واعتمادها قبل النشر. لن يصبح الحساب
                معتمدًا بهذا التغيير.
              </p>
            )}
            {/* What a demotion leaves behind, read off the server's rules:
                listings stay public and bookable (isBookableStay does not look
                at the owner), a service stops taking bookings
                (isBookableService wants an approved provider), and the app's
                host and provider screens are behind the role. */}
            {current === 'business_owner' && role && role !== 'business_owner' && (
              <p className="admin-form-hint">
                أماكنه تبقى منشورة ومرتبطة به، لكنه لن يستطيع إدارتها أو الرد على طلبات حجزها من
                التطبيق. عيّن لها مضيفًا آخر من قسم «الأماكن» إن لزم.
              </p>
            )}
            {current === 'service_provider' && role && role !== 'service_provider' && (
              <p className="admin-form-hint">
                خدماته تبقى ظاهرة لكنها لن تقبل الحجز (يظهر للمسافر زر «تواصل»)، ولن يستطيع إدارتها من
                التطبيق.
              </p>
            )}
          </div>
        </div>
      </div>
      {confirmDialog}
    </Modal>
  )
}
