/**
 * Number and label formatting for the analytics and guests pages.
 *
 * Latin digits in both languages, like the rest of the portal and the admin
 * panel: prices, codes and phone numbers sit next to each other, and a mix of
 * Arabic-Indic and Latin figures on one line reads as two different numbers.
 */

export const DASH = '—'

const grouped = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** A whole number with thousands grouping; null/undefined as a dash. */
export function formatCount(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return DASH
  return grouped.format(n)
}

/** SAR, whole riyals: "SAR 1,250" / "1,250 ر.س". Null is a dash (no bookings yet). */
export function formatMoney(amount, lang) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return DASH
  const n = grouped.format(Math.round(amount))
  return lang === 'en' ? `SAR ${n}` : `${n} ر.س`
}

/** A 0..1 ratio as a whole percentage; null (nothing to divide by) is a dash. */
export function formatPercent(ratio) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return DASH
  return `${Math.round(ratio * 100)}%`
}

const UNITS = {
  en: { min: 'min', h: 'h', d: 'd' },
  ar: { min: 'دقيقة', h: 'ساعة', d: 'يوم' },
}

/**
 * A response time. Under an hour in minutes, under two days in hours, then in
 * days — the unit a host would say out loud ("about 3 hours").
 */
export function formatMinutes(minutes, lang) {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return DASH
  const u = UNITS[lang === 'en' ? 'en' : 'ar']
  const m = Math.max(0, Math.round(minutes))
  if (m < 60) return `${m} ${u.min}`
  if (m < 48 * 60) return `${Math.round(m / 60)} ${u.h}`
  return `${Math.round(m / (24 * 60))} ${u.d}`
}

/**
 * The change against the previous period, or null when both are zero (nothing
 * to compare). From zero to something is "up from 0", not "+∞%".
 * `direction` is 'up' | 'down' | 'flat' | 'new'.
 */
export function formatChange(current, previous, lang, { lowerIsBetter = false } = {}) {
  // No value this period (a rate with nothing to divide) is not a 100% drop.
  if (current === null || current === undefined) return null
  const c = current
  const p = previous ?? 0
  if (c === 0 && p === 0) return null
  // "new" alone read as a label on every card of a young account; this says
  // what it means — the previous period had none.
  if (p === 0) return { text: lang === 'en' ? 'up from 0' : 'ارتفاع من 0', direction: 'new', tone: 'good' }
  const pct = Math.round(((c - p) / p) * 100)
  if (pct === 0) return { text: '0%', direction: 'flat', tone: 'plain' }
  // `tone` is what the colour follows: for a response time, going up is worse.
  const tone = (pct > 0) !== lowerIsBetter ? 'good' : 'plain'
  // U+2212 minus: a hyphen is shorter than the plus sign and reads as a dash.
  return pct > 0
    ? { text: `+${pct}%`, direction: 'up', tone }
    : { text: `−${Math.abs(pct)}%`, direction: 'down', tone }
}

const MONTHS = {
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
}

function monthName(month, lang) {
  return MONTHS[lang === 'en' ? 'en' : 'ar'][month - 1] ?? ''
}

/**
 * A chart bucket's label from its key: "YYYY-MM-DD" for a day or a week (the
 * Riyadh Monday it starts on) → "26 Sep"; "YYYY-MM" for a month → "Sep 2026".
 */
export function bucketLabel(key, bucket, lang) {
  const [y, m, d] = String(key).split('-').map(Number)
  if (!y || !m) return String(key)
  if (bucket === 'month' || !d) return `${monthName(m, lang)} ${y}`
  return `${d} ${monthName(m, lang)}`
}

/** "YYYY-MM-DD" → "26 Sep 2026"; null is a dash. */
export function formatDay(iso, lang) {
  if (!iso) return DASH
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return String(iso)
  return `${d} ${monthName(m, lang)} ${y}`
}

/** A timestamp as a Riyadh calendar day, "26 Sep 2026". */
export function formatTimestamp(ms, lang) {
  if (!ms) return DASH
  // Riyadh is UTC+3 all year (no daylight saving).
  const iso = new Date(ms + 3 * 3600 * 1000).toISOString().slice(0, 10)
  return formatDay(iso, lang)
}

/** The five one-tap tags. Stored in English; shown in the page's language. */
export const DEFAULT_TAGS = ['VIP', 'Repeat', 'Family', 'Business', 'Needs attention']

const TAG_LABELS_AR = {
  VIP: 'VIP',
  Repeat: 'متكرر',
  Family: 'عائلة',
  Business: 'أعمال',
  'Needs attention': 'يحتاج متابعة',
}

export function tagLabel(tag, lang) {
  if (lang === 'en') return tag
  return TAG_LABELS_AR[tag] ?? tag
}

export const TAG_MAX_LENGTH = 24
export const TAG_MAX_COUNT = 10
export const NOTE_MAX_LENGTH = 2000

/**
 * Adds a tag the way the server will store it: trimmed, and not a
 * case-insensitive duplicate. Returns the same array when nothing changes.
 */
export function addTag(tags, raw) {
  const tag = String(raw ?? '').trim()
  if (!tag || tag.length > TAG_MAX_LENGTH || tags.length >= TAG_MAX_COUNT) return tags
  if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return tags
  return [...tags, tag]
}
