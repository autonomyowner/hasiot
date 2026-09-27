import { toLatinDigits } from '../partners/lib/phone'

/**
 * Links built from what hosts and providers typed: a place's phone, email,
 * website and position. Content is not trusted — a website field could hold
 * `javascript:` — so each link is rebuilt from a checked value or not offered.
 */

/** Google Maps directions: the pin first (the app's rule), else the address. */
export function directionsUrl({ coordinates, address } = {}) {
  const { lat, lng } = coordinates ?? {}
  let destination = null
  if (Number.isFinite(lat) && Number.isFinite(lng)) destination = `${lat},${lng}`
  else if (typeof address === 'string' && address.trim()) destination = address.trim()
  if (!destination) return null
  return `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination })}`
}

/** `tel:` for a number typed any way (spaces, dashes, Arabic digits); null when it is not one. */
export function telHref(phone) {
  const digits = toLatinDigits(phone).replace(/[\s()\-.]/g, '')
  return /^\+?\d{6,15}$/.test(digits) ? `tel:${digits}` : null
}

export function mailHref(email) {
  const value = typeof email === 'string' ? email.trim() : ''
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null
}

/** An http(s) address to open, or null. A bare domain is read as https. */
export function websiteHref(website) {
  const raw = typeof website === 'string' ? website.trim() : ''
  if (!raw) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`
  try {
    const url = new URL(withScheme)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  } catch {
    return null
  }
}
