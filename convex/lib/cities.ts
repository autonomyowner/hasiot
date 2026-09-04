/**
 * City names, and the sub-areas that fold into them.
 *
 * Hasio covers the Eastern Province as thirteen cities. Al-Ahsa is one of them,
 * but the panel used to offer its villages as cities in their own right, so
 * every listing seeded before 2026-09-04 stores Hofuf, Mubarraz or Al Oyoun.
 * Rather than rewrite those rows, a query for a city matches anything that
 * folds into it.
 *
 * Kept in step with `hasio-mobile-app/constants/cities.ts` and
 * `src/admin/constants.js`, which own the display labels. This file is only
 * about which stored strings belong to which city.
 */
const ALIASES: Record<string, string> = {
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
  Dhahran: "Al Khobar",
  Saihat: "Qatif",
  Safwa: "Qatif",
  Darin: "Qatif",
  Tarout: "Qatif",
};

/** The city a stored value belongs to, or the value itself if it is unknown. */
export function canonicalCity(city: string | undefined | null): string {
  if (!city) return "";
  return ALIASES[city] ?? city;
}

/**
 * Whether a listing's stored city answers a request for `requested`.
 *
 * Compares canonical forms both ways, so asking for "Al Ahsa" finds a listing
 * stored as "Hofuf", and asking for "Hofuf" still finds it too — a saved filter
 * or an old link should not stop working because the list was reorganised.
 */
export function matchesCity(stored: string | undefined | null, requested: string): boolean {
  return canonicalCity(stored) === canonicalCity(requested);
}

/** True when a city name stands for more than the string itself. */
export function hasAliases(requested: string): boolean {
  const canonical = canonicalCity(requested);
  return Object.values(ALIASES).includes(canonical);
}
