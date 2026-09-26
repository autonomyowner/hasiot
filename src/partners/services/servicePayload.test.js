import { describe, expect, it } from 'vitest'
import {
  EMPTY_SERVICE_FORM,
  editedServiceArgs,
  firstError,
  isLive,
  newServiceArgs,
  parseWholeNumber,
  sameValues,
  serviceFormFromService,
  splitList,
  validateServiceForm,
} from './servicePayload'

const filled = {
  ...EMPTY_SERVICE_FORM,
  serviceType: 'photographer',
  title: '  Desert shoots ',
  titleAr: ' تصوير في الصحراء ',
  description: 'Golden hour portraits',
  descriptionAr: 'صور وقت الغروب',
  city: 'Al Ahsa',
  price: '٢٥٠',
  priceUnit: 'per_hour',
  maxGroupSize: '6',
  availability: 'Weekends',
  availabilityAr: '',
  contactPhone: '0501234567',
  contactEmail: '',
  languages: 'Arabic، English, Arabic',
}

describe('parseWholeNumber', () => {
  it('reads Arabic digits, commas and spaces; empty is undefined; junk is NaN', () => {
    expect(parseWholeNumber('١٢٣')).toBe(123)
    expect(parseWholeNumber('1,500')).toBe(1500)
    expect(parseWholeNumber('  ')).toBeUndefined()
    expect(parseWholeNumber('12.5')).toBeNaN()
    expect(parseWholeNumber('abc')).toBeNaN()
  })
})

describe('splitList', () => {
  it('splits on Latin and Arabic commas, trims, drops blanks and repeats', () => {
    expect(splitList('Arabic، English, , Arabic')).toEqual(['Arabic', 'English'])
  })
})

describe('newServiceArgs', () => {
  it('trims, folds digits and leaves empty fields out', () => {
    expect(newServiceArgs(filled, ['a.jpg'])).toEqual({
      serviceType: 'photographer',
      title_en: 'Desert shoots',
      title_ar: 'تصوير في الصحراء',
      description_en: 'Golden hour portraits',
      description_ar: 'صور وقت الغروب',
      city: 'Al Ahsa',
      price: 250,
      priceUnit: 'per_hour',
      maxGroupSize: 6,
      availability_en: 'Weekends',
      availability_ar: undefined,
      contactPhone: '0501234567',
      contactEmail: undefined,
      languages: ['Arabic', 'English'],
      images: ['a.jpg'],
    })
  })

  it('leaves the price out when empty (the service shows Contact) but keeps the unit', () => {
    const args = newServiceArgs({ ...filled, price: '', maxGroupSize: '', languages: '' }, [])
    expect(args.price).toBeUndefined()
    expect(args.priceUnit).toBe('per_hour')
    expect(args.maxGroupSize).toBeUndefined()
    expect(args.languages).toBeUndefined()
    expect(args.images).toBeUndefined()
  })
})

describe('editedServiceArgs', () => {
  it('sends every field: "" and [] for emptied text and lists, null for an emptied price or group', () => {
    const args = editedServiceArgs(
      { ...filled, price: '', maxGroupSize: '', availability: '', contactPhone: '', languages: '' },
      []
    )
    expect(args.price).toBeNull()
    expect(args.maxGroupSize).toBeNull()
    expect(args.availability_en).toBe('')
    expect(args.contactPhone).toBe('')
    expect(args.languages).toEqual([])
    expect(args.images).toEqual([])
    expect(args.priceUnit).toBe('per_hour')
    expect(Object.keys(args)).not.toContain('serviceId')
  })

  it('keeps a given price', () => {
    expect(editedServiceArgs({ ...filled, price: '1,000', priceUnit: 'fixed' }, ['x']).price).toBe(1000)
  })
})

