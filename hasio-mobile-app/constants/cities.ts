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
