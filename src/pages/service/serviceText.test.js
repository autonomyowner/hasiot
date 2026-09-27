import { describe, expect, it } from 'vitest'
import {
  breakdownText,
  groupSizeText,
  languagesText,
  memberSinceYear,
  pickText,
  providerName,
} from './serviceText'

describe('providerName', () => {
  it('joins the names the provider gave', () => {
    expect(providerName({ firstName: 'Sara', lastName: 'Ali' })).toBe('Sara Ali')
    expect(providerName({ firstName: ' Sara ', lastName: '' })).toBe('Sara')
    expect(providerName({ lastName: 'Ali' })).toBe('Ali')
  })

  it('is empty when there is no one to name', () => {
    expect(providerName(null)).toBe('')
    expect(providerName(undefined)).toBe('')
    expect(providerName({})).toBe('')
    expect(providerName({ firstName: '  ', lastName: '' })).toBe('')
  })
})

describe('memberSinceYear', () => {
  it('is the year the account was made, on the Riyadh clock', () => {
    expect(memberSinceYear(Date.UTC(2025, 5, 1))).toBe('2025')
    // 22:30 UTC on New Year's Eve is already 2026 in Riyadh.
    expect(memberSinceYear(Date.UTC(2025, 11, 31, 22, 30))).toBe('2026')
  })

  it('is null without a real date', () => {
    expect(memberSinceYear(undefined)).toBeNull()
    expect(memberSinceYear(null)).toBeNull()
    expect(memberSinceYear(Number.NaN)).toBeNull()
    expect(memberSinceYear(0)).toBeNull()
  })
})

describe('groupSizeText', () => {
  it('says "Up to" in English', () => {
    expect(groupSizeText(1, 'en')).toBe('Up to 1 person')
    expect(groupSizeText(6, 'en')).toBe('Up to 6 people')
  })

  it('puts the Arabic count in the form «حتى» takes, the dual included', () => {
    expect(groupSizeText(1, 'ar')).toBe('حتى شخص واحد')
    // Genitive after «حتى»: شخصين, never شخصان.
    expect(groupSizeText(2, 'ar')).toBe('حتى شخصين')
    expect(groupSizeText(6, 'ar')).toBe('حتى 6 أشخاص')
    expect(groupSizeText(20, 'ar')).toBe('حتى 20 شخصًا')
  })
})

describe('breakdownText', () => {
  it('multiplies the hours or days by the rate', () => {
    expect(breakdownText({ priceUnit: 'per_hour', quantity: 3, unitPrice: 150 }, 'en')).toBe('3 hours × 150 SAR')
    expect(breakdownText({ priceUnit: 'per_day', quantity: 2, unitPrice: 1200 }, 'ar')).toBe('يومان × 1,200 ر.س')
  })

  it('has nothing to break down for a price per booking', () => {
    expect(breakdownText({ priceUnit: 'fixed', quantity: 1, unitPrice: 300 }, 'en')).toBeNull()
    expect(breakdownText({ priceUnit: 'per_event', quantity: 1, unitPrice: 300 }, 'ar')).toBeNull()
  })
})

describe('pickText', () => {
  it("prefers the page's language and falls back to the other", () => {
    expect(pickText('Walks', 'جولات', 'en')).toBe('Walks')
    expect(pickText('Walks', 'جولات', 'ar')).toBe('جولات')
    expect(pickText('Walks', '  ', 'ar')).toBe('Walks')
    expect(pickText(undefined, 'جولات', 'en')).toBe('جولات')
  })

  it('is empty when neither was written', () => {
    expect(pickText(undefined, undefined, 'en')).toBe('')
    expect(pickText(' ', '', 'ar')).toBe('')
  })
})

describe('languagesText', () => {
  it('lists the languages the provider typed, with the comma of the page', () => {
    expect(languagesText(['Arabic', ' English '], 'en')).toBe('Arabic, English')
    expect(languagesText(['العربية', 'الإنجليزية'], 'ar')).toBe('العربية، الإنجليزية')
  })

  it('is empty when there are none', () => {
    expect(languagesText(undefined, 'en')).toBe('')
    expect(languagesText([], 'en')).toBe('')
    expect(languagesText(['', '  '], 'en')).toBe('')
  })
})
