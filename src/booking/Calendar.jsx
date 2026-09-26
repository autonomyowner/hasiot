import { useEffect, useId, useRef, useState } from 'react'
import {
  MAX_NIGHTS,
  addDays,
  addMonths,
  daysBetween,
  formatDay,
  formatDayLong,
  formatRange,
  monthGrid,
  monthLabel,
  monthOf,
  nextRange,
  riyadhToday,
  weekdayNames,
} from './dates'
import { nightsText } from './text'

const translations = {
  en: {
    prev: 'Previous month',
    next: 'Next month',
    pickIn: 'Choose your check-in date.',
    pickOut: (day) => `Check-in ${day} — now choose your check-out date.`,
    range: (range, nights) => `${range} · ${nights}`,
    pickDay: 'Choose a day.',
    picked: (day) => `${day} selected.`,
    checkIn: 'check-in',
    checkOut: 'check-out',
  },
  ar: {
    prev: 'الشهر السابق',
    next: 'الشهر التالي',
    pickIn: 'اختر تاريخ الوصول.',
    pickOut: (day) => `الوصول ${day} — اختر الآن تاريخ المغادرة.`,
    range: (range, nights) => `${range} · ${nights}`,
    pickDay: 'اختر يومًا.',
    picked: (day) => `تم اختيار ${day}.`,
    checkIn: 'الوصول',
    checkOut: 'المغادرة',
  },
}

// Drawn for left-to-right; booking.css mirrors both in RTL.
const Next = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
)
const Prev = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m15 6-6 6 6 6" />
  </svg>
)

