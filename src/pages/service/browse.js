import { CITY_LABELS, canonicalCity } from '../../admin/constants'
import { serviceTypeLabel } from '../../partners/services/labels'

/**
 * Services on /explore: what a search can find one by, and the order the
 * Services grid shows them in. /explore folds the text with its own Arabic
 * spelling rules, the same ones its places go through.
 */

const text = (value) => (typeof value === 'string' ? value.trim() : '')

/**
 * Both titles, the city in both languages, and the kind of service in both
 * ("Tour guide", «مرشد سياحي»). A service stored under a sub-area ("Hofuf")
 * answers to that name and to the city it folds into (Al Ahsa, «الأحساء»).
 */
export function serviceSearchText(service) {
  const stored = text(service.city)
  const city = stored ? canonicalCity(stored) : ''
  const parts = [
    service.title_en,
    service.title_ar,
    stored,
    city,
    CITY_LABELS[city],
    serviceTypeLabel(service.serviceType, 'en'),
    serviceTypeLabel(service.serviceType, 'ar'),
  ]
  return [...new Set(parts.map(text).filter(Boolean))].join(' ')
}

/**
 * The app's browse order (lib/serviceDisplay.ts sortServicesForBrowse): what
 * can be booked first, then the best rated — the review count breaking a tie,
 * so 5.0 from one review does not outrank 5.0 from forty — then the newest.
 * A sorted copy; the query's own array is left alone.
 */
export function sortServices(rows) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort(
      (a, b) =>
        Number(Boolean(b.row.bookable)) - Number(Boolean(a.row.bookable)) ||
        (b.row.rating ?? 0) - (a.row.rating ?? 0) ||
        (b.row.reviewCount ?? 0) - (a.row.reviewCount ?? 0) ||
        (b.row.createdAt ?? 0) - (a.row.createdAt ?? 0) ||
        a.index - b.index,
    )
    .map(({ row }) => row)
}
