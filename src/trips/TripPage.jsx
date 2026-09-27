import { useEffect, useId, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useLanguage } from '../hooks/useLanguage'
import PageShell from '../booking/PageShell'
import StatusChip from '../booking/StatusChip'
import ConfirmDialog from '../booking/ConfirmDialog'
import ContactActions from '../booking/place/ContactActions'
import { usePageMeta } from '../booking/usePageMeta'
import { useViewer } from '../booking/useViewer'
// A request's deadline and a service's start turn on it.
import { useMinuteClock } from '../booking/useMinuteClock'
import { canCancel, effectiveStatus } from '../booking/status'
import { bookingErrorText } from '../booking/errors'
import { useQuerySafe } from '../lib/useQuerySafe'
import { formatPhone } from '../partners/lib/phone'
import { cityName, serviceTypeLabel } from '../partners/services/labels'
import ReviewForm from './ReviewForm'
import {
  detailRows,
  emailOf,
  personName,
  reasonFor,
  reviewTarget,
  STORE_LINKS,
  tripImage,
  tripKind,
  tripName,
} from './tripDisplay'
import './trips.css'

const translations = {
  en: {
    back: 'My trips',
    booking: 'Booking',
    loading: 'Loading your booking…',
    gone: 'No longer on Hasio',
    notFound: "We couldn't find this booking.",
    myTrips: 'My trips',
    notYours: "This booking isn't one of your trips.",
    partnerBookings: 'Partner bookings',
    suspended: ['Your account is suspended. Contact ', '.'],
    status: 'Booking status',
    sent: 'Request sent',
    close: 'Close',
    email: ["We'll email you at ", ' when they answer.'],
    live: 'This page updates the moment they answer.',
    pendingStay: 'The host confirms within 48 hours. No payment is taken online — you pay at the property.',
    pendingService:
      "The provider confirms within 48 hours, or before the start time if that's sooner. You pay the provider directly.",
    code: 'Your confirmation code',
    copy: 'Copy',
    copied: 'Copied',
    details: 'Booking details',
    rows: {
      checkIn: 'Check-in',
      checkOut: 'Check-out',
      stay: 'Stay',
      date: 'Date',
      startTime: 'Start time',
      time: 'Time',
      duration: 'Duration',
      people: 'People',
      total: 'Total',
    },
    notes: 'Your notes',
    reason: { host: 'Reason from the host', provider: 'Reason from the provider', unknown: 'Reason' },
    provider: 'Provider',
    callProvider: 'Call provider',
    numberLater: 'Their number appears here once they confirm.',
    cancelBooking: 'Cancel booking',
    cancelRequest: 'Cancel request',
    cancelBookingTitle: 'Cancel this booking?',
    cancelRequestTitle: 'Cancel this request?',
    toldHost: 'The host will be notified.',
    toldProvider: 'The provider will be told.',
    keep: 'Keep it',
    cancelled: 'Booking cancelled',
    rateStay: 'How was your stay?',
    rateService: 'How was it?',
    rateBody: 'Your rating helps other travellers.',
    ratePlaceButton: 'Rate this place',
    rateServiceButton: 'Rate this service',
    thanks: 'Thanks — your review is live.',
    rated: (n) => `You rated this ${n}/5`,
    alsoInApp: 'Also in the app',
  },
  ar: {
    back: 'رحلاتي',
    booking: 'الحجز',
    loading: 'جارٍ تحميل حجزك…',
    gone: 'لم يعد على Hasio',
    notFound: 'لم نعثر على هذا الحجز.',
    myTrips: 'رحلاتي',
    notYours: 'هذا الحجز ليس من رحلاتك.',
    partnerBookings: 'حجوزات الشركاء',
    suspended: ['حسابك موقوف. تواصل مع ', '.'],
    status: 'حالة الحجز',
    sent: 'تم إرسال الطلب',
    close: 'إغلاق',
    email: ['سنراسلك على ', ' عند الرد.'],
    live: 'تتحدث هذه الصفحة فور الرد.',
    pendingStay: 'يؤكد المضيف خلال 48 ساعة. لا يُدفع شيء عبر الإنترنت — الدفع في مكان الإقامة.',
    pendingService: 'يؤكد مقدم الخدمة خلال 48 ساعة، أو قبل وقت البدء إن كان أقرب. تدفع لمقدم الخدمة مباشرة.',
    code: 'رمز التأكيد',
    copy: 'نسخ',
    copied: 'تم النسخ',
    details: 'تفاصيل الحجز',
    rows: {
      checkIn: 'تسجيل الوصول',
      checkOut: 'تسجيل المغادرة',
      stay: 'الإقامة',
      date: 'التاريخ',
      startTime: 'وقت البدء',
      time: 'الوقت',
      duration: 'المدة',
      people: 'الأشخاص',
      total: 'الإجمالي',
    },
    notes: 'ملاحظاتك',
    reason: { host: 'سبب المضيف', provider: 'سبب مقدم الخدمة', unknown: 'السبب' },
    provider: 'مقدم الخدمة',
    callProvider: 'اتصل بمقدم الخدمة',
    numberLater: 'يظهر رقمه هنا بعد تأكيده.',
    cancelBooking: 'إلغاء الحجز',
    cancelRequest: 'إلغاء الطلب',
    cancelBookingTitle: 'إلغاء هذا الحجز؟',
    cancelRequestTitle: 'إلغاء هذا الطلب؟',
    toldHost: 'سيتم إشعار المضيف.',
    toldProvider: 'سيتم إبلاغ مقدم الخدمة.',
    keep: 'الإبقاء عليه',
    cancelled: 'تم إلغاء الحجز',
    rateStay: 'كيف كانت إقامتك؟',
    rateService: 'كيف كانت الخدمة؟',
    rateBody: 'تقييمك يساعد المسافرين الآخرين.',
    ratePlaceButton: 'قيّم هذا المكان',
    rateServiceButton: 'قيّم هذه الخدمة',
    thanks: 'شكرًا، تم نشر تقييمك.',
    rated: (n) => `قيّمته ${n}/5`,
    alsoInApp: 'متوفر أيضًا في التطبيق',
  },
}

