import type { Language } from "@/types";

/**
 * The thirteen governorates and cities Hasio covers, in the Eastern Province.
 *
 * This replaces an Al-Ahsa-only list. Al-Ahsa is now ONE entry rather than its
 * villages: a guest picking a place to stay thinks "Al-Ahsa", not "Al Oyoun",
 * and the villages are a neighbourhood-level detail that belongs in the address.
 *
 * `key` is what goes in the database and must never be translated — it is what
 * `getCities` groups on and what every stored listing carries. The labels are
 * for display only.
 */
export const CITIES = [
  { key: "Dammam", en: "Dammam", ar: "الدمام" },
  { key: "Al Khobar", en: "Al Khobar", ar: "الخبر" },
  { key: "Al Ahsa", en: "Al Ahsa", ar: "الأحساء" },
  { key: "Qatif", en: "Qatif", ar: "القطيف" },
  { key: "Jubail", en: "Jubail", ar: "الجبيل" },
  { key: "Hafar Al Batin", en: "Hafar Al Batin", ar: "حفر الباطن" },
  { key: "Khafji", en: "Khafji", ar: "الخفجي" },
  { key: "Ras Tanura", en: "Ras Tanura", ar: "رأس تنورة" },
  { key: "Abqaiq", en: "Abqaiq", ar: "بقيق" },
  { key: "Nairyah", en: "Nairyah", ar: "النعيرية" },
  { key: "Qaryat Al Ulya", en: "Qaryat Al Ulya", ar: "قرية العليا" },
  { key: "Al Udayd", en: "Al Udayd", ar: "العديد" },
  { key: "Al Bayda", en: "Al Bayda", ar: "البيضاء" },
] as const satisfies readonly { key: string; en: string; ar: string }[];

export type CityKey = (typeof CITIES)[number]["key"];

/**
 * Sub-areas that stored listings already use, folded into the city above them.
 *
 * Production carries Hofuf, Mubarraz and Al Oyoun, which are Al-Ahsa villages,
 * and the seed data reaches further into the oasis than that. Folding them here
 * rather than rewriting the rows means the filter is right immediately and no
 * listing has to be migrated to make it so — and a listing that later moves to
 * the canonical name keeps working either way.
 */
const ALIASES: Record<string, CityKey> = {
  // Al-Ahsa oasis
  Hofuf: "Al Ahsa",
  "Al Hofuf": "Al Ahsa",
  Mubarraz: "Al Ahsa",
  "Al Mubarraz": "Al Ahsa",
  "Al Oyoun": "Al Ahsa",
  "Al Omran": "Al Ahsa",
  "Al Jafer": "Al Ahsa",
  "Al Battaliyah": "Al Ahsa",
  "Al Taraf": "Al Ahsa",
  "Al Shuqaiq": "Al Ahsa",
  "Al Qarah": "Al Ahsa",
  "Al Kilabiyah": "Al Ahsa",
  "Al Jishshah": "Al Ahsa",
  "Al Fudhool": "Al Ahsa",
  "Al Marah": "Al Ahsa",
  "Al Hulaila": "Al Ahsa",
  "Al Salhiyah": "Al Ahsa",
  // Khobar governorate
  Dhahran: "Al Khobar",
  // Qatif governorate
  Saihat: "Qatif",
  Safwa: "Qatif",
  Darin: "Qatif",
  Tarout: "Qatif",
};

const BY_KEY = new Map(CITIES.map((city) => [city.key, city]));

/**
 * City centres, used as a listing's location when nobody has given a better one.
 *
 * The posting forms have no map picker, so every owner-posted listing gets a
 * synthetic coordinate — and the schema requires one. Until this expanded past
 * Al-Ahsa that was harmless, because there was only one city; now a Dammam hotel
 * pinned in Hofuf sends the guest 150 km the wrong way, since the detail sheet's
 * directions link prefers coordinates over the address.
 *
 * Al Udayd and Al Bayda are deliberately absent: both are recent, sparsely
 * documented governorates and no reliable centre could be confirmed. They fall
 * back to `PROVINCE_CENTER` — a guess we know is a guess beats a fabricated one
 * that reads as precise.
 */
const CITY_COORDS: Partial<Record<CityKey, { lat: number; lng: number }>> = {
  Dammam: { lat: 26.4207, lng: 50.0888 },
  "Al Khobar": { lat: 26.2794, lng: 50.2083 },
  "Al Ahsa": { lat: 25.3854, lng: 49.5683 },
  Qatif: { lat: 26.5196, lng: 49.9962 },
  Jubail: { lat: 27.0174, lng: 49.6225 },
  "Hafar Al Batin": { lat: 28.4337, lng: 45.9601 },
  Khafji: { lat: 28.439, lng: 48.491 },
  "Ras Tanura": { lat: 26.654, lng: 50.1626 },
  Abqaiq: { lat: 25.934, lng: 49.668 },
  Nairyah: { lat: 27.4894, lng: 48.4839 },
  "Qaryat Al Ulya": { lat: 27.5556, lng: 47.6606 },
};

/** Dammam, the provincial capital — where an unplaceable listing lands. */
const PROVINCE_CENTER = { lat: 26.4207, lng: 50.0888 };

/** The centre of a listing's city. Aliases resolve first, so "Hofuf" works. */
export function cityCoordinates(raw: string): { lat: number; lng: number } {
  return CITY_COORDS[canonicalCity(raw) as CityKey] ?? PROVINCE_CENTER;
}

/** The city a stored value belongs to, or the value itself if it is unknown. */
export function canonicalCity(raw: string): string {
  const value = raw.trim();
  if (BY_KEY.has(value as CityKey)) return value;
  return ALIASES[value] ?? value;
}

/**
 * How to write a city for a reader. An unrecognised value is shown as stored —
 * it came from a host, and inventing an Arabic name for it would be worse than
 * showing the one they typed.
 */
export function cityLabel(raw: string, language: Language): string {
  const known = BY_KEY.get(canonicalCity(raw) as CityKey);
  if (!known) return raw;
  return language === "ar" ? known.ar : known.en;
}
