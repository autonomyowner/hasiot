import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import ListingForm from './ListingForm'
import WorkingHoursModal from '../components/WorkingHoursModal'
import Switch from '../components/Switch'
import FilterSelect from '../components/FilterSelect'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import {
  CITIES,
  CITY_LABELS,
  LISTING_STATUS_COLORS,
  LISTING_STATUS_LABELS,
  LISTING_TYPES,
  TYPE_LABELS,
  cityLabel,
  formatMoney,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

const PAGE_SIZE = 25

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

const triState = (value) => (value === '' ? undefined : value === 'yes')

function ReviewBadge({ status }) {
  // Seed listings carry no status at all and are treated as approved everywhere.
  const key = status || 'seed'
  return (
    <span className={`admin-badge ${LISTING_STATUS_COLORS[key] || 'gray'}`}>
      {LISTING_STATUS_LABELS[key] || key}
    </span>
  )
}

export default function ListingsTab({ initialFilters }) {
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()

  const [searchInput, setSearchInput] = useState('')
  const searchQuery = useDebounced(searchInput.trim())
  const [type, setType] = useState('')
  const [city, setCity] = useState('')
  const [status, setStatus] = useState('')
  // The dashboard's "places with no photos" card lands here with the filter
  // already applied, so the count and the list can never disagree.
  const [photos, setPhotos] = useState(initialFilters?.hasImages || '')
  const [hours, setHours] = useState(initialFilters?.hasWorkingHours || '')
  const [sort, setSort] = useState('newest')

  const [formListing, setFormListing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [hoursListing, setHoursListing] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  const createListing = useMutation(api.admin.mutations.createListing)
  const updateListing = useMutation(api.admin.mutations.updateListing)
  const deleteListing = useMutation(api.admin.mutations.deleteListing)
  const setListingActive = useMutation(api.admin.mutations.setListingActive)
  const suspendListing = useMutation(api.admin.mutations.suspendListing)
  const reinstateListing = useMutation(api.admin.mutations.reinstateListing)

  const isSearching = searchQuery.length > 0
  const filters = {
    type: type || undefined,
    city: city || undefined,
    status: status || undefined,
    hasImages: triState(photos),
    hasWorkingHours: triState(hours),
  }

  // Search and browse are two different queries: a Convex search index cannot be
  // paginated the way an ordinary index can, and search results are narrow
  // enough not to need it. Exactly one of the two runs at a time.
  const searchResults = useQuery(
    api.admin.queries.adminSearchListings,
    isSearching ? { searchQuery, ...filters } : 'skip'
  )
  const browse = usePaginatedQuery(
    api.admin.queries.adminListListings,
    isSearching ? 'skip' : { ...filters, order: sort === 'oldest' ? 'oldest' : 'newest' },
    { initialNumItems: PAGE_SIZE }
  )

  const rows = isSearching ? searchResults : browse.results
  const loading = isSearching ? searchResults === undefined : browse.status === 'LoadingFirstPage'

  // "newest"/"oldest" are resolved on the server by index order. Name and rating
  // can only be applied to what is already loaded, which the hint below says.
  const visibleRows = useMemo(() => {
    if (!rows) return []
    if (sort === 'name') {
      return [...rows].sort((a, b) => (a.name_ar || a.name_en).localeCompare(b.name_ar || b.name_en, 'ar'))
    }
    if (sort === 'rating') {
      return [...rows].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    }
    return rows
  }, [rows, sort])

  const clientSorted = sort === 'name' || sort === 'rating'
  const hasFilters = Boolean(type || city || status || photos || hours || isSearching)

  const handleSubmit = async (data) => {
    try {
      if (formListing) {
        await updateListing({ id: formListing._id, ...data })
        toast.success('تم حفظ التعديلات')
      } else {
        await createListing(data)
        toast.success('تمت إضافة المكان')
      }
      setShowForm(false)
      setFormListing(null)
    } catch (error) {
      toast.error(error)
      throw error
    }
  }

  // Visibility is a switch, not a form field: hiding a listing from the app is a
  // one-click, one-click-back action, so it gets no confirmation dialog — the
  // toast names what changed and the switch itself shows the new state.
  const handleToggleActive = async (listing, next) => {
    setTogglingId(listing._id)
    try {
      await setListingActive({ id: listing._id, isActive: next })
      toast.success(
        next
          ? `"${listing.name_ar || listing.name_en}" ظاهر الآن في التطبيق`
          : `"${listing.name_ar || listing.name_en}" مخفي الآن عن التطبيق`
      )
    } catch (error) {
      toast.error(error)
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (listing) => {
    const ok = await confirm({
      title: 'حذف هذا المكان؟',
      message: `سيُحذف "${listing.name_ar || listing.name_en}" نهائياً من التطبيق. لا يمكن التراجع عن هذا الإجراء.`,
      confirmLabel: 'حذف نهائي',
      destructive: true,
    })
    if (!ok) return

    setBusyId(listing._id)
    try {
      await deleteListing({ id: listing._id })
      toast.success('تم حذف المكان')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  /**
   * Take a live listing down without destroying it.
   *
   * Distinct from rejecting, which is a verdict on a submission that was never
   * public, and from deleting, which is irreversible. A suspended listing keeps
   * its photos, hours and bookings and can be put straight back.
   */
  const handleSuspend = async (listing) => {
    const result = await confirm({
      title: 'إيقاف هذا المكان؟',
      message: `سيختفي "${listing.name_ar || listing.name_en}" من التطبيق ولن يقبل حجوزات جديدة. الحجوزات القائمة لا تتأثر.`,
      confirmLabel: 'إيقاف',
      destructive: true,
      reason: {
        label: 'سبب الإيقاف',
        placeholder: 'مثال: انتهاء الترخيص',
        required: true,
      },
    })
    if (!result) return

    setBusyId(listing._id)
    try {
      await suspendListing({ id: listing._id, reason: result.reason })
      toast.success('تم إيقاف المكان')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const handleReinstate = async (listing) => {
    setBusyId(listing._id)
    try {
      await reinstateListing({ id: listing._id })
      toast.success('تمت إعادة المكان')
    } catch (error) {
      toast.error(error)
    } finally {
      setBusyId(null)
    }
  }

  const resetFilters = () => {
    setSearchInput(''); setType(''); setCity(''); setStatus(''); setPhotos(''); setHours('')
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-card-header">
        <div>
          <h2 className="admin-page-title" style={{ margin: 0 }}>الأماكن</h2>
          <p className="admin-page-subtitle">
            {loading ? 'جاري التحميل...' : `${visibleRows.length} ${isSearching ? 'نتيجة' : 'معروضة'}`}
            {!isSearching && browse.status === 'CanLoadMore' ? ' — هناك المزيد' : ''}
          </p>
        </div>
        <button
          onClick={() => { setFormListing(null); setShowForm(true) }}
          className="admin-btn admin-btn-primary"
        >
          إضافة مكان
        </button>
      </div>

      <div className="admin-filters">
        <input
          type="search"
          className="admin-form-input admin-search-input"
          placeholder="ابحث بالاسم بالعربية أو الإنجليزية..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <FilterSelect
          value={type}
          onChange={setType}
          placeholder="كل الأنواع"
          options={[{ value: '', label: 'كل الأنواع' }, ...LISTING_TYPES]}
        />
        <FilterSelect
          value={city}
          onChange={setCity}
          placeholder="كل المدن"
          options={[
            { value: '', label: 'كل المدن' },
            ...CITIES.map((c) => ({ value: c, label: CITY_LABELS[c] || c })),
          ]}
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="كل حالات المراجعة"
          options={[
            { value: '', label: 'كل حالات المراجعة' },
            { value: 'pending', label: 'قيد المراجعة' },
            { value: 'approved', label: 'معتمد' },
            { value: 'rejected', label: 'مرفوض' },
            { value: 'suspended', label: 'موقوف' },
            { value: 'seed', label: 'أصلي (بيانات أولية)' },
          ]}
        />
        <FilterSelect
          value={photos}
          onChange={setPhotos}
          placeholder="الصور: الكل"
          options={[
            { value: '', label: 'الصور: الكل' },
            { value: 'no', label: 'بدون صور' },
            { value: 'yes', label: 'لديها صور' },
          ]}
        />
        <FilterSelect
          value={hours}
          onChange={setHours}
          placeholder="أوقات العمل: الكل"
          options={[
            { value: '', label: 'أوقات العمل: الكل' },
            { value: 'no', label: 'بدون أوقات' },
            { value: 'yes', label: 'لديها أوقات' },
          ]}
        />
        <FilterSelect
          value={sort}
          onChange={setSort}
          placeholder="الترتيب"
          options={[
            { value: 'newest', label: 'الأحدث أولاً' },
            { value: 'oldest', label: 'الأقدم أولاً' },
            { value: 'name', label: 'الاسم (أ - ي)' },
            { value: 'rating', label: 'الأعلى تقييماً' },
          ]}
        />
        {hasFilters && (
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-small" onClick={resetFilters}>
            مسح الفلاتر
          </button>
        )}
      </div>

      {clientSorted && (
        <p className="admin-inline-hint">هذا الترتيب يطبَّق على النتائج المحمّلة حالياً فقط.</p>
      )}

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : visibleRows.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'لا توجد نتائج مطابقة' : 'لا توجد أماكن بعد'}
          hint={hasFilters
            ? 'جرّب تغيير الفلاتر أو مسحها.'
            : 'أضف أول فندق أو مطعم ليظهر في التطبيق.'}
          action={hasFilters
            ? <button className="admin-btn admin-btn-secondary" onClick={resetFilters}>مسح الفلاتر</button>
            : <button className="admin-btn admin-btn-primary" onClick={() => { setFormListing(null); setShowForm(true) }}>إضافة مكان</button>}
        />
      ) : (
        <>
          <Table className="admin-table">
              <TableHeader>
                <TableRow>
                  <TableHead style={{ width: '64px' }}>الصورة</TableHead>
                  <TableHead>الاسم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>المدينة</TableHead>
                  <TableHead>الظهور</TableHead>
                  <TableHead>المراجعة</TableHead>
                  <TableHead>أوقات العمل</TableHead>
                  <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((listing) => (
                  <TableRow key={listing._id} className={busyId === listing._id ? 'is-busy' : ''}>
                    <TableCell>
                      {listing.images?.length ? (
                        <img className="admin-row-thumb" src={listing.images[0]} alt="" loading="lazy" />
                      ) : (
                        <span className="admin-row-thumb empty" title="لا توجد صور">—</span>
                      )}
                    </TableCell>
                    <TableCell data-label="الاسم">
                      <div className="admin-table-name">{listing.name_ar}</div>
                      <div className="admin-table-sub" dir="ltr">{listing.name_en}</div>
                      {/* The nightly rate, when set — this is what decides
                          whether a hotel can be booked at all. */}
                      {listing.pricePerNight != null && (
                        <div className="admin-table-sub">
                          {formatMoney(listing.pricePerNight)} / ليلة
                        </div>
                      )}
                    </TableCell>
                    <TableCell data-label="النوع">{TYPE_LABELS[listing.type] || listing.type}</TableCell>
                    <TableCell data-label="المدينة">{cityLabel(listing.city)}</TableCell>
                    {/* The verified badge is a separate fact from the toggle, so
                        it stacks under it rather than running into it. */}
                    <TableCell data-label="الظهور">
                      <div className="admin-cell-stack">
                        <Switch
                          checked={listing.isActive !== false}
                          busy={togglingId === listing._id}
                          onChange={(next) => handleToggleActive(listing, next)}
                          label={`ظهور ${listing.name_ar || listing.name_en} في التطبيق`}
                          onLabel="ظاهر"
                          offLabel="مخفي"
                        />
                        {listing.isVerified && <span className="admin-badge blue">موثق</span>}
                      </div>
                    </TableCell>
                    <TableCell data-label="المراجعة"><ReviewBadge status={listing.status} /></TableCell>
                    <TableCell data-label="أوقات العمل">
                      {listing.workingHours?.length ? (
                        <span className="admin-badge green">محددة</span>
                      ) : (
                        <span className="admin-badge yellow" title="بدون أوقات عمل لا يمكن الحجز">
                          غير محددة
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="admin-actions">
                        <button
                          onClick={() => { setFormListing(listing); setShowForm(true) }}
                          className="admin-action-btn edit"
                        >
                          تعديل
                        </button>
                        <button
                          onClick={() => setHoursListing(listing)}
                          className="admin-action-btn"
                        >
                          الأوقات
                        </button>
                        {/* Suspension, not deletion: the listing, its photos
                            and its bookings all stay put, so reinstating puts
                            back exactly what was there. */}
                        {listing.status === 'suspended' ? (
                          <button
                            onClick={() => handleReinstate(listing)}
                            className="admin-action-btn edit"
                            disabled={busyId === listing._id}
                          >
                            إعادة
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(listing)}
                            className="admin-action-btn delete"
                            disabled={busyId === listing._id}
                          >
                            إيقاف
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(listing)}
                          className="admin-action-btn delete"
                          disabled={busyId === listing._id}
                        >
                          {busyId === listing._id ? 'جاري...' : 'حذف'}
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

          {!isSearching && browse.status === 'CanLoadMore' && (
            <div className="admin-load-more">
              <button
                className="admin-btn admin-btn-secondary"
                onClick={() => browse.loadMore(PAGE_SIZE)}
              >
                تحميل المزيد
              </button>
            </div>
          )}
          {!isSearching && browse.status === 'LoadingMore' && <TableSkeleton rows={2} cols={7} />}
          {isSearching && visibleRows.length === 100 && (
            <p className="admin-inline-hint">تُعرض أول 100 نتيجة فقط. ضيّق البحث لنتائج أدق.</p>
          )}
        </>
      )}

      <AnimatePresence>
        {showForm && (
          <ListingForm
            key={formListing?._id || 'new'}
            initialData={formListing}
            onSubmit={handleSubmit}
            onClose={() => { setShowForm(false); setFormListing(null) }}
          />
        )}
        {hoursListing && (
          <WorkingHoursModal
            key={hoursListing._id}
            listing={hoursListing}
            onClose={() => setHoursListing(null)}
          />
        )}
      </AnimatePresence>

      {confirmDialog}
    </motion.div>
  )
}