const SUPPORT_EMAIL = 'support@hasio.xyz'

const icon = (children, strokeWidth = 2) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
)
// Drawn pointing left; booking.css mirrors .bk-back's arrow in Arabic.
const BackIcon = () => icon(<path d="m15 6-6 6 6 6" />)
const CheckIcon = () => icon(<path d="m5 12.5 4.5 4.5L19 7.5" />, 2.4)
const CloseIcon = () => icon(<path d="M6 6l12 12M18 6 6 18" />)
const SmallStar = ({ on }) => (
  <svg viewBox="0 0 24 24" className={on ? undefined : 'is-off'} fill="currentColor" aria-hidden="true">
    <path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8Z" />
  </svg>
)

function Message({ text, children }) {
  return (
    <div className="tr-state">
      <h1 className="bk-h2">{text}</h1>
      {children}
    </div>
  )
}

function DetailSkeleton({ label }) {
  return (
    <div aria-busy="true">
      <span className="bk-sr" role="status">{label}</span>
      <div className="bk-skel tr-skel-title" />
      <div className="tr-skel-stack">
        <div className="bk-skel tr-skel-block" />
        <div className="bk-skel tr-skel-block" />
      </div>
    </div>
  )
}

function StoreLinks({ label }) {
  return (
    <p className="tr-apps">
      {label}:{' '}
      <a href={STORE_LINKS.appStore} target="_blank" rel="noopener noreferrer" lang="en">App Store</a>
      {' · '}
      <a href={STORE_LINKS.googlePlay} target="_blank" rel="noopener noreferrer" lang="en">Google Play</a>
    </p>
  )
}

/**
 * One booking, for the traveller who made it: the "Request sent" banner after
 * a checkout, status and code, the facts, the reason when it was turned down,
 * how to reach the place or the provider, Cancel while it may be cancelled
 * (design W9) and Rate once it is over (W10). It reads the booking through a
 * live subscription, so a host's answer changes the page as it happens.
 *
 * Keyed by the booking id: moving from one booking to another starts clean,
 * with no banner, dialog or half-written review carried across.
 */
