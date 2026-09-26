import { describe, expect, it } from 'vitest'
import { saudiSmsOpen, smsBlockedFor } from './smsAvailability'
import { normalizePhone } from './phone'

describe('smsBlockedFor', () => {
  it('blocks Saudi numbers while the server says Saudi SMS is off', () => {
    expect(smsBlockedFor('+966501234567', false)).toBe(true)
  })

  it('blocks Saudi numbers while the config is still loading', () => {
    expect(smsBlockedFor('+966501234567', undefined)).toBe(true)
    expect(smsBlockedFor('+966501234567')).toBe(true)
  })

  it('catches every way a Saudi number is typed once normalised', () => {
    for (const raw of ['0501234567', '501234567', '966501234567', '+966 50 123 4567', '٠٥٠١٢٣٤٥٦٧']) {
      expect(smsBlockedFor(normalizePhone(raw), false)).toBe(true)
    }
  })

  it('lets other countries through', () => {
    expect(smsBlockedFor('+213661234567', false)).toBe(false)
    expect(smsBlockedFor('+97150123456', false)).toBe(false)
  })

  it('treats a missing number as not blocked', () => {
    expect(smsBlockedFor(null, false)).toBe(false)
    expect(smsBlockedFor(undefined, false)).toBe(false)
  })

  it('lets Saudi through once the server switch is on', () => {
    expect(smsBlockedFor('+966501234567', true)).toBe(false)
  })
})

describe('saudiSmsOpen', () => {
  it('is closed while the config loads', () => {
    expect(saudiSmsOpen(undefined)).toBe(false)
    expect(saudiSmsOpen(null)).toBe(false)
  })

  it('follows saudiSmsLive from the server', () => {
    expect(saudiSmsOpen({ demoAuth: false, saudiSmsLive: false })).toBe(false)
    expect(saudiSmsOpen({ demoAuth: false, saudiSmsLive: true })).toBe(true)
  })

  it('is open on a demo backend, which accepts any code', () => {
    expect(saudiSmsOpen({ demoAuth: true, saudiSmsLive: false })).toBe(true)
  })

  it('stays closed on an older backend that does not send the field', () => {
    expect(saudiSmsOpen({ demoAuth: false })).toBe(false)
  })
})
