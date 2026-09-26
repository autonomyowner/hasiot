import { describe, expect, it } from 'vitest'
import { dayPart, formatDay, formatMoney, previewOf } from './bookingText'

describe('formatDay', () => {
  it('reads an ISO day as a short date, Latin digits in Arabic too', () => {
    expect(formatDay('2026-10-06', 'en')).toBe('6 Oct')
    expect(formatDay('2026-10-06', 'ar')).toMatch(/^6 /)
  })
  it('hands back anything it cannot read', () => {
    expect(formatDay('soon', 'en')).toBe('soon')
    expect(formatDay(undefined, 'en')).toBe('')
  })
})

describe('formatMoney', () => {
  it('formats whole riyals', () => {
    expect(formatMoney(1440, 'SAR', 'en').replace(/\s/g, ' ')).toBe('SAR 1,440')
  })
  it('is empty without an amount', () => {
    expect(formatMoney(undefined, 'SAR', 'en')).toBe('')
  })
})

describe('dayPart', () => {
  it('splits the day into morning, afternoon and evening', () => {
    expect(dayPart(6)).toBe('morning')
    expect(dayPart(11)).toBe('morning')
    expect(dayPart(12)).toBe('afternoon')
    expect(dayPart(17)).toBe('evening')
    expect(dayPart(2)).toBe('evening')
  })
})

describe('previewOf', () => {
  const now = Date.UTC(2026, 8, 26, 12)
  const b = (over) => ({ _id: Math.random().toString(36), status: 'pending', checkIn: '2026-10-01', checkOut: '2026-10-03', ...over })

  it('takes the first few of each list and counts the rest', () => {
    const rows = [
      b({ checkIn: '2026-10-05' }),
      b({ checkIn: '2026-10-02' }),
      b({ checkIn: '2026-10-09' }),
      b({ checkIn: '2026-10-07' }),
      b({ status: 'confirmed', checkIn: '2026-10-20', checkOut: '2026-10-21' }),
      b({ status: 'declined' }),
    ]
    const p = previewOf(rows, now, 3)
    expect(p.pending.map((x) => x.checkIn)).toEqual(['2026-10-02', '2026-10-05', '2026-10-07'])
    expect(p.pendingTotal).toBe(4)
    expect(p.upcoming).toHaveLength(1)
    expect(p.upcomingTotal).toBe(1)
  })

  it('is empty while the bookings load', () => {
    expect(previewOf(undefined, now)).toEqual({ pending: [], upcoming: [], pendingTotal: 0, upcomingTotal: 0 })
  })
})
