import { describe, expect, it } from 'vitest'
import { loginReturnURL, returnTarget } from './returnUrl'

describe('returnTarget', () => {
  it('is this page with its choices, for Google to come back to', () => {
    expect(returnTarget('https://hasio.net', '/book/stay/abc', '?checkIn=2026-10-03&checkOut=2026-10-06&guests=2'))
      .toBe('https://hasio.net/book/stay/abc?checkIn=2026-10-03&checkOut=2026-10-06&guests=2')
  })

  it('never carries an earlier Google failure along', () => {
    expect(returnTarget('https://hasio.net', '/book/stay/abc', '?checkIn=2026-10-03&guests=2&error=access_denied&error_description=x'))
      .toBe('https://hasio.net/book/stay/abc?checkIn=2026-10-03&guests=2')
    expect(returnTarget('https://hasio.net', '/login', '?state=state_not_found')).toBe('https://hasio.net/login')
  })

  it('works without a query', () => {
    expect(returnTarget('https://hasio.net/', '/trips', '')).toBe('https://hasio.net/trips')
  })
})

describe('loginReturnURL', () => {
  it('is /login alone without a next page', () => {
    expect(loginReturnURL('https://hasio.net', null)).toBe('https://hasio.net/login')
  })

  it('keeps the next page, encoded', () => {
    expect(loginReturnURL('https://hasio.net/', '/trips')).toBe('https://hasio.net/login?next=%2Ftrips')
    expect(loginReturnURL('https://hasio.net', '/book/stay/abc?checkIn=2026-10-03&guests=2'))
      .toBe('https://hasio.net/login?next=%2Fbook%2Fstay%2Fabc%3FcheckIn%3D2026-10-03%26guests%3D2')
  })
})
