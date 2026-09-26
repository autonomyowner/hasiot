import { describe, expect, it } from 'vitest'
import { stayQuery } from '../../booking/params'
import { blockReason, defaultGuests, quoteView, readStay, writeStay } from './stayState'

const TODAY = '2026-09-27'
const LIMITS = { today: TODAY, maxDay: '2027-09-27', maxGuests: 4 }

describe('readStay', () => {
  it('reads a stay the calendar could have picked', () => {
    expect(readStay('?checkIn=2026-10-01&checkOut=2026-10-04&guests=3', LIMITS)).toEqual({
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: 3,
    })
  })

  it('starts with two guests, or fewer when the place takes fewer', () => {
    expect(readStay('', LIMITS)).toEqual({ checkIn: null, checkOut: null, guests: 2 })
    expect(readStay('', { ...LIMITS, maxGuests: 1 }).guests).toBe(1)
    expect(defaultGuests(6)).toBe(2)
  })

  it('keeps a lone check-in: the traveller had not chosen the way out yet', () => {
    expect(readStay('?checkIn=2026-10-01', LIMITS)).toEqual({ checkIn: '2026-10-01', checkOut: null, guests: 2 })
  })

  it('keeps a lone guests value', () => {
    expect(readStay('?guests=1', LIMITS)).toEqual({ checkIn: null, checkOut: null, guests: 1 })
  })

  it('holds guests to the place’s limit', () => {
    expect(readStay('?guests=9', LIMITS).guests).toBe(4)
  })

  it('drops dates the calendar would not offer', () => {
    // Check-in in the past, or beyond the last bookable day: nothing is kept.
    expect(readStay('?checkIn=2026-09-26&checkOut=2026-09-28', LIMITS)).toMatchObject({ checkIn: null, checkOut: null })
    expect(readStay('?checkIn=2027-09-28&checkOut=2027-09-30', LIMITS)).toMatchObject({ checkIn: null, checkOut: null })
    // A good check-in with a bad check-out keeps the check-in.
    expect(readStay('?checkIn=2026-10-01&checkOut=2026-11-01', LIMITS)).toMatchObject({ checkIn: '2026-10-01', checkOut: null })
    expect(readStay('?checkIn=2026-10-04&checkOut=2026-10-04', LIMITS)).toMatchObject({ checkIn: '2026-10-04', checkOut: null })
    expect(readStay('?checkIn=2026-10-04&checkOut=2026-10-01', LIMITS)).toMatchObject({ checkIn: '2026-10-04', checkOut: null })
    expect(readStay('?checkIn=2027-09-20&checkOut=2027-09-28', LIMITS)).toMatchObject({ checkIn: '2027-09-20', checkOut: null })
  })

  it('allows a stay of exactly 30 nights, from today', () => {
    expect(readStay('?checkIn=2026-09-27&checkOut=2026-10-27', LIMITS)).toMatchObject({
      checkIn: '2026-09-27',
      checkOut: '2026-10-27',
    })
  })

  it('ignores what is malformed', () => {
    expect(readStay('?checkIn=2026-02-30&checkOut=soon&guests=2.5', LIMITS)).toEqual({ checkIn: null, checkOut: null, guests: 2 })
  })

  it('reads URLSearchParams as well as a string', () => {
    const params = new URLSearchParams({ checkIn: '2026-10-01', checkOut: '2026-10-02', guests: '1' })
    expect(readStay(params, LIMITS)).toEqual({ checkIn: '2026-10-01', checkOut: '2026-10-02', guests: 1 })
  })
})

