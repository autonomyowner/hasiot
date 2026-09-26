import { AMENITIES } from '../../partners/hotel/amenities'
import { CATEGORY_LABELS, CITY_LABELS, WEEK_DAYS, canonicalCity } from '../../admin/constants'

/**
 * What the place page says about a listing, in the page's language.
 *
 * Kept pure so the fallbacks are tested: a name or description written in one
 * language only, the sub-areas stored listings still carry as their city, and
 * amenities typed before the closed list existed. Both imports are plain data
 * modules, safe on a public page (contract §4).
 */

// The server's guest limit when a host has not set one
// (DEFAULT_MAX_GUESTS in convex/bookings/logic.ts).
export const DEFAULT_MAX_GUESTS = 4

const clean = (value) => (typeof value === 'string' ? value.trim() : '')
const side = (lang) => (lang === 'ar' ? 'ar' : 'en')

/**
 * A hotel with a nightly price: the one kind of place this page books. The
 * server also checks the listing is live, which getListing already did.
 */
export function isBookableHotel(listing) {
  return listing?.type === 'hotel' && typeof listing.pricePerNight === 'number' && listing.pricePerNight > 0
}

/**
 * `name` or `description` in the page's language, else in the other one, with
 * the language it is actually written in — the element gets that as its
 * `lang`, so a screen reader does not read English words with Arabic sounds.
 */
export function localized(listing, field, lang) {
  const first = side(lang)
  for (const l of [first, first === 'ar' ? 'en' : 'ar']) {
    const text = clean(listing?.[`${field}_${l}`])
    if (text) return { text, lang: l }
  }
  return null
}

const TYPES = {
  hotel: { en: 'Stay', ar: 'إقامة' },
  attraction: { en: 'Place', ar: 'مكان' },
  restaurant: { en: 'Food', ar: 'مطعم' },
  event: { en: 'Event', ar: 'فعالية' },
  tour: { en: 'Tour', ar: 'جولة' },
}

export function typeLabel(type, lang) {
  return TYPES[type]?.[side(lang)] ?? null
}

// English words for the admin panel's categories; its own list is Arabic only.
const CATEGORY_EN = {
  luxury_hotel: 'Luxury hotel',
  business_hotel: 'Business hotel',
  mid_range_hotel: 'Mid-range hotel',
  boutique_hotel: 'Boutique hotel',
  resort: 'Resort',
  traditional_food: 'Traditional food',
  fine_dining: 'Fine dining',
  seafood: 'Seafood',
  international: 'International',
  fast_food: 'Fast food',
  historical_site: 'Historical site',
  museum: 'Museum',
  natural_landmark: 'Natural landmark',
  entertainment: 'Entertainment',
  cultural_tour: 'Cultural tour',
  adventure: 'Adventure',
  seasonal_event: 'Seasonal event',
}

/**
 * "Luxury hotel" / «فندق فاخر». The stored key is English-ish ("budget_hotel"),
 * so an unknown one is still readable as words in English; in Arabic there is
 * nothing to fall back on but the panel's list, and an English key on an
 * Arabic page would read as a mistake, so it is left out.
 */
export function categoryLabel(listing, lang) {
  const key = clean(listing?.category)
  if (side(lang) === 'ar') return clean(listing?.category_ar) || CATEGORY_LABELS[key] || null
  if (!key) return null
  if (CATEGORY_EN[key]) return CATEGORY_EN[key]
  const words = key.replace(/[_-]+/g, ' ').trim()
  return words ? words[0].toUpperCase() + words.slice(1) : null
}

/** The city a place is in, with Hofuf, Mubarraz and the rest folded into Al Ahsa. */
export function cityText(city, lang) {
  const stored = clean(city)
  if (!stored) return null
  const canonical = canonicalCity(stored)
  return side(lang) === 'ar' ? CITY_LABELS[canonical] || stored : canonical
}

/** The partner portal's labels for the closed list; anything else as the host typed it. */
export function amenityLabels(amenities, lang) {
  const labels = []
  for (const value of amenities ?? []) {
    const stored = clean(value)
    if (!stored) continue
    const known = AMENITIES.find((a) => a.key === stored)
    const label = known ? known[side(lang)] : stored
    if (!labels.includes(label)) labels.push(label)
  }
  return labels
}

const DAY_EN = {
  sunday: 'Sunday',
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
}

/**
 * The week's opening hours, Sunday first as the calendar is. `hours` is
 * "09:00–22:00", or null for a closed day. A day with nothing stored is left
 * out rather than guessed at — "closed" would be a claim nobody made.
 * `today` (Riyadh, YYYY-MM-DD) marks the row a visitor most wants.
 */
export function openingHours(workingHours, lang, today) {
  const stored = new Map()
  for (const row of workingHours ?? []) {
    const day = clean(row?.day).toLowerCase()
    if (day && !stored.has(day)) stored.set(day, row)
  }
  const todayKey = today ? WEEK_DAYS[new Date(`${today}T00:00:00Z`).getUTCDay()]?.key : null
  return WEEK_DAYS.filter(({ key }) => stored.has(key)).map(({ key, label }) => {
    const row = stored.get(key)
    const open = clean(row.open)
    const close = clean(row.close)
    const closed = row.isClosed === true || !open || !close
    return {
      key,
      day: side(lang) === 'ar' ? label : DAY_EN[key],
      hours: closed ? null : `${open}–${close}`,
      isToday: key === todayKey,
    }
  })
}

/** "Check-in from 15:00 · Check-out by 12:00", or whichever half is set. */
export function stayTimes(checkInTime, checkOutTime, lang) {
  const ar = side(lang) === 'ar'
  const parts = []
  if (clean(checkInTime)) parts.push(ar ? `الوصول من ${clean(checkInTime)}` : `Check-in from ${clean(checkInTime)}`)
  if (clean(checkOutTime)) parts.push(ar ? `المغادرة حتى ${clean(checkOutTime)}` : `Check-out by ${clean(checkOutTime)}`)
  return parts.length ? parts.join(' · ') : null
}

/** How many guests a place takes: its own limit, else the server's default. */
export function guestLimit(listing) {
  const max = Math.floor(Number(listing?.maxGuests))
  return max >= 1 ? max : DEFAULT_MAX_GUESTS
}
