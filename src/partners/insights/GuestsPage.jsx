import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useQuerySafe } from '../../admin/useQuerySafe'
import { toastApi } from '../../admin/components/toast-context'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { EmptyState, ErrorState, Ltr, PageSpinner } from '../components/Ui'
import { errorText } from '../lib/errors'
import { formatPhone } from '../lib/phone'
import { InsightIcon } from './InsightsUi'
import { guestsToCsv, downloadCsv } from './csv'
import { DEFAULT_TAGS, formatCount, formatDay, formatMoney, tagLabel } from './format'
import GuestDrawer from './GuestDrawer'

const translations = {
  en: {
    title: 'Guests',
    subtitle: 'Everyone who has sent you a booking request.',
    count: (n) => (n === 1 ? '1 guest' : `${formatCount(n)} guests`),
    search: 'Search by name or phone',
    allTags: 'All',
    tagsLabel: 'Filter by tag',
    sort: 'Sort by',
    sorts: { recent: 'Last visit', spent: 'Total spent', bookings: 'Bookings' },
    export: 'Export CSV',
    exported: 'The guest list was downloaded.',
    exportFailed: 'The file could not be created.',
    name: 'Name',
    phone: 'Phone',
    bookings: 'Bookings',
    completed: 'Completed',
    spent: 'Spent',
    lastVisit: 'Last visit',
    tags: 'Tags',
    unnamed: 'Guest',
    open: 'Open guest',
    hasNote: 'Has a note',
    truncated: 'Showing the first 500 guests. Search to find anyone else.',
    emptyTitle: 'No guests yet',
    emptyHint: 'Travellers who send you a booking request appear here.',
    noMatchTitle: 'No guests match',
    noMatchHint: 'Try another name, number or tag.',
    errorTitle: 'Guests could not be loaded',
    retry: 'Try again',
  },
  ar: {
    title: 'الضيوف',
    subtitle: 'كل من أرسل إليك طلب حجز.',
    count: (n) => (n === 1 ? 'ضيف واحد' : n === 2 ? 'ضيفان' : n >= 3 && n <= 10 ? `${n} ضيوف` : `${formatCount(n)} ضيفًا`),
    search: 'ابحث بالاسم أو رقم الجوال',
    allTags: 'الكل',
    tagsLabel: 'التصفية حسب الوسم',
    sort: 'الترتيب',
    sorts: { recent: 'آخر زيارة', spent: 'إجمالي المصروف', bookings: 'عدد الحجوزات' },
    export: 'تصدير CSV',
    exported: 'تم تنزيل قائمة الضيوف.',
    exportFailed: 'تعذّر إنشاء الملف.',
    name: 'الاسم',
    phone: 'الجوال',
    bookings: 'الحجوزات',
    completed: 'المكتملة',
    spent: 'المصروف',
    lastVisit: 'آخر زيارة',
    tags: 'الوسوم',
    unnamed: 'ضيف',
    open: 'فتح الضيف',
    hasNote: 'عليه ملاحظة',
    truncated: 'نعرض أول 500 ضيف. ابحث للوصول إلى غيرهم.',
    emptyTitle: 'لا يوجد ضيوف بعد',
    emptyHint: 'يظهر هنا كل مسافر يرسل إليك طلب حجز.',
    noMatchTitle: 'لا يوجد ضيوف مطابقون',
    noMatchHint: 'جرّب اسمًا أو رقمًا أو وسمًا آخر.',
    errorTitle: 'تعذّر تحميل الضيوف',
    retry: 'حاول مرة أخرى',
  },
}

const SORTS = ['recent', 'spent', 'bookings']

