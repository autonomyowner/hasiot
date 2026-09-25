import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import ServiceDrawer from '../components/ServiceDrawer'
import FilterSelect from '../components/FilterSelect'
import { EmptyState, KeepLooking, LoadMore, TableSkeleton } from '../components/States'
import { usePagedList } from '../usePagedList'
import { useDebounced } from '../../hooks/useDebounced'
import {
  CITY_OPTIONS,
  SERVICE_STATUSES,
  SERVICE_STATUS_COLORS,
  SERVICE_STATUS_LABELS,
  SERVICE_TYPE_LABELS,
  SERVICE_TYPE_OPTIONS,
  cityLabel,
  formatServicePrice,
  personName,
} from '../constants'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../ui/table'

const PAGE_SIZE = 25
// adminSearchServices returns one ranked array, capped here on the server.
const SEARCH_CAP = 50

/**
 * «الخدمات المنشورة» — the services travellers can find, and the ones taken
 * down.
 *
 * Until 1.1.0 a service vanished from the panel the moment it was approved:
 * the only view was the pending queue, so a live service could not be read,
 * corrected, suspended or deleted from here. Browsing and searching are two
 * queries and only one runs at a time, as on the listings tab: Convex search
 * results are ranked, not pageable.
 *
 * It opens on the published services; the status filter reaches the
 * suspended ones (to reinstate them) and the rest. Every decision is in the
 * drawer, where the whole service is in front of whoever makes it.
 */
