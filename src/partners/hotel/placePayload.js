import { toLatinDigits } from '../lib/phone'
import { canonicalCity, cityCoordinates } from './cities'

/**
 * What the hotel dashboard's place form sends — a port of the app's
 * hasio-mobile-app/lib/listingForm.ts and of what post-lodging.tsx and
 * post-destination.tsx pass to submitListing / updateMyListing. Both clients
 * write the same rows, so the rules are the app's, not new ones:
 *
 * - an edit sends only the location the host changed; the stored pin moves to
 *   a city centre only when the city itself changes (there is no map picker);
 * - an emptied nightly price in an edit is `null`, which the server reads as
 *   "clear it" — left out, the old price would stay bookable;
 * - an emptied guest cap or unit count is left out and keeps what is stored,
 *   never replaced by the new-listing defaults;
 * - text and lists in an edit go as "" and [], because the server skips
 *   undefined and an emptied description would otherwise be kept.
 *
 * Two kinds of place, as in the app: a stay (`type: "hotel"`, the lodging
 * form) and a destination (`type: "attraction"`).
 */

export const MAX_PRICE_PER_NIGHT = 100_000
export const MAX_GUESTS = 20
export const MAX_UNITS = 500
export const MAX_PHOTOS = 5

export const STAY_TYPES = ['hotel', 'apartment', 'camp', 'homestay']
export const PLACE_CATEGORIES = ['historical', 'natural', 'cultural', 'recreational', 'religious']

/** The listing types this dashboard has an editor for. */
export function kindOfType(type) {
  if (type === 'hotel') return 'stay'
  if (type === 'attraction') return 'place'
  return null
}

// ── Numbers and times ──────────────────────────────────────────────────────

export function parseWholeNumber(raw) {
  const value = toLatinDigits(raw).replace(/[\s,]/g, '')
  if (value === '') return undefined
  return /^\d+$/.test(value) ? Number(value) : NaN
}

function inRange(value, min, max) {
  return value !== undefined && Number.isInteger(value) && value >= min && value <= max
}

export function normaliseTime(raw) {
  const value = toLatinDigits(raw).trim()
  const short = /^(\d):([0-5]\d)$/.exec(value)
  return short ? `0${short[1]}:${short[2]}` : value
}

const isHHMM = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// ── Region ─────────────────────────────────────────────────────────────────

const PROVINCE_WIDE = [
  /^(the\s+)?eastern(\s+(province|region))?$/i,
  /^ash[\s-]?sharqiy(y)?ah$/i,
  /^(ال)?منطقة\s+الشرقية$/,
  /^الشرقية$/,
]

/** Seeded listings store "Eastern Province" as their region; not a neighbourhood. */
export function isProvinceWideRegion(region) {
  const value = String(region ?? '').trim()
  return value !== '' && PROVINCE_WIDE.some((p) => p.test(value))
}

// ── The form ───────────────────────────────────────────────────────────────

export function emptyForm(kind = 'stay') {
  return {
    kind,
    category: kind === 'stay' ? 'hotel' : 'historical',
    name: '',
    nameAr: '',
    city: '',
    neighborhood: '',
    address: '',
    phone: '',
    priceRange: '',
    pricePerNight: '',
    // Offered filled in for a new stay only; an edit never is.
    maxGuests: kind === 'stay' ? '2' : '',
    unitCount: kind === 'stay' ? '1' : '',
    checkInTime: '15:00',
    checkOutTime: '12:00',
    description: '',
    descriptionAr: '',
    amenities: [],
    images: [],
  }
}

/**
 * The form filled from a stored listing. Unset counts stay empty (a seed hotel
 * with no unitCount has no cap, and prefilling "1" would impose one); the
 * category is kept as stored; the city is folded to its key.
 */
export function formFromListing(listing) {
  const kind = kindOfType(listing.type) ?? 'place'
  const count = (value) => (value != null ? String(value) : '')
  return {
    kind,
    category: listing.category || (kind === 'stay' ? 'hotel' : 'historical'),
    name: listing.name_en ?? '',
    nameAr: listing.name_ar ?? '',
    city: canonicalCity(listing.city ?? ''),
    neighborhood: isProvinceWideRegion(listing.region) ? '' : (listing.region ?? ''),
    address: listing.address ?? '',
    phone: listing.phone ?? '',
    priceRange: listing.priceRange ?? '',
    pricePerNight: count(listing.pricePerNight),
    maxGuests: count(listing.maxGuests),
    unitCount: count(listing.unitCount),
    checkInTime: listing.checkInTime ?? '15:00',
    checkOutTime: listing.checkOutTime ?? '12:00',
    description: listing.description_en ?? '',
    descriptionAr: listing.description_ar ?? '',
    amenities: listing.amenities ?? [],
    images: listing.images ?? [],
  }
}

