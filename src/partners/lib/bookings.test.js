import { describe, expect, it } from 'vitest'
import { actionsFor, partitionBookings, riyadhMoment, shownStatus, todayRiyadhISO } from './bookings'

// 2026-09-10 12:00 Riyadh = 09:00 UTC
const NOW = Date.UTC(2026, 8, 10, 9, 0)

describe('dates on the Riyadh clock', () => {
  it('today', () => {
    expect(todayRiyadhISO(Date.UTC(2026, 8, 9, 22, 0))).toBe('2026-09-10')
  })
  it('a day and time as a moment', () => {
    expect(riyadhMoment('2026-09-10', '12:00')).toBe(NOW)
    expect(riyadhMoment('bad', '12:00')).toBeNaN()
  })
})

describe('shownStatus', () => {
  it('shows a pending request past its expiry as expired', () => {
    expect(shownStatus({ status: 'pending', expiresAt: NOW - 1 }, NOW)).toBe('expired')
    expect(shownStatus({ status: 'pending', expiresAt: NOW + 1 }, NOW)).toBe('pending')
  })
})

describe('partitionBookings', () => {
  const rows = [
    { _id: 'a', status: 'pending', date: '2026-09-20', checkIn: '2026-09-20', checkOut: '2026-09-22' },
    { _id: 'b', status: 'pending', date: '2026-09-12', checkIn: '2026-09-12', checkOut: '2026-09-13' },
    { _id: 'c', status: 'confirmed', date: '2026-09-09', checkIn: '2026-09-09', checkOut: '2026-09-11' },
    { _id: 'd', status: 'confirmed', date: '2026-09-01', checkIn: '2026-09-01', checkOut: '2026-09-03' },
    { _id: 'e', status: 'declined', date: '2026-09-15' },
    { _id: 'f', status: 'pending', date: '2026-09-15', expiresAt: NOW - 1 },
  ]
  it('splits requests / upcoming / past like the app', () => {
    const g = partitionBookings(rows, NOW)
    expect(g.pending.map((b) => b._id)).toEqual(['b', 'a'])
    expect(g.upcoming.map((b) => b._id)).toEqual(['c'])
    expect(g.past.map((b) => b._id)).toEqual(['e', 'f', 'd'])
  })
})

describe('actionsFor', () => {
  it('decide on a live request', () => {
    expect(actionsFor({ status: 'pending', date: '2026-09-20' }, 'stay', NOW)).toBe('decide')
  })
  it('nothing on an expired request or a closed booking', () => {
    expect(actionsFor({ status: 'pending', expiresAt: NOW - 1, date: 'x' }, 'stay', NOW)).toBe('none')
    expect(actionsFor({ status: 'completed', date: '2026-09-01' }, 'stay', NOW)).toBe('none')
  })
  it('a stay closes from its arrival day', () => {
    expect(actionsFor({ status: 'confirmed', checkIn: '2026-09-10', date: '2026-09-10' }, 'stay', NOW)).toBe('close')
    expect(actionsFor({ status: 'confirmed', checkIn: '2026-09-11', date: '2026-09-11' }, 'stay', NOW)).toBe('none')
  })
  it('a service closes from its start time', () => {
    expect(actionsFor({ status: 'confirmed', date: '2026-09-10', time: '12:00' }, 'service', NOW)).toBe('close')
    expect(actionsFor({ status: 'confirmed', date: '2026-09-10', time: '12:01' }, 'service', NOW)).toBe('none')
  })
})
