/**
 * Riyals as the app writes them (lib/currency.ts): the amount, then "SAR" or
 * "ر.س", US-style grouping and Latin digits in both languages. The server
 * stores and charges SAR only; the app's USD toggle is not ported (design W12).
 */

export function formatAmount(n, lang) {
  // Latin digits in Arabic too: the rest of the site writes numbers that way,
  // and a price must read the same on the card, the checkout and the email.
  return Math.round(n).toLocaleString(lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US')
}

export function formatSAR(n, lang) {
  return `${formatAmount(n, lang)} ${lang === 'ar' ? 'ر.س' : 'SAR'}`
}

const UNITS = {
  per_hour: { en: 'per hour', ar: 'للساعة' },
  per_day: { en: 'per day', ar: 'لليوم' },
}
// A per-event price and a fixed one are the same thing to a traveller: one
// price for the booking.
const PER_BOOKING = { en: 'per booking', ar: 'للحجز' }

export function unitLabel(priceUnit, lang) {
  const unit = UNITS[priceUnit] ?? PER_BOOKING
  return lang === 'ar' ? unit.ar : unit.en
}

/** "150 SAR per hour", or "Price on request" for a service with no price. */
export function priceLine(price, priceUnit, lang) {
  if (typeof price !== 'number' || !(price > 0)) return lang === 'ar' ? 'السعر عند الطلب' : 'Price on request'
  return `${formatSAR(price, lang)} ${unitLabel(priceUnit, lang)}`
}
