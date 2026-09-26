import { riyadhToday } from '../../booking/dates'
import { formatSAR } from '../../booking/money'
import { quantityRule } from '../../booking/serviceRules'
import { quantityText } from '../../booking/text'

/**
 * How a service reads on its page: who offers it, since when, for how many,
 * in which languages, and what a total is made of. The app's wording
 * (hasio-mobile-app/lib/serviceDisplay.ts), so a traveller reads the same
 * lines on the phone and on the site.
 */

const clean = (value) => (typeof value === 'string' ? value.trim() : '')

/** "Sara Ali" — whatever the provider gave of their name, or '' when nothing. */
export function providerName(provider) {
  return [clean(provider?.firstName), clean(provider?.lastName)].filter(Boolean).join(' ')
}

/** The year a provider joined, as it was in Riyadh then; null without a date. */
export function memberSinceYear(memberSince) {
  if (!Number.isFinite(memberSince) || memberSince <= 0) return null
  return riyadhToday(memberSince).slice(0, 4)
}

/**
 * "Up to 6 people" / «حتى 6 أشخاص». Not «حتى» + peopleText: after «حتى» the
 * dual is genitive, «حتى شخصين», where a bare count says «شخصان» — the same
 * distinction the app draws (serviceDisplay.ts UP_TO_WORDS).
 */
export function groupSizeText(n, lang) {
  if (lang !== 'ar') return n === 1 ? 'Up to 1 person' : `Up to ${n} people`
  if (n === 1) return 'حتى شخص واحد'
  if (n === 2) return 'حتى شخصين'
  if (n >= 3 && n <= 10) return `حتى ${n} أشخاص`
  return `حتى ${n} شخصًا`
}

/**
 * What a total is made of, "3 hours × 150 SAR", for a price by the hour or
 * the day. Null for a price per booking: its total is the price itself, and a
 * line saying so again beside it would only repeat the number.
 */
export function breakdownText(quote, lang) {
  if (!quantityRule(quote.priceUnit)) return null
  return `${quantityText(quote.priceUnit, quote.quantity, lang)} × ${formatSAR(quote.unitPrice, lang)}`
}

/**
 * A provider's text in the page's language, or in the other one when that is
 * all they wrote: the text they did write beats an empty line.
 */
export function pickText(en, ar, lang) {
  const [first, second] = lang === 'ar' ? [ar, en] : [en, ar]
  return clean(first) || clean(second)
}

/** "Arabic, English" / «العربية، الإنجليزية» — as the provider typed them. */
export function languagesText(languages, lang) {
  const list = (Array.isArray(languages) ? languages : []).map(clean).filter(Boolean)
  return list.join(lang === 'ar' ? '، ' : ', ')
}
