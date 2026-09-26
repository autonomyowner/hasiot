import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Calendar from '../../booking/Calendar'
import Stepper from '../../booking/Stepper'
import { MAX_DAYS_AHEAD, addDays, formatDay, formatDayLong, riyadhToday } from '../../booking/dates'
import { bookingErrorText } from '../../booking/errors'
import { formatSAR, unitLabel } from '../../booking/money'
import { firstServiceDay, maxPeople, quantityRule, startTimes } from '../../booking/serviceRules'
import { peopleText, quantityText } from '../../booking/text'
import { useConvexQuery } from '../../lib/convexHttp'
import { bookingPath, choiceSearch, initialChoice, missingStep, withClock, withDay } from './choice'
import { breakdownText } from './serviceText'

const translations = {
  en: {
    heading: 'Book this service',
    chooseDay: 'Choose a day',
    startTime: 'Start time',
    saudiTime: 'Times are in Saudi time.',
    timesAfterDay: 'The start times appear once you choose a day.',
    noTimes: 'No start times left today. Pick another day.',
    hours: 'Hours',
    days: 'Days',
    people: 'People',
    pickDay: 'Pick a day first',
    pickTime: 'Pick a start time',
    calculating: 'Calculating total…',
    updating: 'Updating…',
    total: 'Total',
    retry: 'Try again',
    request: 'Request to book',
    note: "The provider confirms within 48 hours, or before the start time if that's sooner. You pay the provider directly.",
  },
  ar: {
    heading: 'احجز هذه الخدمة',
    chooseDay: 'اختر اليوم',
    startTime: 'وقت البدء',
    saudiTime: 'الأوقات بتوقيت السعودية.',
    timesAfterDay: 'تظهر أوقات البدء بعد اختيار اليوم.',
    noTimes: 'لم يتبقَّ وقت بدء اليوم. اختر يومًا آخر.',
    hours: 'الساعات',
    days: 'الأيام',
    people: 'الأشخاص',
    pickDay: 'اختر اليوم أولًا',
    pickTime: 'اختر وقت البدء',
    calculating: 'جارٍ حساب الإجمالي…',
    updating: 'جارٍ التحديث…',
    total: 'الإجمالي',
    retry: 'حاول مجددًا',
    request: 'اطلب الحجز',
    note: 'يؤكد مقدم الخدمة خلال 48 ساعة، أو قبل وقت البدء إن كان أقرب. تدفع لمقدم الخدمة مباشرة.',
  },
}

// Read through a function so the state initialiser takes the time without a
// bare Date.now() in the component body, which rendering must not call.
const readClock = () => Date.now()
// How often the page's clock moves on, so a start time that comes within the
// hour while the page sits open drops off today's chips — the app's sheet
// ticks the same way (ServiceBookingSheet CLOCK_TICK_MS).
const CLOCK_TICK_MS = 30_000

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Booking a service from its page: a day, a start time, hours or days when
 * the price is by the hour or the day, and how many people — priced live by
 * the server's own quoteService, so the total shown is the total the checkout
 * will send (bookings design D5). The page never multiplies a price.
 *
 * It renders nothing itself. It hands the page three parts through
 * `children`: the choices (in the content), the summary card (beside the
 * content on a wide screen, under the choices on a phone) and the phone's
 * bottom bar — so the page decides the layout and the state stays in one
 * place. The choice is kept in the address bar (choice.js).
 *
 * "Request to book" is never faded. Pressed before a day or a start time is
 * picked, it scrolls to that step, shakes it and says what is missing;
 * pressed on a refusal, it points at the refusal.
 */