function TripDetail({ booking, lang, t, user, config }) {
  const kind = tripKind(booking)
  const isService = kind === 'service'
  const now = useMinuteClock()
  const ids = useId()

  // ?sent=1 is the checkout's hand-off. It is read once and taken out of the
  // address, so a reload or a shared link does not announce the request again;
  // the banner itself stays until the traveller closes it or leaves.
  const [searchParams, setSearchParams] = useSearchParams()
  const [bannerOpen, setBannerOpen] = useState(() => searchParams.get('sent') === '1')
  useEffect(() => {
    if (!searchParams.has('sent')) return
    const next = new URLSearchParams(searchParams)
    next.delete('sent')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const bannerRef = useRef(null)
  const statusRef = useRef(null)
  // The checkout replaced itself with this page: focus goes to what changed.
  useEffect(() => {
    if (bannerOpen) bannerRef.current?.focus()
  }, [bannerOpen])
  const closeBanner = () => {
    // The close button is about to disappear; keep focus on the card.
    statusRef.current?.focus()
    setBannerOpen(false)
  }

  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return undefined
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])
  const copyCode = () => {
    // No clipboard (an insecure context) or a refusal: the code is on screen
    // to copy by hand, so nothing is said.
    const writing = navigator.clipboard?.writeText?.(booking.confirmationCode)
    writing?.then(() => setCopied(true), () => {})
  }

  const cancelBooking = useMutation(api.bookings.mutations.cancelBooking)
  const [askCancel, setAskCancel] = useState(false)
  const [cancelBusy, setCancelBusy] = useState(false)
  const [cancelDone, setCancelDone] = useState(false)
  const [cancelError, setCancelError] = useState(null)
  const cancelGuard = useRef(false)
  const doneRef = useRef(null)
  // The Cancel button is gone once the booking closes; the result takes focus.
  useEffect(() => {
    if (cancelDone) doneRef.current?.focus()
  }, [cancelDone])
  const confirmCancel = async () => {
    if (cancelGuard.current) return
    cancelGuard.current = true
    setCancelBusy(true)
    setCancelError(null)
    try {
      await cancelBooking({ bookingId: booking._id })
      setCancelDone(true)
    } catch (err) {
      setCancelError(bookingErrorText(err, lang, isService ? 'service' : 'stay'))
    } finally {
      cancelGuard.current = false
      setCancelBusy(false)
      setAskCancel(false)
    }
  }

  // Rating: asked of the server only for a completed stay or service whose
  // place or service still exists. `undefined` is loading and shows nothing,
  // so the prompt never flashes up for someone who has already rated.
  const target = reviewTarget(booking)
  const minePlace = useQuerySafe(api.reviews.queries.getMine, target?.listingId ? { listingId: target.listingId } : 'skip')
  const mineService = useQuerySafe(
    api.reviews.queries.getMineForService,
    target?.serviceId ? { serviceId: target.serviceId } : 'skip'
  )
  const mine = target?.serviceId ? mineService : minePlace
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewDone, setReviewDone] = useState(false)
  const thanksRef = useRef(null)
  useEffect(() => {
    if (reviewDone) thanksRef.current?.focus()
  }, [reviewDone])

  const name = tripName(booking, lang)
  const status = effectiveStatus(booking, now)
  const pending = status === 'pending'
  // A 1.0.x reservation never had the 48-hour rule or an email, so it gets neither line.
  const pendingNote = kind === 'stay' ? t.pendingStay : isService ? t.pendingService : null
  const email = config?.bookingEmails === true ? emailOf(user) : null
  const rows = detailRows(booking, lang)
  const reason = reasonFor(booking, lang)
  const cancellable = canCancel(booking, now)
  // A service nobody has confirmed yet is a request, and is withdrawn as one.
  const isRequest = isService && booking.status === 'pending'
  const cancelLabel = isRequest ? t.cancelRequest : t.cancelBooking
  // Old reservations never told the host of a cancellation; promise nothing.
  const cancelBody = isService ? t.toldProvider : kind === 'stay' ? t.toldHost : undefined

  const listing = booking.listing ?? null
  const service = booking.service ?? null
  const provider = isService ? (booking.provider ?? null) : null
  const image = tripImage(booking)
  const meta = isService
    ? service
      ? [serviceTypeLabel(service.serviceType, lang), cityName(service.city, lang)].filter(Boolean).join(' · ')
      : ''
    : listing
      ? cityName(listing.city, lang)
      : ''
  const hasAside = isService ? Boolean(service || provider) : Boolean(listing)
  const providerName = personName(provider)

  let rate = null
  if (target) {
    if (reviewDone) {
      rate = (
        <p className="tr-rate-done" ref={thanksRef} tabIndex={-1} role="status">
          {t.thanks}
        </p>
      )
    } else if (mine.data) {
      rate = (
        <p className="tr-rated">
          <span className="bk-stars" aria-hidden="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <SmallStar key={n} on={n <= mine.data.rating} />
            ))}
          </span>
          {t.rated(mine.data.rating)}
        </p>
      )
    } else if (mine.data === null) {
      rate = (
        <section className="tr-rate" aria-labelledby={`${ids}-rate`}>
          <h2 id={`${ids}-rate`}>{isService ? t.rateService : t.rateStay}</h2>
          <p>{t.rateBody}</p>
          {reviewOpen ? (
            <ReviewForm target={target} bookingId={booking._id} lang={lang} autoFocus onDone={() => setReviewDone(true)} />
          ) : (
            <button type="button" className="bk-btn tr-rate-btn" onClick={() => setReviewOpen(true)}>
              {isService ? t.rateServiceButton : t.ratePlaceButton}
            </button>
          )}
        </section>
      )
    }
  }

  return (
    <>
      <Link className="bk-back" to="/trips">
        <BackIcon />
        {t.back}
      </Link>
      <header className="tr-head">
        <h1 className="bk-h1 tr-title">{name ?? t.gone}</h1>
        {meta ? <p className="bk-muted tr-meta">{meta}</p> : null}
      </header>

      <div className={`tr-detail${hasAside ? '' : ' is-single'}`}>
        <div className="tr-main">
          <section className="bk-card tr-status" ref={statusRef} tabIndex={-1} aria-label={t.status}>
            {bannerOpen ? (
              <div className="tr-banner" ref={bannerRef} tabIndex={-1} role="region" aria-labelledby={`${ids}-sent`}>
                <span className="tr-banner-icon">
                  <CheckIcon />
                </span>
                <div>
                  <h2 id={`${ids}-sent`}>{t.sent}</h2>
                  {pending && pendingNote ? <p>{pendingNote}</p> : null}
                  <p>
                    {email ? (
                      <>
                        {t.email[0]}
                        <bdi dir="ltr">{email}</bdi>
                        {t.email[1]}
                      </>
                    ) : (
                      t.live
                    )}
                  </p>
                </div>
                <button type="button" className="tr-close" aria-label={t.close} onClick={closeBanner}>
                  <CloseIcon />
                </button>
              </div>
            ) : null}
            <div>
              <StatusChip booking={booking} lang={lang} now={now} />
            </div>
            {booking.confirmationCode ? (
              <div className="tr-code">
                <span className="tr-code-label" id={`${ids}-code`}>
                  {t.code}
                </span>
                <div className="tr-code-row">
                  <span className="tr-code-value" dir="ltr">
                    {booking.confirmationCode}
                  </span>
                  <button
                    type="button"
                    className="bk-btn bk-btn-ghost bk-btn-sm"
                    onClick={copyCode}
                    aria-describedby={`${ids}-code`}
                  >
                    {copied ? t.copied : t.copy}
                  </button>
                </div>
                <span className="bk-sr" role="status">
                  {copied ? t.copied : ''}
                </span>
              </div>
            ) : null}
          </section>

          <section className="bk-card tr-facts" aria-labelledby={`${ids}-details`}>
            <h2 className="tr-section-title" id={`${ids}-details`}>
              {t.details}
            </h2>
            <dl className="tr-rows">
              {rows.map((row) => (
                <div key={row.key} className={`tr-row${row.strong ? ' is-total' : ''}`}>
                  <dt>{t.rows[row.key]}</dt>
                  <dd>{row.ltr ? <bdi dir="ltr">{row.value}</bdi> : row.value}</dd>
                </div>
              ))}
            </dl>
            {booking.notes ? (
              <div className="tr-block">
                <h3>{t.notes}</h3>
                <p>{booking.notes}</p>
              </div>
            ) : null}
            {reason ? (
              <div className="tr-block">
                <h3>{t.reason[reason.from]}</h3>
                <p>{reason.text}</p>
              </div>
            ) : null}
            {/* While the banner is up it carries this line already. */}
            {pending && pendingNote && !bannerOpen ? <p className="bk-note tr-pending">{pendingNote}</p> : null}
          </section>
        </div>

        {hasAside ? (
          <aside className="tr-aside">
            <section className="bk-card tr-place" aria-labelledby={name ? `${ids}-place` : undefined}>
              {image ? (
                <div className="tr-place-media">
                  {/* Beside the name it would repeat, so decorative. */}
                  <img src={image} alt="" loading="lazy" decoding="async" />
                </div>
              ) : null}
              {name ? (
                <h2 className="tr-place-name" id={`${ids}-place`}>
                  <Link to={isService ? `/services/${service._id}` : `/places/${booking.listingId}`}>{name}</Link>
                </h2>
              ) : null}
              {!isService && listing?.address ? <p className="bk-muted">{listing.address}</p> : null}
              {!isService ? (
                <ContactActions phone={listing.phone} coordinates={listing.coordinates} address={listing.address} lang={lang} />
              ) : null}
              {provider ? (
                <div className="tr-provider">
                  <h3 className="bk-label">{t.provider}</h3>
                  {providerName ? <p className="tr-provider-name">{providerName}</p> : null}
                  {provider.phone ? (
                    <>
                      <p>
                        {/* One piece, or an Arabic line reverses the digit groups. */}
                        <bdi dir="ltr">{formatPhone(provider.phone)}</bdi>
                      </p>
                      <ContactActions phone={provider.phone} lang={lang} callLabel={t.callProvider} />
                    </>
                  ) : pending ? (
                    // The provider's own number is shared only once they say yes.
                    <p className="bk-note">{t.numberLater}</p>
                  ) : null}
                </div>
              ) : null}
            </section>
          </aside>
        ) : null}

        <div className="tr-end">
          {rate}
          {cancellable || cancelDone || cancelError ? (
            <div className="tr-actions">
              {cancellable ? (
                <button
                  type="button"
                  className="bk-btn bk-btn-ghost tr-cancel"
                  onClick={() => {
                    setCancelError(null)
                    setAskCancel(true)
                  }}
                >
                  {cancelLabel}
                </button>
              ) : null}
              {cancelDone ? (
                <p className="tr-done" ref={doneRef} tabIndex={-1} role="status">
                  {t.cancelled}
                </p>
              ) : null}
              {cancelError ? (
                <p className="bk-error" role="alert">
                  {cancelError}
                </p>
              ) : null}
            </div>
          ) : null}
          <StoreLinks label={t.alsoInApp} />
        </div>
      </div>

      <ConfirmDialog
        open={askCancel}
        title={isRequest ? t.cancelRequestTitle : t.cancelBookingTitle}
        body={cancelBody}
        confirmLabel={cancelLabel}
        cancelLabel={t.keep}
        onConfirm={confirmCancel}
        onCancel={() => setAskCancel(false)}
        busy={cancelBusy}
        tone="danger"
      />
    </>
  )
}

