import { describe, expect, it } from 'vitest'
import { riyadhTimestamp } from './dates'
import { firstServiceDay, maxPeople, quantityRule, startTimes } from './serviceRules'

const at = (date, time) => riyadhTimestamp(date, time)

describe('startTimes', () => {
  it('offers every half hour from 06:00 to 23:00 on a later day', () => {
    const times = startTimes('2026-09-28', at('2026-09-27', '14:10'))
    expect(times).toHaveLength(35)
    expect(times[0]).toBe('06:00')
    expect(times[1]).toBe('06:30')
    expect(times.at(-1)).toBe('23:00')
  })

  it('offers only times at least an hour away today', () => {
    expect(startTimes('2026-09-27', at('2026-09-27', '14:10'))[0]).toBe('15:30')
    expect(startTimes('2026-09-27', at('2026-09-27', '14:30'))[0]).toBe('15:30')
    expect(startTimes('2026-09-27', at('2026-09-27', '22:30'))).toEqual([])
  })

  it('offers nothing on a past or malformed day', () => {
    expect(startTimes('2026-09-26', at('2026-09-27', '08:00'))).toEqual([])
    expect(startTimes('nope', at('2026-09-27', '08:00'))).toEqual([])
    expect(startTimes(null, at('2026-09-27', '08:00'))).toEqual([])
  })
})

describe('firstServiceDay', () => {
  it('is today while a start time is left, tomorrow after that', () => {
    expect(firstServiceDay(at('2026-09-27', '14:10'))).toBe('2026-09-27')
    expect(firstServiceDay(at('2026-09-27', '22:30'))).toBe('2026-09-28')
  })
})

describe('quantityRule', () => {
  it('asks for hours or days only when the price is per hour or per day', () => {
    expect(quantityRule('per_hour')).toEqual({ kind: 'hours', min: 1, max: 12 })
    expect(quantityRule('per_day')).toEqual({ kind: 'days', min: 1, max: 14 })
    expect(quantityRule('per_event')).toBeNull()
    expect(quantityRule('fixed')).toBeNull()
    expect(quantityRule(undefined)).toBeNull()
  })
})

describe('maxPeople', () => {
  it("is the provider's limit, or 20", () => {
    expect(maxPeople({})).toBe(20)
    expect(maxPeople({ maxGroupSize: 6 })).toBe(6)
    expect(maxPeople(null)).toBe(20)
  })
})
