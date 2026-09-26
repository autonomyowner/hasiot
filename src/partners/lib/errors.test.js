import { describe, expect, it } from 'vitest'
import { errorText, GENERIC_ERROR } from './errors'

const convexError = (data) => Object.assign(new Error('ConvexError'), { data })

describe('errorText', () => {
  it('shows the half of a house refusal that matches the language', () => {
    const err = convexError('الحجز غير موجود / Booking not found')
    expect(errorText(err, 'ar')).toBe('الحجز غير موجود')
    expect(errorText(err, 'en')).toBe('Booking not found')
  })

  it('reads data.message too', () => {
    expect(errorText(convexError({ message: 'عربي / English' }), 'en')).toBe('English')
  })

  it('reads a better-auth error ({ error: { message } }) verbatim when not split', () => {
    expect(errorText({ error: { message: 'Too many requests. Try again later.' } }, 'en')).toBe(
      'Too many requests. Try again later.'
    )
    expect(errorText({ message: 'Invalid OTP' }, 'en')).toBe('Invalid OTP')
  })

  it('does not show an Arabic-only message in English, or the reverse', () => {
    expect(errorText(convexError('خطأ فقط'), 'en')).toBe(GENERIC_ERROR.en)
    expect(errorText({ message: 'Invalid OTP' }, 'ar')).toBe(GENERIC_ERROR.ar)
  })

  it('never shows a server stack or a redacted "Server Error"', () => {
    expect(errorText(new Error('[CONVEX M(x)] Server Error'), 'en')).toBe(GENERIC_ERROR.en)
    expect(errorText(undefined, 'ar')).toBe(GENERIC_ERROR.ar)
  })

  it('names a lapsed session', () => {
    expect(errorText(convexError('Not authenticated'), 'en')).toMatch(/session/i)
  })
})
