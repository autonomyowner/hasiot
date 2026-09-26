/**
 * Counts in words: "3 nights", "ليلتان".
 *
 * Arabic agrees with the number in four forms — one, two (the dual), three to
 * ten, eleven and up — so "s"-style pluralising reads wrong. The Arabic forms
 * are the server's, word for word (convex/notifications/templates.ts), so a
 * page and the email about the same booking say the same thing.
 */

function arabicCount(n, one, two, few, many) {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${n} ${few}`
  return `${n} ${many}`
}

const english = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`

export const nightsText = (n, lang) =>
  lang === 'ar' ? arabicCount(n, 'ليلة واحدة', 'ليلتان', 'ليالٍ', 'ليلة') : english(n, 'night', 'nights')

export const guestsText = (n, lang) =>
  lang === 'ar' ? arabicCount(n, 'ضيف واحد', 'ضيفان', 'ضيوف', 'ضيفًا') : english(n, 'guest', 'guests')

export const peopleText = (n, lang) =>
  lang === 'ar' ? arabicCount(n, 'شخص واحد', 'شخصان', 'أشخاص', 'شخصًا') : english(n, 'person', 'people')

export const hoursText = (n, lang) =>
  lang === 'ar' ? arabicCount(n, 'ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة') : english(n, 'hour', 'hours')

export const daysText = (n, lang) =>
  lang === 'ar' ? arabicCount(n, 'يوم واحد', 'يومان', 'أيام', 'يومًا') : english(n, 'day', 'days')

export const reviewsText = (n, lang) =>
  lang === 'ar' ? arabicCount(n, 'تقييم واحد', 'تقييمان', 'تقييمات', 'تقييمًا') : english(n, 'review', 'reviews')

/** Hours or days for an hourly or daily service; nothing for any other price. */
export function quantityText(priceUnit, n, lang) {
  if (priceUnit === 'per_hour') return hoursText(n, lang)
  if (priceUnit === 'per_day') return daysText(n, lang)
  return ''
}
