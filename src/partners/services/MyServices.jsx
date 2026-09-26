import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useQuerySafe } from '../../admin/useQuerySafe'
import { toastApi } from '../../admin/components/toast-context'
import { usePartnerLang, pick } from '../lang'
import { usePartnerGate } from '../usePartnerGate'
import { usePartnerConfirm } from '../confirm'
import { errorText } from '../lib/errors'
import { EmptyState, ErrorState, SkeletonList, Spinner } from '../components/Ui'
import { ownerStatusOf } from './servicePayload'
import { STATUS_LABELS, cityName, priceText, serviceTitle, serviceTypeLabel } from './labels'

const translations = {
  en: {
    title: 'My services',
    subtitle: (n) => (n === 1 ? '1 service' : `${n} services`),
    add: 'Add a service',
    edit: 'Edit',
    delete: 'Delete',
    noPrice: 'No price — shows "Contact" in the app',
    reason: 'Reason:',
    pendingNote: 'Our team reviews it before travellers can see it.',
    suspendedNote: 'Our team took this service down. It stays hidden until it is reinstated.',
    emptyTitle: 'No services yet',
    emptyHint: 'Post your first service — a guide, a driver, a photographer… Our team reviews it before it goes live.',
    errorTitle: 'Your services could not be loaded',
    retry: 'Try again',
    deleteTitle: 'Delete this service?',
    deleteBody: 'It is removed for good, with its photos and reviews. A service with open bookings cannot be deleted.',
    deleted: 'Service deleted.',
    noPhoto: 'No photo',
  },
  ar: {
    title: 'خدماتي',
    subtitle: (n) => (n === 1 ? 'خدمة واحدة' : n === 2 ? 'خدمتان' : n <= 10 ? `${n} خدمات` : `${n} خدمة`),
    add: 'إضافة خدمة',
    edit: 'تعديل',
    delete: 'حذف',
    noPrice: 'بلا سعر — تظهر بزر «تواصل» في التطبيق',
    reason: 'السبب:',
    pendingNote: 'يراجعها فريقنا قبل أن يراها المسافرون.',
    suspendedNote: 'أوقف فريقنا هذه الخدمة. تبقى مخفية حتى يُعاد تفعيلها.',
    emptyTitle: 'لا توجد خدمات بعد',
    emptyHint: 'انشر خدمتك الأولى — مرشد، سائق، مصور… يراجعها فريقنا قبل نشرها.',
    errorTitle: 'تعذّر تحميل خدماتك',
    retry: 'حاول مرة أخرى',
    deleteTitle: 'حذف هذه الخدمة؟',
    deleteBody: 'تُحذف نهائيًا مع صورها وتقييماتها. لا يمكن حذف خدمة عليها حجوزات مفتوحة.',
    deleted: 'تم حذف الخدمة.',
    noPhoto: 'لا توجد صورة',
  },
}

/** The app's provider/my-services.tsx: every service, its state, edit and delete. */
export default function MyServices() {
  const { lang } = usePartnerLang()
  const t = pick(translations, lang)
  const confirm = usePartnerConfirm()
  const { guard } = usePartnerGate('services')
  const { data: services, error } = useQuerySafe(api.services.queries.getMyServices, guard ? 'skip' : {})
  const deleteMyService = useMutation(api.services.mutations.deleteMyService)
  const [deleting, setDeleting] = useState(null)
  const busyRef = useRef(false)

  if (guard) return guard

  const remove = async (service) => {
    if (busyRef.current) return
    const answer = await confirm({
      title: t.deleteTitle,
      message: t.deleteBody,
      confirmLabel: t.delete,
      destructive: true,
    })
    if (!answer) return
    busyRef.current = true
    setDeleting(service._id)
    try {
      await deleteMyService({ serviceId: service._id })
      toastApi.success(t.deleted)
    } catch (err) {
      toastApi.error(errorText(err, lang))
    } finally {
      busyRef.current = false
      setDeleting(null)
    }
  }

  const statusLabels = STATUS_LABELS[lang === 'en' ? 'en' : 'ar']

  return (
    <div>
      <div className="p-svc-head">
        <div>
          <h1 className="p-title">{t.title}</h1>
          {services && <p className="p-subtitle" style={{ margin: 0 }}>{t.subtitle(services.length)}</p>}
        </div>
        <Link to="/partners/services/mine/new" className="p-btn p-btn-primary">{t.add}</Link>
      </div>

      {error ? (
        <ErrorState title={t.errorTitle} retryLabel={t.retry} onRetry={() => window.location.reload()} />
      ) : services === undefined ? (
        <SkeletonList />
      ) : services.length === 0 ? (
        <div className="p-card">
          <EmptyState icon="briefcase" title={t.emptyTitle} hint={t.emptyHint} />
        </div>
      ) : (
        <ul className="p-svc-list">
          {services.map((service) => {
            const status = ownerStatusOf(service.status)
            const price = priceText(service.price, service.priceUnit, lang)
            const cover = service.images?.[0]
            const note =
              status === 'rejected' && service.rejectionReason
                ? `${t.reason} ${service.rejectionReason}`
                : status === 'suspended'
                  ? service.suspendedReason
                    ? `${t.suspendedNote} ${t.reason} ${service.suspendedReason}`
                    : t.suspendedNote
                  : status === 'pending'
                    ? t.pendingNote
                    : null
            return (
              <li key={service._id} className="p-svc-card">
                <div className="p-svc-cover">
                  {cover ? <img src={cover} alt="" loading="lazy" /> : <span className="p-small p-muted">{t.noPhoto}</span>}
                </div>
                <div className="p-svc-body">
                  <div className="p-row" style={{ gap: 8 }}>
                    <span className={`p-badge p-svc-status-${status}`}>{statusLabels[status] ?? status}</span>
                    <span className="p-small p-muted">
                      {serviceTypeLabel(service.serviceType, lang)}
                      {service.city ? ` · ${cityName(service.city, lang)}` : ''}
                    </span>
                  </div>
                  <h2 className="p-svc-title">{serviceTitle(service, lang)}</h2>
                  <p className={price ? 'p-svc-price' : 'p-small p-muted'}>{price ?? t.noPrice}</p>
                  {note && <p className={status === 'pending' ? 'p-small p-muted' : 'p-svc-note'}>{note}</p>}
                </div>
                <div className="p-svc-actions">
                  <Link to={`/partners/services/mine/${service._id}`} className="p-btn p-btn-outline p-btn-sm">
                    {t.edit}
                  </Link>
                  <button
                    type="button"
                    className="p-btn p-btn-danger p-btn-sm"
                    disabled={deleting === service._id}
                    onClick={() => void remove(service)}
                  >
                    {deleting === service._id && <Spinner />}
                    {t.delete}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
