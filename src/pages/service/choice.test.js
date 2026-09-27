import { describe, expect, it } from 'vitest'
import { riyadhTimestamp } from '../../booking/dates'
import { parseServiceParams } from '../../booking/params'
import { bookingPath, choiceSearch, initialChoice, missingStep, withClock, withDay } from './choice'

// 14:10 on 27 September 2026, Riyadh time.
const now = riyadhTimestamp('2026-09-27', '14:10')
const hourly = { priceUnit: 'per_hour', maxGroupSize: 6 }
const daily = { priceUnit: 'per_day' }
const fixed = { priceUnit: 'fixed' }
const HOURS = { kind: 'hours', min: 1, max: 12 }

describe('initialChoice', () => {
  it('starts with nothing picked, one person and one hour when the URL says nothing', () => {
    expect(initialChoice('', hourly, now)).toEqual({ date: null, time: null, quantity: 1, people: 1 })
  })

  it('has no quantity at all for a price per booking', () => {
    expect(initialChoice('', fixed, now)).toEqual({ date: null, time: null, quantity: null, people: 1 })
    expect(initialChoice('?quantity=3', fixed, now).quantity).toBeNull()
  })

  it('keeps a whole, valid choice from the URL', () => {
    expect(initialChoice('?date=2026-10-03&time=10:00&quantity=3&people=4', hourly, now))
      .toEqual({ date: '2026-10-03', time: '10:00', quantity: 3, people: 4 })
  })

  it('keeps the valid parts and puts the rest back to their defaults', () => {
    // Thirteen hours is over the limit of twelve; seven people over this provider's six.
    expect(initialChoice('?date=2026-10-03&time=10:00&quantity=13&people=7', hourly, now))
      .toEqual({ date: '2026-10-03', time: '10:00', quantity: 1, people: 1 })
    expect(initialChoice('?date=2026-10-03&time=soon&quantity=x&people=0', hourly, now))
      .toEqual({ date: '2026-10-03', time: null, quantity: 1, people: 1 })
  })

  it('drops a day the calendar does not offer', () => {
    expect(initialChoice('?date=2026-09-26', hourly, now).date).toBeNull()
    expect(initialChoice('?date=2026-02-30', hourly, now).date).toBeNull()
    // A year out is the last day on offer.
    expect(initialChoice('?date=2027-09-27', hourly, now).date).toBe('2027-09-27')
    expect(initialChoice('?date=2027-09-28', hourly, now).date).toBeNull()
  })

  it('drops a start time the day does not offer, and a time with no day', () => {
    // At 14:10, 15:00 is less than an hour away; 15:30 is not.
    expect(initialChoice('?date=2026-09-27&time=15:00', hourly, now))
      .toMatchObject({ date: '2026-09-27', time: null })
    expect(initialChoice('?date=2026-09-27&time=15:30', hourly, now))
      .toMatchObject({ date: '2026-09-27', time: '15:30' })
    expect(initialChoice('?date=2026-10-03&time=05:30', hourly, now).time).toBeNull()
    expect(initialChoice('?time=10:00', hourly, now).time).toBeNull()
  })

  it('drops today once no start time is left in it', () => {
    const late = riyadhTimestamp('2026-09-27', '22:30')
    expect(initialChoice('?date=2026-09-27&time=23:00', hourly, late))
      .toMatchObject({ date: null, time: null })
  })

  it('reads days, up to fourteen, for a daily price', () => {
    expect(initialChoice('?quantity=14', daily, now).quantity).toBe(14)
    expect(initialChoice('?quantity=15', daily, now).quantity).toBe(1)
  })

  it('takes up to 20 people when the provider set no limit', () => {
    expect(initialChoice('?people=20', fixed, now).people).toBe(20)
    expect(initialChoice('?people=21', fixed, now).people).toBe(1)
  })
})

