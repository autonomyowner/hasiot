import { describe, expect, it } from 'vitest'
import {
  addTag,
  bucketLabel,
  DASH,
  formatChange,
  formatDay,
  formatMinutes,
  formatMoney,
  formatPercent,
  formatTimestamp,
  tagLabel,
} from './format'

describe('formatMoney', () => {
  it('groups thousands with Latin digits in both languages', () => {
    expect(formatMoney(12500, 'en')).toBe('SAR 12,500')
    expect(formatMoney(12500, 'ar')).toBe('12,500 ر.س')
  })
  it('rounds to whole riyals and shows a dash for null', () => {
    expect(formatMoney(99.6, 'en')).toBe('SAR 100')
    expect(formatMoney(null, 'en')).toBe(DASH)
  })
})

describe('formatPercent', () => {
  it('turns a ratio into a whole percentage', () => {
    expect(formatPercent(0.834)).toBe('83%')
    expect(formatPercent(0)).toBe('0%')
  })
  it('shows a dash when there was nothing to divide by', () => {
    expect(formatPercent(null)).toBe(DASH)
  })
})

describe('formatMinutes', () => {
  it('picks minutes, hours or days', () => {
    expect(formatMinutes(35, 'en')).toBe('35 min')
    expect(formatMinutes(180, 'en')).toBe('3 h')
    expect(formatMinutes(47 * 60, 'en')).toBe('47 h')
    expect(formatMinutes(2 * 24 * 60, 'en')).toBe('2 d')
    expect(formatMinutes(35, 'ar')).toBe('35 دقيقة')
  })
  it('shows a dash for null', () => {
    expect(formatMinutes(null, 'en')).toBe(DASH)
  })
})

describe('formatChange', () => {
  it('reports growth and decline against the previous period', () => {
    expect(formatChange(112, 100, 'en')).toEqual({ text: '+12%', direction: 'up' })
    expect(formatChange(95, 100, 'en')).toEqual({ text: '−5%', direction: 'down' })
    expect(formatChange(100, 100, 'en')).toEqual({ text: '0%', direction: 'flat' })
  })
  it('calls growth from zero new, and has nothing to say about zero to zero', () => {
    expect(formatChange(3, 0, 'en')).toEqual({ text: 'new', direction: 'new' })
    expect(formatChange(3, 0, 'ar').text).toBe('جديد')
    expect(formatChange(0, 0, 'en')).toBeNull()
  })
})

describe('bucketLabel', () => {
  it('labels days and weeks by day and month', () => {
    expect(bucketLabel('2026-09-26', 'day', 'en')).toBe('26 Sep')
    expect(bucketLabel('2026-09-21', 'week', 'ar')).toBe('21 سبتمبر')
  })
  it('labels months by month and year', () => {
    expect(bucketLabel('2026-01', 'month', 'en')).toBe('Jan 2026')
    expect(bucketLabel('2026-01', 'month', 'ar')).toBe('يناير 2026')
  })
})

describe('dates', () => {
  it('formats an ISO day and a timestamp in Riyadh time', () => {
    expect(formatDay('2026-09-26', 'en')).toBe('26 Sep 2026')
    expect(formatDay(null, 'en')).toBe(DASH)
    // 22:30 UTC on the 25th is already the 26th in Riyadh.
    expect(formatTimestamp(Date.UTC(2026, 8, 25, 22, 30), 'en')).toBe('26 Sep 2026')
  })
})

describe('tags', () => {
  it('translates the default tags and passes free tags through', () => {
    expect(tagLabel('Family', 'ar')).toBe('عائلة')
    expect(tagLabel('Family', 'en')).toBe('Family')
    expect(tagLabel('Late arrival', 'ar')).toBe('Late arrival')
  })
  it('adds trimmed, case-insensitively unique tags within the limits', () => {
    expect(addTag(['VIP'], '  Family ')).toEqual(['VIP', 'Family'])
    expect(addTag(['VIP'], 'vip')).toEqual(['VIP'])
    expect(addTag(['VIP'], '   ')).toEqual(['VIP'])
    expect(addTag([], 'x'.repeat(25))).toEqual([])
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`)
    expect(addTag(ten, 'more')).toBe(ten)
  })
})