const WIDE = '(min-width: 900px)'
function useWide() {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE).matches)
  useEffect(() => {
    const mq = window.matchMedia(WIDE)
    const onChange = (e) => setWide(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return wide
}

const clamp = (iso, min, max) => (iso < min ? min : max && iso > max ? max : iso)
const sameMonth = (a, b) => a.year === b.year && a.month === b.month
const monthIndex = ({ year, month }) => year * 12 + month

/**
 * A month calendar for picking a stay (`mode="range"`) or a day
 * (`mode="single"`). Two months side by side from 900px, one below.
 *
 * Keyboard: the days are buttons with one tab stop between them (roving
 * tabindex); arrow keys move by a day or a week — left and right follow the
 * page's direction, so in Arabic the left arrow goes forward — Home and End
 * go to the ends of the week, Page Up and Page Down by a month, and Enter or
 * Space picks. A polite live line says what to pick next.
 *
 * Range picking follows the app (dates.js nextRange). Days before `min` or
 * after `max` are disabled; nothing else is — the quote says whether rooms
 * are free (design W8).
 */
export default function Calendar({ mode = 'range', value, onChange, min, max, lang, maxNights = MAX_NIGHTS, label }) {
  const t = translations[lang === 'ar' ? 'ar' : 'en']
  const isRtl = lang === 'ar'
  const wide = useWide()
  const count = wide ? 2 : 1
  const labelId = useId()

  const start = mode === 'range' ? value?.start ?? null : value ?? null
  const end = mode === 'range' ? value?.end ?? null : null

  const [view, setView] = useState(() => monthOf(start ?? min))
  const [focusDay, setFocusDay] = useState(() => clamp(start ?? min, min, max))
  const dayRefs = useRef(new Map())
  const moved = useRef(false)

  // After a keyboard move, put focus on the day it moved to (it may have been
  // rendered by the same update that scrolled the view).
  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    dayRefs.current.get(focusDay)?.focus()
  }, [focusDay, view])

  const first = monthIndex(monthOf(min))
  const last = max ? monthIndex(monthOf(max)) : Infinity
  const canPrev = monthIndex(view) > first
  const canNext = monthIndex(addMonths(view, count - 1)) < last
  const months = Array.from({ length: count }, (_, i) => addMonths(view, i))

  const disabled = (iso) => iso < min || (max ? iso > max : false)

  const showDay = (iso) => {
    const target = monthOf(iso)
    const shown = months.some((m) => sameMonth(m, target))
    if (shown) return
    // Keep the moved-to month in view: it becomes the first month when moving
    // back, the last when moving forward.
    setView(monthIndex(target) < monthIndex(view) ? target : addMonths(target, -(count - 1)))
  }

  const moveTo = (iso) => {
    const next = clamp(iso, min, max)
    moved.current = true
    setFocusDay(next)
    showDay(next)
  }

  const pick = (iso) => {
    setFocusDay(iso)
    onChange(mode === 'range' ? nextRange({ start, end }, iso, maxNights) : iso)
  }

  const onKeyDown = (e, iso) => {
    const forward = isRtl ? 'ArrowLeft' : 'ArrowRight'
    const back = isRtl ? 'ArrowRight' : 'ArrowLeft'
    const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay()
    let target = null
    if (e.key === forward) target = addDays(iso, 1)
    else if (e.key === back) target = addDays(iso, -1)
    else if (e.key === 'ArrowDown') target = addDays(iso, 7)
    else if (e.key === 'ArrowUp') target = addDays(iso, -7)
    else if (e.key === 'Home') target = addDays(iso, -weekday)
    else if (e.key === 'End') target = addDays(iso, 6 - weekday)
    else if (e.key === 'PageDown' || e.key === 'PageUp') {
      const { year, month } = addMonths(monthOf(iso), e.key === 'PageDown' ? 1 : -1)
      const day = Math.min(Number(iso.slice(8)), new Date(Date.UTC(year, month, 0)).getUTCDate())
      target = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }
    if (!target) return
    e.preventDefault()
    moveTo(target)
  }

  // The one day that is tabbable: the focused day if it is on screen, else the
  // first enabled day shown.
  const visibleDays = months.flatMap((m) => monthGrid(m).flat().filter(Boolean))
  const tabbable = visibleDays.includes(focusDay) && !disabled(focusDay)
    ? focusDay
    : visibleDays.find((d) => !disabled(d))

  let live
  if (mode === 'range') {
    if (!start) live = t.pickIn
    else if (!end) live = t.pickOut(formatDay(start, lang))
    else live = t.range(formatRange(start, end, lang), nightsText(daysBetween(start, end), lang))
  } else {
    live = start ? t.picked(formatDayLong(start, lang)) : t.pickDay
  }

  const cellClass = (iso) => {
    if (mode !== 'range' || !start) return ''
    if (iso === start) return end ? 'is-start has-end' : 'is-start'
    if (end && iso === end) return 'is-end'
    if (end && iso > start && iso < end) return 'is-between'
    return ''
  }
  const dayClass = (iso) => {
    if (mode === 'single') return iso === start ? 'bk-cal-day is-selected' : 'bk-cal-day'
    if (iso === start) return 'bk-cal-day is-start'
    if (end && iso === end) return 'bk-cal-day is-end'
    return 'bk-cal-day'
  }
  const dayLabel = (iso) => {
    const name = formatDayLong(iso, lang)
    if (mode === 'range' && iso === start) return `${name}, ${t.checkIn}`
    if (mode === 'range' && iso === end) return `${name}, ${t.checkOut}`
    return name
  }

  const today = riyadhToday()
  const names = weekdayNames(lang)

  return (
    <div className="bk-cal" role="group" aria-labelledby={label ? labelId : undefined}>
      {label && <span id={labelId} className="bk-sr">{label}</span>}
      <div className="bk-cal-head">
        <button type="button" className="bk-cal-nav" onClick={() => setView(addMonths(view, -1))} disabled={!canPrev} aria-label={t.prev}>
          <Prev />
        </button>
        <p className="bk-cal-live" aria-live="polite">{live}</p>
        <button type="button" className="bk-cal-nav" onClick={() => setView(addMonths(view, 1))} disabled={!canNext} aria-label={t.next}>
          <Next />
        </button>
      </div>
      <div className="bk-cal-months" style={{ '--cal-months': count }}>
        {months.map((m) => (
          <div key={`${m.year}-${m.month}`} role="group" aria-label={monthLabel(m, lang)}>
            <h3 className="bk-cal-title" aria-hidden="true">{monthLabel(m, lang)}</h3>
            <div className="bk-cal-grid">
              {names.map((n) => <span key={n} className="bk-cal-dow" aria-hidden="true">{n}</span>)}
              {monthGrid(m).flat().map((iso, i) => (
                <div key={iso ?? `x${i}`} className={`bk-cal-cell ${iso ? cellClass(iso) : ''}`}>
                  {iso && (
                    <button
                      type="button"
                      ref={(el) => { if (el) dayRefs.current.set(iso, el); else dayRefs.current.delete(iso) }}
                      className={dayClass(iso)}
                      disabled={disabled(iso)}
                      tabIndex={iso === tabbable ? 0 : -1}
                      aria-label={dayLabel(iso)}
                      aria-pressed={iso === start || iso === end}
                      aria-current={iso === today ? 'date' : undefined}
                      onClick={() => pick(iso)}
                      onKeyDown={(e) => onKeyDown(e, iso)}
                      onFocus={() => setFocusDay(iso)}
                    >
                      {Number(iso.slice(8))}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