describe('serviceFormFromService', () => {
  it('fills from a stored service, folding aliases and leaving unset numbers empty', () => {
    const form = serviceFormFromService({
      serviceType: 'driver',
      title_en: 'Airport runs',
      title_ar: 'توصيل',
      city: 'Hofuf',
      languages: ['Arabic', 'Urdu'],
      images: ['p.jpg'],
      priceUnit: 'per_day',
    })
    expect(form.city).toBe('Al Ahsa')
    expect(form.price).toBe('')
    expect(form.maxGroupSize).toBe('')
    expect(form.priceUnit).toBe('per_day')
    expect(form.languages).toBe('Arabic, Urdu')
    expect(form.images).toEqual(['p.jpg'])
    expect(form.description).toBe('')
  })

  it('files an unknown type under other, drops a city outside the province, and reads a missing unit as fixed', () => {
    const form = serviceFormFromService({ serviceType: 'astronaut', city: 'Riyadh', price: 90 })
    expect(form.serviceType).toBe('other')
    expect(form.city).toBe('')
    expect(form.priceUnit).toBe('fixed')
    expect(form.price).toBe('90')
  })

  it('round-trips: an untouched edit writes back what was stored', () => {
    const stored = {
      serviceType: 'tour_guide',
      title_en: 'Oasis walk',
      title_ar: 'جولة الواحة',
      description_en: 'd',
      description_ar: 'و',
      city: 'Al Ahsa',
      price: 150,
      priceUnit: 'per_event',
      maxGroupSize: 12,
      availability_en: 'Daily',
      availability_ar: 'يوميًا',
      contactPhone: '+966501234567',
      contactEmail: 'a@b.co',
      languages: ['Arabic'],
      images: ['1.jpg', '2.jpg'],
    }
    const form = serviceFormFromService(stored)
    const args = editedServiceArgs(form, form.images)
    expect(args).toMatchObject({
      price: 150,
      priceUnit: 'per_event',
      maxGroupSize: 12,
      city: 'Al Ahsa',
      languages: ['Arabic'],
      images: ['1.jpg', '2.jpg'],
    })
  })
})

describe('validateServiceForm', () => {
  it('passes a complete form', () => {
    expect(validateServiceForm(filled)).toEqual({})
  })

  it('requires both titles, both descriptions and a province city', () => {
    const errors = validateServiceForm(EMPTY_SERVICE_FORM)
    expect(Object.keys(errors).sort()).toEqual(['city', 'description', 'descriptionAr', 'title', 'titleAr'])
    expect(validateServiceForm({ ...filled, city: 'Riyadh' }).city).toBe('city')
  })

  it('checks price 1–100,000, group 1–100, and contact details when given', () => {
    expect(validateServiceForm({ ...filled, price: '0' }).price).toBe('price')
    expect(validateServiceForm({ ...filled, price: '100001' }).price).toBe('price')
    expect(validateServiceForm({ ...filled, price: '12.5' }).price).toBe('price')
    expect(validateServiceForm({ ...filled, price: '١٠٠٠٠٠' }).price).toBeUndefined()
    expect(validateServiceForm({ ...filled, maxGroupSize: '101' }).maxGroupSize).toBe('maxGroupSize')
    expect(validateServiceForm({ ...filled, contactPhone: '12' }).contactPhone).toBe('contactPhone')
    expect(validateServiceForm({ ...filled, contactEmail: 'nope' }).contactEmail).toBe('contactEmail')
  })

  it('firstError follows the on-screen order', () => {
    expect(firstError({ price: 'price', title: 'title' })).toBe('title')
    expect(firstError({})).toBeUndefined()
  })
})

describe('status and dirtiness', () => {
  it('a missing status is live; sameValues compares by value', () => {
    expect(isLive(undefined)).toBe(true)
    expect(isLive('pending')).toBe(false)
    expect(sameValues({ a: [1] }, { a: [1] })).toBe(true)
    expect(sameValues(filled, { ...filled, title: 'x' })).toBe(false)
  })
})