function todayISO() {
  return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * The guest CRM: one row per traveller who has booked with this partner,
 * searchable, filterable by the partner's own tags, exportable, and each
 * opening a drawer with their bookings and a private note.
 */
export default function GuestsPage({ role }) {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate(role)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [sort, setSort] = useState('recent')
  const [openId, setOpenId] = useState(null)

  // One query per pause in typing, not per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 250)
    return () => clearTimeout(id)
  }, [searchInput])

  const args = { sort }
  if (search) args.search = search
  if (tag) args.tag = tag
  const result = useQuerySafe(api.partners.queries.listGuests, guard ? 'skip' : args)
  const guests = result.data?.guests

  // The five defaults, every free tag on the guests shown, and the tag being
  // filtered on (so the active chip never disappears from under the pointer).
  const tagChips = useMemo(() => {
    const extra = new Set((guests ?? []).flatMap((g) => g.tags ?? []))
    if (tag) extra.add(tag)
    for (const x of DEFAULT_TAGS) extra.delete(x)
    return [...DEFAULT_TAGS, ...[...extra].sort()]
  }, [guests, tag])

  if (guard) return guard

  const exportCsv = () => {
    try {
      downloadCsv(`hasio-guests-${todayISO()}.csv`, guestsToCsv(guests ?? [], lang))
      toastApi.success(t.exported)
    } catch (err) {
      console.error('[partners] CSV export failed:', err)
      toastApi.error(t.exportFailed)
    }
  }

  const filtering = Boolean(search || tag)
  const nameOf = (g) => g.name || t.unnamed
  const phoneOf = (g) => (g.phone ? <Ltr>{formatPhone(g.phone)}</Ltr> : '—')
  const tagsOf = (g) =>
    (g.tags ?? []).map((x) => <span key={x} className="p-ins-tag">{tagLabel(x, lang)}</span>)

  let body
  if (result.error) {
    body = <ErrorState title={t.errorTitle} hint={errorText(result.error, lang)} retryLabel={t.retry}
      onRetry={() => window.location.reload()} />
  } else if (guests === undefined) {
    body = <PageSpinner />
  } else if (guests.length === 0) {
    body = filtering
      ? <EmptyState icon="user" title={t.noMatchTitle} hint={t.noMatchHint} />
      : <EmptyState icon="user" title={t.emptyTitle} hint={t.emptyHint} />
  } else {
    body = (
      <>
        {result.data.truncated && <p className="p-note" style={{ margin: 0 }}>{t.truncated}</p>}
        <div className="p-card p-ins-table-wrap p-ins-guests-table">
          <table className="p-ins-table">
            <thead>
              <tr>
                <th scope="col">{t.name}</th>
                <th scope="col">{t.phone}</th>
                <th scope="col">{t.bookings}</th>
                <th scope="col">{t.completed}</th>
                <th scope="col">{t.spent}</th>
                <th scope="col">{t.lastVisit}</th>
                <th scope="col">{t.tags}</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => (
                <tr key={g.guestId} className="p-ins-clickable" onClick={() => setOpenId(g.guestId)}>
                  <th scope="row">
                    <button type="button" className="p-ins-link" onClick={(e) => { e.stopPropagation(); setOpenId(g.guestId) }}
                      aria-label={`${t.open}: ${nameOf(g)}`}>
                      {nameOf(g)}
                    </button>
                    {g.hasNote && <span className="p-ins-note-dot" title={t.hasNote} aria-label={t.hasNote} />}
                  </th>
                  <td>{phoneOf(g)}</td>
                  <td>{formatCount(g.bookings)}</td>
                  <td>{formatCount(g.completed)}</td>
                  <td>{formatMoney(g.spent, lang)}</td>
                  <td>{formatDay(g.lastVisit, lang)}</td>
                  <td><span className="p-ins-tags">{tagsOf(g)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="p-ins-guest-cards">
          {guests.map((g) => (
            <li key={g.guestId}>
              <button type="button" className="p-card p-ins-guest-card" onClick={() => setOpenId(g.guestId)}
                aria-label={`${t.open}: ${nameOf(g)}`}>
                <span className="p-ins-guest-card-head">
                  <strong>{nameOf(g)}</strong>
                  <span>{formatMoney(g.spent, lang)}</span>
                </span>
                <span className="p-muted p-small">
                  {phoneOf(g)} · {t.bookings}: {formatCount(g.bookings)} · {t.lastVisit}: {formatDay(g.lastVisit, lang)}
                </span>
                {g.tags?.length > 0 && <span className="p-ins-tags">{tagsOf(g)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className="p-stack">
      <div className="p-ins-head">
        <div>
          <h1 className="p-title">{t.title}</h1>
          <p className="p-subtitle" style={{ margin: 0 }}>
            {guests ? `${t.subtitle} ${t.count(guests.length)}.` : t.subtitle}
          </p>
        </div>
        <button type="button" className="p-btn p-btn-outline p-btn-sm" onClick={exportCsv}
          disabled={!guests || guests.length === 0}>
          <InsightIcon name="download" size={18} />
          <span>{t.export}</span>
        </button>
      </div>

      <div className="p-ins-filters">
        <label className="p-ins-search">
          <InsightIcon name="search" size={18} />
          <input type="search" className="p-input" value={searchInput} placeholder={t.search} aria-label={t.search}
            onChange={(e) => setSearchInput(e.target.value)} />
        </label>
        <label className="p-ins-sort">
          <span className="p-muted p-small">{t.sort}</span>
          <select className="p-input" value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => <option key={s} value={s}>{t.sorts[s]}</option>)}
          </select>
        </label>
      </div>

      <div className="p-chips" role="group" aria-label={t.tagsLabel} style={{ marginBottom: 0 }}>
        <button type="button" className={tag === '' ? 'p-chip is-active' : 'p-chip'} aria-pressed={tag === ''}
          onClick={() => setTag('')}>
          {t.allTags}
        </button>
        {tagChips.map((x) => (
          <button key={x} type="button" className={tag === x ? 'p-chip is-active' : 'p-chip'} aria-pressed={tag === x}
            onClick={() => setTag(tag === x ? '' : x)}>
            {tagLabel(x, lang)}
          </button>
        ))}
      </div>

      {body}

      {openId && <GuestDrawer guestId={openId} onClose={() => setOpenId(null)} />}
    </div>
  )
}
