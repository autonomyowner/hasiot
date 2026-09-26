import { describe, expect, it } from 'vitest'
import {
  accountLabel,
  bilingualHalf,
  defaultTab,
  detailRows,
  emailOf,
  personName,
  reasonFor,
  reviewTarget,
  starsText,
  tripImage,
  tripKind,
  tripName,
  tripTotal,
  tripWhat,
  tripWhen,
} from './tripDisplay'

const stay = (over = {}) => ({
  _id: 'b1',
  kind: 'stay',
  status: 'confirmed',
  date: '2026-10-03',
  time: '',
  checkIn: '2026-10-03',
  checkOut: '2026-10-06',
  nights: 3,
  guests: 2,
  pricePerNight: 450,
  totalAmount: 1350,
  listingId: 'l1',
  listing: {
    _id: 'l1',
    name_en: 'Oasis Inn',
    name_ar: 'نزل الواحة',
    images: ['https://img.test/oasis.jpg'],
    checkInTime: '15:00',
    checkOutTime: '12:00',
  },
  service: null,
  ...over,
})

const service = (over = {}) => ({
  _id: 'b2',
  kind: 'service',
  status: 'pending',
  date: '2026-10-10',
  time: '19:00',
  quantity: 3,
  priceUnit: 'per_hour',
  unitPrice: 150,
  partySize: 4,
  totalAmount: 450,
  serviceId: 's1',
  listing: null,
  service: { _id: 's1', title_en: 'Desert tour', title_ar: 'جولة صحراوية', images: [] },
  ...over,
})

// A 1.0.x restaurant reservation: a day, a time and a party, no total or code.
const slot = (over = {}) => ({
  _id: 'b3',
  kind: 'slot',
  status: 'pending',
  date: '2026-10-03',
  time: '19:00',
  partySize: 4,
  listingId: 'l2',
  listing: { _id: 'l2', name_en: 'Al Bait Restaurant', name_ar: 'مطعم البيت', images: [] },
  ...over,
})

describe('tripKind', () => {
  it('tells stays, services and old reservations apart', () => {
    expect(tripKind(stay())).toBe('stay')
    expect(tripKind(service())).toBe('service')
    expect(tripKind(slot())).toBe('slot')
  })

  it('reads a row with no kind and no dates as a reservation, as the server stores them', () => {
    expect(tripKind(slot({ kind: undefined }))).toBe('slot')
    // A stay row without its dates cannot be drawn as a stay; show it as a day.
    expect(tripKind(stay({ checkIn: undefined, checkOut: undefined }))).toBe('slot')
  })
})

describe('tripName', () => {
  it("uses the page's language, and the other one when a name is missing", () => {
    expect(tripName(stay(), 'en')).toBe('Oasis Inn')
    expect(tripName(stay(), 'ar')).toBe('نزل الواحة')
    expect(tripName(service(), 'ar')).toBe('جولة صحراوية')
    expect(tripName(stay({ listing: { name_en: 'Oasis Inn', name_ar: '' } }), 'ar')).toBe('Oasis Inn')
    expect(tripName(slot(), 'en')).toBe('Al Bait Restaurant')
  })

  it('is null once the place or the service is gone', () => {
    expect(tripName(stay({ listing: null }), 'en')).toBeNull()
    expect(tripName(service({ service: null }), 'en')).toBeNull()
  })
})

describe('tripImage', () => {
  it('is the first photo, http(s) only', () => {
    expect(tripImage(stay())).toBe('https://img.test/oasis.jpg')
    expect(tripImage(service())).toBeNull()
    expect(tripImage(stay({ listing: null }))).toBeNull()
    expect(tripImage(stay({ listing: { images: ['javascript:alert(1)'] } }))).toBeNull()
  })
})

describe('tripWhen', () => {
  it('writes a stay as its dates', () => {
    expect(tripWhen(stay(), 'en')).toBe('3 Oct – 6 Oct')
    expect(tripWhen(stay(), 'ar')).toBe('3 أكتوبر – 6 أكتوبر')
  })

  it('writes a service as its day and start time, in Riyadh time as stored', () => {
    expect(tripWhen(service(), 'en')).toBe('10 Oct at 19:00')
    expect(tripWhen(service(), 'ar')).toBe('10 أكتوبر الساعة 19:00')
  })

  it("names the last day of a service booked for several days, as the app does", () => {
    expect(tripWhen(service({ priceUnit: 'per_day', quantity: 3, time: '09:00' }), 'en')).toBe(
      '10 Oct – 12 Oct at 09:00'
    )
  })

  it('writes an old reservation as its day and time', () => {
    expect(tripWhen(slot(), 'en')).toBe('3 Oct at 19:00')
  })
})

