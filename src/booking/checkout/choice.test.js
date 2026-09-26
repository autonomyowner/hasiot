import { describe, expect, it } from 'vitest'
import { bookingErrorText, refusalKind } from '../errors'
import {
  MAX_NOTES,
  NO_AVAILABILITY,
  bookingArgs,
  breakdownLine,
  choiceQuery,
  itemPath,
  quoteArgs,
  quoteState,
  readChoice,
} from './choice'

const TODAY = '2026-09-27'
const STAY = '?checkIn=2026-10-03&checkOut=2026-10-06&guests=2'
const SERVICE = '?date=2026-10-03&time=19:00&quantity=3&people=2'

describe('itemPath', () => {
  it('points at the place or the service page', () => {
    expect(itemPath('stay', 'abc')).toBe('/places/abc')
    expect(itemPath('service', 'abc')).toBe('/services/abc')
  })

  it('encodes whatever the URL carried', () => {
    expect(itemPath('stay', 'a b/c')).toBe('/places/a%20b%2Fc')
  })
})

describe('readChoice', () => {
  it('reads a stay', () => {
    expect(readChoice('stay', STAY, TODAY)).toEqual({ checkIn: '2026-10-03', checkOut: '2026-10-06', guests: 2, valid: true })
  })

  it('reads a service', () => {
    expect(readChoice('service', SERVICE, TODAY)).toEqual({ date: '2026-10-03', time: '19:00', quantity: 3, people: 2, valid: true })
  })

  it('ignores a Google error riding along', () => {
    expect(readChoice('stay', `${STAY}&error=access_denied`, TODAY).valid).toBe(true)
  })
})

describe('choiceQuery', () => {
  it('writes a whole stay back', () => {
    expect(choiceQuery('stay', readChoice('stay', STAY, TODAY), TODAY)).toBe(STAY)
  })

  it('drops dates that cannot be booked but keeps the guests', () => {
    const past = readChoice('stay', '?checkIn=2026-09-01&checkOut=2026-09-03&guests=2', TODAY)
    expect(choiceQuery('stay', past, TODAY)).toBe('?guests=2')
    const backwards = readChoice('stay', '?checkIn=2026-10-06&checkOut=2026-10-03&guests=2', TODAY)
    expect(choiceQuery('stay', backwards, TODAY)).toBe('?guests=2')
    const tooLong = readChoice('stay', '?checkIn=2026-10-01&checkOut=2026-11-15&guests=2', TODAY)
    expect(choiceQuery('stay', tooLong, TODAY)).toBe('?guests=2')
  })

  it('is empty when nothing usable is left', () => {
    expect(choiceQuery('stay', readChoice('stay', '?guests=x', TODAY), TODAY)).toBe('')
    expect(choiceQuery('service', readChoice('service', '', TODAY), TODAY)).toBe('')
  })

  it('writes a whole service back', () => {
    expect(choiceQuery('service', readChoice('service', SERVICE, TODAY), TODAY))
      .toBe('?date=2026-10-03&time=19%3A00&quantity=3&people=2')
  })

  it('drops a past day with its time, keeps the rest', () => {
    const past = readChoice('service', '?date=2026-09-01&time=19:00&quantity=3&people=2', TODAY)
    expect(choiceQuery('service', past, TODAY)).toBe('?quantity=3&people=2')
  })

  it('keeps a day without a time', () => {
    const noTime = readChoice('service', '?date=2026-10-03&people=2', TODAY)
    expect(choiceQuery('service', noTime, TODAY)).toBe('?date=2026-10-03&people=2')
  })
})

describe('quoteArgs', () => {
  it('asks for a stay quote only when the choice is complete', () => {
    expect(quoteArgs('stay', 'L1', readChoice('stay', STAY, TODAY)))
      .toEqual({ listingId: 'L1', checkIn: '2026-10-03', checkOut: '2026-10-06', guests: 2 })
    expect(quoteArgs('stay', 'L1', readChoice('stay', '?guests=2', TODAY))).toBe('skip')
    expect(quoteArgs('stay', undefined, readChoice('stay', STAY, TODAY))).toBe('skip')
  })

  it('sends people as partySize, and hours or days only when chosen', () => {
    expect(quoteArgs('service', 'S1', readChoice('service', SERVICE, TODAY)))
      .toEqual({ serviceId: 'S1', date: '2026-10-03', time: '19:00', partySize: 2, quantity: 3 })
    const fixed = quoteArgs('service', 'S1', readChoice('service', '?date=2026-10-03&time=19:00&people=2', TODAY))
    expect(fixed).toEqual({ serviceId: 'S1', date: '2026-10-03', time: '19:00', partySize: 2 })
    expect('quantity' in fixed).toBe(false)
  })
})

