import { useState } from 'react'
import { motion } from 'framer-motion'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, KeepLooking, LoadMore, TableSkeleton } from '../components/States'
import FilterSelect from '../components/FilterSelect'
import UserDrawer from '../components/UserDrawer'
import { usePagedList } from '../usePagedList'
import { useDebounced } from '../../hooks/useDebounced'
import { ROLE_LABELS, formatDate, personName, roleLabel } from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

const PAGE_SIZE = 25

const triState = (value) => (value === '' ? undefined : value === 'yes')

/**
 * Accounts.
 *
 * The panel had every other entity but no way to see a person — which meant a
 * fraudulent booker or an abusive host could only be dealt with by editing
 * rows in the Convex dashboard.
 *
 * Browsing and searching are separate queries and only one runs at a time, the
 * same shape the listings tab uses: Convex search results are ranked by
 * relevance and cannot be paginated like an index scan.
 *
 * «التفاصيل» opens the whole account (UserDrawer): its bookings, what it
 * publishes, the reports against it, and «تغيير الدور».
 */
export default function UsersTab({ currentUser }) {
  const [searchInput, setSearchInput] = useState('')
  const searchQuery = useDebounced(searchInput.trim())
  const [role, setRole] = useState('')
  const [verified, setVerified] = useState('')
  const [suspended, setSuspended] = useState('')

  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [busyId, setBusyId] = useState(null)
  const [openId, setOpenId] = useState(null)

  const suspendUser = useMutation(api.admin.mutations.suspendUser)
  const unsuspendUser = useMutation(api.admin.mutations.unsuspendUser)

  // Two characters is the shortest term the search index returns anything
  // useful for, and below it every keystroke would scan the whole table.
  const isSearching = searchQuery.length >= 2

  const filters = {
    role: role || undefined,
    phoneVerified: triState(verified),
    suspended: triState(suspended),
  }

  const searchResults = useQuery(
    api.admin.users.adminSearchUsers,
    isSearching ? { searchQuery, ...filters } : 'skip'
  )
  const browse = usePagedList(
    api.admin.users.adminListUsers,
    isSearching ? 'skip' : filters,
    PAGE_SIZE
  )

  const rows = isSearching ? searchResults : browse.results
  const loading = isSearching
    ? searchResults === undefined
    : browse.status === 'LoadingFirstPage' ||
      (browse.results.length === 0 && browse.status === 'LoadingMore')
  const stalled = !isSearching && browse.results.length === 0 && browse.status === 'CanLoadMore'
  const hasFilters = Boolean(role || verified || suspended || isSearching)

  // A phone sign-up's address is synthesised and undeliverable, so showing it
  // as a name would put "966501234567@phone.hasio.xyz" in the table.
  const displayName = personName

  const handleSuspend = async (user) => {
    const result = await confirm({
      title: 'إيقاف هذا الحساب؟',
      message: `${displayName(user)} — لن يتمكن من الدخول أو الحجز حتى يُرفع الإيقاف.`,
      confirmLabel: 'إيقاف الحساب',
      destructive: true,
      reason: {
        label: 'سبب الإيقاف',
        placeholder: 'مثال: حجوزات وهمية متكررة',
        required: true,
      },
    })
    if (!result) return

    setBusyId(user._id)
    try {
      await suspendUser({ userId: user._id, reason: result.reason })
      toast.success('تم إيقاف الحساب')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleUnsuspend = async (user) => {
    setBusyId(user._id)
    try {
      await unsuspendUser({ userId: user._id })
      toast.success('تم إلغاء الإيقاف')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title">المستخدمون</h2>
          <p className="admin-page-subtitle">
            {loading
              ? 'جاري التحميل...'
              : `${rows?.length ?? 0} حساب معروض${
                  !isSearching && browse.status === 'CanLoadMore' ? ' — هناك المزيد' : ''
                }`}
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <input
          className="admin-form-input admin-search-input"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ابحث بالبريد أو الهاتف أو الاسم..."
          aria-label="بحث في المستخدمين"
        />
        <FilterSelect
          value={role}
          onChange={setRole}
          placeholder="كل الأدوار"
          options={[
            { value: '', label: 'كل الأدوار' },
            ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
        />
        <FilterSelect
          value={verified}
          onChange={setVerified}
          placeholder="التوثيق"
          options={[
            { value: '', label: 'التوثيق: الكل' },
            { value: 'yes', label: 'جوال موثق' },
            { value: 'no', label: 'غير موثق' },
          ]}
        />
        <FilterSelect
          value={suspended}
          onChange={setSuspended}
          placeholder="الحالة"
          options={[
            { value: '', label: 'الحالة: الكل' },
            { value: 'no', label: 'نشط' },
            { value: 'yes', label: 'موقوف' },
          ]}
        />
        {hasFilters && (
          <button
            className="admin-action-btn"
            onClick={() => {
              setSearchInput('')
              setRole('')
              setVerified('')
              setSuspended('')
            }}
          >
            مسح الفلاتر
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={6} />
      ) : stalled ? (
        <KeepLooking onLoadMore={browse.loadMore} />
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'لا توجد حسابات مطابقة' : 'لا توجد حسابات بعد'}
          hint={hasFilters ? 'جرّب تعديل البحث أو الفلاتر.' : undefined}
        />
      ) : (
        <>
          <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>الجوال</TableHead>
                <TableHead>الدور</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التسجيل</TableHead>
                <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <TableRow key={user._id} className={busyId === user._id ? 'is-busy' : ''}>
                  <TableCell data-label="المستخدم">
                    <div className="admin-table-name">{displayName(user)}</div>
                    <div className="admin-table-sub" dir="ltr">
                      {user.isPlaceholderEmail ? 'تسجيل بالهاتف' : user.email}
                    </div>
                  </TableCell>
                  <TableCell data-label="الجوال">
                    {user.phone ? (
                      <>
                        <div dir="ltr">{user.phone}</div>
                        <span className={`admin-badge ${user.phoneVerified ? 'green' : 'gray'}`}>
                          {user.phoneVerified ? 'موثق' : 'غير موثق'}
                        </span>
                      </>
                    ) : (
                      <span className="admin-table-sub">—</span>
                    )}
                  </TableCell>
                  <TableCell data-label="الدور">
                    {roleLabel(user.role)}
                    {/* The rule the drawer uses: a rejection stands while its
                        reason is set, so the two never disagree. */}
                    {user.isApproved === false && (
                      <div className="admin-table-sub" title={user.accountRejectionReason || ''}>
                        {user.accountRejectionReason ? 'مرفوض' : 'بانتظار الاعتماد'}
                      </div>
                    )}
                  </TableCell>
                  <TableCell data-label="الحالة">
                    {user.isSuspended ? (
                      <span className="admin-badge red" title={user.suspendedReason || ''}>
                        موقوف
                      </span>
                    ) : (
                      <span className="admin-badge green">نشط</span>
                    )}
                  </TableCell>
                  <TableCell data-label="التسجيل">{formatDate(user.createdAt)}</TableCell>
                  <TableCell>
                    <div className="admin-actions">
                      <button
                        className="admin-action-btn edit"
                        onClick={() => setOpenId(user._id)}
                      >
                        التفاصيل
                      </button>
                      {/* An admin account, the operator's own included, can be
                          neither suspended nor re-roled: the server refuses. */}
                      {user.role === 'admin' || user._id === currentUser?._id ? null : user.isSuspended ? (
                        <button
                          className="admin-action-btn edit"
                          onClick={() => handleUnsuspend(user)}
                          disabled={busyId === user._id}
                        >
                          إلغاء الإيقاف
                        </button>
                      ) : (
                        <button
                          className="admin-action-btn delete"
                          onClick={() => handleSuspend(user)}
                          disabled={busyId === user._id}
                        >
                          إيقاف
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isSearching && (
            <LoadMore status={browse.status} onLoadMore={browse.loadMore} cols={6} />
          )}
        </>
      )}

      {openId && (
        <UserDrawer
          key={openId}
          userId={openId}
          currentUserId={currentUser?._id}
          busy={busyId === openId}
          onClose={() => setOpenId(null)}
          onSuspend={handleSuspend}
          onUnsuspend={handleUnsuspend}
        />
      )}
      {confirmDialog}
    </motion.div>
  )
}
