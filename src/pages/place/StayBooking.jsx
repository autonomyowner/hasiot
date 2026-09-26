import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Calendar from '../../booking/Calendar'
import Stepper from '../../booking/Stepper'
import { MAX_DAYS_AHEAD, MAX_NIGHTS, addDays, formatRange, riyadhToday } from '../../booking/dates'
import { bookingErrorText } from '../../booking/errors'
import { formatSAR } from '../../booking/money'
import { stayQuery } from '../../booking/params'
import { guestsText, nightsText } from '../../booking/text'
import { useConvexQuery } from '../../lib/convexHttp'
import { guestLimit } from './placeInfo'
import { blockReason, changeStay, pressOutcome, quoteView, readStay } from './stayState'

const translations = {
  en: {
    heading: 'Book your stay',
    intro: 'Choose your arrival, then your departure',
    dates: 'Stay dates',
    clear: 'Clear dates',
    guests: 'Guests',
    upTo: (guests) => `Up to ${guests}`,
    summary: 'Your stay',
    perNight: '/ night',
    chooseDates: 'Choose your dates to see the total',
    pickDates: 'Choose your dates',
    calculating: 'Calculating total…',
    updating: 'Updating…',
    total: 'Total',
    unavailable: 'No rooms available for those dates',
    quoteFailed: "We couldn't calculate the total.",
    retry: 'Try again',
    request: 'Request to book',
    note: 'The host confirms within 48 hours. No payment is taken online — you pay at the property.',
    nudge: {
      dates: 'Choose your dates first',
      checkout: 'Choose your check-out date',
      calculating: 'Calculating total…',
      unavailable: 'No rooms available for those dates',
    },
    live: (total, nights, guests) => `Total ${total} · ${nights} · ${guests}`,
  },
  ar: {
    heading: 'احجز إقامتك',
    intro: 'اختر يوم الوصول ثم يوم المغادرة',
    dates: 'تواريخ الإقامة',
    clear: 'مسح التواريخ',
    guests: 'الضيوف',
    // Not «حتى …»: after that preposition two guests would have to be
    // «ضيفين», and text.js has the nominative «ضيفان» only.
    upTo: (guests) => `الحد الأقصى: ${guests}`,
    summary: 'إقامتك',
    perNight: '/ الليلة',
    chooseDates: 'اختر التواريخ لعرض الإجمالي',
    pickDates: 'اختر التواريخ',
    calculating: 'جارٍ حساب الإجمالي…',
    updating: 'جارٍ التحديث…',
    total: 'الإجمالي',
    unavailable: 'لا توجد وحدات متاحة لهذه التواريخ',
    quoteFailed: 'تعذّر حساب الإجمالي.',
    retry: 'حاول مجددًا',
    request: 'اطلب الحجز',
    note: 'يؤكد المضيف خلال 48 ساعة. لا يُدفع شيء عبر الإنترنت — الدفع في مكان الإقامة.',
    nudge: {
      dates: 'اختر التواريخ أولًا',
      checkout: 'اختر تاريخ المغادرة',
      calculating: 'جارٍ حساب الإجمالي…',
      unavailable: 'لا توجد وحدات متاحة لهذه التواريخ',
    },
    live: (total, nights, guests) => `الإجمالي ${total} · ${nights} · ${guests}`,
  },
}

