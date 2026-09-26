import { describe, expect, it } from 'vitest'
import { alreadyVerified, codeFailure, isSaudiMobile, phoneMode } from './phoneStep'

const SMS_OFF = { saudiSmsLive: false, demoAuth: false }
const SMS_LIVE = { saudiSmsLive: true, demoAuth: false }

describe('isSaudiMobile', () => {
  it('is +9665 and eight digits, as the server says', () => {
    expect(isSaudiMobile('+966501234567')).toBe(true)
    expect(isSaudiMobile('+966112345678')).toBe(false)
    expect(isSaudiMobile('+213612345678')).toBe(false)
    expect(isSaudiMobile(null)).toBe(false)
  })
})

describe('phoneMode', () => {
  it('saves a Saudi mobile while Saudi SMS is off', () => {
    expect(phoneMode('+966501234567', 'sa', SMS_OFF)).toBe('save')
  })

  it('sends a code to a Saudi mobile once Saudi SMS is live', () => {
    expect(phoneMode('+966501234567', 'sa', SMS_LIVE)).toBe('verify')
  })

  it('sends a code to any other country', () => {
    expect(phoneMode('+213612345678', 'intl', SMS_OFF)).toBe('verify')
  })

  it('follows the server switch only: the demo backend still saves', () => {
    // setContactPhone refuses only when SAUDI_SMS_LIVE is on, whatever the SMS provider.
    expect(phoneMode('+966501234567', 'sa', { saudiSmsLive: false, demoAuth: true })).toBe('save')
  })

  it('counts a config still loading as SMS off', () => {
    expect(phoneMode('+966501234567', 'sa', undefined)).toBe('save')
    expect(phoneMode(null, 'sa', undefined)).toBe('save')
  })

  it('goes by the country choice until a number is typed', () => {
    expect(phoneMode(null, 'sa', SMS_OFF)).toBe('save')
    expect(phoneMode(null, 'intl', SMS_OFF)).toBe('verify')
    expect(phoneMode(null, 'sa', SMS_LIVE)).toBe('verify')
  })

  it('lets the typed number win over the country choice', () => {
    expect(phoneMode('+966501234567', 'intl', SMS_OFF)).toBe('save')
    expect(phoneMode('+213612345678', 'sa', SMS_OFF)).toBe('verify')
  })

  it('refuses a Saudi number that is not a mobile', () => {
    expect(phoneMode('+966112345678', 'sa', SMS_OFF)).toBe('invalid')
    expect(phoneMode('+966112345678', 'intl', SMS_LIVE)).toBe('invalid')
  })
})

describe('alreadyVerified', () => {
  it('reads the contact-phone refusal that means there is nothing to do', () => {
    expect(alreadyVerified({ data: 'رقم جوالك موثّق بالفعل. / Your phone number is already verified.' })).toBe(true)
  })

  it('is false for every other refusal', () => {
    expect(alreadyVerified({ data: 'أدخل رقم جوال سعودي صحيح. / Enter a valid Saudi mobile number.' })).toBe(false)
    expect(alreadyVerified(new Error('network'))).toBe(false)
    expect(alreadyVerified(null)).toBe(false)
  })
})

describe('codeFailure', () => {
  const auth = (message) => ({ error: { message } })

  it('a number owned by another account', () => {
    expect(codeFailure(auth('Phone number already exists'))).toBe('taken')
  })

  it('a code that needs replacing', () => {
    expect(codeFailure(auth('OTP expired'))).toBe('expired')
    expect(codeFailure(auth('OTP not found'))).toBe('expired')
    expect(codeFailure(auth('Too many attempts'))).toBe('expired')
  })

  it('a wrong code', () => {
    expect(codeFailure(auth('Invalid OTP'))).toBe('wrong')
  })

  it('nothing it knows', () => {
    expect(codeFailure(auth('Something else'))).toBeNull()
    expect(codeFailure(undefined)).toBeNull()
  })
})
