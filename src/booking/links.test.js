import { describe, expect, it } from 'vitest'
import { directionsUrl, mailHref, telHref, websiteHref } from './links'

describe('directionsUrl', () => {
  it('prefers the pin, as the app does', () => {
    expect(directionsUrl({ coordinates: { lat: 25.38, lng: 49.59 }, address: 'King Fahd Rd' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=25.38%2C49.59'
    )
  })

  it('falls back to the address, encoded', () => {
    expect(directionsUrl({ address: 'King Fahd Rd, Hofuf & Co' })).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=King+Fahd+Rd%2C+Hofuf+%26+Co'
    )
  })

  it('has nowhere to go without either', () => {
    expect(directionsUrl({})).toBeNull()
    expect(directionsUrl({ coordinates: { lat: Number.NaN, lng: 1 } })).toBeNull()
    expect(directionsUrl({ address: '   ' })).toBeNull()
  })
})

describe('contact links', () => {
  it('dials a number however it was typed', () => {
    expect(telHref('+966 50 123 4567')).toBe('tel:+966501234567')
    expect(telHref('٠٥٠١٢٣٤٥٦٧')).toBe('tel:0501234567')
    expect(telHref('')).toBeNull()
    expect(telHref('call me')).toBeNull()
  })

  it('writes to an address that looks like one', () => {
    expect(mailHref('host@example.com')).toBe('mailto:host@example.com')
    expect(mailHref('not an email')).toBeNull()
    expect(mailHref(undefined)).toBeNull()
  })

  it('opens only web addresses from content', () => {
    expect(websiteHref('https://hotel.example')).toBe('https://hotel.example/')
    expect(websiteHref('http://hotel.example/rooms')).toBe('http://hotel.example/rooms')
    // Hosts type bare domains.
    expect(websiteHref('hotel.example')).toBe('https://hotel.example/')
    expect(websiteHref('javascript:alert(1)')).toBeNull()
    expect(websiteHref('data:text/html,x')).toBeNull()
    expect(websiteHref('')).toBeNull()
  })
})
