import { describe, expect, it } from 'vitest'
import { parseServiceParams, parseStayParams, safeNext, serviceQuery, stayQuery } from './params'

const TODAY = '2026-09-27'

describe('stay parameters', () => {
  it('reads a stay the server would quote', () => {
    expect(parseStayParams('?checkIn=2026-10-01&checkOut=2026-10-04&guests=2', TODAY)).toEqual({
      checkIn: '2026-10-01',
      checkOut: '2026-10-04',
      guests: 2,
      valid: true,
    })
  })

  it('accepts URLSearchParams as well as a query string', () => {
    const params = new URLSearchParams({ checkIn: '2026-10-01', checkOut: '2026-10-02', guests: '1' })
    expect(parseStayParams(params, TODAY).valid).toBe(true)
  })

  it('is not valid for a past check-in, a wrong order, or more than 30 nights', () => {
    expect(parseStayParams('?checkIn=2026-09-26&checkOut=2026-09-28&guests=2', TODAY).valid).toBe(false)
    expect(parseStayParams('?checkIn=2026-10-04&checkOut=2026-10-04&guests=2', TODAY).valid).toBe(false)
    expect(parseStayParams('?checkIn=2026-10-04&checkOut=2026-10-01&guests=2', TODAY).valid).toBe(false)
    expect(parseStayParams('?checkIn=2026-10-01&checkOut=2026-10-31&guests=2', TODAY).valid).toBe(true)
    expect(parseStayParams('?checkIn=2026-10-01&checkOut=2026-11-01&guests=2', TODAY).valid).toBe(false)
  })

  it('drops what is malformed, field by field', () => {
    for (const guests of ['0', '2.5', 'x', '-1', '']) {
      const parsed = parseStayParams(`?checkIn=2026-10-01&checkOut=2026-10-04&guests=${guests}`, TODAY)
      expect(parsed.guests).toBeNull()
      expect(parsed.valid).toBe(false)
    }
    expect(parseStayParams('?checkIn=2026-02-30&checkOut=nope', TODAY)).toEqual({
      checkIn: null,
      checkOut: null,
      guests: null,
      valid: false,
    })
    expect(parseStayParams('', TODAY)).toEqual({ checkIn: null, checkOut: null, guests: null, valid: false })
  })

  it('writes a stay back into a query string', () => {
    const query = stayQuery({ checkIn: '2026-10-01', checkOut: '2026-10-04', guests: 2 })
    expect(query).toBe('?checkIn=2026-10-01&checkOut=2026-10-04&guests=2')
    expect(parseStayParams(query, TODAY).valid).toBe(true)
  })
})

describe('service parameters', () => {
  it('reads a service request, with or without a quantity', () => {
    expect(parseServiceParams('?date=2026-10-01&time=09:30&quantity=3&people=4', TODAY)).toEqual({
      date: '2026-10-01',
      time: '09:30',
      quantity: 3,
      people: 4,
      valid: true,
    })
    expect(parseServiceParams('?date=2026-10-01&time=09:30&people=1', TODAY)).toEqual({
      date: '2026-10-01',
      time: '09:30',
      quantity: null,
      people: 1,
      valid: true,
    })
  })

  it('is not valid for a past day, a bad time, or no people', () => {
    expect(parseServiceParams('?date=2026-09-26&time=09:30&people=1', TODAY).valid).toBe(false)
    const badTime = parseServiceParams('?date=2026-10-01&time=25:00&people=1', TODAY)
    expect(badTime.time).toBeNull()
    expect(badTime.valid).toBe(false)
    expect(parseServiceParams('?date=2026-10-01&time=9:30&people=1', TODAY).valid).toBe(false)
    expect(parseServiceParams('?date=2026-10-01&time=09:30', TODAY).valid).toBe(false)
    expect(parseServiceParams('?date=2026-10-01&time=09:30&people=1&quantity=0', TODAY).valid).toBe(false)
  })

  it('writes a service request back, leaving out a quantity it does not have', () => {
    expect(serviceQuery({ date: '2026-10-01', time: '09:30', quantity: 3, people: 4 })).toBe(
      '?date=2026-10-01&time=09%3A30&quantity=3&people=4'
    )
    expect(serviceQuery({ date: '2026-10-01', time: '09:30', quantity: null, people: 1 })).toBe(
      '?date=2026-10-01&time=09%3A30&people=1'
    )
    expect(parseServiceParams(serviceQuery({ date: '2026-10-01', time: '09:30', quantity: 3, people: 4 }), TODAY).valid).toBe(true)
  })
})

describe('safeNext', () => {
  it('follows only paths inside My trips and the checkout', () => {
    expect(safeNext('/trips')).toBe('/trips')
    expect(safeNext('/trips/k57abc')).toBe('/trips/k57abc')
    expect(safeNext('/trips?sent=1')).toBe('/trips?sent=1')
    expect(safeNext('/book/stay/k57abc?checkIn=2026-10-01&checkOut=2026-10-04&guests=2')).toBe(
      '/book/stay/k57abc?checkIn=2026-10-01&checkOut=2026-10-04&guests=2'
    )
  })

  it('refuses anything that could leave the site or reach another part of it', () => {
    for (const next of [
      null,
      undefined,
      '',
      '//evil.example',
      '/\\evil.example',
      'https://evil.example/trips',
      'javascript:alert(1)',
      '/admin',
      '/partners',
      '/tripsevil',
      '/book',
      ' /trips',
    ]) {
      expect(safeNext(next)).toBeNull()
    }
  })
})