describe('writeStay', () => {
  const stay = { checkIn: '2026-10-01', checkOut: '2026-10-04', guests: 2 }

  it('writes a complete stay exactly as the checkout link does', () => {
    expect(`?${writeStay('', stay)}`).toBe(stayQuery(stay))
  })

  it('leaves out what is not chosen yet', () => {
    expect(writeStay('?checkIn=2026-10-01&checkOut=2026-10-04&guests=2', { ...stay, checkOut: null }).toString())
      .toBe('checkIn=2026-10-01&guests=2')
    expect(writeStay('?checkIn=2026-10-01&checkOut=2026-10-04&guests=3', { checkIn: null, checkOut: null, guests: 3 }).toString())
      .toBe('guests=3')
  })

  it('keeps anything else in the address, ahead of the stay', () => {
    expect(writeStay('?guests=1&utm_source=ig', stay).toString())
      .toBe('utm_source=ig&checkIn=2026-10-01&checkOut=2026-10-04&guests=2')
  })

  it('round-trips through readStay', () => {
    expect(readStay(writeStay('', stay), LIMITS)).toEqual(stay)
  })

  it('does not change the params it was given', () => {
    const params = new URLSearchParams('guests=1')
    writeStay(params, stay)
    expect(params.toString()).toBe('guests=1')
  })
})

describe('quoteView', () => {
  const stay = { checkIn: '2026-10-01', checkOut: '2026-10-04' }
  const quote = { checkIn: '2026-10-01', checkOut: '2026-10-04', nights: 3, guests: 2, pricePerNight: 450, totalAmount: 1350, currency: 'SAR' }

  it('is empty until both dates are chosen', () => {
    expect(quoteView({ checkIn: null, checkOut: null }, { data: undefined }).state).toBe('empty')
    expect(quoteView({ checkIn: '2026-10-01', checkOut: null }, { data: undefined }).state).toBe('empty')
  })

  it('is loading while the first quote is on its way', () => {
    expect(quoteView(stay, { data: undefined, error: null, stale: false })).toEqual({ state: 'loading', stale: false })
  })

  it('is ok with a quote and a free unit', () => {
    expect(quoteView(stay, { data: { ok: true, quote, available: true } })).toEqual({ state: 'ok', quote, stale: false })
  })

  it('is unavailable when every unit is taken', () => {
    expect(quoteView(stay, { data: { ok: true, quote, available: false } })).toEqual({ state: 'unavailable', quote, stale: false })
  })

  it('is refused, with the server’s reason, when there is no quote', () => {
    const error = 'اختر تواريخ صحيحة. / Choose valid dates.'
    expect(quoteView(stay, { data: { ok: false, error } })).toEqual({ state: 'refused', error, stale: false })
    expect(quoteView(stay, { data: { ok: true, available: true } }).state).toBe('refused')
  })

  it('is failed when the quote could not be fetched', () => {
    const error = new Error('Failed to fetch')
    expect(quoteView(stay, { data: undefined, error })).toEqual({ state: 'failed', error, stale: false })
  })

  it('keeps the last figures, marked stale, while the next quote loads', () => {
    expect(quoteView(stay, { data: { ok: true, quote, available: true }, stale: true })).toEqual({ state: 'ok', quote, stale: true })
  })
})

describe('blockReason', () => {
  const stay = { checkIn: '2026-10-01', checkOut: '2026-10-04' }
  const ok = { state: 'ok', quote: {}, stale: false }

  it('goes ahead with a fresh, available quote', () => {
    expect(blockReason(stay, ok)).toBeNull()
  })

  it('asks for what is missing first', () => {
    expect(blockReason({ checkIn: null, checkOut: null }, { state: 'empty' })).toBe('dates')
    expect(blockReason({ checkIn: '2026-10-01', checkOut: null }, { state: 'empty' })).toBe('checkout')
  })

  it('waits for a quote that is loading, or that belongs to the previous choice', () => {
    expect(blockReason(stay, { state: 'loading', stale: false })).toBe('calculating')
    expect(blockReason(stay, { ...ok, stale: true })).toBe('calculating')
    expect(blockReason(stay, { state: 'unavailable', stale: true })).toBe('calculating')
  })

  it('says why a quote cannot be booked', () => {
    expect(blockReason(stay, { state: 'unavailable', stale: false })).toBe('unavailable')
    expect(blockReason(stay, { state: 'refused', stale: false })).toBe('refused')
    expect(blockReason(stay, { state: 'failed', stale: false })).toBe('failed')
  })
})