export default function ServiceBooking({ service, lang, children }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const navigate = useNavigate()
  const location = useLocation()
  const headingId = useId()
  const dayTitleId = useId()
  const timesTitleId = useId()
  const rule = useMemo(() => quantityRule(service.priceUnit), [service.priceUnit])
  const peopleMax = maxPeople(service)

  const [now, setNow] = useState(readClock)
  const [picked, setPicked] = useState(() => initialChoice(location.search, service, now))
  // The step an early press last pointed at, which keeps its message up
  // until it is picked; and the part shaking right now.
  const [pointedAt, setPointedAt] = useState(null)
  const [shaking, setShaking] = useState(null)
  const dayRef = useRef(null)
  const timeRef = useRef(null)
  const quoteRef = useRef(null)

  useEffect(() => {
    const timer = setInterval(() => setNow(readClock()), CLOCK_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // What the page acts on: the choice, less what the clock has overtaken.
  const choice = useMemo(() => withClock(picked, now), [picked, now])
  const { date, time, quantity, people } = choice
  const ready = Boolean(date && time)
  const min = firstServiceDay(now)
  const max = addDays(riyadhToday(now), MAX_DAYS_AHEAD)
  const times = date ? startTimes(date, now) : []

  // Written back with replace: a reload or a shared link keeps the choice,
  // and Back still leaves the page in one step.
  useEffect(() => {
    const search = choiceSearch(location.search, choice, rule)
    if (search !== location.search) navigate({ search, hash: location.hash }, { replace: true })
  }, [choice, rule, location.search, location.hash, navigate])

  // Once there is something to request, fetch the checkout's code, so the
  // press lands on a page that is already here. A failure costs nothing: the
  // route loads it again on the way in.
  useEffect(() => {
    if (!ready) return
    import('../../AuthedLayout.jsx').catch(() => {})
    import('../../booking/CheckoutPage.jsx').catch(() => {})
  }, [ready])

  const quote = useConvexQuery(
    'bookings/queries:quoteService',
    { serviceId: service._id, date, time, partySize: people, ...(rule ? { quantity } : {}) },
    { skip: !ready, debounceMs: 250, keepPrevious: true },
  )
  const answer = quote.data
  const priced = answer?.ok ? answer.quote : null
  const refusal = answer && !answer.ok ? answer.error : null

  // Every change starts from what the page shows, so a start time the clock
  // took away does not come back on another day.
  const pickDay = (day) => setPicked(withDay(choice, day, now))
  const pickTime = (slot) => setPicked({ ...choice, time: slot })
  const pickQuantity = (n) => setPicked({ ...choice, quantity: n })
  const pickPeople = (n) => setPicked({ ...choice, people: n })

  const pointAt = (target) => {
    setPointedAt(target)
    setShaking(target)
    const el = { day: dayRef, time: timeRef, quote: quoteRef }[target].current
    if (!el) return
    el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: target === 'quote' ? 'nearest' : 'start' })
    // Focus follows, so a keyboard lands where the choice is made: the
    // calendar's day, the first start time, or the refusal to read.
    let focusable = el
    if (target === 'day') focusable = el.querySelector('.bk-cal-day[tabindex="0"]') ?? el.querySelector('h3')
    if (target === 'time') focusable = el.querySelector('.bk-chip') ?? el.querySelector('h3')
    focusable?.focus({ preventScroll: true })
  }

  const request = () => {
    const missing = missingStep(choice)
    if (missing) {
      pointAt(missing)
      return
    }
    // A refusal still on its way out (a new quote loading) does not block:
    // the checkout quotes again before anything is sent.
    if (refusal && !quote.loading) {
      pointAt('quote')
      return
    }
    navigate(bookingPath(service._id, choice, rule))
  }

  const stopShaking = (e) => {
    if (e.target === e.currentTarget) setShaking(null)
  }
  const shake = (target) => (shaking === target ? ' bk-shake' : '')
  const nudge = (step) => {
    if (pointedAt !== step || missingStep(choice) !== step) return ''
    return step === 'day' ? t.pickDay : t.pickTime
  }

  const choices = (
    <section className="bk-section sv-book" aria-labelledby={headingId}>
      <h2 id={headingId} className="bk-h2">{t.heading}</h2>

      <div ref={dayRef} className={`sv-step sv-day${shake('day')}`} onAnimationEnd={stopShaking}>
        <div className="sv-step-head">
          <h3 id={dayTitleId} className="bk-h3" tabIndex={-1}>{t.chooseDay}</h3>
          <p className="sv-nudge" aria-live="polite">{nudge('day')}</p>
        </div>
        <Calendar mode="single" value={date} onChange={pickDay} min={min} max={max} lang={lang} label={t.chooseDay} />
      </div>

      <div ref={timeRef} className={`sv-step${shake('time')}`} onAnimationEnd={stopShaking}>
        <div className="sv-step-head">
          <h3 id={timesTitleId} className="bk-h3" tabIndex={-1}>{t.startTime}</h3>
          <p className="sv-nudge" aria-live="polite">{nudge('time')}</p>
        </div>
        {!date && <p className="bk-note">{t.timesAfterDay}</p>}
        {date && times.length === 0 && <p className="bk-note">{t.noTimes}</p>}
        {times.length > 0 && (
          <div className="bk-chips sv-times" role="group" aria-labelledby={timesTitleId}>
            {times.map((slot) => (
              <button
                key={slot}
                type="button"
                className="bk-chip"
                aria-pressed={slot === time}
                onClick={() => pickTime(slot)}
                dir="ltr"
              >
                {slot}
              </button>
            ))}
          </div>
        )}
        <p className="bk-note">{t.saudiTime}</p>
      </div>

      <div className="sv-step sv-counts">
        {rule && (
          <Stepper
            label={rule.kind === 'hours' ? t.hours : t.days}
            value={quantity}
            min={rule.min}
            max={rule.max}
            onChange={pickQuantity}
            lang={lang}
          />
        )}
        <Stepper label={t.people} value={people} min={1} max={peopleMax} onChange={pickPeople} lang={lang} />
      </div>
    </section>
  )

  const breakdown = priced ? breakdownText(priced, lang) : null
  let quoteBody = null
  if (ready) {
    if (priced) {
      quoteBody = (
        <>
          {breakdown && (
            <div className="bk-price-row">
              <span>{breakdown}</span>
              <span>{formatSAR(priced.totalAmount, lang)}</span>
            </div>
          )}
          <div className="bk-total">
            <span>{t.total}</span>
            <span>{formatSAR(priced.totalAmount, lang)}</span>
          </div>
        </>
      )
    } else if (refusal) {
      quoteBody = <p className="bk-alert">{bookingErrorText(refusal, lang, 'service')}</p>
    } else if (quote.error) {
      quoteBody = (
        <p className="bk-alert">
          {bookingErrorText(quote.error, lang, 'service')}{' '}
          <button type="button" className="bk-link" onClick={quote.reload}>{t.retry}</button>
        </p>
      )
    } else {
      quoteBody = <p className="bk-muted">{t.calculating}</p>
    }
  }

  const counts = [rule ? quantityText(service.priceUnit, quantity, lang) : '', peopleText(people, lang)]
    .filter(Boolean)
    .join(' · ')

  const summary = (
    <div className="bk-card bk-summary sv-summary">
      <p className="sv-sum-price">
        <b>{formatSAR(service.price, lang)}</b> {unitLabel(service.priceUnit, lang)}
      </p>
      <div className="sv-sum-body">
        {date ? (
          <p className="sv-sum-when">{time ? `${formatDayLong(date, lang)} · ${time}` : formatDayLong(date, lang)}</p>
        ) : (
          <p className="sv-sum-hint">{t.pickDay}</p>
        )}
        {date && !time && <p className="sv-sum-hint">{t.pickTime}</p>}
        <p className="sv-sum-counts">{counts}</p>
        {/* Only the price is live: the calendar and the steppers announce
            their own changes, and saying them twice would drown the total. */}
        <div
          ref={quoteRef}
          tabIndex={-1}
          className={`sv-sum-quote${quote.stale ? ' bk-is-stale' : ''}${shake('quote')}`}
          aria-live="polite"
          onAnimationEnd={stopShaking}
        >
          {quoteBody}
        </div>
        {ready && quote.stale && <p className="sv-sum-updating">{t.updating}</p>}
      </div>
      <button type="button" className="bk-btn bk-btn-primary bk-btn-block" onClick={request}>
        {t.request}
      </button>
      <p className="bk-note">{t.note}</p>
    </div>
  )

  const bar = (
    <div className="bk-bar">
      <div className={`bk-bar-price${quote.stale ? ' bk-is-stale' : ''}`}>
        <b>{formatSAR(priced ? priced.totalAmount : service.price, lang)}</b>
        <span>{priced ? `${formatDay(date, lang)} · ${time}` : unitLabel(service.priceUnit, lang)}</span>
      </div>
      <button type="button" className="bk-btn bk-btn-primary" onClick={request}>
        {t.request}
      </button>
    </div>
  )

  return children({ choices, summary, bar })
}
