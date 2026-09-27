import { describe, expect, it } from 'vitest'
import {
  MAX_DAYS_AHEAD,
  MAX_NIGHTS,
  addDays,
  addMonths,
  daysBetween,
  formatDay,
  formatDayLong,
  formatRange,
  isISODate,
  monthGrid,
  monthLabel,
  monthOf,
  nextRange,
  riyadhTimestamp,
  riyadhToday,
  weekdayNames,
} from './dates'

describe('riyadhToday', () => {
  it('turns over at midnight in Riyadh, which is 21:00 UTC', () => {
    expect(riyadhToday(Date.UTC(2026, 8, 26, 20, 59))).toBe('2026-09-26')
    expect(riyadhToday(Date.UTC(2026, 8, 26, 21, 0))).toBe('2026-09-27')
  })
})

describe('isISODate', () => {
  it('accepts real calendar days in YYYY-MM-DD only', () => {
    expect(isISODate('2026-09-27')).toBe(true)
    expect(isISODate('2028-02-29')).toBe(true)
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2026-9-1')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('')).toBe(false)
    expect(isISODate(null)).toBe(false)
    expect(isISODate('2026-09-27T00:00')).toBe(false)
  })
})

describe('day arithmetic', () => {
  it('crosses months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-09-27', 365)).toBe('2027-09-27')
  })

  it('counts whole days between two dates', () => {
    expect(daysBetween('2026-09-10', '2026-09-13')).toBe(3)
    expect(daysBetween('2026-09-13', '2026-09-10')).toBe(-3)
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3)
  })

  it('has the limits the server enforces', () => {
    expect(MAX_NIGHTS).toBe(30)
    expect(MAX_DAYS_AHEAD).toBe(365)
  })
})

describe('riyadhTimestamp', () => {
  it('reads a date and time on the Riyadh wall clock (UTC+3)', () => {
    expect(riyadhTimestamp('2026-09-27', '09:30')).toBe(Date.UTC(2026, 8, 27, 6, 30))
    expect(riyadhTimestamp('2026-09-27', '00:00')).toBe(Date.UTC(2026, 8, 26, 21, 0))
  })
})

describe('months', () => {
  it('knows the month of a date and steps across years', () => {
    expect(monthOf('2026-10-03')).toEqual({ year: 2026, month: 10 })
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
  })

  it('lays a month out in weeks starting on Sunday', () => {
    // 1 October 2026 is a Thursday.
    const grid = monthGrid({ year: 2026, month: 10 })
    expect(grid[0]).toEqual([null, null, null, null, '2026-10-01', '2026-10-02', '2026-10-03'])
    for (const week of grid) expect(week).toHaveLength(7)
    const days = grid.flat().filter(Boolean)
    expect(days).toHaveLength(31)
    expect(days.at(-1)).toBe('2026-10-31')
  })

  it('starts a month that begins on Sunday in the first cell', () => {
    // 1 November 2026 is a Sunday.
    expect(monthGrid({ year: 2026, month: 11 })[0][0]).toBe('2026-11-01')
  })
})

describe('names', () => {
  it('names weekdays from Sunday in both languages', () => {
    expect(weekdayNames('en')).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
    expect(weekdayNames('ar')[0]).toBe('أحد')
    expect(weekdayNames('ar')).toHaveLength(7)
  })

  it('names months on the Gregorian calendar with Latin digits, even in Arabic', () => {
    expect(monthLabel({ year: 2026, month: 10 }, 'en')).toBe('October 2026')
    // Plain ar-SA would print the Hijri month.
    expect(monthLabel({ year: 2026, month: 10 }, 'ar')).toBe('أكتوبر 2026')
  })

  it('formats a day short and long', () => {
    expect(formatDay('2026-10-03', 'en')).toBe('3 Oct')
    expect(formatDay('2026-10-03', 'ar')).toBe('3 أكتوبر')
    expect(formatDayLong('2026-10-03', 'en')).toBe('Sat, 3 Oct 2026')
    expect(formatDayLong('2026-10-03', 'ar')).toBe('السبت، 3 أكتوبر 2026')
  })

  it('formats a range', () => {
    expect(formatRange('2026-10-03', '2026-10-06', 'en')).toBe('3 Oct – 6 Oct')
    expect(formatRange('2026-10-03', '2026-10-06', 'ar')).toBe('3 أكتوبر – 6 أكتوبر')
  })
})

describe('nextRange', () => {
  const empty = { start: null, end: null }

  it('starts a stay on the first tap', () => {
    expect(nextRange(empty, '2026-10-03')).toEqual({ start: '2026-10-03', end: null })
  })

  it('ends it on a later tap', () => {
    expect(nextRange({ start: '2026-10-03', end: null }, '2026-10-06')).toEqual({
      start: '2026-10-03',
      end: '2026-10-06',
    })
  })

  it('starts over on the same day or an earlier one', () => {
    expect(nextRange({ start: '2026-10-03', end: null }, '2026-10-03')).toEqual({ start: '2026-10-03', end: null })
    expect(nextRange({ start: '2026-10-03', end: null }, '2026-10-01')).toEqual({ start: '2026-10-01', end: null })
  })

  it('starts over when the stay would be longer than allowed', () => {
    expect(nextRange({ start: '2026-10-03', end: null }, '2026-11-02')).toEqual({
      start: '2026-10-03',
      end: '2026-11-02',
    })
    expect(nextRange({ start: '2026-10-03', end: null }, '2026-11-03')).toEqual({ start: '2026-11-03', end: null })
  })

  it('starts over after a complete stay', () => {
    expect(nextRange({ start: '2026-10-03', end: '2026-10-06' }, '2026-10-10')).toEqual({
      start: '2026-10-10',
      end: null,
    })
  })
})
