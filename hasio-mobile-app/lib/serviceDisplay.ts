/**
 * How a service is shown to a traveller: its price and unit, the start times
 * they may pick, the counts beside them, and the order and search of the list.
 *
 * Pure, and tested in plain Node, like lib/bookingDisplay.ts — none of it
 * needs a screen to be right, and all of it has been wrong on a screen before.
 *
 * The words here come as whole strings per language rather than as keys in
 * constants/translations: a price line and a count are assembled from a number
 * and a unit, and Arabic changes the unit's form with the number (ساعة واحدة،
 * ساعتان، 3 ساعات، 11 ساعة). Keeping the forms beside the rule that picks them
 * is what lets one test check both languages.
 */

import type { Language } from "@/types";
import { translations, type TranslationKey } from "@/constants/translations";
import { cityLabel } from "@/constants/cities";
import { convertFromSar, formatPrice, SAR_PER_USD, type Currency } from "./currency";
import { addDays } from "./dates";
import { countForm, matchesQuery, normalizeForSearch, searchableText } from "./searchText";

/* ── Text ────────────────────────────────────────────────────────────── */

/**
 * A provider's text in the reader's language, or in the other one when that
 * is all there is. A provider writes both titles (the server requires them),
 * but a description, an availability line or a service posted before that
 * rule may exist in one language only — and the text they did write beats an
 * empty line.
 */
export function pickLanguage(
  en: string | undefined,
  ar: string | undefined,
  lang: Language
): string {
  const [first, second] = lang === "ar" ? [ar, en] : [en, ar];
  return first?.trim() || second?.trim() || "";
}

/* ── Types and units ─────────────────────────────────────────────────── */

/**
 * The eight kinds of service, in the order their chips appear. The same list
 * and order as convex/services/logic.ts and the provider's posting form.
 */
export const SERVICE_TYPES = [
  "tour_guide",
  "photographer",
  "driver",
  "translator",
  "event_planner",
  "catering",
  "equipment_rental",
  "other",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

// The label keys the provider's form already uses for each type.
const TYPE_LABEL_KEYS: Record<ServiceType, TranslationKey> = {
  tour_guide: "tourGuide",
  photographer: "photographer",
  driver: "driver",
  translator: "translator",
  event_planner: "eventPlanner",
  catering: "catering",
  equipment_rental: "equipmentRental",
  other: "otherService",
};

function isServiceType(value: string): value is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}

/** The label key for a stored type. Anything unknown reads as "Other". */
export function serviceTypeLabelKey(serviceType: string): TranslationKey {
  return isServiceType(serviceType) ? TYPE_LABEL_KEYS[serviceType] : "otherService";
}

export type PriceUnit = "per_hour" | "per_day" | "per_event" | "fixed";

/**
 * The unit a price is charged per. A missing or unknown one is a price per
 * booking — convex/services/logic.ts treats it as "fixed" when it quotes, so
 * the line shown here has to say the same.
 */
function unitOf(priceUnit: string | undefined): PriceUnit {
  return priceUnit === "per_hour" || priceUnit === "per_day" || priceUnit === "per_event"
    ? priceUnit
    : "fixed";
}

const UNIT_WORDS: Record<Language, Record<PriceUnit, string>> = {
  en: { per_hour: "per hour", per_day: "per day", per_event: "per booking", fixed: "per booking" },
  ar: { per_hour: "للساعة", per_day: "لليوم", per_event: "للحجز", fixed: "للحجز" },
};

/** What the price is per, as it follows the amount: "per hour", «للساعة». */
export function priceUnitLabel(priceUnit: string | undefined, lang: Language): string {
  return UNIT_WORDS[lang][unitOf(priceUnit)];
}

/* ── Prices ──────────────────────────────────────────────────────────── */

/**
 * A riyal amount as the service lines write it — "450 SAR", «450 ر.س», or
 * "$120" for a traveller who chose dollars — which is how a stay writes it:
 * lib/currency's formatPrice, with the same unit words (translations
 * `sar` / `usd`). The service lines used to spell it their own way ("SAR
 * 450", «450 ريال») beside a stay's «650 ر.س» on the same Book tab. Stored
 * and charged in riyals always; dollars are only ever the display.
 */