describe('withClock', () => {
  const picked = { date: '2026-09-27', time: '15:30', quantity: 2, people: 3 }

  it('keeps a choice the clock has not overtaken', () => {
    expect(withClock(picked, now)).toEqual(picked)
  })

  it('lets go of a start time that has come within the hour since it was picked', () => {
    expect(withClock(picked, riyadhTimestamp('2026-09-27', '14:40'))).toEqual({ ...picked, time: null })
  })

  it('lets go of the day once it has no start time left', () => {
    expect(withClock(picked, riyadhTimestamp('2026-09-27', '22:30'))).toEqual({ ...picked, date: null, time: null })
  })
})

describe('withDay', () => {
  const choice = { date: '2026-10-03', time: '10:00', quantity: 2, people: 3 }

  it('keeps the start time when the new day offers it', () => {
    expect(withDay(choice, '2026-10-04', now)).toEqual({ ...choice, date: '2026-10-04' })
  })

  it('clears a start time the new day no longer offers', () => {
    // 10:00 has already gone today.
    expect(withDay(choice, '2026-09-27', now)).toEqual({ ...choice, date: '2026-09-27', time: null })
  })
})

describe('missingStep', () => {
  it('names the day, then the start time, then nothing', () => {
    expect(missingStep({ date: null, time: null })).toBe('day')
    expect(missingStep({ date: null, time: '10:00' })).toBe('day')
    expect(missingStep({ date: '2026-10-03', time: null })).toBe('time')
    expect(missingStep({ date: '2026-10-03', time: '10:00' })).toBeNull()
  })
})

describe('choiceSearch', () => {
  const full = { date: '2026-10-03', time: '10:00', quantity: 3, people: 4 }

  it('writes what was chosen in a fixed order', () => {
    expect(choiceSearch('', full, HOURS)).toBe('?date=2026-10-03&time=10:00&quantity=3&people=4')
  })

  it('leaves out what is not chosen yet, and the defaults', () => {
    expect(choiceSearch('', { date: null, time: null, quantity: 1, people: 1 }, HOURS)).toBe('')
    expect(choiceSearch('', { date: '2026-10-03', time: null, quantity: 1, people: 1 }, HOURS))
      .toBe('?date=2026-10-03')
  })

  it('never writes a quantity for a price per booking', () => {
    expect(choiceSearch('', full, null)).toBe('?date=2026-10-03&time=10:00&people=4')
  })

  it('keeps parameters that are not its own and replaces its own', () => {
    expect(choiceSearch('?utm_source=mail&date=2026-01-01&people=9', { date: '2026-10-03', time: null, quantity: null, people: 1 }, null))
      .toBe('?utm_source=mail&date=2026-10-03')
  })

  it('changes nothing when written over what it wrote', () => {
    const search = choiceSearch('?ref=x', full, HOURS)
    expect(search).toBe('?ref=x&date=2026-10-03&time=10:00&quantity=3&people=4')
    expect(choiceSearch(search, full, HOURS)).toBe(search)
  })

  it('reads back as the same choice', () => {
    expect(initialChoice(choiceSearch('', full, HOURS), hourly, now)).toEqual(full)
  })
})

describe('bookingPath', () => {
  const choice = { date: '2026-10-03', time: '10:00', quantity: 3, people: 2 }

  it('opens the checkout with the whole choice', () => {
    expect(bookingPath('svc123', choice, HOURS)).toBe('/book/service/svc123?date=2026-10-03&time=10:00&quantity=3&people=2')
  })

  it('sends no quantity for a price per booking', () => {
    expect(bookingPath('svc123', choice, null)).toBe('/book/service/svc123?date=2026-10-03&time=10:00&people=2')
  })

  it('is a request the checkout reads as valid', () => {
    const search = bookingPath('svc123', choice, HOURS).split('?')[1]
    expect(parseServiceParams(search, '2026-09-27')).toEqual({ ...choice, valid: true })
  })
})
