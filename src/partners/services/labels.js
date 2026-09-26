/**
 * Service wording shared by the provider pages — the app's own words
 * (constants/translations.ts: tourGuide…, pricePerHour…), so a provider reads
 * the same thing on the web and on the phone.
 */
import { CITY_LABELS, canonicalCity } from '../../admin/constants.js'

export const SERVICE_TYPE_LABELS = {
  en: {
    tour_guide: 'Tour guide',
    photographer: 'Photographer',
    driver: 'Driver',
    translator: 'Translator',
    event_planner: 'Event planner',
    catering: 'Catering',
    equipment_rental: 'Equipment rental',
    other: 'Other',
  },
  ar: {
    tour_guide: 'مرشد سياحي',
    photographer: 'مصور',
    driver: 'سائق',
    translator: 'مترجم',
    event_planner: 'منظم فعاليات',
    catering: 'تموين طعام',
    equipment_rental: 'تأجير معدات',
    other: 'أخرى',
  },
}

/** `label` names the unit in a picker; `per` follows an amount. */
export const PRICE_UNIT_LABELS = {
  en: {
    per_hour: { label: 'Per hour', per: '/ hour' },
    per_day: { label: 'Per day', per: '/ day' },
    per_event: { label: 'Per event', per: '/ event' },
    fixed: { label: 'Fixed price', per: 'fixed' },
  },
  ar: {
    per_hour: { label: 'بالساعة', per: 'للساعة' },
    per_day: { label: 'باليوم', per: 'لليوم' },
    per_event: { label: 'بالفعالية', per: 'للفعالية' },
    fixed: { label: 'سعر ثابت', per: 'سعر ثابت' },
  },
}

export const STATUS_LABELS = {
  en: { approved: 'Live', pending: 'In review', rejected: 'Not approved', suspended: 'Suspended' },
  ar: { approved: 'منشورة', pending: 'قيد المراجعة', rejected: 'مرفوضة', suspended: 'موقوفة' },
}

const lng = (lang) => (lang === 'en' ? 'en' : 'ar')

export const serviceTypeLabel = (type, lang) =>
  SERVICE_TYPE_LABELS[lng(lang)][type] ?? SERVICE_TYPE_LABELS[lng(lang)].other

export const cityName = (city, lang) => {
  const key = canonicalCity(city ?? '')
  if (!key) return ''
  return lng(lang) === 'ar' ? CITY_LABELS[key] || key : key
}

/** "SAR 150 / hour" / "150 ر.س للساعة", or null without a numeric price. */
export function priceText(price, unit, lang) {
  if (price === undefined || price === null) return null
  const l = lng(lang)
  const amount = l === 'ar' ? `${price.toLocaleString('en-US')} ر.س` : `SAR ${price.toLocaleString('en-US')}`
  const per = PRICE_UNIT_LABELS[l][unit]?.per ?? PRICE_UNIT_LABELS[l].fixed.per
  return `${amount} ${per}`
}

/** The service's title in the reader's language, falling back to the other. */
export const serviceTitle = (service, lang) =>
  (lng(lang) === 'ar' ? service?.title_ar || service?.title_en : service?.title_en || service?.title_ar) || ''
