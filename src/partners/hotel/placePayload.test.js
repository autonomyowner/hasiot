import { describe, expect, it } from 'vitest'
import {
  editPlacePayload,
  emptyForm,
  formFromListing,
  keptCounts,
  newPlacePayload,
  ownerStatusOf,
  parseWholeNumber,
  validateForm,
} from './placePayload'
import { canonicalCity, cityCoordinates, cityLabel } from './cities'

const seededHotel = {
  type: 'hotel',
  category: 'luxury_hotel',
  category_ar: 'فندق فاخر',
  name_en: 'Oasis Hotel',
  name_ar: 'فندق الواحة',
  city: 'Hofuf',
  region: 'Eastern Province',
  address: 'King Abdullah Rd, Hofuf',
  coordinates: { lat: 25.3801, lng: 49.5871 },
  pricePerNight: 450,
  currency: 'SAR',
  maxGuests: 4,
  checkInTime: '14:00',
  checkOutTime: '12:00',
  description_en: 'Nice',
  description_ar: 'جميل',
  amenities: ['wifi', 'Free coffee'],
  images: ['https://x/a.jpg', 'https://x/b.jpg'],
}

describe('cities', () => {
  it('folds aliases and places a city centre', () => {
    expect(canonicalCity('Hofuf')).toBe('Al Ahsa')
    expect(canonicalCity('Dhahran')).toBe('Al Khobar')
    expect(cityCoordinates('Dammam')).toEqual({ lat: 26.4207, lng: 50.0888 })
    expect(cityCoordinates('Al Bayda')).toEqual({ lat: 26.4207, lng: 50.0888 })
    expect(cityLabel('Mubarraz', 'ar')).toBe('الأحساء')
    expect(cityLabel('Somewhere', 'en')).toBe('Somewhere')
  })
})

describe('parseWholeNumber', () => {
  it('folds Arabic digits and grouping', () => {
    expect(parseWholeNumber('٤٥٠')).toBe(450)
    expect(parseWholeNumber('1,200')).toBe(1200)
    expect(parseWholeNumber('  ')).toBeUndefined()
    expect(parseWholeNumber('12.5')).toBeNaN()
  })
})

describe('newPlacePayload', () => {
  it('builds a new stay with the city centre and the neighbourhood as address', () => {
    const form = {
      ...emptyForm('stay'),
      name: ' Sea View ',
      nameAr: 'إطلالة',
      city: 'Al Khobar',
      neighborhood: 'Corniche',
      pricePerNight: '٣٠٠',
      checkInTime: '٩:٠٠',
      amenities: ['wifi'],
    }
    expect(newPlacePayload(form)).toEqual({
      type: 'hotel',
      name_en: 'Sea View',
      name_ar: 'إطلالة',
      category: 'hotel',
      city: 'Al Khobar',
      coordinates: { lat: 26.2794, lng: 50.2083 },
      address: 'Corniche',
      region: 'Corniche',
      amenities: ['wifi'],
      pricePerNight: 300,
      currency: 'SAR',
      maxGuests: 2,
      unitCount: 1,
      checkInTime: '09:00',
      checkOutTime: '12:00',
    })
  })

  it('sends no price at all for a new stay without one (never null)', () => {
    const payload = newPlacePayload({ ...emptyForm('stay'), name: 'a', nameAr: 'b', city: 'Dammam' })
    expect('pricePerNight' in payload).toBe(false)
    expect('currency' in payload).toBe(false)
    expect(payload.address).toBe('Dammam')
  })

  it('builds a destination whose blank address falls back to the city', () => {
    const payload = newPlacePayload({ ...emptyForm('place'), name: 'Fort', nameAr: 'قلعة', city: 'Qatif' })
    expect(payload).toEqual({
      type: 'attraction',
      name_en: 'Fort',
      name_ar: 'قلعة',
      category: 'historical',
      city: 'Qatif',
      coordinates: { lat: 26.5196, lng: 49.9962 },
      address: 'Qatif',
    })
  })
})

