import { describe, expect, it } from 'vitest'
import { matchServices, serviceSearchText, sortServices } from './browse'

describe('serviceSearchText', () => {
  it('holds both titles, the city in both languages and the kind of service in both', () => {
    const text = serviceSearchText({ title_en: 'Desert walks', title_ar: 'جولات صحراوية', city: 'Al Khobar', serviceType: 'tour_guide' })
    expect(text).toBe('Desert walks جولات صحراوية Al Khobar الخبر Tour guide مرشد سياحي')
  })

  it('finds a service stored under a sub-area by its city, and by the sub-area too', () => {
    const text = serviceSearchText({ title_en: 'Rides', title_ar: 'مشاوير', city: 'Hofuf', serviceType: 'driver' })
    expect(text).toBe('Rides مشاوير Hofuf Al Ahsa الأحساء Driver سائق')
  })

  it('leaves out what the service does not have', () => {
    expect(serviceSearchText({ title_en: 'Rides', title_ar: 'مشاوير', serviceType: 'driver' })).toBe('Rides مشاوير Driver سائق')
  })

  it('reads an unknown kind as "Other", as its tag does', () => {
    expect(serviceSearchText({ title_en: 'Henna', title_ar: 'حناء', serviceType: 'henna' })).toBe('Henna حناء Other أخرى')
  })
})

describe('matchServices', () => {
  // As /explore holds them: each service with its search text, already folded.
  const guide = { s: { _id: 'g', city: 'Hofuf' }, key: 'desert walks tour guide al ahsa' }
  const driver = { s: { _id: 'd', city: 'Dammam' }, key: 'airport rides driver dammam' }
  const index = [guide, driver]
  const ids = (rows) => rows.map((s) => s._id)

  it('lists every service under the Services chip', () => {
    expect(ids(matchServices(index, { type: 'services', query: '', city: '' }))).toEqual(['g', 'd'])
  })

  it('leaves "All" to places until the visitor searches or picks a city', () => {
    expect(matchServices(index, { type: 'all', query: '', city: '' })).toEqual([])
  })

  it('adds the services a search finds under "All", every word matching', () => {
    expect(ids(matchServices(index, { type: 'all', query: 'guide', city: '' }))).toEqual(['g'])
    expect(ids(matchServices(index, { type: 'all', query: 'tour  walks', city: '' }))).toEqual(['g'])
    expect(matchServices(index, { type: 'all', query: 'guide dammam', city: '' })).toEqual([])
  })

  it('matches the city through the sub-areas that fold into it', () => {
    expect(ids(matchServices(index, { type: 'all', query: '', city: 'Al Ahsa' }))).toEqual(['g'])
    expect(ids(matchServices(index, { type: 'services', query: '', city: 'Dammam' }))).toEqual(['d'])
  })

  it('shows none under a chip for a kind of place', () => {
    expect(matchServices(index, { type: 'hotel', query: 'guide', city: '' })).toEqual([])
  })
})

describe('sortServices', () => {
  it('puts what can be booked first, then the best rated, the most reviewed, the newest', () => {
    const rows = [
      { _id: 'a', bookable: false, rating: 5, reviewCount: 9, createdAt: 5 },
      { _id: 'b', bookable: true, rating: 4, reviewCount: 2, createdAt: 1 },
      { _id: 'c', bookable: true, rating: 4.5, reviewCount: 1, createdAt: 2 },
      { _id: 'd', bookable: true, rating: 4.5, reviewCount: 7, createdAt: 3 },
      { _id: 'e', bookable: true, createdAt: 9 },
      { _id: 'f', bookable: true, createdAt: 8 },
    ]
    expect(sortServices(rows).map((r) => r._id)).toEqual(['d', 'c', 'b', 'e', 'f', 'a'])
  })

  it('leaves the list it was given as it was', () => {
    const rows = [{ _id: 'x', bookable: false, createdAt: 1 }, { _id: 'y', bookable: true, createdAt: 2 }]
    expect(sortServices(rows).map((r) => r._id)).toEqual(['y', 'x'])
    expect(rows.map((r) => r._id)).toEqual(['x', 'y'])
  })
})
