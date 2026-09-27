import { describe, expect, it } from 'vitest'
import { accountLabel, displayName, isPlaceholderEmail, needsName, splitName, NAME_MAX } from './account'

describe('isPlaceholderEmail', () => {
  it('knows the address a phone sign-up is given', () => {
    expect(isPlaceholderEmail('966501234567@phone.hasio.xyz')).toBe(true)
    expect(isPlaceholderEmail('213612345678@PHONE.HASIO.XYZ')).toBe(true)
  })

  it('leaves real addresses alone', () => {
    expect(isPlaceholderEmail('sara@example.com')).toBe(false)
    expect(isPlaceholderEmail('someone@hasio.xyz')).toBe(false)
    expect(isPlaceholderEmail(undefined)).toBe(false)
    expect(isPlaceholderEmail(null)).toBe(false)
  })
})

describe('displayName', () => {
  it('joins first and last name', () => {
    expect(displayName({ firstName: 'Sara', lastName: 'Ahmed' })).toBe('Sara Ahmed')
    expect(displayName({ firstName: ' Sara ', lastName: '' })).toBe('Sara')
    expect(displayName({ lastName: 'Ahmed' })).toBe('Ahmed')
  })

  it('is empty without a name', () => {
    expect(displayName({})).toBe('')
    expect(displayName(null)).toBe('')
  })
})

describe('accountLabel', () => {
  it('prefers the name', () => {
    expect(accountLabel({ firstName: 'Sara', lastName: 'Ahmed', phone: '+966501234567', email: 'a@b.co' }))
      .toEqual({ kind: 'name', text: 'Sara Ahmed' })
  })

  it('falls back to the phone, formatted', () => {
    expect(accountLabel({ phone: '+966501234567', email: '966501234567@phone.hasio.xyz' }))
      .toEqual({ kind: 'phone', text: '+966 50 123 4567' })
  })

  it('then to a real email', () => {
    expect(accountLabel({ email: 'sara@example.com' })).toEqual({ kind: 'email', text: 'sara@example.com' })
  })

  it('never shows the placeholder address', () => {
    expect(accountLabel({ email: '966501234567@phone.hasio.xyz' })).toBeNull()
    expect(accountLabel(null)).toBeNull()
  })
})

describe('needsName', () => {
  it('asks when there is no first name', () => {
    expect(needsName({})).toBe(true)
    expect(needsName({ firstName: '   ' })).toBe(true)
    expect(needsName({ firstName: 'Sara' })).toBe(false)
  })
})

describe('splitName', () => {
  it('splits at the first space', () => {
    expect(splitName('Sara Ahmed')).toEqual({ firstName: 'Sara', lastName: 'Ahmed' })
    expect(splitName('Sara Al Ahmed')).toEqual({ firstName: 'Sara', lastName: 'Al Ahmed' })
    expect(splitName('سارة أحمد')).toEqual({ firstName: 'سارة', lastName: 'أحمد' })
  })

  it('trims and folds runs of spaces', () => {
    expect(splitName('  Sara \t  Al   Ahmed \n')).toEqual({ firstName: 'Sara', lastName: 'Al Ahmed' })
  })

  it('sends no last name when there is one word', () => {
    expect(splitName(' Sara ')).toEqual({ firstName: 'Sara' })
  })

  it('refuses nothing and too much', () => {
    expect(splitName('')).toBeNull()
    expect(splitName('    ')).toBeNull()
    expect(splitName(undefined)).toBeNull()
    expect(splitName('a'.repeat(NAME_MAX))).toEqual({ firstName: 'a'.repeat(NAME_MAX) })
    expect(splitName('a'.repeat(NAME_MAX + 1))).toBeNull()
  })
})
