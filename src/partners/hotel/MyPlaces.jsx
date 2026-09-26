import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { toastApi } from '../../admin/components/toast-context'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { usePartnerConfirm } from '../confirm'
import { errorText } from '../lib/errors'
import { EmptyState, SkeletonList, Spinner } from '../components/Ui'
import { cityLabel } from './cities'
import { kindOfType, ownerStatusOf } from './placePayload'

const translations = {
  en: {
    title: 'My places',
    count: (n) => (n === 1 ? '1 place' : `${n} places`),
    add: 'Add a place',
    edit: 'Edit',
    delete: 'Delete',
    emptyTitle: 'No places yet',
    emptyHint: 'Add your hotel or a place to visit. Our team reviews it before it goes live.',
    deleteTitle: 'Delete this place?',
    deleteBody: 'It disappears from the app for good. This cannot be undone.',
    deleted: 'Place deleted.',
    openBookings: 'This place has open bookings. Settle them before deleting it.',
    noPhoto: 'No photo',
    reason: 'Reason:',
    fixHint: 'Edit it and it goes back to review.',
    status: { pending: 'In review', approved: 'Live', rejected: 'Not approved', suspended: 'Suspended' },
    type: { hotel: 'Stay', attraction: 'Place to visit', restaurant: 'Restaurant', event: 'Event', tour: 'Tour' },
  },
  ar: {
    title: 'أماكني',
    count: (n) => (n === 1 ? 'مكان واحد' : n === 2 ? 'مكانان' : `${n} أماكن`),
    add: 'أضف مكانًا',
    edit: 'تعديل',
    delete: 'حذف',
    emptyTitle: 'لا توجد أماكن بعد',
    emptyHint: 'أضف فندقك أو مكانًا للزيارة. يراجعه فريقنا قبل نشره.',
    deleteTitle: 'حذف هذا المكان؟',
    deleteBody: 'سيختفي من التطبيق نهائيًا، ولا يمكن التراجع.',
    deleted: 'تم حذف المكان.',
    openBookings: 'لهذا المكان حجوزات مفتوحة. أنهِها قبل حذفه.',
    noPhoto: 'لا صورة',
    reason: 'السبب:',
    fixHint: 'عدّله ليعود إلى المراجعة.',
    status: { pending: 'قيد المراجعة', approved: 'منشور', rejected: 'مرفوض', suspended: 'موقوف' },
    type: { hotel: 'إقامة', attraction: 'مكان للزيارة', restaurant: 'مطعم', event: 'فعالية', tour: 'جولة' },
  },
}

/**
 * The host's listings, as the app's business/my-listings.tsx: status badge,
 * the admin's reason when rejected or suspended, Edit for the two types that
 * have an editor, and Delete — which the client refuses up front when a
 * booking is still open (the server refuses too; its words are shown then).
 */
export default function MyPlaces() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const { guard } = usePartnerGate('hotel')
  const confirm = usePartnerConfirm()
  const listings = useQuery(api.listings.queries.getMyListings, guard ? 'skip' : {})
  const bookings = useQuery(api.bookings.queries.getBusinessBookings, guard ? 'skip' : {})
  const deleteMyListing = useMutation(api.listings.mutations.deleteMyListing)
  const [deleting, setDeleting] = useState(null)
  const busyRef = useRef(false)

  if (guard) return guard
  if (listings === undefined) return <SkeletonList />

  const open = new Set(
    (bookings ?? [])
      .filter((b) => b.status === 'pending' || b.status === 'confirmed')
      .map((b) => b.listingId),
  )

  const remove = async (listing) => {
    if (busyRef.current) return
    if (open.has(listing._id)) {
      toastApi.error(t.openBookings)
      return
    }
    const ok = await confirm({ title: t.deleteTitle, message: t.deleteBody, destructive: true, confirmLabel: t.delete })
    if (!ok) return
    busyRef.current = true
    setDeleting(listing._id)
    try {
      await deleteMyListing({ listingId: listing._id })
      toastApi.success(t.deleted)
    } catch (err) {
      toastApi.error(errorText(err, lang))
    } finally {
      busyRef.current = false
      setDeleting(null)
    }
  }

  return (
    <div>
      <div className="h-head">
        <div>
          <h1 className="p-title">{t.title}</h1>
          <p className="p-subtitle">{t.count(listings.length)}</p>
        </div>
        <Link className="p-btn p-btn-primary" to="/partners/hotel/places/new">{t.add}</Link>
      </div>

      {listings.length === 0 ? (
        <div className="p-card">
          <EmptyState title={t.emptyTitle} hint={t.emptyHint} icon="building" />
        </div>
      ) : (
        <ul className="h-places">
          {listings.map((l) => {
            const status = ownerStatusOf(l.status)
            const reason = status === 'suspended' ? l.suspendedReason : status === 'rejected' ? l.rejectionReason : null
            const canEdit = kindOfType(l.type) !== null
            const name = lang === 'ar' ? l.name_ar || l.name_en || '—' : l.name_en || l.name_ar || '—'
            return (
              <li key={l._id} className="p-card h-place">
                <div className="h-place-photo">
                  {l.images?.[0] ? <img src={l.images[0]} alt="" loading="lazy" /> : <span className="p-muted p-small">{t.noPhoto}</span>}
                </div>
                <div className="h-place-body">
                  <div className="h-place-top">
                    <strong className="h-place-name">{name}</strong>
                    <span className={`p-badge h-badge-${status}`}>{t.status[status] ?? t.status.pending}</span>
                  </div>
                  <span className="p-muted p-small">
                    {t.type[l.type] ?? l.type} · {cityLabel(l.city, lang)}
                  </span>
                  {(status === 'rejected' || status === 'suspended') && (
                    <p className="p-note h-place-note">
                      {reason && <>{t.reason} {reason} </>}
                      {canEdit && t.fixHint}
                    </p>
                  )}
                  <div className="p-row h-place-actions">
                    {canEdit && (
                      <Link className="p-btn p-btn-outline p-btn-sm" to={`/partners/hotel/places/${l._id}`}>
                        {t.edit}
                      </Link>
                    )}
                    <button
                      type="button"
                      className="p-btn p-btn-danger p-btn-sm"
                      onClick={() => remove(l)}
                      disabled={deleting === l._id}
                    >
                      {deleting === l._id && <Spinner />} {t.delete}
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
