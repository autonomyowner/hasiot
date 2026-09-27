import { describe, expect, it } from 'vitest'
import { daysText, guestsText, hoursText, nightsText, peopleText, quantityText, reviewsText } from './text'

describe('counts', () => {
  it('says nights the way Arabic counts them: one, two, three to ten, eleven and up', () => {
    expect(nightsText(1, 'ar')).toBe('ليلة واحدة')
    expect(nightsText(2, 'ar')).toBe('ليلتان')
    expect(nightsText(3, 'ar')).toBe('3 ليالٍ')
    expect(nightsText(10, 'ar')).toBe('10 ليالٍ')
    expect(nightsText(11, 'ar')).toBe('11 ليلة')
    expect(nightsText(1, 'en')).toBe('1 night')
    expect(nightsText(3, 'en')).toBe('3 nights')
  })

  it('counts guests, people, hours and days the same way', () => {
    expect([1, 2, 3, 11].map((n) => guestsText(n, 'ar'))).toEqual(['ضيف واحد', 'ضيفان', '3 ضيوف', '11 ضيفًا'])
    expect([1, 2, 3, 11].map((n) => peopleText(n, 'ar'))).toEqual(['شخص واحد', 'شخصان', '3 أشخاص', '11 شخصًا'])
    expect([1, 2, 3, 11].map((n) => hoursText(n, 'ar'))).toEqual(['ساعة واحدة', 'ساعتان', '3 ساعات', '11 ساعة'])
    expect([1, 2, 3, 11].map((n) => daysText(n, 'ar'))).toEqual(['يوم واحد', 'يومان', '3 أيام', '11 يومًا'])
    expect([guestsText(1, 'en'), guestsText(2, 'en')]).toEqual(['1 guest', '2 guests'])
    expect([peopleText(1, 'en'), peopleText(4, 'en')]).toEqual(['1 person', '4 people'])
    expect([hoursText(1, 'en'), hoursText(3, 'en')]).toEqual(['1 hour', '3 hours'])
    expect([daysText(1, 'en'), daysText(2, 'en')]).toEqual(['1 day', '2 days'])
  })

  it('counts reviews', () => {
    expect([1, 2, 3, 11].map((n) => reviewsText(n, 'ar'))).toEqual(['تقييم واحد', 'تقييمان', '3 تقييمات', '11 تقييمًا'])
    expect([reviewsText(1, 'en'), reviewsText(12, 'en')]).toEqual(['1 review', '12 reviews'])
  })

  it('describes a service quantity only for hourly and daily prices', () => {
    expect(quantityText('per_hour', 3, 'en')).toBe('3 hours')
    expect(quantityText('per_day', 2, 'ar')).toBe('يومان')
    expect(quantityText('fixed', 1, 'en')).toBe('')
    expect(quantityText('per_event', 1, 'en')).toBe('')
    expect(quantityText(undefined, 1, 'en')).toBe('')
  })
})