describe('formFromListing', () => {
  it('keeps unset counts empty, the stored category, and folds the city', () => {
    const form = formFromListing(seededHotel)
    expect(form.kind).toBe('stay')
    expect(form.category).toBe('luxury_hotel')
    expect(form.city).toBe('Al Ahsa')
    expect(form.neighborhood).toBe('')
    expect(form.maxGuests).toBe('4')
    expect(form.unitCount).toBe('')
    expect(form.pricePerNight).toBe('450')
  })
})

describe('editPlacePayload', () => {
  it('a price change leaves the pin, address, region and capacity alone', () => {
    const form = { ...formFromListing(seededHotel), pricePerNight: '500' }
    const payload = editPlacePayload(form, seededHotel)
    expect(payload.coordinates).toBeUndefined()
    expect(payload.address).toBeUndefined()
    expect(payload.region).toBeUndefined()
    expect(payload.category_ar).toBeUndefined()
    expect('unitCount' in payload).toBe(false)
    expect(payload.maxGuests).toBe(4)
    expect(payload.pricePerNight).toBe(500)
    expect(payload.city).toBe('Al Ahsa')
  })

  it('an emptied nightly price is sent as null, and its currency with nothing', () => {
    const form = { ...formFromListing(seededHotel), pricePerNight: '' }
    const payload = editPlacePayload(form, seededHotel)
    expect(payload.pricePerNight).toBeNull()
    expect('currency' in payload).toBe(false)
  })

  it('an emptied guest cap is left out, and reported as kept', () => {
    const form = { ...formFromListing(seededHotel), maxGuests: '' }
    expect('maxGuests' in editPlacePayload(form, seededHotel)).toBe(false)
    expect(keptCounts(form, seededHotel)).toEqual(['maxGuests'])
  })

  it('moves the pin only when the city changes', () => {
    const form = { ...formFromListing(seededHotel), city: 'Dammam' }
    const payload = editPlacePayload(form, seededHotel)
    expect(payload.coordinates).toEqual({ lat: 26.4207, lng: 50.0888 })
    expect(payload.address).toBe('Dammam')
  })

  it('a neighbourhood edit rewrites address and region, not the pin', () => {
    const form = { ...formFromListing(seededHotel), neighborhood: 'Al Naseem' }
    const payload = editPlacePayload(form, seededHotel)
    expect(payload.address).toBe('Al Naseem')
    expect(payload.region).toBe('Al Naseem')
    expect(payload.coordinates).toBeUndefined()
  })

  it('sends emptied text and lists as "" and [], and clears category_ar on a new category', () => {
    const form = {
      ...formFromListing(seededHotel),
      category: 'camp',
      description: '',
      amenities: [],
      images: [],
    }
    const payload = editPlacePayload(form, seededHotel)
    expect(payload.description_en).toBe('')
    expect(payload.amenities).toEqual([])
    expect(payload.images).toEqual([])
    expect(payload.category_ar).toBe('')
  })

  it('a destination edit keeps its pin within the same city', () => {
    const place = { type: 'attraction', category: 'natural_landmark', name_en: 'a', name_ar: 'b', city: 'Mubarraz', address: 'Jabal' }
    const payload = editPlacePayload({ ...formFromListing(place), address: '' }, place)
    expect(payload.coordinates).toBeUndefined()
    expect(payload.address).toBe('Al Ahsa')
    expect(payload.category).toBe('natural_landmark')
  })
})

describe('validateForm', () => {
  it('requires names and a city, and checks the stay limits', () => {
    expect(validateForm(emptyForm('place'))).toEqual({ name: 'required', nameAr: 'required', city: 'chooseCity' })
    const errors = validateForm({
      ...emptyForm('stay'),
      name: 'a',
      nameAr: 'b',
      city: 'Dammam',
      pricePerNight: '0',
      maxGuests: '21',
      unitCount: 'x',
      checkInTime: '25:00',
    })
    expect(errors).toEqual({ pricePerNight: 'price', maxGuests: 'guests', unitCount: 'units', checkInTime: 'time' })
  })
})

describe('ownerStatusOf', () => {
  it('treats a seed row with no status as live', () => {
    expect(ownerStatusOf(undefined)).toBe('approved')
    expect(ownerStatusOf('rejected')).toBe('rejected')
  })
})