export default function ServicesTab() {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebounced(searchInput.trim())
  const [status, setStatus] = useState('approved')
  const [serviceType, setServiceType] = useState('')
  const [city, setCity] = useState('')
  const [openId, setOpenId] = useState(null)

  const isSearching = search.length > 0
  const filters = {
    status: status || undefined,
    serviceType: serviceType || undefined,
    city: city || undefined,
  }

  const searchResults = useQuery(
    api.admin.queries.adminSearchServices,
    isSearching ? { search, ...filters } : 'skip'
  )
  const browse = usePagedList(
    api.admin.queries.adminListServices,
    isSearching ? 'skip' : filters,
    PAGE_SIZE
  )

  const rows = (isSearching ? searchResults : browse.results) ?? []
  const loading = isSearching
    ? searchResults === undefined
    : browse.status === 'LoadingFirstPage' ||
      (browse.results.length === 0 && browse.status === 'LoadingMore')
  const stalled = !isSearching && browse.results.length === 0 && browse.status === 'CanLoadMore'
  // "Published" is the tab's own default, not a filter someone chose.
  const hasFilters = Boolean(isSearching || serviceType || city || status !== 'approved')

  const resetFilters = () => {
    setSearchInput('')
    setStatus('approved')
    setServiceType('')
    setCity('')
  }

  const statusWord = status ? SERVICE_STATUS_LABELS[status] : null

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="admin-page-head">
        <div>
          <h2 className="admin-page-title">الخدمات المنشورة</h2>
          <p className="admin-page-subtitle">
            {loading
              ? 'جاري التحميل...'
              : `${rows.length} ${isSearching ? 'نتيجة' : 'خدمة معروضة'}${
                  !isSearching && browse.status === 'CanLoadMore' ? ' — هناك المزيد' : ''
                }`}
          </p>
        </div>
      </div>

      <div className="admin-filters">
        <input
          type="search"
          className="admin-form-input admin-search-input"
          placeholder="ابحث بعنوان الخدمة بالعربية أو الإنجليزية..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="بحث في الخدمات"
        />
        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="كل الحالات"
          options={[{ value: '', label: 'كل الحالات' }, ...SERVICE_STATUSES]}
        />
        <FilterSelect
          value={serviceType}
          onChange={setServiceType}
          placeholder="كل الأنواع"
          options={[{ value: '', label: 'كل الأنواع' }, ...SERVICE_TYPE_OPTIONS]}
        />
        <FilterSelect
          value={city}
          onChange={setCity}
          placeholder="كل المدن"
          options={[{ value: '', label: 'كل المدن' }, ...CITY_OPTIONS]}
        />
        {hasFilters && (
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-small" onClick={resetFilters}>
            مسح الفلاتر
          </button>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={6} cols={7} />
      ) : stalled ? (
        <KeepLooking onLoadMore={browse.loadMore} />
      ) : rows.length === 0 ? (
        <EmptyState
          title={
            isSearching ? 'لا توجد خدمات مطابقة'
              : statusWord ? `لا توجد خدمات ${statusWord}` : 'لا توجد خدمات بعد'
          }
          hint={hasFilters
            ? 'جرّب تغيير البحث أو الفلاتر.'
            : 'الخدمات التي يضيفها مقدمو الخدمات من التطبيق تظهر هنا بعد الموافقة عليها.'}
          action={hasFilters
            ? <button type="button" className="admin-btn admin-btn-secondary" onClick={resetFilters}>مسح الفلاتر</button>
            : null}
        />
      ) : (
        <>
          <Table className="admin-table">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '64px' }}>الصورة</TableHead>
                <TableHead>الخدمة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>المدينة</TableHead>
                <TableHead>السعر</TableHead>
                <TableHead>مقدم الخدمة</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead style={{ textAlign: 'left' }}>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((service) => {
                const price = formatServicePrice(service.price, service.priceUnit)
                return (
                  <TableRow key={service._id}>
                    <TableCell>
                      {service.images?.length ? (
                        <img className="admin-row-thumb" src={service.images[0]} alt="" loading="lazy" />
                      ) : (
                        <span className="admin-row-thumb empty" title="لا توجد صور">—</span>
                      )}
                    </TableCell>
                    <TableCell data-label="الخدمة">
                      <div className="admin-table-name">{service.title_ar}</div>
                      <div className="admin-table-sub" dir="ltr">{service.title_en}</div>
                    </TableCell>
                    <TableCell data-label="النوع">{SERVICE_TYPE_LABELS[service.serviceType] || 'أخرى'}</TableCell>
                    <TableCell data-label="المدينة">{service.city ? cityLabel(service.city) : '—'}</TableCell>
                    <TableCell data-label="السعر">
                      {price ? (
                        <div className="admin-table-name">{price}</div>
                      ) : (
                        <span className="admin-badge yellow" title="بدون سعر رقمي يظهر زر «تواصل» بدل «احجز»">
                          بدون سعر
                        </span>
                      )}
                    </TableCell>
                    <TableCell data-label="مقدم الخدمة">
                      {service.owner ? (
                        <>
                          <div className="admin-table-name">{personName(service.owner)}</div>
                          {service.owner.phone && (
                            <div className="admin-table-sub" dir="ltr">{service.owner.phone}</div>
                          )}
                          {service.owner.isSuspended && (
                            <span className="admin-badge red">الحساب موقوف</span>
                          )}
                        </>
                      ) : (
                        <span className="admin-table-sub">حساب محذوف</span>
                      )}
                    </TableCell>
                    <TableCell data-label="الحالة">
                      <span className={`admin-badge ${SERVICE_STATUS_COLORS[service.status] || 'gray'}`}>
                        {SERVICE_STATUS_LABELS[service.status] || service.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="admin-action-btn edit"
                          onClick={() => setOpenId(service._id)}
                        >
                          التفاصيل والإجراءات
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>

          {!isSearching && (
            <LoadMore status={browse.status} onLoadMore={browse.loadMore} cols={7} />
          )}
          {isSearching && rows.length >= SEARCH_CAP && (
            <p className="admin-inline-hint">تُعرض أول {SEARCH_CAP} نتيجة فقط. ضيّق البحث لنتائج أدق.</p>
          )}
        </>
      )}

      {openId && (
        <ServiceDrawer key={openId} serviceId={openId} onClose={() => setOpenId(null)} />
      )}
    </motion.div>
  )
}