/**
 * /trips/:bookingId — one of the traveller's bookings (plan task D).
 *
 * The id comes from a link, so it is read through useQuerySafe: an id cut
 * short by a mail client, one from another deployment, or someone else's
 * booking all read "not found" rather than the crash screen (design W24).
 */
export default function TripPage() {
  const { lang, toggleLang, isRtl } = useLanguage()
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const { bookingId } = useParams()
  const location = useLocation()
  const viewer = useViewer()
  const active = viewer.state === 'active'
  const { data: booking, error } = useQuerySafe(
    api.bookings.queries.getBooking,
    active && bookingId ? { bookingId, includeServices: true } : 'skip'
  )
  const own = booking && booking.viewerRole === 'guest' ? booking : null
  usePageMeta({ title: (own && tripName(own, lang)) || t.booking })

  // Only once the session has settled: a reload must never bounce to /login.
  if (viewer.state === 'signed_out' || viewer.state === 'no_account') {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  let body
  if (viewer.state === 'suspended') {
    body = (
      <div className="tr-state">
        <h1 className="bk-h2">{t.booking}</h1>
        <p>
          {t.suspended[0]}
          <a href={`mailto:${SUPPORT_EMAIL}`} dir="ltr">{SUPPORT_EMAIL}</a>
          {t.suspended[1]}
        </p>
      </div>
    )
  } else if (!active || (booking === undefined && !error)) {
    body = <DetailSkeleton label={t.loading} />
  } else if (error || !booking) {
    body = (
      <Message text={t.notFound}>
        <Link className="bk-btn bk-btn-primary" to="/trips">{t.myTrips}</Link>
      </Message>
    )
  } else if (!own) {
    // A host, provider or admin opening a guest's booking: theirs to handle
    // from the partner portal, not a trip of their own.
    body = (
      <Message text={t.notYours}>
        <Link className="bk-btn bk-btn-primary" to="/partners">{t.partnerBookings}</Link>
      </Message>
    )
  } else {
    body = <TripDetail key={own._id} booking={own} lang={lang} t={t} user={viewer.user} config={viewer.config} />
  }

  return (
    <PageShell lang={lang} toggleLang={toggleLang} isRtl={isRtl} current="trips">
      {body}
    </PageShell>
  )
}
