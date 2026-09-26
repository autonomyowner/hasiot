/**
 * The service form's rules — a port of the service half of the app's
 * hasio-mobile-app/lib/listingForm.ts (post-service.tsx uses it). Both clients
 * write the same rows, so a field one sends and the other does not is a bug:
 * keep the two in step.
 *
 * The server's lists and limits (convex/services/logic.ts) are checked here
 * first so a provider hears about them before anything is sent.
 */
import { CITIES, canonicalCity } from '../../admin/constants.js'
import { toLatinDigits } from '../lib/phone.js'

export const SERVICE_TYPE_KEYS = [
  'tour_guide',
  'photographer',
  'driver',
  'translator',
  'event_planner',
  'catering',
  'equipment_rental',
  'other',
]
export const SERVICE_PRICE_UNITS = ['per_hour', 'per_day', 'per_event', 'fixed']
export const MAX_SERVICE_PRICE = 100_000
export const MAX_GROUP_SIZE = 100
export const MAX_TITLE = 100
export const MAX_DESCRIPTION = 2000

/** The fields that can be wrong, top to bottom as they appear on screen. */
export const FIELD_ORDER = [
  'title',
  'titleAr',
  'city',
  'description',
  'descriptionAr',
  'price',
  'maxGroupSize',
  'contactPhone',
  'contactEmail',
]

const isServiceType = (value) => SERVICE_TYPE_KEYS.includes(value ?? '')

/** One of the thirteen city keys, exactly — an alias has to be folded first. */
export const isProvinceCity = (city) => CITIES.includes(String(city ?? '').trim())

/**
 * A whole number as typed: Arabic digits, a grouping comma and spaces are
 * fine. Empty is "not given" (undefined); anything else not whole is NaN,
 * which no range passes.
 */
export function parseWholeNumber(raw) {
  const value = toLatinDigits(raw).replace(/[\s,]/g, '')
  if (value === '') return undefined
  return /^\d+$/.test(value) ? Number(value) : NaN
}

const inRange = (value, min, max) =>
  value !== undefined && Number.isInteger(value) && value >= min && value <= max

/** "Arabic، English, Arabic" -> ["Arabic", "English"]. */
export function splitList(raw) {
  const items = String(raw ?? '')
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean)
  return items.filter((item, index) => items.indexOf(item) === index)
}

const isPlausibleEmail = (raw) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())
// Loose on purpose: a contact number may be a landline or a foreign mobile.
const isPlausiblePhone = (raw) => /^\+?\d{7,15}$/.test(toLatinDigits(raw).replace(/[\s\-().]/g, ''))

/** Seed rows carry no status and are live. */
export const ownerStatusOf = (status) => status ?? 'approved'
/** Live now, so an edit — which always goes back to review — takes it down. */
export const isLive = (status) => ownerStatusOf(status) === 'approved'

/** A new service's form. The unit defaults to per hour, as in the app. */
export const EMPTY_SERVICE_FORM = {
  serviceType: 'tour_guide',
  title: '',
  titleAr: '',
  description: '',
  descriptionAr: '',
  city: '',
  price: '',
  priceUnit: 'per_hour',
  maxGroupSize: '',
  availability: '',
  availabilityAr: '',
  contactPhone: '',
  contactEmail: '',
  languages: '',
  images: [],
}

/**
 * The form, filled from a stored service. Unset numbers stay empty so a save
 * never writes a price the provider did not choose; the city is folded to its
 * key, and one outside the province is left unchosen; an unknown type is
 * Other; a missing or unknown unit reads as the fixed price the server quotes
 * it at, rather than "per hour", which saving would then make true.
 */
