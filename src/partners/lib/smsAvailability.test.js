import { describe, expect, it } from 'vitest'
import { SAUDI_SMS_LIVE, smsBlockedFor } from './smsAvailability'
import { normalizePhone } from './phone'

describe('smsBlockedFor', () => {
  it('is off for Saudi numbers until delivery is confirmed', () => {
    expect(SAUDI_SMS_LIVE).toBe(false)
    expect(smsBlockedFor('+966501234567')).toBe(true)
  })

  it('catches every way a Saudi number is typed once normalised', () => {
    for (const raw of ['0501234567', '501234567', '966501234567', '+966 50 123 4567', '٠٥٠١٢٣٤٥٦٧']) {
      expect(smsBlockedFor(normalizePhone(raw))).toBe(true)
    }
  })

  it('lets other countries through', () => {
    expect(smsBlockedFor('+213661234567')).toBe(false)
    expect(smsBlockedFor('+97150123456')).toBe(false)
  })

  it('treats a missing number as not blocked', () => {
    expect(smsBlockedFor(null)).toBe(false)
    expect(smsBlockedFor(undefined)).toBe(false)
  })

  it('lets Saudi through once the switch is flipped', () => {
    expect(smsBlockedFor('+966501234567', true)).toBe(false)
  })
})
