/**
 * The thirteen Eastern Province cities, a port of the app's
 * hasio-mobile-app/constants/cities.ts. The key is what the database stores;
 * the labels are for display. Keep this list, its aliases and its centres in
 * step with the app's — both clients post listings to the same table.
 */
export const CITIES = [
  { key: 'Dammam', en: 'Dammam', ar: 'الدمام' },
  { key: 'Al Khobar', en: 'Al Khobar', ar: 'الخبر' },
  { key: 'Al Ahsa', en: 'Al Ahsa', ar: 'الأحساء' },
  { key: 'Qatif', en: 'Qatif', ar: 'القطيف' },
  { key: 'Jubail', en: 'Jubail', ar: 'الجبيل' },
  { key: 'Hafar Al Batin', en: 'Hafar Al Batin', ar: 'حفر الباطن' },
  { key: 'Khafji', en: 'Khafji', ar: 'الخفجي' },
  { key: 'Ras Tanura', en: 'Ras Tanura', ar: 'رأس تنورة' },
  { key: 'Abqaiq', en: 'Abqaiq', ar: 'بقيق' },
  { key: 'Nairyah', en: 'Nairyah', ar: 'النعيرية' },
  { key: 'Qaryat Al Ulya', en: 'Qaryat Al Ulya', ar: 'قرية العليا' },
  { key: 'Al Udayd', en: 'Al Udayd', ar: 'العديد' },
  { key: 'Al Bayda', en: 'Al Bayda', ar: 'البيضاء' },
]

const ALIASES = {
  Hofuf: 'Al Ahsa',
  'Al Hofuf': 'Al Ahsa',
  Mubarraz: 'Al Ahsa',
  'Al Mubarraz': 'Al Ahsa',
  'Al Oyoun': 'Al Ahsa',
  'Al Omran': 'Al Ahsa',
  'Al Jafer': 'Al Ahsa',
  'Al Battaliyah': 'Al Ahsa',
  'Al Taraf': 'Al Ahsa',
  'Al Shuqaiq': 'Al Ahsa',
  'Al Qarah': 'Al Ahsa',
  'Al Kilabiyah': 'Al Ahsa',
  'Al Jishshah': 'Al Ahsa',
  'Al Fudhool': 'Al Ahsa',
  'Al Marah': 'Al Ahsa',
  'Al Hulaila': 'Al Ahsa',
  'Al Salhiyah': 'Al Ahsa',
  Dhahran: 'Al Khobar',
  Saihat: 'Qatif',
  Safwa: 'Qatif',
  Darin: 'Qatif',
  Tarout: 'Qatif',
}

// Al Udayd and Al Bayda have no confirmed centre and fall back to Dammam, as
// in the app.
const CITY_COORDS = {
  Dammam: { lat: 26.4207, lng: 50.0888 },
  'Al Khobar': { lat: 26.2794, lng: 50.2083 },
  'Al Ahsa': { lat: 25.3854, lng: 49.5683 },
  Qatif: { lat: 26.5196, lng: 49.9962 },
  Jubail: { lat: 27.0174, lng: 49.6225 },
  'Hafar Al Batin': { lat: 28.4337, lng: 45.9601 },
  Khafji: { lat: 28.439, lng: 48.491 },
  'Ras Tanura': { lat: 26.654, lng: 50.1626 },
  Abqaiq: { lat: 25.934, lng: 49.668 },
  Nairyah: { lat: 27.4894, lng: 48.4839 },
  'Qaryat Al Ulya': { lat: 27.5556, lng: 47.6606 },
}

const PROVINCE_CENTER = { lat: 26.4207, lng: 50.0888 }
const BY_KEY = new Map(CITIES.map((c) => [c.key, c]))

export function canonicalCity(raw) {
  const value = String(raw ?? '').trim()
  if (BY_KEY.has(value)) return value
  return ALIASES[value] ?? value
}

export function cityCoordinates(raw) {
  return CITY_COORDS[canonicalCity(raw)] ?? PROVINCE_CENTER
}

/** An unknown value is shown as the host typed it. */
export function cityLabel(raw, lang) {
  const known = BY_KEY.get(canonicalCity(raw))
  if (!known) return String(raw ?? '').trim() || '—'
  return lang === 'en' ? known.en : known.ar
}
