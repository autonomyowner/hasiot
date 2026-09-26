import { describe, expect, it } from 'vitest'
import { BOM, csvCell, guestsToCsv } from './csv'

describe('csvCell', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
    expect(csvCell(null)).toBe('')
  })
  it('defuses formulas but leaves phone numbers alone', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('@cmd')).toBe("'@cmd")
    expect(csvCell('+966501234567')).toBe('+966501234567')
  })
})

describe('guestsToCsv', () => {
  const guests = [
    { name: 'سارة, العلي', phone: '+966501234567', bookings: 3, completed: 2, spent: 1500.4, lastVisit: '2026-09-20', tags: ['VIP', 'Family'] },
    { name: null, phone: null, bookings: 1, completed: 0, spent: 0, lastVisit: null, tags: [] },
  ]

  it('starts with a byte-order mark and a header in the page language', () => {
    const csv = guestsToCsv(guests, 'en')
    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.slice(1).split('\r\n')[0]).toBe('Name,Phone,Bookings,Completed,Spent (SAR),Last visit,Tags')
    expect(guestsToCsv(guests, 'ar').slice(1).split('\r\n')[0]).toContain('الاسم')
  })

  it('writes one row per guest with rounded totals and joined tags', () => {
    const lines = guestsToCsv(guests, 'en').slice(1).split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe('"سارة, العلي",+966501234567,3,2,1500,2026-09-20,VIP; Family')
    expect(lines[2]).toBe(',,1,0,0,,')
  })
})