export function formatServiceAmount(
  amountSar: number,
  lang: Language,
  currency: Currency = "SAR"
): string {
  const words = translations[lang];
  return formatPrice(amountSar, currency, { sar: words.sar, usd: words.usd });
}

/**
 * A service's price line: "150 SAR per hour", «150 ر.س للساعة» — the shape
 * of a stay's "650 SAR per night", «650 ر.س في الليلة», shown beside it.
 *
 * A service with no price is shown, not hidden — posted before 1.1.0, or by a
 * provider who quotes per job — and offers Contact instead of Book (design
 * D16). Zero is no price either: nobody books a free hour, and the server
 * refuses one.
 */
export function formatServicePrice(
  service: { price?: number | null; priceUnit?: string },
  lang: Language,
  currency: Currency = "SAR"
): string {
  const { price } = service;
  if (typeof price !== "number" || !(price > 0)) {
    return lang === "ar" ? "السعر عند التواصل" : "Price on request";
  }
  return `${formatServiceAmount(price, lang, currency)} ${priceUnitLabel(service.priceUnit, lang)}`;
}

/* ── Counts ──────────────────────────────────────────────────────────── */

export type QuantityUnit = "hours" | "days";

type CountWords = { one: string; two: string; few: string; many: string };

// English needs two forms; the other two repeat the plural so every count has
// all four. Arabic: one is a word, two the dual, 3–10 the plural, 11 and up
// the singular again (accusative where it shows) — see countForm.
const COUNT_WORDS: Record<QuantityUnit | "people", Record<Language, CountWords>> = {
  hours: {
    en: { one: "1 hour", two: "{n} hours", few: "{n} hours", many: "{n} hours" },
    ar: { one: "ساعة واحدة", two: "ساعتان", few: "{n} ساعات", many: "{n} ساعة" },
  },
  days: {
    en: { one: "1 day", two: "{n} days", few: "{n} days", many: "{n} days" },
    ar: { one: "يوم واحد", two: "يومان", few: "{n} أيام", many: "{n} يومًا" },
  },
  people: {
    en: { one: "1 person", two: "{n} people", few: "{n} people", many: "{n} people" },
    ar: { one: "شخص واحد", two: "شخصان", few: "{n} أشخاص", many: "{n} شخصًا" },
  },
};

// After «حتى» ("up to") the dual is genitive: شخصين, not شخصان.
const UP_TO_WORDS: Record<Language, CountWords> = {
  en: { one: "Up to 1 person", two: "Up to {n} people", few: "Up to {n} people", many: "Up to {n} people" },
  ar: { one: "حتى شخص واحد", two: "حتى شخصين", few: "حتى {n} أشخاص", many: "حتى {n} شخصًا" },
};

function counted(words: Record<Language, CountWords>, n: number, lang: Language): string {
  return words[lang][countForm(n, lang)].replace("{n}", String(n));
}

/** "3 hours", «ساعتان», «11 يومًا». */
export function quantityLabel(n: number, unit: QuantityUnit, lang: Language): string {
  return counted(COUNT_WORDS[unit], n, lang);
}

/** "4 people", «شخصان». */
export function peopleLabel(n: number, lang: Language): string {
  return counted(COUNT_WORDS.people, n, lang);
}

/** How many people a service takes: "Up to 20 people", «حتى 20 شخصًا». */
export function groupSizeLabel(n: number, lang: Language): string {
  return counted(UP_TO_WORDS, n, lang);
}

/** People per booking when the provider set no limit — convex/services/logic.ts DEFAULT_MAX_GROUP. */
export const DEFAULT_MAX_GROUP = 20;

/**
 * The hours or days a traveller chooses, when the unit is priced by them —
 * the same bounds the server enforces (MAX_HOURS, MAX_DAYS). A service priced
 * per booking has nothing to choose, and the server charges it once.
 */
