import { describe, expect, it } from 'vitest'
import { riyadhTimestamp } from './dates'
import { canCancel, effectiveStatus, isUpcoming, splitTrips, statusLabel, statusTone } from './status'

const NOW = riyadhTimestamp('2026-09-27', '12:00')
const HOUR = 3_600_000

const stay = (over = {}) => ({
  _id: 's',
  kind: 'stay',
  status: 'confirmed',
  date: '2026-09-30',
  checkIn: '2026-09-30',
  checkOut: '2026-10-02',
  createdAt: NOW - 10 * HOUR,
  ...over,
})
const service = (over = {}) => ({
  _id: 'v',
  kind: 'service',
  status: 'confirmed',
  date: '2026-09-27',
  time: '13:00',
  checkIn: '2026-09-27',
  checkOut: '2026-09-28',
  createdAt: NOW - 10 * HOUR,
  ...over,
})

describe('effectiveStatus', () => {
  it('reads a request past its deadline as expired before the hourly job gets to it', () => {
    expect(effectiveStatus(stay({ status: 'pending', expiresAt: NOW - 1 }), NOW)).toBe('expired')
    expect(effectiveStatus(stay({ status: 'pending', expiresAt: NOW + HOUR }), NOW)).toBe('pending')
    expect(effectiveStatus(stay({ status: 'pending' }), NOW)).toBe('pending')
    expect(effectiveStatus(stay({ status: 'confirmed', expiresAt: NOW - 1 }), NOW)).toBe('confirmed')
  })
})

describe('labels and tones', () => {
  it("uses the app's words", () => {
    expect(statusLabel('pending', 'stay', 'en')).toBe('Awaiting host')
    expect(statusLabel('pending', 'service', 'en')).toBe('Awaiting provider')
    expect(statusLabel('pending', 'stay', 'ar')).toBe('بانتظار المضيف')
    expect(statusLabel('pending', 'service', 'ar')).toBe('بانتظار مقدم الخدمة')
    expect(statusLabel('confirmed', 'stay', 'ar')).toBe('مؤكد')
    expect(statusLabel('completed', 'stay', 'en')).toBe('Completed')
    expect(statusLabel('cancelled', 'stay', 'ar')).toBe('ملغى')
    expect(statusLabel('declined', 'service', 'en')).toBe('Declined')
    expect(statusLabel('expired', 'stay', 'ar')).toBe('منتهي الصلاحية')
    expect(statusLabel('no_show', 'stay', 'en')).toBe('No-show')
    expect(statusLabel('no_show', 'stay', 'ar')).toBe('لم يحضر')
  })

  it('groups statuses into four tones', () => {
    expect(statusTone('pending')).toBe('wait')
    expect(statusTone('confirmed')).toBe('ok')
    expect(statusTone('completed')).toBe('done')
    for (const s of ['cancelled', 'declined', 'expired', 'no_show']) expect(statusTone(s)).toBe('bad')
  })
})

describe('isUpcoming', () => {
  it('keeps a stay upcoming until its check-out day has passed', () => {
    expect(isUpcoming(stay({ checkIn: '2026-09-25', checkOut: '2026-09-27' }), NOW)).toBe(true)
    expect(isUpcoming(stay({ checkIn: '2026-09-24', checkOut: '2026-09-26' }), NOW)).toBe(false)
  })

  it('keeps a service upcoming until it starts', () => {
    expect(isUpcoming(service({ status: 'pending', time: '13:00' }), NOW)).toBe(true)
    expect(isUpcoming(service({ time: '11:00' }), NOW)).toBe(false)
  })

  it('never counts a closed or lapsed booking', () => {
    expect(isUpcoming(stay({ status: 'cancelled' }), NOW)).toBe(false)
    expect(isUpcoming(stay({ status: 'pending', expiresAt: NOW - 1 }), NOW)).toBe(false)
  })

  it('reads an old restaurant reservation by its date', () => {
    expect(isUpcoming({ kind: 'slot', status: 'pending', date: '2026-09-28', time: '19:00' }, NOW)).toBe(true)
    expect(isUpcoming({ status: 'confirmed', date: '2026-09-20', time: '19:00' }, NOW)).toBe(false)
  })
})

describe('splitTrips', () => {
  it('puts the soonest upcoming first and the newest past first', () => {
    const later = stay({ _id: 'later', checkIn: '2026-10-10', checkOut: '2026-10-12' })
    const sooner = service({ _id: 'sooner', time: '18:00' })
    const oldPast = stay({ _id: 'old', status: 'cancelled', createdAt: NOW - 100 * HOUR })
    const newPast = stay({ _id: 'new', status: 'declined', createdAt: NOW - 1 * HOUR })
    const { upcoming, past } = splitTrips([later, oldPast, sooner, newPast], NOW)
    expect(upcoming.map((b) => b._id)).toEqual(['sooner', 'later'])
    expect(past.map((b) => b._id)).toEqual(['new', 'old'])
  })
})

describe('canCancel', () => {
  it('lets a stay be cancelled until its check-in day', () => {
    expect(canCancel(stay({ status: 'pending', checkIn: '2026-09-28' }), NOW)).toBe(true)
    expect(canCancel(stay({ status: 'confirmed', checkIn: '2026-09-28' }), NOW)).toBe(true)
    expect(canCancel(stay({ status: 'confirmed', checkIn: '2026-09-27' }), NOW)).toBe(false)
  })

  it('lets a service request be withdrawn any time, and a confirmed service until it starts', () => {
    expect(canCancel(service({ status: 'pending', time: '11:00' }), NOW)).toBe(true)
    expect(canCancel(service({ status: 'confirmed', time: '14:00' }), NOW)).toBe(true)
    expect(canCancel(service({ status: 'confirmed', time: '11:00' }), NOW)).toBe(false)
  })

  it('never offers to cancel what is already closed', () => {
    for (const status of ['completed', 'cancelled', 'declined', 'expired', 'no_show']) {
      expect(canCancel(stay({ status }), NOW)).toBe(false)
    }
    expect(canCancel(stay({ status: 'pending', expiresAt: NOW - 1 }), NOW)).toBe(false)
  })
})