export function serviceFormFromService(service) {
  const count = (value) => (value != null ? String(value) : '')
  const city = canonicalCity(service.city ?? '')
  const unit = service.priceUnit ?? ''
  return {
    serviceType: isServiceType(service.serviceType) ? service.serviceType : 'other',
    title: service.title_en ?? '',
    titleAr: service.title_ar ?? '',
    description: service.description_en ?? '',
    descriptionAr: service.description_ar ?? '',
    city: isProvinceCity(city) ? city : '',
    price: count(service.price),
    priceUnit: SERVICE_PRICE_UNITS.includes(unit) ? unit : 'fixed',
    maxGroupSize: count(service.maxGroupSize),
    availability: service.availability_en ?? '',
    availabilityAr: service.availability_ar ?? '',
    contactPhone: service.contactPhone ?? '',
    contactEmail: service.contactEmail ?? '',
    languages: (service.languages ?? []).join(', '),
    images: service.images ?? [],
  }
}

/**
 * `{ field: field }` for each field that is wrong; the page words each one.
 * Both titles and descriptions are required and the city is one of the
 * thirteen. Price is optional — without one the service shows Contact
 * instead of Book — but a given one must be a whole 1–100,000.
 */
export function validateServiceForm(form) {
  const errors = {}
  if (!form.title.trim()) errors.title = 'title'
  if (!form.titleAr.trim()) errors.titleAr = 'titleAr'
  if (!isProvinceCity(form.city)) errors.city = 'city'
  if (!form.description.trim()) errors.description = 'description'
  if (!form.descriptionAr.trim()) errors.descriptionAr = 'descriptionAr'
  const price = parseWholeNumber(form.price)
  if (price !== undefined && !inRange(price, 1, MAX_SERVICE_PRICE)) errors.price = 'price'
  const group = parseWholeNumber(form.maxGroupSize)
  if (group !== undefined && !inRange(group, 1, MAX_GROUP_SIZE)) errors.maxGroupSize = 'maxGroupSize'
  if (form.contactPhone.trim() && !isPlausiblePhone(form.contactPhone)) errors.contactPhone = 'contactPhone'
  if (form.contactEmail.trim() && !isPlausibleEmail(form.contactEmail)) errors.contactEmail = 'contactEmail'
  return errors
}

export function firstError(errors, order = FIELD_ORDER) {
  return order.find((field) => errors[field] !== undefined)
}

/** What `submitService` is sent: anything empty is left out, price included. */
export function newServiceArgs(form, images) {
  const languages = splitList(form.languages)
  return {
    serviceType: form.serviceType,
    title_en: form.title.trim(),
    title_ar: form.titleAr.trim(),
    description_en: form.description.trim() || undefined,
    description_ar: form.descriptionAr.trim() || undefined,
    city: form.city.trim(),
    price: parseWholeNumber(form.price),
    priceUnit: form.priceUnit,
    maxGroupSize: parseWholeNumber(form.maxGroupSize),
    availability_en: form.availability.trim() || undefined,
    availability_ar: form.availabilityAr.trim() || undefined,
    contactPhone: form.contactPhone.trim() || undefined,
    contactEmail: form.contactEmail.trim() || undefined,
    languages: languages.length > 0 ? languages : undefined,
    images: images.length > 0 ? images : undefined,
  }
}

/**
 * What `updateMyService` is sent (plus `serviceId`): every field, because the
 * server skips undefined and an emptied one would otherwise be kept. Text as
 * "", lists as [], an emptied price or group size as null ("remove") — a
 * provider who empties the price goes back to Contact.
 */
export function editedServiceArgs(form, images) {
  return {
    serviceType: form.serviceType,
    title_en: form.title.trim(),
    title_ar: form.titleAr.trim(),
    description_en: form.description.trim(),
    description_ar: form.descriptionAr.trim(),
    city: form.city.trim(),
    price: parseWholeNumber(form.price) ?? null,
    priceUnit: form.priceUnit,
    maxGroupSize: parseWholeNumber(form.maxGroupSize) ?? null,
    availability_en: form.availability.trim(),
    availability_ar: form.availabilityAr.trim(),
    contactPhone: form.contactPhone.trim(),
    contactEmail: form.contactEmail.trim(),
    languages: splitList(form.languages),
    images,
  }
}

export function sameValues(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}
