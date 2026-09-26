import { describe, expect, it } from 'vitest'
import { formatAmount, formatSAR, priceLine, unitLabel } from './money'

describe('money', () => {
  it('groups thousands with Latin digits in both languages', () => {
    expect(formatAmount(1350, 'en')).toBe('1,350')
    expect(formatAmount(1350, 'ar')).toBe('1,350')
    expect(formatAmount(450, 'ar')).toBe('450')
  })

  it('writes riyals after the amount, as the app does', () => {
    expect(formatSAR(1350, 'en')).toBe('1,350 SAR')
    expect(formatSAR(1350, 'ar')).toBe('1,350 ر.س')
  })

  it('rounds to whole riyals', () => {
    expect(formatSAR(449.6, 'en')).toBe('450 SAR')
  })

  it('names what a service price is for', () => {
    expect(unitLabel('per_hour', 'en')).toBe('per hour')
    expect(unitLabel('per_day', 'en')).toBe('per day')
    expect(unitLabel('per_event', 'en')).toBe('per booking')
    expect(unitLabel('fixed', 'en')).toBe('per booking')
    expect(unitLabel(undefined, 'en')).toBe('per booking')
    expect(unitLabel('per_hour', 'ar')).toBe('للساعة')
    expect(unitLabel('per_day', 'ar')).toBe('لليوم')
    expect(unitLabel('fixed', 'ar')).toBe('للحجز')
  })

  it('reads a service price as one line, or says it is on request', () => {
    expect(priceLine(150, 'per_hour', 'en')).toBe('150 SAR per hour')
    expect(priceLine(150, 'per_hour', 'ar')).toBe('150 ر.س للساعة')
    expect(priceLine(undefined, 'per_hour', 'en')).toBe('Price on request')
    expect(priceLine(0, 'per_hour', 'ar')).toBe('السعر عند الطلب')
  })
})
