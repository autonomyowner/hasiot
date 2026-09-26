import { describe, expect, it } from 'vitest'
import { normalizePhone, toLatinDigits } from './phone'

describe('toLatinDigits', () => {
  it('folds Arabic-Indic and Persian digits and the Arabic separators', () => {
    expect(toLatinDigits('٠٥٠١٢٣٤٥٦٧')).toBe('0501234567')
    expect(toLatinDigits('۰۵۰')).toBe('050')
    expect(toLatinDigits('١٬٢٣٤٫٥')).toBe('1234.5')
  })

  it('leaves everything else alone', () => {
    expect(toLatinDigits('+966 50')).toBe('+966 50')
  })
})

describe('normalizePhone', () => {
  it.each([
    ['0501234567', '+966501234567'],
    ['501234567', '+966501234567'],
    ['966501234567', '+966501234567'],
    ['00966501234567', '+966501234567'],
    ['+966 50 123 4567', '+966501234567'],
    ['050-123-4567', '+966501234567'],
    ['٠٥٠١٢٣٤٥٦٧', '+966501234567'],
    ['+97150123456', '+97150123456'],
  ])('%s -> %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(['', '   ', '0401234567', '12345', '+0123', '9664012345', 'abc', null, undefined])(
    'rejects %s',
    (input) => {
      expect(normalizePhone(input)).toBeNull()
    }
  )
})
