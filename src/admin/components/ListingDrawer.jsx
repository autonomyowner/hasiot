import { useState } from 'react'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Drawer, { DrawerSection, Facts, Gallery } from './Drawer'
import { useConfirm } from './ConfirmDialog'
import { useToast } from './toast-context'
import {
  AMENITY_LABELS,
  CATEGORY_LABELS,
  CITY_LABELS,
  GUESTS,
  PIN_WARNING_KM,
  TYPE_LABELS,
  arCount,
  canonicalCity,
  cityCentre,
  cityLabel,
  distanceKm,
  formatDate,
  formatMoney,
  insideSaudiArabia,
  isPlaceholderEmail,
  realEmail,
  safeHttpUrl,
} from '../constants'

/**
 * A place submitted from the app, read in full before it is approved.
 *
 * The queue used to approve from a row that showed a name, a type and a city,
 * which is not enough to judge what every traveller is about to be shown. This
 * lays out the photos, the description, the price and the contact details, and
 * checks the pin against the city it claims — the posting forms have no map,
 * so a pin in the wrong city is the likeliest mistake in a submission.
 *
 * `listing` is the queue's own row (listPendingContent returns whole
 * documents). Approving or rejecting closes the drawer, since either takes the
 * place out of the queue.
 */
export default function ListingDrawer({ listing, onClose }) {
  const approve = useMutation(api.admin.mutations.approveContent)
  const reject = useMutation(api.admin.mutations.rejectContent)
  const toast = useToast()
  const { confirm, confirmDialog } = useConfirm()
  const [busy, setBusy] = useState(false)

  const name = listing.name_ar || listing.name_en
  // A seed row, or one whose host has not been assigned, has nobody to tell.
  const notified = listing.ownerId ? 'وسيتم إشعار صاحب المكان.' : 'لا يوجد صاحب مرتبط بهذا المكان لإشعاره.'

  const decide = async (action, success) => {
    setBusy(true)
    try {
      await action()
      toast.success(success)
      onClose()
    } catch (error) {
      toast.error(error)
    } finally {
      setBusy(false)
    }
  }

  const handleApprove = async () => {
    const ok = await confirm({
      title: 'الموافقة على هذا المكان؟',
      message: `سيظهر "${name}" للمسافرين في التطبيق فورًا، ${notified}`,
      confirmLabel: 'موافقة ونشر',
    })
    if (!ok) return
    await decide(() => approve({ id: listing._id }), `تمت الموافقة على "${name}"`)
  }

  const handleReject = async () => {
    const result = await confirm({
      title: 'رفض هذا المكان؟',
      message: `سيظهر سبب الرفض لصاحب "${name}" في التطبيق، ويمكنه التعديل وإعادة الإرسال. ${notified}`,
      confirmLabel: 'تأكيد الرفض',
      destructive: true,
      reason: { label: 'سبب الرفض (اختياري)', placeholder: 'مثال: الصور غير واضحة، العنوان غير صحيح...' },
    })
    if (!result) return
    await decide(
      () => reject({ id: listing._id, reason: result.reason || undefined }),
      'تم رفض المكان'
    )
  }

  const { lat, lng } = listing.coordinates || {}
  const centre = cityCentre(listing.city)
  const distance = centre && Number.isFinite(lat) && Number.isFinite(lng)
    ? distanceKm({ lat, lng }, centre)
    : null
  const outside = Number.isFinite(lat) && Number.isFinite(lng) && !insideSaudiArabia(lat, lng)
  const isHotel = listing.type === 'hotel'

  return (
    <>
      <Drawer
        title={name}
        subtitle={listing.name_en}
        badges={
          <>
            <span className="admin-badge yellow">قيد المراجعة</span>
            <span className="admin-badge gray">{TYPE_LABELS[listing.type] || listing.type}</span>
          </>
        }
        onClose={onClose}
        width={600}
        footer={
          <>
            <button type="button" className="admin-btn admin-btn-primary" disabled={busy} onClick={handleApprove}>
              موافقة
            </button>
            <button type="button" className="admin-btn admin-btn-danger" disabled={busy} onClick={handleReject}>
              رفض
            </button>
          </>
        }
      >
        {listing.rejectionReason && (
          <p className="admin-callout">
            <strong>رُفض سابقًا بسبب:</strong> {listing.rejectionReason}
          </p>
        )}
        {outside && (
          <p className="admin-callout danger">
            الإحداثيات خارج المملكة العربية السعودية — على الأغلب خط العرض وخط الطول معكوسان.
          </p>
        )}
        {!outside && distance !== null && distance > PIN_WARNING_KM && (
          <p className="admin-callout">
            موقع المكان على الخريطة يبعد نحو {Math.round(distance)} كم عن مركز{' '}
            {CITY_LABELS[canonicalCity(listing.city)] || listing.city}. تحقق من العنوان قبل الموافقة.
          </p>
        )}

        <DrawerSection title="الصور">
          <Gallery images={listing.images} emptyText="لم تُرفع صور لهذا المكان — سيظهر بغلاف فارغ في التطبيق." />
        </DrawerSection>

        <DrawerSection title="التفاصيل">
          <Facts
            items={[
              { label: 'النوع', value: TYPE_LABELS[listing.type] || listing.type },
              { label: 'الفئة', value: listing.category_ar || CATEGORY_LABELS[listing.category] || listing.category },
              { label: 'المدينة', value: cityLabel(listing.city) },
              {
                label: 'الموقع على الخريطة',
                value: Number.isFinite(lat) && Number.isFinite(lng) ? (
                  <a
                    className="admin-link"
                    href={`https://www.google.com/maps?q=${lat},${lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    dir="ltr"
                  >
                    {lat.toFixed(4)}, {lng.toFixed(4)}
                  </a>
                ) : null,
              },
              { label: 'العنوان', value: listing.address, wide: true },
              isHotel && {
                label: 'سعر الليلة',
                value: listing.pricePerNight != null ? formatMoney(listing.pricePerNight) : 'غير محدد — لن يقبل الحجز',
              },
              { label: 'نطاق السعر', value: listing.priceRange },
              isHotel && { label: 'الحد الأقصى للضيوف', value: listing.maxGuests ? arCount(listing.maxGuests, GUESTS) : null },
              isHotel && { label: 'عدد الوحدات', value: listing.unitCount },
              isHotel && {
                label: 'الوصول والمغادرة',
                value: listing.checkInTime || listing.checkOutTime
                  ? `${listing.checkInTime || '—'} / ${listing.checkOutTime || '—'}`
                  : null,
                ltr: true,
              },
              {
                label: 'المرافق',
                value: listing.amenities?.length
                  ? listing.amenities.map((a) => AMENITY_LABELS[a] || a).join('، ')
                  : null,
                wide: true,
              },
              { label: 'تاريخ الإرسال', value: formatDate(listing.createdAt) },
            ]}
          />
        </DrawerSection>

        {(listing.description_ar || listing.description_en) ? (
          <DrawerSection title="الوصف">
            {listing.description_ar && <p className="admin-prose">{listing.description_ar}</p>}
            {listing.description_en && <p className="admin-prose" dir="ltr">{listing.description_en}</p>}
          </DrawerSection>
        ) : (
          <DrawerSection title="الوصف">
            <p className="admin-inline-hint">لا يوجد وصف.</p>
          </DrawerSection>
        )}

        <DrawerSection title="التواصل">
          <Facts
            items={[
              { label: 'الهاتف', value: listing.phone || 'غير محدد', ltr: Boolean(listing.phone) },
              { label: 'البريد', value: listing.email || 'غير محدد', ltr: Boolean(listing.email) },
              {
                label: 'الموقع الإلكتروني',
                value: !listing.website ? 'غير محدد'
                  : safeHttpUrl(listing.website) ? (
                    <a className="admin-link" href={safeHttpUrl(listing.website)} target="_blank" rel="noopener noreferrer" dir="ltr">
                      {listing.website}
                    </a>
                  ) : <span dir="ltr">{listing.website}</span>,
                wide: true,
              },
            ]}
          />
        </DrawerSection>

        <DrawerSection title="صاحب المكان">
          {listing.ownerId ? (
            <Facts
              items={[
                {
                  label: 'الاسم',
                  value: isPlaceholderEmail(listing.ownerName) ? 'تسجيل بالهاتف' : listing.ownerName || '—',
                },
                { label: 'البريد', value: realEmail(listing.ownerEmail) || 'تسجيل بالهاتف', ltr: Boolean(realEmail(listing.ownerEmail)) },
              ]}
            />
          ) : (
            <p className="admin-inline-hint">لا يوجد صاحب مرتبط بهذا المكان.</p>
          )}
        </DrawerSection>
      </Drawer>
      {confirmDialog}
    </>
  )
}