describe('tripWhat', () => {
  it('counts nights and guests for a stay', () => {
    expect(tripWhat(stay(), 'en')).toBe('3 nights · 2 guests')
    expect(tripWhat(stay(), 'ar')).toBe('3 ليالٍ · ضيفان')
    // Nights the row does not carry are counted from the dates.
    expect(tripWhat(stay({ nights: undefined }), 'en')).toBe('3 nights · 2 guests')
  })

  it('counts hours or days only for a service priced by them, then the group', () => {
    expect(tripWhat(service(), 'en')).toBe('3 hours · 4 people')
    expect(tripWhat(service({ priceUnit: 'per_day', quantity: 2 }), 'ar')).toBe('يومان · 4 أشخاص')
    expect(tripWhat(service({ priceUnit: 'fixed', quantity: 1 }), 'en')).toBe('4 people')
  })

  it('counts the party of an old reservation', () => {
    expect(tripWhat(slot(), 'en')).toBe('4 people')
    expect(tripWhat(slot({ partySize: undefined }), 'en')).toBe('')
  })
})

describe('tripTotal', () => {
  it('is the total in riyals, and nothing for an old reservation', () => {
    expect(tripTotal(stay(), 'en')).toBe('1,350 SAR')
    expect(tripTotal(service(), 'ar')).toBe('450 ر.س')
    expect(tripTotal(slot({ totalAmount: 200 }), 'en')).toBeNull()
    expect(tripTotal(stay({ totalAmount: undefined }), 'en')).toBeNull()
  })
})

describe('detailRows', () => {
  it("lists a stay's check-in and check-out with the place's times, the stay and the total", () => {
    expect(detailRows(stay(), 'en')).toEqual([
      { key: 'checkIn', value: 'Sat, 3 Oct 2026 · 15:00' },
      { key: 'checkOut', value: 'Tue, 6 Oct 2026 · 12:00' },
      { key: 'stay', value: '3 nights · 2 guests' },
      { key: 'total', value: '1,350 SAR', strong: true },
    ])
    const noTimes = stay({ listing: { name_en: 'Oasis Inn' } })
    expect(detailRows(noTimes, 'en')[0]).toEqual({ key: 'checkIn', value: 'Sat, 3 Oct 2026' })
  })

  it("lists a service's day, start time, duration, group and total", () => {
    expect(detailRows(service(), 'en')).toEqual([
      { key: 'date', value: 'Sat, 10 Oct 2026' },
      { key: 'startTime', value: '19:00', ltr: true },
      { key: 'duration', value: '3 hours' },
      { key: 'people', value: '4 people' },
      { key: 'total', value: '450 SAR', strong: true },
    ])
    expect(detailRows(service(), 'ar')).toEqual([
      { key: 'date', value: 'السبت، 10 أكتوبر 2026' },
      { key: 'startTime', value: '19:00', ltr: true },
      { key: 'duration', value: '3 ساعات' },
      { key: 'people', value: '4 أشخاص' },
      { key: 'total', value: '450 ر.س', strong: true },
    ])
  })

  it('gives a service of several days its first and last day, and no duration for a fixed price', () => {
    const days = detailRows(service({ priceUnit: 'per_day', quantity: 3 }), 'en')
    expect(days[0]).toEqual({ key: 'date', value: 'Sat, 10 Oct 2026 – Mon, 12 Oct 2026' })
    expect(days.find((r) => r.key === 'duration')).toEqual({ key: 'duration', value: '3 days' })
    const fixed = detailRows(service({ priceUnit: 'fixed', quantity: 1 }), 'en')
    expect(fixed.map((r) => r.key)).toEqual(['date', 'startTime', 'people', 'total'])
  })

  it('lists an old reservation as its day, time and party, with no total', () => {
    expect(detailRows(slot({ totalAmount: 200 }), 'en')).toEqual([
      { key: 'date', value: 'Sat, 3 Oct 2026' },
      { key: 'time', value: '19:00', ltr: true },
      { key: 'people', value: '4 people' },
    ])
  })
})