function Status({ busy = false, children }) {
  return (
    <p className="pl-status">
      {busy && <span className="bk-spinner" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  )
}

/** A quote's figures: the dates, nights and guests, then "3 × 450 SAR" and the total. */
function Figures({ quote, withTotal, lang, t }) {
  return (
    <div className="pl-figures">
      <p className="pl-figures-dates">{formatRange(quote.checkIn, quote.checkOut, lang)}</p>
      <p className="bk-muted bk-small">{nightsText(quote.nights, lang)} · {guestsText(quote.guests, lang)}</p>
      {withTotal && (
        <>
          <div className="bk-price-row">
            <span>{quote.nights} × {formatSAR(quote.pricePerNight, lang)}</span>
            <span>{formatSAR(quote.totalAmount, lang)}</span>
          </div>
          <div className="bk-total">
            <span>{t.total}</span>
            <span>{formatSAR(quote.totalAmount, lang)}</span>
          </div>
        </>
      )}
    </div>
  )
}

/** The summary card's middle: what the live quote says right now. */
function QuoteStatus({ view, checkIn, onRetry, onChooseDates, lang, t }) {
  if (view.state === 'empty') {
    // On a wide screen the calendar can be far below the card, so the prompt
    // is also the way there.
    return (
      <p className="pl-status">
        <button type="button" className="bk-link pl-to-cal" onClick={onChooseDates}>
          {checkIn ? t.nudge.checkout : t.chooseDates}
        </button>
      </p>
    )
  }
  if (view.state === 'loading') return <Status busy>{t.calculating}</Status>
  if (view.state === 'failed') {
    return (
      <div className="pl-failed">
        <p className="bk-error">{t.quoteFailed}</p>
        <button type="button" className="bk-link" onClick={onRetry}>{t.retry}</button>
      </div>
    )
  }
  // The last answer stays on screen, faded, while the next one loads: a total
  // that blinks out on every click reads as broken.
  return (
    <>
      <div className={view.stale ? 'pl-answer bk-is-stale' : 'pl-answer'}>
        {view.state === 'refused' ? (
          <p className="bk-alert">{bookingErrorText(view.error, lang)}</p>
        ) : (
          <>
            <Figures quote={view.quote} withTotal={view.state === 'ok'} lang={lang} t={t} />
            {view.state === 'unavailable' && <p className="bk-alert">{t.unavailable}</p>}
          </>
        )}
      </div>
      {view.stale && <Status busy>{t.updating}</Status>}
    </>
  )
}

/** One sentence for screen readers, said once per fresh answer (never for stale figures). */
function liveText(view, lang, t) {
  if (view.stale) return ''
  if (view.state === 'loading') return t.calculating
  if (view.state === 'failed') return t.quoteFailed
  if (view.state === 'refused') return bookingErrorText(view.error, lang)
  if (view.state === 'unavailable') return t.unavailable
  if (view.state === 'ok') {
    const { totalAmount, nights, guests } = view.quote
    return t.live(formatSAR(totalAmount, lang), nightsText(nights, lang), guestsText(guests, lang))
  }
  return ''
}

// Disabled only while its own navigation is under way, with a spinner — never
// faded to wait for input (contract §5).
function RequestButton({ going, onClick, className, children }) {
  return (
    <button
      type="button"
      className={['bk-btn bk-btn-primary', className].filter(Boolean).join(' ')}
      onClick={onClick}
      disabled={going}
      aria-busy={going || undefined}
    >
      {going && <span className="bk-spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

/** The phone's fixed bar: the price per night until there is a total, then the total. */
function PhoneBar({ view, checkIn, price, going, onRequest, lang, t }) {
  let sub
  if (view.stale) sub = t.updating
  else if (view.state === 'empty') sub = checkIn ? t.nudge.checkout : t.pickDates
  else if (view.state === 'loading') sub = t.calculating
  else if (view.state === 'failed') sub = t.quoteFailed
  else if (view.state === 'refused') sub = bookingErrorText(view.error, lang)
  else if (view.state === 'unavailable') sub = t.unavailable
  else sub = `${nightsText(view.quote.nights, lang)} · ${formatRange(view.quote.checkIn, view.quote.checkOut, lang)}`

  return (
    <div className="bk-bar pl-bar">
      <div className="bk-bar-price">
        {view.state === 'ok' ? (
          <b className={view.stale ? 'bk-is-stale' : undefined}>{formatSAR(view.quote.totalAmount, lang)}</b>
        ) : (
          <b>{price} <small>{t.perNight}</small></b>
        )}
        <span>{sub}</span>
      </div>
      <RequestButton going={going} onClick={onRequest}>{t.request}</RequestButton>
    </div>
  )
}

/**
 * A priced hotel's booking: the calendar and guests, the summary card with the
 * live quote, and the phone's bottom bar. It returns three grid items for the
 * place page's layout — the section (`book`), the card (`aside`) and the bar
 * (fixed, out of the grid) — so a wide screen can keep the card beside the
 * whole page while a phone shows it straight after the calendar.
 *
 * The dates and guests live in the URL only (stayState.js): every change is
 * written back with `replace`, so a reload, a shared link or the checkout's
 * "Change" link lands on the same choice without filling the history. The
 * server prices every stay; nothing here is trusted beyond showing it.
 */
export default function StayBooking({ listing, lang }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const listingId = listing._id
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const today = riyadhToday()
  const maxDay = addDays(today, MAX_DAYS_AHEAD)
  const maxGuests = guestLimit(listing)
  const limits = { today, maxDay, maxGuests }
  const stay = readStay(searchParams, limits)
  const { checkIn, checkOut, guests } = stay

  const quote = useConvexQuery(
    'bookings/queries:quoteStay',
    { listingId, checkIn, checkOut, guests },
    { skip: !(checkIn && checkOut), debounceMs: 250, keepPrevious: true },
  )
  const view = quoteView(stay, quote)
  const reason = blockReason(stay, view)

  // What "Request to book" said when pressed too early. `n` changes on every
  // press so the same sentence is announced again.
  const [nudge, setNudge] = useState(null)
  const [going, setGoing] = useState(false)
  const goingRef = useRef(false)
  const pickRef = useRef(null)
  const prefetched = useRef(false)

  // Once a stay is chosen the next page is likely: fetch the checkout's code
  // (and the Convex client under it) now, so the tap on "Request to book"
  // does not wait for it. Fire and forget — a failure here costs nothing.
  useEffect(() => {
    if (!checkIn || !checkOut || prefetched.current) return
    prefetched.current = true
    import('../../AuthedLayout.jsx').catch(() => {})
    import('../../booking/CheckoutPage.jsx').catch(() => {})
  }, [checkIn, checkOut])

  const update = (change) => {
    setNudge(null)
    setSearchParams((prev) => changeStay(prev, change, limits), { replace: true })
  }

  // Bring the calendar to the middle of the screen and put the keyboard on its
  // current day; `shake` once when it was pressed too early.
  const showCalendar = (shake = false) => {
    const el = pickRef.current
    if (!el) return
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ block: 'center', behavior: still ? 'instant' : 'smooth' })
    if (shake) {
      el.classList.remove('bk-shake')
      void el.offsetWidth // restarts the animation on a second press
      el.classList.add('bk-shake')
    }
    el.querySelector('.bk-cal-day[tabindex="0"]')?.focus({ preventScroll: true })
  }

  const request = () => {
    if (goingRef.current) return
    const outcome = pressOutcome(reason)
    if (outcome.go) {
      goingRef.current = true
      setGoing(true)
      navigate(`/book/stay/${listingId}${stayQuery({ checkIn, checkOut, guests })}`)
      return
    }
    if (outcome.reload) quote.reload()
    setNudge((prev) => ({ reason: outcome.say, n: (prev?.n ?? 0) + 1 }))
    if (outcome.point) showCalendar(true)
  }

  // Shown only while it is still the reason: picking a date or a fresh quote
  // makes it stale, and a stale reason must not linger.
  let nudgeText = null
  if (nudge && nudge.reason === reason) {
    nudgeText = reason === 'refused' ? bookingErrorText(view.error, lang) : t.nudge[reason]
  }

  const clearDates = () => {
    update({ checkIn: null, checkOut: null })
    // The button leaves with the dates; keep the keyboard in the calendar
    // rather than dropping it back to the top of the page.
    pickRef.current?.querySelector('.bk-cal-day[tabindex="0"]')?.focus({ preventScroll: true })
  }

  const endShake = (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('bk-shake')
  }

  const price = formatSAR(listing.pricePerNight, lang)

  return (
    <>
      <section id="book" className="bk-section pl-book" aria-labelledby="pl-book-title">
        <div className="pl-book-head">
          <div className="pl-book-intro">
            <h2 id="pl-book-title" className="bk-h2">{t.heading}</h2>
            <p className="bk-note">{t.intro}</p>
          </div>
          {checkIn && (
            <button type="button" className="bk-link pl-clear" onClick={clearDates}>{t.clear}</button>
          )}
        </div>
        <div ref={pickRef} className="pl-pick" onAnimationEnd={endShake}>
          <p className="pl-nudge" role="alert">{nudgeText && <span key={nudge.n}>{nudgeText}</span>}</p>
          <Calendar
            mode="range"
            value={{ start: checkIn, end: checkOut }}
            onChange={(range) => update({ checkIn: range.start, checkOut: range.end })}
            min={today}
            max={maxDay}
            maxNights={MAX_NIGHTS}
            lang={lang}
            label={t.dates}
          />
        </div>
        <div className="pl-guests">
          <Stepper label={t.guests} value={guests} min={1} max={maxGuests} onChange={(n) => update({ guests: n })} lang={lang} />
          <p className="bk-note">{t.upTo(guestsText(maxGuests, lang))}</p>
        </div>
      </section>

      <section className="bk-sticky pl-aside" aria-labelledby="pl-summary-title">
        <div className="bk-card bk-summary pl-card">
          <h2 id="pl-summary-title" className="bk-sr">{t.summary}</h2>
          <p className="pl-card-price"><b>{price}</b> <span>{t.perNight}</span></p>
          <div className="pl-quote">
            <QuoteStatus
              view={view}
              checkIn={checkIn}
              onRetry={quote.reload}
              onChooseDates={() => showCalendar()}
              lang={lang}
              t={t}
            />
          </div>
          <p className="bk-sr" aria-live="polite" aria-atomic="true">{liveText(view, lang, t)}</p>
          <RequestButton going={going} onClick={request} className="bk-btn-block pl-card-cta">{t.request}</RequestButton>
          <p className="bk-note">{t.note}</p>
        </div>
      </section>

      <PhoneBar view={view} checkIn={checkIn} price={price} going={going} onRequest={request} lang={lang} t={t} />
    </>
  )
}