export function quantityRange(
  priceUnit: string | undefined
): { unit: QuantityUnit; min: number; max: number } | null {
  const unit = unitOf(priceUnit);
  if (unit === "per_hour") return { unit: "hours", min: 1, max: 12 };
  if (unit === "per_day") return { unit: "days", min: 1, max: 14 };
  return null;
}

/* ── The clock ───────────────────────────────────────────────────────── */

// Saudi Arabia has kept UTC+3, with no daylight saving, since 1990.
const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/**
 * The Riyadh wall clock at `now`: its date, and the minutes since its midnight.
 *
 * Every service day and start time is a Riyadh wall-clock value, whatever the
 * traveller's phone is set to — the app ships to Sydney and Algiers as well as
 * the Gulf, and the server refuses a start that has passed in Riyadh
 * (PAST_TIME). Here rather than in lib/dates.ts, which the stay screens share.
 */
export function riyadhClock(now: number): { date: string; minutes: number } {
  const shifted = new Date(now + RIYADH_OFFSET_MS);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

const FIRST_START = 6 * 60; // 06:00
const LAST_START = 23 * 60; // 23:00
const START_STEP = 30;
/**
 * How far ahead of now a start time has to be. The server only refuses one
 * that has passed; an hour is what gives the provider a chance to see the
 * request and answer it before the traveller is standing there.
 */
const MIN_LEAD_MS = 60 * MINUTE_MS;

function hhmm(minutes: number): string {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * The start times on offer for a day: every half hour from 06:00 to 23:00, and
 * for today only those at least an hour from now.
 *
 * Compared as instants, not as clock readings, so the phone's own timezone
 * never enters into it: a day that has ended in Riyadh offers nothing, and one
 * that has begun there offers its morning, whatever the date is in Sydney.
 */
export function startTimes(date: string, now: number): string[] {
  const midnight = Date.parse(`${date}T00:00:00Z`) - RIYADH_OFFSET_MS;
  if (Number.isNaN(midnight)) return [];
  const earliest = now + MIN_LEAD_MS;
  const out: string[] = [];
  for (let minutes = FIRST_START; minutes <= LAST_START; minutes += START_STEP) {
    if (midnight + minutes * MINUTE_MS >= earliest) out.push(hhmm(minutes));
  }
  return out;
}

/**
 * The first day the calendar offers: today in Riyadh while a start time is
 * left today, otherwise tomorrow — so a traveller booking at 22:30 is not
 * handed a day with nothing in it.
 */
export function firstBookableDate(now: number): string {
  const today = riyadhClock(now).date;
  return startTimes(today, now).length > 0 ? today : addDays(today, 1);
}

/* ── The quote ───────────────────────────────────────────────────────── */

/** The parts of the server's quote these read. */
export type QuoteAmounts = {
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  priceUnit: string;
};

/**
 * The riyal amount to format for a total, so it agrees with "quantity × the
 * rate" as the traveller reads them. In riyals that is the server's total, as
 * is. In dollars the rate is rounded to a whole dollar, and three hours at
 * "$27" must total $81 — though 300 SAR on its own is $80. The same rule as
 * displayTotalSar for stays.
 */
export function serviceTotalSar(quote: QuoteAmounts, currency: Currency): number {
  if (currency !== "USD") return quote.totalAmount;
  return quote.quantity * convertFromSar(quote.unitPrice, "USD") * SAR_PER_USD;
}

/**
 * What a total is made of: "3 hours × SAR 150" when the traveller chose a
 * number of hours or days, or the price line itself for a one-off price.
 */
export function quoteBreakdown(quote: QuoteAmounts, lang: Language, currency: Currency = "SAR"): string {
  const range = quantityRange(quote.priceUnit);
  if (!range) return formatServicePrice({ price: quote.unitPrice, priceUnit: quote.priceUnit }, lang, currency);
  return `${quantityLabel(quote.quantity, range.unit, lang)} × ${formatServiceAmount(quote.unitPrice, lang, currency)}`;
}

export type ServiceQuoteResult = { ok: true; quote: QuoteAmounts } | { ok: false; error: string };

export type ServiceFooterState =
  | { kind: "idle"; missing: "day" | "time" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | ({ kind: "total"; stale: boolean } & QuoteAmounts);

/**
 * What the booking sheet's pinned footer shows.
 *
 * Until there is something to price it names the next thing to choose, the
 * day and then the start time — which is also what the Send button points at
 * when it is pressed too early. While a new quote is on its way (more hours,
 * another start time) the last total stays, marked stale, rather than the
 * footer collapsing to a spinner and back: the number changes in place.
 */
export function serviceFooterState(input: {
  date: string | null;
  time: string | null;
  quote: ServiceQuoteResult | undefined;
  lastGood: QuoteAmounts | null;
}): ServiceFooterState {
  const { date, time, quote, lastGood } = input;
  if (!date) return { kind: "idle", missing: "day" };
  if (!time) return { kind: "idle", missing: "time" };
  if (quote === undefined) {
    return lastGood ? { kind: "total", stale: true, ...lastGood } : { kind: "loading" };
  }
  if (!quote.ok) return { kind: "error", message: quote.error };
  return { kind: "total", stale: false, ...quote.quote };
}

/* ── The list ────────────────────────────────────────────────────────── */

type Sortable = { bookable: boolean; rating?: number; reviewCount?: number; createdAt: number };

/**
 * The order a traveller browses services in: what they can book first, then
 * the best rated (the review count breaking a tie, so 5.0 from one review does
 * not outrank 5.0 from forty), then the newest. A copy; the input is left as
 * it was, since it is a query's result.
 */
export function sortServicesForBrowse<T extends Sortable>(rows: readonly T[]): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        Number(b.row.bookable) - Number(a.row.bookable) ||
        (b.row.rating ?? 0) - (a.row.rating ?? 0) ||
        (b.row.reviewCount ?? 0) - (a.row.reviewCount ?? 0) ||
        b.row.createdAt - a.row.createdAt ||
        a.index - b.index
    )
    .map((entry) => entry.row);
}

/** Home's "Local services" row: at most ten, what can be booked first. */
export function localServicesFor<T extends Sortable>(rows: readonly T[], limit = 10): T[] {
  return sortServicesForBrowse(rows).slice(0, limit);
}

type Searchable = {
  title: string;
  titleAr: string;
  serviceType: string;
  city?: string;
  languages?: string[];
};

/**
 * Everything a service can be found by, folded once: both titles, what it is
 * in both languages, its city in both languages (a row stored as "Hofuf" is
 * found as Al Ahsa, «الأحساء»), and the languages it is offered in.
 */
export function serviceSearchText(service: Searchable): string {
  const typeKey = serviceTypeLabelKey(service.serviceType);
  const city = service.city?.trim();
  return searchableText(
    service.title,
    service.titleAr,
    translations.en[typeKey],
    translations.ar[typeKey],
    city ? cityLabel(city, "en") : undefined,
    city ? cityLabel(city, "ar") : undefined,
    ...(service.languages ?? [])
  );
}

/**
 * The services a query finds, matched the way Home's search matches: folded
 * for Arabic spelling (hamza, taa marbuta, alef maqsura, tashkeel), and every
 * word somewhere, in any order. The server's search index does not fold, so
 * this is what finds «الاحساء» typed without its hamza.
 */
export function filterServicesByQuery<T extends Searchable>(rows: readonly T[], query: string): T[] {
  const term = normalizeForSearch(query);
  if (!term) return [...rows];
  return rows.filter((row) => matchesQuery(serviceSearchText(row), term));
}

/** Rows from several sources, each once, in the order first found. */
export function mergeById<T extends { id: string }>(...lists: (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const list of lists) {
    for (const item of list) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

/**
 * The type chips worth showing: a chip for each type actually listed, in the
 * app's order — a chip with nothing behind it is a dead end (the rule the Stay
 * tab's kind chips follow). The selected type keeps its chip after its last
 * service goes, so the selection stays visible and can be switched off where
 * it was switched on.
 */
export function presentServiceTypes(
  rows: readonly { serviceType: string }[],
  selected: string
): ServiceType[] {
  const present = new Set(rows.map((row) => row.serviceType));
  return SERVICE_TYPES.filter((type) => present.has(type) || type === selected);
}