/**
 * Field errors as keys (`required`, `chooseCity`, `price`, `guests`, `units`,
 * `time`); the page words them. Same limits as convex/listings/pricing.ts.
 */
export function validateForm(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = 'required'
  if (!form.nameAr.trim()) errors.nameAr = 'required'
  if (!form.city.trim()) errors.city = 'chooseCity'
  if (form.kind !== 'stay') return errors

  const price = parseWholeNumber(form.pricePerNight)
  if (price !== undefined && !inRange(price, 1, MAX_PRICE_PER_NIGHT)) errors.pricePerNight = 'price'
  const guests = parseWholeNumber(form.maxGuests)
  if (guests !== undefined && !inRange(guests, 1, MAX_GUESTS)) errors.maxGuests = 'guests'
  const units = parseWholeNumber(form.unitCount)
  if (units !== undefined && !inRange(units, 1, MAX_UNITS)) errors.unitCount = 'units'
  if (!isHHMM(normaliseTime(form.checkInTime))) errors.checkInTime = 'time'
  if (!isHHMM(normaliseTime(form.checkOutTime))) errors.checkOutTime = 'time'
  return errors
}

function stayPricing(form, mode) {
  const nightly = parseWholeNumber(form.pricePerNight)
  return {
    pricePerNight: nightly === undefined && mode === 'edit' ? null : nightly,
    currency: nightly !== undefined ? 'SAR' : undefined,
    maxGuests: parseWholeNumber(form.maxGuests),
    unitCount: parseWholeNumber(form.unitCount),
    checkInTime: normaliseTime(form.checkInTime),
    checkOutTime: normaliseTime(form.checkOutTime),
  }
}

/** Drop undefined keys, so the payload says only what it means to send. */
function clean(obj) {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))
}

/** submitListing's arguments for a new place. */
export function newPlacePayload(form) {
  const city = form.city.trim()
  const base = {
    name_en: form.name.trim(),
    name_ar: form.nameAr.trim(),
    category: form.category,
    city,
    description_en: form.description.trim() || undefined,
    description_ar: form.descriptionAr.trim() || undefined,
    phone: form.phone.trim() || undefined,
    images: form.images.length > 0 ? form.images : undefined,
    coordinates: cityCoordinates(city),
  }
  if (form.kind === 'stay') {
    const neighborhood = form.neighborhood.trim()
    const pricing = stayPricing(form, 'create')
    return clean({
      type: 'hotel',
      ...base,
      address: neighborhood || city,
      region: neighborhood || undefined,
      priceRange: form.priceRange.trim() || undefined,
      amenities: form.amenities.length > 0 ? form.amenities : undefined,
      ...pricing,
      pricePerNight: pricing.pricePerNight ?? undefined,
    })
  }
  return clean({ type: 'attraction', ...base, address: form.address.trim() || city })
}

/**
 * updateMyListing's arguments (without listingId) for an edit of `existing`,
 * the stored listing the form was opened from.
 */
export function editPlacePayload(form, existing) {
  const saved = formFromListing(existing)
  const city = form.city.trim()
  const cityChanged = canonicalCity(saved.city) !== canonicalCity(city)
  const base = {
    name_en: form.name.trim(),
    name_ar: form.nameAr.trim(),
    category: form.category,
    // A seeded listing's stored Arabic label names its old category.
    category_ar: form.category !== saved.category ? '' : undefined,
    city,
    coordinates: cityChanged ? cityCoordinates(city) : undefined,
    description_en: form.description.trim(),
    description_ar: form.descriptionAr.trim(),
    // Only a phone the owner actually changed is sent: the app never writes it,
    // so an admin-set number must survive a web edit that leaves it untouched.
    phone: form.phone.trim() !== saved.phone.trim() ? form.phone.trim() : undefined,
    images: form.images,
  }
  if (form.kind === 'stay') {
    const neighborhood = form.neighborhood.trim()
    const neighborhoodChanged = saved.neighborhood.trim() !== neighborhood
    return clean({
      type: 'hotel',
      ...base,
      address: cityChanged || neighborhoodChanged ? neighborhood || city : undefined,
      region: neighborhoodChanged ? neighborhood : undefined,
      priceRange: form.priceRange.trim(),
      amenities: form.amenities,
      ...stayPricing(form, 'edit'),
    })
  }
  return clean({ type: 'attraction', ...base, address: form.address.trim() || city })
}

/** A count the host emptied that the server cannot clear, so it will be kept. */
export function keptCounts(form, existing) {
  if (!existing || form.kind !== 'stay') return []
  const saved = formFromListing(existing)
  return ['maxGuests', 'unitCount'].filter((k) => saved[k] !== '' && form[k].trim() === '')
}

/** A listing's review status; seed rows carry none and are live. */
export function ownerStatusOf(status) {
  return status ?? 'approved'
}

export function sameValues(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}