describe('reasonFor', () => {
  it("names the host's or the provider's reason for a decline", () => {
    expect(reasonFor(stay({ status: 'declined', declineReason: 'Fully booked' }), 'en')).toEqual({
      from: 'host',
      text: 'Fully booked',
    })
    expect(reasonFor(service({ status: 'declined', declineReason: 'Away that week' }), 'en')).toEqual({
      from: 'provider',
      text: 'Away that week',
    })
  })

  it("shows a cancellation's reason without guessing who wrote it, in the page's half", () => {
    const closed = stay({
      status: 'cancelled',
      cancellationReason: 'أُغلق حساب المضيف / The host closed their account',
    })
    expect(reasonFor(closed, 'en')).toEqual({ from: 'unknown', text: 'The host closed their account' })
    expect(reasonFor(closed, 'ar')).toEqual({ from: 'unknown', text: 'أُغلق حساب المضيف' })
  })

  it('is null without a reason, or when the status no longer carries one', () => {
    expect(reasonFor(stay({ status: 'declined' }), 'en')).toBeNull()
    expect(reasonFor(stay({ status: 'confirmed', declineReason: 'old' }), 'en')).toBeNull()
    expect(reasonFor(stay({ status: 'cancelled', cancellationReason: '  ' }), 'en')).toBeNull()
  })
})

describe('reviewTarget', () => {
  it('rates the place of a completed stay and the service of a completed service booking', () => {
    expect(reviewTarget(stay({ status: 'completed' }))).toEqual({ listingId: 'l1' })
    expect(reviewTarget(service({ status: 'completed' }))).toEqual({ serviceId: 's1' })
  })

  it('offers nothing before completion, for an old reservation, or once the target is gone', () => {
    expect(reviewTarget(stay())).toBeNull()
    expect(reviewTarget(slot({ status: 'completed' }))).toBeNull()
    expect(reviewTarget(stay({ status: 'completed', listing: null }))).toBeNull()
    expect(reviewTarget(service({ status: 'completed', service: null }))).toBeNull()
  })
})

describe('the account', () => {
  it('is named by its name, else its phone, else a real email', () => {
    expect(accountLabel({ firstName: 'Sara', lastName: 'Al Qahtani', phone: '+966501234567' })).toEqual({
      kind: 'name',
      text: 'Sara Al Qahtani',
    })
    expect(accountLabel({ phone: '+966501234567', email: '966501234567@phone.hasio.xyz' })).toEqual({
      kind: 'phone',
      text: '+966 50 123 4567',
    })
    expect(accountLabel({ email: 'sara@example.com' })).toEqual({ kind: 'email', text: 'sara@example.com' })
    expect(accountLabel({ email: '213555@phone.hasio.xyz' })).toBeNull()
    expect(accountLabel(null)).toBeNull()
  })

  it("never offers a phone sign-up's made-up address as an email", () => {
    expect(emailOf({ email: '966501234567@phone.hasio.xyz' })).toBeNull()
    expect(emailOf({ email: '966501234567@Phone.Hasio.XYZ' })).toBeNull()
    expect(emailOf({ email: 'sara@example.com' })).toBe('sara@example.com')
    expect(emailOf({})).toBeNull()
  })

  it('joins a first and last name, skipping what is missing', () => {
    expect(personName({ firstName: 'Sara', lastName: 'Al Qahtani' })).toBe('Sara Al Qahtani')
    expect(personName({ firstName: 'Sara' })).toBe('Sara')
    expect(personName(null)).toBe('')
  })
})

describe('starsText', () => {
  it('counts stars in real plural forms', () => {
    expect(starsText(1, 'en')).toBe('1 star')
    expect(starsText(5, 'en')).toBe('5 stars')
    expect(starsText(1, 'ar')).toBe('نجمة واحدة')
    expect(starsText(2, 'ar')).toBe('نجمتان')
    expect(starsText(3, 'ar')).toBe('3 نجوم')
    expect(starsText(5, 'ar')).toBe('5 نجوم')
  })
})

describe('bilingualHalf', () => {
  it("picks the page's half of the server's two-language text", () => {
    const text = 'أُغلق حساب المضيف / The host closed their account'
    expect(bilingualHalf(text, 'ar')).toBe('أُغلق حساب المضيف')
    expect(bilingualHalf(text, 'en')).toBe('The host closed their account')
  })

  it('leaves what a person typed as they typed it', () => {
    expect(bilingualHalf('Full / no rooms left', 'ar')).toBe('Full / no rooms left')
    expect(bilingualHalf('لا توجد غرف', 'en')).toBe('لا توجد غرف')
  })
})

describe('defaultTab', () => {
  it('opens on Upcoming, or on Past when only past bookings exist', () => {
    expect(defaultTab({ upcoming: [stay()], past: [] })).toBe('upcoming')
    expect(defaultTab({ upcoming: [], past: [stay()] })).toBe('past')
    expect(defaultTab({ upcoming: [], past: [] })).toBe('upcoming')
  })
})
