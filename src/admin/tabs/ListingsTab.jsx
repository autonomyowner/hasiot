import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import ListingForm from './ListingForm'
import WorkingHoursModal from '../components/WorkingHoursModal'
import { useConfirm } from '../components/ConfirmDialog'
import { useToast } from '../components/toast-context'
import { EmptyState, TableSkeleton } from '../components/States'
import { CITIES, CITY_LABELS, LISTING_TYPES, TYPE_LABELS, cityLabel } from '../constants'

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
  if (status === 'approved') return <span className="admin-badge green">معتمد</span>
  if (status === 'pending') return <span className="admin-badge yellow">قيد المراجعة</span>
  if (status === 'rejected') return <span className="admin-badge red">مرفوض</span>
  // Seed listings carry no status at all and are treated as approved everywhere.
  return <span className="admin-badge gray">أصلي</span>
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

  const createListing = useMutation(api.admin.mutations.createListing)
  const updateListing = useMutation(api.admin.mutations.updateListing)
  const deleteListing = useMutation(api.admin.mutations.deleteListing)

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
        <select value={type} onChange={(e) => setType(e.target.value)} className="admin-form-select">
          <option value="">كل الأنواع</option>
          {LISTING_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="admin-form-select">
          <option value="">كل المدن</option>
          {CITIES.map((c) => <option key={c} value={c}>{CITY_LABELS[c] || c}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="admin-form-select">
          <option value="">كل حالات المراجعة</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">معتمد</option>
          <option value="rejected">مرفوض</option>
          <option value="seed">أصلي (بيانات أولية)</option>
        </select>
        <select value={photos} onChange={(e) => setPhotos(e.target.value)} className="admin-form-select">
          <option value="">الصور: الكل</option>
          <option value="no">بدون صور</option>
          <option value="yes">لديها صور</option>
        </select>
        <select value={hours} onChange={(e) => setHours(e.target.value)} className="admin-form-select">
          <option value="">أوقات العمل: الكل</option>
          <option value="no">بدون أوقات</option>
          <option value="yes">لديها أوقات</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="admin-form-select">
          <option value="newest">الأحدث أولاً</option>
          <option value="oldest">الأقدم أولاً</option>
          <option value="name">الاسم (أ - ي)</option>
          <option value="rating">الأعلى تقييماً</option>
        </select>
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
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: '64px' }}>الصورة</th>
                  <th>الاسم</th>
                  <th>النوع</th>
                  <th>المدينة</th>
                  <th>الحالة</th>
                  <th>المراجعة</th>
                  <th>أوقات العمل</th>
                  <th style={{ textAlign: 'left' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((listing) => (
                  <tr key={listing._id} className={busyId === listing._id ? 'is-busy' : ''}>
                    <td>
                      {listing.images?.length ? (
                        <img className="admin-row-thumb" src={listing.images[0]} alt="" loading="lazy" />
                      ) : (
                        <span className="admin-row-thumb empty" title="لا توجد صور">—</span>
                      )}
                    </td>
                    <td data-label="الاسم">
                      <div className="admin-table-name">{listing.name_ar}</div>
                      <div className="admin-table-sub" dir="ltr">{listing.name_en}</div>
                    </td>
                    <td data-label="النوع">{TYPE_LABELS[listing.type] || listing.type}</td>
                    <td data-label="المدينة">{cityLabel(listing.city)}</td>
                    <td data-label="الحالة">
                      <span className={`admin-badge ${listing.isActive !== false ? 'green' : 'gray'}`}>
                        {listing.isActive !== false ? 'نشط' : 'غير نشط'}
                      </span>
                      {listing.isVerified && <span className="admin-badge blue">موثق</span>}
                    </td>
                    <td data-label="المراجعة"><ReviewBadge status={listing.status} /></td>
                    <td data-label="أوقات العمل">
                      {listing.workingHours?.length ? (
                        <span className="admin-badge green">محددة</span>
                      ) : (
                        <span className="admin-badge yellow" title="بدون أوقات عمل لا يمكن الحجز">
                          غير محددة
                        </span>
                      )}
                    </td>
                    <td>
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
                        <button
                          onClick={() => handleDelete(listing)}
                          className="admin-action-btn delete"
                          disabled={busyId === listing._id}
                        >
                          {busyId === listing._id ? 'جاري...' : 'حذف'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
