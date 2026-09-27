import { describe, expect, it } from 'vitest'
import {
  amenityLabels,
  categoryLabel,
  cityText,
  guestLimit,
  isBookableHotel,
  localized,
  openingHours,
  stayTimes,
  typeLabel,
} from './placeInfo'

describe('isBookableHotel', () => {
  it('is a hotel with a nightly price', () => {
    expect(isBookableHotel({ type: 'hotel', pricePerNight: 450 })).toBe(true)
  })

  it('is nothing else', () => {
    expect(isBookableHotel({ type: 'hotel' })).toBe(false)
    expect(isBookableHotel({ type: 'hotel', pricePerNight: 0 })).toBe(false)
    expect(isBookableHotel({ type: 'hotel', pricePerNight: '450' })).toBe(false)
    expect(isBookableHotel({ type: 'restaurant', pricePerNight: 450 })).toBe(false)
    expect(isBookableHotel(null)).toBe(false)
  })
})

describe('localized', () => {
  const listing = { name_en: 'Palm Resort', name_ar: 'منتجع النخيل', description_en: 'By the oasis.' }

  it('reads the page language first', () => {
    expect(localized(listing, 'name', 'ar')).toEqual({ text: 'منتجع النخيل', lang: 'ar' })
    expect(localized(listing, 'name', 'en')).toEqual({ text: 'Palm Resort', lang: 'en' })
  })

  it('falls back to the other language, and says which one it is', () => {
    expect(localized(listing, 'description', 'ar')).toEqual({ text: 'By the oasis.', lang: 'en' })
    expect(localized({ name_en: '  ', name_ar: 'الكوت' }, 'name', 'en')).toEqual({ text: 'الكوت', lang: 'ar' })
  })

  it('is null when neither is filled in', () => {
    expect(localized(listing, 'nothing', 'en')).toBeNull()
    expect(localized({ description_en: ' ', description_ar: '' }, 'description', 'ar')).toBeNull()
  })

  it('trims what it returns', () => {
    expect(localized({ name_en: '  Al Koot  ' }, 'name', 'en')).toEqual({ text: 'Al Koot', lang: 'en' })
  })
})

describe('typeLabel', () => {
  it('names the five listing types in both languages', () => {
    expect(['hotel', 'attraction', 'restaurant', 'event', 'tour'].map((t) => typeLabel(t, 'en')))
      .toEqual(['Stay', 'Place', 'Food', 'Event', 'Tour'])
    expect(['hotel', 'attraction', 'restaurant', 'event', 'tour'].map((t) => typeLabel(t, 'ar')))
      .toEqual(['إقامة', 'مكان', 'مطعم', 'فعالية', 'جولة'])
  })

  it('is null for a type it does not know', () => {
    expect(typeLabel('cafe', 'en')).toBeNull()
    expect(typeLabel(undefined, 'ar')).toBeNull()
  })
})

describe('categoryLabel', () => {
  it('uses the stored Arabic, and English words for the key', () => {
    const listing = { category: 'mid_range_hotel', category_ar: 'فندق متوسط' }
    expect(categoryLabel(listing, 'en')).toBe('Mid-range hotel')
    expect(categoryLabel(listing, 'ar')).toBe('فندق متوسط')
  })

  it('writes an unknown key as words', () => {
    expect(categoryLabel({ category: 'budget_hotel' }, 'en')).toBe('Budget hotel')
  })

  it('falls back to the panel’s Arabic label, else shows nothing in Arabic', () => {
    expect(categoryLabel({ category: 'museum' }, 'ar')).toBe('متحف')
    expect(categoryLabel({ category: 'budget_hotel' }, 'ar')).toBeNull()
  })

  it('is null without a category', () => {
    expect(categoryLabel({}, 'en')).toBeNull()
    expect(categoryLabel({ category: ' ' }, 'ar')).toBeNull()
  })
})

describe('cityText', () => {
  it('folds a stored sub-area into its city', () => {
    expect(cityText('Hofuf', 'en')).toBe('Al Ahsa')
    expect(cityText('Hofuf', 'ar')).toBe('الأحساء')
    expect(cityText('Dhahran', 'ar')).toBe('الخبر')
  })

  it('shows a city it does not know as stored, and nothing for none', () => {
    expect(cityText('Riyadh', 'ar')).toBe('Riyadh')
    expect(cityText('', 'en')).toBeNull()
    expect(cityText(undefined, 'en')).toBeNull()
  })
})

describe('amenityLabels', () => {
  const amenities = ['wifi', 'pool', 'Free parking', ' ', 'wifi']

  it('labels known keys, keeps free text as typed, and drops blanks and repeats', () => {
    expect(amenityLabels(amenities, 'en')).toEqual(['Wi-Fi', 'Swimming pool', 'Free parking'])
    expect(amenityLabels(amenities, 'ar')).toEqual(['واي فاي', 'مسبح', 'Free parking'])
  })

  it('is empty when there are none', () => {
    expect(amenityLabels(undefined, 'en')).toEqual([])
  })
})

describe('openingHours', () => {
  // 2026-09-27 is a Sunday.
  const TODAY = '2026-09-27'
  const hours = [
    { day: 'monday', open: '09:00', close: '22:00' },
    { day: 'Sunday', open: '16:00', close: '23:30' },
    { day: 'friday', open: '09:00', close: '22:00', isClosed: true },
    { day: 'saturday', open: '', close: '' },
  ]

  it('lists the days Sunday first, whatever order they were stored in', () => {
    expect(openingHours(hours, 'en', TODAY)).toEqual([
      { key: 'sunday', day: 'Sunday', hours: '16:00–23:30', isToday: true },
      { key: 'monday', day: 'Monday', hours: '09:00–22:00', isToday: false },
      { key: 'friday', day: 'Friday', hours: null, isToday: false },
      { key: 'saturday', day: 'Saturday', hours: null, isToday: false },
    ])
  })

  it('names the days in Arabic', () => {
    expect(openingHours(hours, 'ar', TODAY).map((row) => row.day)).toEqual(['الأحد', 'الإثنين', 'الجمعة', 'السبت'])
  })

  it('is empty when no hours are stored', () => {
    expect(openingHours(undefined, 'en', TODAY)).toEqual([])
    expect(openingHours([{ day: 'someday', open: '09:00', close: '10:00' }], 'en', TODAY)).toEqual([])
  })
})

describe('stayTimes', () => {
  it('says when a guest can arrive and must leave', () => {
    expect(stayTimes('15:00', '12:00', 'en')).toBe('Check-in from 15:00 · Check-out by 12:00')
    expect(stayTimes('15:00', '12:00', 'ar')).toBe('الوصول من 15:00 · المغادرة حتى 12:00')
  })

  it('says only what is set', () => {
    expect(stayTimes('15:00', undefined, 'en')).toBe('Check-in from 15:00')
    expect(stayTimes(' ', '11:00', 'ar')).toBe('المغادرة حتى 11:00')
    expect(stayTimes(undefined, null, 'en')).toBeNull()
  })
})

describe('guestLimit', () => {
  it('is the place’s own limit, or the server’s default of 4', () => {
    expect(guestLimit({ maxGuests: 6 })).toBe(6)
    expect(guestLimit({ maxGuests: 1 })).toBe(1)
    expect(guestLimit({})).toBe(4)
    expect(guestLimit({ maxGuests: 0 })).toBe(4)
    expect(guestLimit(null)).toBe(4)
  })
})
