import type { Language } from "@/types";
import { toLatinDigits } from "./digits";

/**
 * How the Home search reads text, and how it counts what it found.
 *
 * The search used to lowercase the query and call `includes` on each field.
 * That is fine for English and quietly wrong for Arabic, which people type in
 * more than one correct way: "الاحساء" found nothing, because the listing is
 * stored as "الأحساء" and the hamza on the alef is a different letter to a
 * computer. Nobody types the hamza on a phone keyboard every time, and nobody
 * should have to. Taa marbuta and alef maqsura have the same problem ("واحه",
 * "مستشفي"), and a name copied from somewhere with its vowel marks on
 * matched nothing at all.
 *
 * So both sides go through `normalizeForSearch` — the query and the text it is
 * matched against — and are compared in that folded form. Nothing here is ever
 * shown to anyone.
 */

// The short vowels, tanween, shadda and sukun (U+064B–U+065F), the dagger alef
// (U+0670), and the Quranic annotation marks either side of them. Invisible to
// a reader, and each one enough to make `includes` fail.
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
// Tatweel: the stretching stroke some names are typed with ("الـقـطـيف").
const TATWEEL = /ـ/g;
// آ أ إ ٱ — every alef that carries something — read as a plain alef.
const ALEF_FORMS = /[آأإٱ]/g;
const TAA_MARBUTA = /ة/g; // ة → ه
const ALEF_MAQSURA = /ى/g; // ى → ي

// Enough Latin accents that "cafe" finds "Café". Deliberately a table rather
// than `normalize("NFD")`, which not every JS engine a phone runs ships.
const LATIN_ACCENTS: [RegExp, string][] = [
  [/[àáâãäåā]/g, "a"],
  [/[çć]/g, "c"],
  [/[èéêëē]/g, "e"],
  [/[ìíîïī]/g, "i"],
  [/ñ/g, "n"],
  [/[òóôõöō]/g, "o"],
  [/[ùúûüū]/g, "u"],
  [/[ýÿ]/g, "y"],
];

// Apostrophes vanish ("Qara'a" is "Qaraa"); anything else between words —
// hyphens, commas in either script, slashes, bullets — is only a space.
const APOSTROPHES = /['’‘`ʼ]/g;
const SEPARATORS = /[\s\-_.,،؛;:/\\|·•()[\]"]+/g;

/**
 * A string folded for matching: lowercase, Latin digits, no vowel marks or
 * tatweel, one alef, taa marbuta as haa, alef maqsura as yaa, and single
 * spaces between words.
 */
export function normalizeForSearch(input: string): string {
  let text = toLatinDigits(input).toLowerCase();
  for (const [accented, plain] of LATIN_ACCENTS) {
    text = text.replace(accented, plain);
  }
  return text
    .replace(ARABIC_MARKS, "")
    .replace(TATWEEL, "")
    .replace(ALEF_FORMS, "ا")
    .replace(TAA_MARBUTA, "ه")
    .replace(ALEF_MAQSURA, "ي")
    .replace(APOSTROPHES, "")
    .replace(SEPARATORS, " ")
    .trim();
}

/**
 * Everything a result can be found by, folded once into one string — the
 * name and city in both languages, and whatever else the caller passes.
 * Built when the data changes, not on every keystroke.
 */
export function searchableText(...fields: (string | null | undefined)[]): string {
  return normalizeForSearch(fields.filter(Boolean).join(" "));
}

/**
 * Whether every word of the query appears in the text, in any order.
 *
 * Word by word rather than as one phrase, so "khobar hilton" finds the Hilton
 * in Al Khobar — the name and the city are separate fields, and a guest does
 * not know which order we store them in. Both arguments must already be
 * normalised; an empty query matches everything.
 */
export function matchesQuery(haystack: string, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return normalizedQuery.split(" ").every((word) => haystack.includes(word));
}

/**
 * Which form a count takes in each language: the key suffix for strings like
 * `resultsCount_one` … `resultsCount_many`.
 *
 * English has two forms. Arabic has more, and "{n} results" with a single
 * plural reads as broken Arabic: one is "نتيجة واحدة", two is the dual
 * "نتيجتان", three to ten take the plural "نتائج", and eleven and up go back
 * to the singular "نتيجة". Past a hundred it is the last two digits that
 * decide — 103 is "103 نتائج" — which is the CLDR rule `Intl.PluralRules`
 * would apply, written out because that API is not in every engine either.
 * Zero never reaches a count line (the screen shows its empty state instead),
 * and 100–102 read like eleven-plus, so both fall into "many".
 */
export type CountForm = "one" | "two" | "few" | "many";

export function countForm(count: number, language: Language): CountForm {
  if (count === 1) return "one";
  if (language !== "ar") return "many";
  if (count === 2) return "two";
  const lastTwo = count % 100;
  return lastTwo >= 3 && lastTwo <= 10 ? "few" : "many";
}