describe('bookingArgs', () => {
  it('builds a stay request, notes trimmed', () => {
    expect(bookingArgs('stay', 'L1', readChoice('stay', STAY, TODAY), '  Arriving late  '))
      .toEqual({ listingId: 'L1', checkIn: '2026-10-03', checkOut: '2026-10-06', guests: 2, notes: 'Arriving late' })
  })

  it('leaves blank notes out', () => {
    const args = bookingArgs('stay', 'L1', readChoice('stay', STAY, TODAY), '   ')
    expect('notes' in args).toBe(false)
  })

  it('never sends more than the limit', () => {
    const args = bookingArgs('stay', 'L1', readChoice('stay', STAY, TODAY), 'x'.repeat(MAX_NOTES + 20))
    expect(args.notes).toHaveLength(MAX_NOTES)
  })

  it('builds a service request', () => {
    expect(bookingArgs('service', 'S1', readChoice('service', SERVICE, TODAY), 'Meet at the lobby'))
      .toEqual({ serviceId: 'S1', date: '2026-10-03', time: '19:00', partySize: 2, quantity: 3, notes: 'Meet at the lobby' })
    const fixed = bookingArgs('service', 'S1', readChoice('service', '?date=2026-10-03&time=19:00&people=2', TODAY), '')
    expect(fixed).toEqual({ serviceId: 'S1', date: '2026-10-03', time: '19:00', partySize: 2 })
  })
})

describe('quoteState', () => {
  const quote = { nights: 3, pricePerNight: 450, totalAmount: 1350 }

  it('is loading until an answer comes', () => {
    expect(quoteState({ data: undefined, error: null })).toEqual({ status: 'loading' })
  })

  it('a failed query is a refusal', () => {
    const error = new Error('boom')
    expect(quoteState({ data: undefined, error })).toEqual({ status: 'refused', reason: error })
  })

  it('carries the server refusal', () => {
    const refusal = 'هذا المكان لا يقبل الحجز حاليًا. / This listing is not available for booking.'
    expect(quoteState({ data: { ok: false, error: refusal }, error: null })).toEqual({ status: 'refused', reason: refusal })
  })

  it('a full place reads as the server would say it', () => {
    const state = quoteState({ data: { ok: true, quote, available: false }, error: null })
    expect(state).toEqual({ status: 'refused', reason: NO_AVAILABILITY })
    expect(bookingErrorText(state.reason, 'en')).toBe('No rooms available for those dates')
    expect(bookingErrorText(state.reason, 'ar')).toBe('لا توجد وحدات متاحة لهذه التواريخ')
    expect(refusalKind(state.reason)).toBe('dates')
  })

  it('an available stay, or any service quote, is ok', () => {
    expect(quoteState({ data: { ok: true, quote, available: true }, error: null })).toEqual({ status: 'ok', quote })
    expect(quoteState({ data: { ok: true, quote }, error: null })).toEqual({ status: 'ok', quote })
  })

  it("keeps the host's check-in and check-out times", () => {
    const data = { ok: true, quote, available: true, checkInTime: '15:00', checkOutTime: '12:00' }
    expect(quoteState({ data, error: null })).toEqual({ status: 'ok', quote, checkInTime: '15:00', checkOutTime: '12:00' })
  })
})

describe('breakdownLine', () => {
  it('nights times the nightly price', () => {
    const quote = { nights: 3, pricePerNight: 450, totalAmount: 1350 }
    expect(breakdownLine('stay', quote, 'en')).toEqual({ label: '3 × 450 SAR', amount: '1,350 SAR' })
    expect(breakdownLine('stay', quote, 'ar')).toEqual({ label: '3 × 450 ر.س', amount: '1,350 ر.س' })
  })

  it('hours or days times the unit price', () => {
    const hourly = { priceUnit: 'per_hour', quantity: 3, unitPrice: 150, totalAmount: 450 }
    expect(breakdownLine('service', hourly, 'en')).toEqual({ label: '3 hours × 150 SAR', amount: '450 SAR' })
    expect(breakdownLine('service', hourly, 'ar')).toEqual({ label: '3 ساعات × 150 ر.س', amount: '450 ر.س' })
    const daily = { priceUnit: 'per_day', quantity: 1, unitPrice: 800, totalAmount: 800 }
    expect(breakdownLine('service', daily, 'en')).toEqual({ label: '1 day × 800 SAR', amount: '800 SAR' })
  })

  it('one price for a fixed or per-event service', () => {
    const fixed = { priceUnit: 'fixed', quantity: 1, unitPrice: 300, totalAmount: 300 }
    expect(breakdownLine('service', fixed, 'en')).toEqual({ label: null, amount: '300 SAR' })
    expect(breakdownLine('service', { ...fixed, priceUnit: 'per_event' }, 'en')).toEqual({ label: null, amount: '300 SAR' })
  })
})
