// Shared lookups for the admin panel. These used to be duplicated inside
// individual tabs (the city list three times, type labels four times), which is
// how the pending-accounts tab ended up labelling `businessType` with the
// listing category list.

// What the panel prints when a value is missing or the server sent its
// English placeholder ("Unknown") for one.
export const UNKNOWN_LABEL = 'غير معروف'

export const orUnknown = (value) =>
  value === undefined || value === null || value === '' || value === 'Unknown'
    ? UNKNOWN_LABEL
    : value

// The thirteen governorates and cities Hasio covers, in the Eastern Province.
// Keep in step with `hasio-mobile-app/constants/cities.ts` — the app stores
// these exact strings and looks them up there to draw an Arabic or English
// label, so a name that exists in only one of the two files loses its label on
// the other side.
export const CITIES = [
  'Dammam', 'Al Khobar', 'Al Ahsa', 'Qatif', 'Jubail', 'Hafar Al Batin',
  'Khafji', 'Ras Tanura', 'Abqaiq', 'Nairyah', 'Qaryat Al Ulya', 'Al Udayd',
  'Al Bayda',
]

export const CITY_LABELS = {
  'Dammam': 'الدمام',
  'Al Khobar': 'الخبر',
  'Al Ahsa': 'الأحساء',
  'Qatif': 'القطيف',
  'Jubail': 'الجبيل',
  'Hafar Al Batin': 'حفر الباطن',
  'Khafji': 'الخفجي',
  'Ras Tanura': 'رأس تنورة',
  'Abqaiq': 'بقيق',
  'Nairyah': 'النعيرية',
  'Qaryat Al Ulya': 'قرية العليا',
  'Al Udayd': 'العديد',
  'Al Bayda': 'البيضاء',
}

export const CITY_OPTIONS = CITIES.map((c) => ({ value: c, label: CITY_LABELS[c] || c }))

// Sub-areas that stored listings already use, folded into the city above them.
// Al-Ahsa used to be fifteen separate "cities" in this panel, so production
// carries Hofuf, Mubarraz and Al Oyoun. Folding them here means every table and
// filter reads correctly today without rewriting a single row.
export const CITY_ALIASES = {
  'Hofuf': 'Al Ahsa',
  'Al Hofuf': 'Al Ahsa',
  'Mubarraz': 'Al Ahsa',
  'Al Mubarraz': 'Al Ahsa',
  'Al Oyoun': 'Al Ahsa',
  'Al Omran': 'Al Ahsa',
  'Al Jafer': 'Al Ahsa',
  'Al Battaliyah': 'Al Ahsa',
  'Al Taraf': 'Al Ahsa',
  'Al Shuqaiq': 'Al Ahsa',
  'Al Qarah': 'Al Ahsa',
  'Al Kilabiyah': 'Al Ahsa',
  'Al Jishshah': 'Al Ahsa',
  'Al Fudhool': 'Al Ahsa',
  'Al Marah': 'Al Ahsa',
  'Al Hulaila': 'Al Ahsa',
  'Al Salhiyah': 'Al Ahsa',
  'Dhahran': 'Al Khobar',
  'Saihat': 'Qatif',
  'Safwa': 'Qatif',
  'Darin': 'Qatif',
  'Tarout': 'Qatif',
}

export const canonicalCity = (city) => CITY_ALIASES[city] || city

export const cityLabel = (city) =>
  CITY_LABELS[canonicalCity(city)] || city || '—'

// City centres, copied from `CITY_COORDS` / `cityCoordinates` in
// hasio-mobile-app/constants/cities.ts — keep the two in step. That file has
// eleven: Al Udayd and Al Bayda are recent, sparsely documented governorates
// with no confirmed centre, and it falls back to Dammam for them. They have
// no entry here either, so the listing form pins them on Dammam the same way
// but does not measure a distance from a centre nobody has confirmed.
export const CITY_CENTRES = {
  'Dammam': { lat: 26.4207, lng: 50.0888 },
  'Al Khobar': { lat: 26.2794, lng: 50.2083 },
  'Al Ahsa': { lat: 25.3854, lng: 49.5683 },
  'Qatif': { lat: 26.5196, lng: 49.9962 },
  'Jubail': { lat: 27.0174, lng: 49.6225 },
  'Hafar Al Batin': { lat: 28.4337, lng: 45.9601 },
  'Khafji': { lat: 28.439, lng: 48.491 },
  'Ras Tanura': { lat: 26.654, lng: 50.1626 },
  'Abqaiq': { lat: 25.934, lng: 49.668 },
  'Nairyah': { lat: 27.4894, lng: 48.4839 },
  'Qaryat Al Ulya': { lat: 27.5556, lng: 47.6606 },
}

/** Dammam, the provincial capital: where a city with no known centre is pinned. */
export const PROVINCE_CENTRE = CITY_CENTRES['Dammam']

/** A city's confirmed centre, or null when there is none to measure against. */
export const cityCentre = (city) => CITY_CENTRES[canonicalCity(city)] || null

/** Where a new listing in `city` starts on the map. */
export const defaultPin = (city) => cityCentre(city) || PROVINCE_CENTRE

// Saudi Arabia, rounded outwards. A pin outside this box is a typo or a
// swapped latitude and longitude, not a place in the Kingdom. The old box
// (lat 24–27, lng 48–51) only fitted Al-Ahsa and turned away Jubail, Nairyah,
// Qaryat Al Ulya, Khafji and Hafar Al Batin.
export const SAUDI_BOUNDS = { minLat: 16, maxLat: 33, minLng: 34, maxLng: 56 }

/**
 * Beyond this the pin is probably in the wrong city, so the form says so.
 *
 * It was 150 km, which let the likeliest mistake through: Dammam, Al Khobar
 * and Qatif are 118–133 km from the Al-Ahsa centre that the posting forms used
 * to hardcode, so a Hofuf pin under any of them passed without a word (25 of
 * the 55 pairs of city centres are closer than 150 km). 100 km still leaves
 * room for a place far out in a large governorate — Al-Uqair is about 70 km
 * from the Al-Ahsa centre — and it only ever warns, never blocks.
 */
export const PIN_WARNING_KM = 100

export function insideSaudiArabia(lat, lng) {
  return (
    lat >= SAUDI_BOUNDS.minLat && lat <= SAUDI_BOUNDS.maxLat &&
    lng >= SAUDI_BOUNDS.minLng && lng <= SAUDI_BOUNDS.maxLng
  )
}

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export const LISTING_TYPES = [
  { value: 'hotel', label: 'فندق' },
  { value: 'restaurant', label: 'مطعم' },
  { value: 'attraction', label: 'معلم سياحي' },
  { value: 'event', label: 'فعالية' },
  { value: 'tour', label: 'جولة' },
]

export const TYPE_LABELS = Object.fromEntries(LISTING_TYPES.map(t => [t.value, t.label]))

export const CATEGORIES = [
  { value: 'luxury_hotel', label: 'فندق فاخر' },
  { value: 'business_hotel', label: 'فندق أعمال' },
  { value: 'mid_range_hotel', label: 'فندق متوسط' },
  { value: 'boutique_hotel', label: 'فندق بوتيك' },
  { value: 'resort', label: 'منتجع' },
  { value: 'traditional_food', label: 'مطبخ تقليدي' },
  { value: 'fine_dining', label: 'مطعم فاخر' },
  { value: 'seafood', label: 'مأكولات بحرية' },
  { value: 'international', label: 'عالمي' },
  { value: 'fast_food', label: 'وجبات سريعة' },
  { value: 'historical_site', label: 'موقع تاريخي' },
  { value: 'museum', label: 'متحف' },
  { value: 'natural_landmark', label: 'معلم طبيعي' },
  { value: 'entertainment', label: 'ترفيه' },
  { value: 'cultural_tour', label: 'جولة ثقافية' },
  { value: 'adventure', label: 'مغامرة' },
  { value: 'seasonal_event', label: 'موسم' },
]

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

// Which categories belong to which listing type, so the form stops offering
// "فندق فاخر" as a category for an event.
export const CATEGORIES_BY_TYPE = {
  hotel: ['luxury_hotel', 'business_hotel', 'mid_range_hotel', 'boutique_hotel', 'resort'],
  restaurant: ['traditional_food', 'fine_dining', 'seafood', 'international', 'fast_food'],
  attraction: ['historical_site', 'museum', 'natural_landmark', 'entertainment'],
  event: ['seasonal_event', 'entertainment', 'cultural_tour'],
  tour: ['cultural_tour', 'adventure', 'natural_landmark'],
}

export const SERVICE_TYPE_LABELS = {
  tour_guide: 'مرشد سياحي',
  photographer: 'مصور',
  driver: 'سائق',
  translator: 'مترجم',
  event_planner: 'منظم فعاليات',
  catering: 'تقديم طعام',
  equipment_rental: 'تأجير معدات',
  other: 'أخرى',
}

export const SERVICE_TYPE_OPTIONS = Object.entries(SERVICE_TYPE_LABELS)
  .map(([value, label]) => ({ value, label }))

// A service's review state. Suspended (1.1.0) is a live service an admin took
// down: it keeps its bookings and comes back with one click.
export const SERVICE_STATUSES = [
  { value: 'approved', label: 'منشورة', color: 'green' },
  { value: 'pending', label: 'قيد المراجعة', color: 'yellow' },
  { value: 'suspended', label: 'موقوفة', color: 'red' },
  { value: 'rejected', label: 'مرفوضة', color: 'red' },
]

export const SERVICE_STATUS_LABELS =
  Object.fromEntries(SERVICE_STATUSES.map(s => [s.value, s.label]))

export const SERVICE_STATUS_COLORS =
  Object.fromEntries(SERVICE_STATUSES.map(s => [s.value, s.color]))

// The unit a service is priced in (services/logic.ts PRICE_UNITS). `label` is
// the app's own wording (translations.ts pricePerHour …), `per` is how a price
// reads after the amount. Only the first two let the traveller pick a
// quantity, and the total is the price times it.
export const PRICE_UNITS = [
  { value: 'per_hour', label: 'بالساعة', per: 'للساعة' },
  { value: 'per_day', label: 'باليوم', per: 'لليوم' },
  { value: 'per_event', label: 'بالفعالية', per: 'للفعالية' },
  { value: 'fixed', label: 'سعر ثابت', per: 'سعر ثابت' },
]

export const PRICE_UNIT_LABELS = Object.fromEntries(PRICE_UNITS.map(u => [u.value, u.label]))

/** "150 ر.س للساعة", or null for a service with no numeric price. */
export function formatServicePrice(price, priceUnit) {
  if (price === undefined || price === null) return null
  const unit = PRICE_UNITS.find((u) => u.value === priceUnit)
  return unit ? `${formatMoney(price)} ${unit.per}` : formatMoney(price)
}

/**
 * The address a phone sign-up is given (convex/lib/contact.ts). It takes no
 * mail and is nobody's name, so the panel never shows it as either.
 */
export const isPlaceholderEmail = (email) =>
  typeof email === 'string' && email.toLowerCase().endsWith('@phone.hasio.xyz')

/** An address someone can write to, or null. */
export const realEmail = (email) => (email && !isPlaceholderEmail(email) ? email : null)

/**
 * A URL safe to put in an href, or null. Websites and image URLs are text a
 * host or provider typed into the app; a "javascript:" one would run in the
 * admin's session when clicked, so only http(s) becomes a link.
 */
export function safeHttpUrl(url) {
  if (typeof url !== 'string') return null
  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  // "www.example.com" — typed without the scheme, still meant as a website.
  if (/^www\./i.test(trimmed)) return `https://${trimmed}`
  return null
}

/** A person's name as the panel shows it; a phone sign-up has only a number. */
export function personName(person) {
  if (!person) return UNKNOWN_LABEL
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  if (name) return name
  if (person.isPlaceholderEmail || isPlaceholderEmail(person.email)) {
    // Some rows (a reporter, a queue's owner) carry no phone field at all.
    return person.phone || 'تسجيل بالهاتف'
  }
  return person.email || person.phone || UNKNOWN_LABEL
}

// One set of role labels for the whole panel. The accounts tab, the users tab
// and the host picker each had their own (صاحب عمل / مالك نشاط / مشرف …), so
// the same account read as a different thing depending on where it was shown.
export const ROLE_LABELS = {
  tourist: 'سائح',
  business_owner: 'صاحب منشأة',
  service_provider: 'مقدم خدمة',
  admin: 'مدير',
}

// The roles an admin may give an account from the panel. Admin itself is
// granted from the command line only (convex/admin/devTools.ts).
export const ASSIGNABLE_ROLES = ['tourist', 'business_owner', 'service_provider']

/** A stored role in Arabic. An account with none is a tourist, as on the server. */
export const roleLabel = (role) => ROLE_LABELS[role || 'tourist'] || role

/** `businessType` is whatever the sign-up offered: a listing type or a service type. */
export const businessTypeLabel = (value) =>
  !value ? '—' : TYPE_LABELS[value] || SERVICE_TYPE_LABELS[value] || value

export const KNOWLEDGE_CATEGORIES = [
  { value: 'destinations', label: 'الوجهات' },
  { value: 'hotels', label: 'الفنادق' },
  { value: 'restaurants', label: 'المطاعم' },
  { value: 'culture', label: 'الثقافة' },
  { value: 'transport', label: 'المواصلات' },
  { value: 'tips', label: 'نصائح السفر' },
  { value: 'events', label: 'الفعاليات' },
  { value: 'general', label: 'معلومات عامة' },
]

export const KNOWLEDGE_CATEGORY_LABELS =
  Object.fromEntries(KNOWLEDGE_CATEGORIES.map(c => [c.value, c.label]))

export const REPORT_REASONS_AR = {
  spam: 'محتوى مزعج',
  inappropriate: 'محتوى غير لائق',
  offensive: 'محتوى مسيء',
  fraud: 'احتيال',
  other: 'أخرى',
}

export const REPORT_TARGET_TYPES_AR = {
  listing: 'مكان',
  service: 'خدمة',
  review: 'تقييم',
  // A reply from the travel planner (1.1.0). It is not a document: the
  // conversation lives on the phone, and the report carries its text.
  ai_message: 'رد المساعد الذكي',
}

export const REPORT_STATUSES = [
  { value: 'pending', label: 'مفتوحة' },
  { value: 'actioned', label: 'تم اتخاذ إجراء' },
  { value: 'dismissed', label: 'مرفوضة' },
  { value: 'reviewed', label: 'تمت المراجعة' },
]

export const REPORT_STATUS_LABELS =
  Object.fromEntries(REPORT_STATUSES.map(s => [s.value, s.label]))

export const BOOKING_STATUSES = [
  { value: 'pending', label: 'بانتظار المالك', color: 'yellow' },
  { value: 'confirmed', label: 'مؤكد', color: 'blue' },
  { value: 'completed', label: 'مكتمل', color: 'green' },
  { value: 'cancelled', label: 'ملغى', color: 'red' },
  { value: 'declined', label: 'مرفوض من المالك', color: 'red' },
  { value: 'expired', label: 'منتهي الصلاحية', color: 'gray' },
  { value: 'no_show', label: 'لم يحضر', color: 'gray' },
]

export const BOOKING_STATUS_LABELS =
  Object.fromEntries(BOOKING_STATUSES.map(s => [s.value, s.label]))

export const BOOKING_STATUS_COLORS =
  Object.fromEntries(BOOKING_STATUSES.map(s => [s.value, s.color]))

/** Closed: nothing moves out of these except a logged support override. */
export const TERMINAL_BOOKING_STATUSES = ['cancelled', 'completed', 'declined', 'expired', 'no_show']

// Three shapes share the bookings table. "slot" is the original restaurant
// reservation, stored as kind "slot" or with no kind at all.
export const BOOKING_KINDS = [
  { value: 'stay', label: 'إقامة', plural: 'إقامات' },
  { value: 'service', label: 'خدمة', plural: 'خدمات' },
  { value: 'slot', label: 'موعد', plural: 'مواعيد' },
]

export const BOOKING_KIND_LABELS = Object.fromEntries(BOOKING_KINDS.map(k => [k.value, k.label]))

export const bookingKindOf = (booking) =>
  booking?.kind === 'stay' || booking?.kind === 'service' ? booking.kind : 'slot'

/** Who answers a booking: the host of a stay, the provider of a service. */
export const bookingOwnerLabel = (kind) =>
  kind === 'service' ? 'مقدم الخدمة' : kind === 'stay' ? 'المضيف' : 'المالك'

/**
 * A booking status in Arabic, worded for who the booking waits on. The filter
 * list keeps the generic label; a row knows whether it is a stay or a service.
 */
export function bookingStatusLabel(status, kind) {
  if (kind === 'service') {
    if (status === 'pending') return 'بانتظار مقدم الخدمة'
    if (status === 'declined') return 'رفضه مقدم الخدمة'
  }
  if (kind === 'stay') {
    if (status === 'pending') return 'بانتظار المضيف'
    if (status === 'declined') return 'رفضه المضيف'
  }
  return BOOKING_STATUS_LABELS[status] || status || UNKNOWN_LABEL
}

// A listing's review state. "seed" is not a stored value — it is the absence
// of one, which is how the original catalogue is distinguished from anything
// a host submitted.
export const LISTING_STATUSES = [
  { value: 'pending', label: 'قيد المراجعة', color: 'yellow' },
  { value: 'approved', label: 'معتمد', color: 'green' },
  { value: 'rejected', label: 'مرفوض', color: 'red' },
  { value: 'suspended', label: 'موقوف', color: 'red' },
  { value: 'seed', label: 'أصلي', color: 'gray' },
]

export const LISTING_STATUS_LABELS =
  Object.fromEntries(LISTING_STATUSES.map(s => [s.value, s.label]))

export const LISTING_STATUS_COLORS =
  Object.fromEntries(LISTING_STATUSES.map(s => [s.value, s.color]))

/**
 * Only a live listing can be suspended: approved, or a seed row with no status.
 * The server refuses the rest, because reinstating sets "approved" and would
 * publish a submission nobody reviewed — a pending one is rejected instead.
 */
export const isLiveListing = (listing) => !listing?.status || listing.status === 'approved'

/** The same rule for a service, which always has a status. */
export const isLiveService = (service) => service?.status === 'approved'

/** A reported item's status in Arabic, whichever kind of thing it is. */
export function contentStatusLabel(targetType, status) {
  if (targetType === 'listing') return LISTING_STATUS_LABELS[status || 'seed'] || status
  if (targetType === 'service') return SERVICE_STATUS_LABELS[status] || status
  return status ? status : null
}

export const PRICE_RANGES = [
  { value: '$', label: '$ اقتصادي' },
  { value: '$$', label: '$$ متوسط' },
  { value: '$$$', label: '$$$ مرتفع' },
  { value: '$$$$', label: '$$$$ فاخر' },
]

// Where an early-access address was left. Only the landing page's banner
// ever wrote one; "footer" is named in the schema comment.
export const EMAIL_SOURCE_LABELS = {
  home_banner: 'لافتة الصفحة الرئيسية',
  footer: 'تذييل الموقع',
}

export const emailSourceLabel = (source) =>
  !source ? 'غير محدد' : EMAIL_SOURCE_LABELS[source] || 'مصدر آخر'

// The admin action log. Keys are the `action` strings written through
// convex/admin/activity.ts:logAdminAction.
export const ACTIVITY_ACTION_LABELS = {
  'listing.create': 'إضافة مكان',
  'listing.update': 'تعديل مكان',
  'listing.delete': 'حذف مكان',
  'listing.import': 'استيراد أماكن',
  'listing.hours': 'تحديث أوقات العمل',
  // Visibility, not moderation: hiding a place from the app is a switch on
  // its row. Suspension (below) is the moderation act.
  'listing.activate': 'إظهار مكان',
  'listing.deactivate': 'إخفاء مكان',
  'listing.suspend': 'إيقاف مكان',
  'listing.reinstate': 'إعادة مكان',
  'listing.assign_host': 'تعيين مضيف',
  'listing.clear_host': 'إزالة مضيف',
  'content.approve': 'الموافقة على مكان',
  'content.reject': 'رفض مكان',
  'service.approve': 'الموافقة على خدمة',
  'service.reject': 'رفض خدمة',
  'service.update': 'تعديل خدمة',
  'service.suspend': 'إيقاف خدمة',
  'service.reinstate': 'إعادة خدمة',
  'service.delete': 'حذف خدمة',
  'account.approve': 'اعتماد حساب',
  'account.reject': 'رفض حساب',
  'user.suspend': 'إيقاف حساب',
  'user.unsuspend': 'إلغاء إيقاف حساب',
  'user.role': 'تغيير دور حساب',
  'review.remove': 'حذف تقييم',
  'knowledge.create': 'إضافة معلومة',
  'knowledge.update': 'تعديل معلومة',
  'knowledge.delete': 'حذف معلومة',
  'booking.confirmed': 'تأكيد حجز',
  'booking.completed': 'إتمام حجز',
  'booking.cancelled': 'إلغاء حجز',
  'booking.no_show': 'تسجيل عدم حضور',
  'booking.pending': 'إرجاع حجز للانتظار',
  'booking.declined': 'رفض طلب حجز',
  'booking.expired': 'إنهاء صلاحية طلب حجز',
  // Reopening a closed booking. Named apart from the routine transitions
  // because it is support overriding the flow, not the flow running.
  'booking.force': 'تغيير حالة حجز مغلق',
  'report.actioned': 'إغلاق تبليغ بإجراء',
  'report.dismissed': 'رفض تبليغ',
  'report.reviewed': 'مراجعة تبليغ',
}

export const ACTIVITY_TARGET_LABELS = {
  listing: 'مكان',
  service: 'خدمة',
  user: 'حساب',
  booking: 'حجز',
  knowledge: 'معلومة',
  report: 'تبليغ',
  review: 'تقييم',
}

// Destructive actions are tinted so a scan down the log finds them first.
export const ACTIVITY_TONE = {
  'listing.delete': 'red',
  'listing.deactivate': 'red',
  'listing.suspend': 'red',
  'knowledge.delete': 'red',
  'content.reject': 'red',
  'service.reject': 'red',
  'service.suspend': 'red',
  'service.delete': 'red',
  'account.reject': 'red',
  'booking.cancelled': 'red',
  'booking.declined': 'red',
  'booking.force': 'red',
  'user.suspend': 'red',
  'review.remove': 'red',
  'report.actioned': 'red',
  'listing.activate': 'green',
  'listing.reinstate': 'green',
  'service.reinstate': 'green',
  'user.unsuspend': 'green',
  'content.approve': 'green',
  'service.approve': 'green',
  'account.approve': 'green',
  'booking.confirmed': 'green',
  'booking.completed': 'green',
}

/**
 * A log row's details in Arabic. Status and role changes are written as
 * "from → to" with the stored keys, and a report's summary as
 * "type: reason"; everything else is the admin's own words and stays as it is.
 */
export function activityDetails(row) {
  const details = row?.details
  if (!details) return null

  if (row.action?.startsWith('booking.')) {
    const [transition, ...reason] = details.split(' — ')
    const [from, to] = transition.split(' → ')
    if (from && to) {
      const text = `${bookingStatusLabel(from)} ← ${bookingStatusLabel(to)}`
      return reason.length ? `${text} — ${reason.join(' — ')}` : text
    }
  }

  if (row.action === 'user.role') {
    const [from, to] = details.split(' → ')
    if (from && to) return `${roleLabel(from)} ← ${roleLabel(to)}`
  }

  return details
}

/** A log row's summary in Arabic, where the server wrote it in English. */
export function activitySummary(row) {
  const summary = row?.summary
  if (!summary) return '—'

  if (row.action?.startsWith('report.')) {
    const [type, reason] = summary.split(': ')
    if (type && reason) {
      return `${REPORT_TARGET_TYPES_AR[type] || type}: ${REPORT_REASONS_AR[reason] || reason}`
    }
  }

  if (row.action === 'listing.import') {
    const count = /^(\d+) listings imported$/.exec(summary)
    if (count) return `استيراد ${count[1]} مكان`
  }

  // A support change to a booking whose place or service is gone.
  if (row.action?.startsWith('booking.') && summary.startsWith('booking - ')) {
    return `حجز - ${summary.slice('booking - '.length)}`
  }

  return summary
}

// Day keys are the lowercase English names on purpose: getAvailableSlots in
// convex/bookings/queries.ts matches them against JS getDay(). Arabic is display
// only — translating the stored key would silently break slot generation.
export const WEEK_DAYS = [
  { key: 'sunday', label: 'الأحد' },
  { key: 'monday', label: 'الإثنين' },
  { key: 'tuesday', label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday', label: 'الخميس' },
  { key: 'friday', label: 'الجمعة' },
  { key: 'saturday', label: 'السبت' },
]

// Arabic-Indic digits read badly next to the Latin numerals used everywhere else
// in this panel (ids, coordinates, prices), so dates use the Latin-digit locale.
const DATE_LOCALE = 'ar-SA-u-nu-latn'

export function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString(DATE_LOCALE, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

export function formatDateTime(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString(DATE_LOCALE, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function formatRelative(ts) {
  if (!ts) return '—'
  const minutes = Math.round((Date.now() - ts) / 60000)
  if (minutes < 1) return 'الآن'
  if (minutes < 60) return `قبل ${minutes} دقيقة`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `قبل ${hours} ساعة`
  const days = Math.round(hours / 24)
  if (days < 30) return `قبل ${days} يوم`
  return formatDate(ts)
}

/**
 * A count with its noun in the right Arabic form: "ليلة واحدة", "ليلتان",
 * "3 ليالٍ", "11 ليلة". `forms` is [one, two, few (3–10), many (11+)].
 */
export function arCount(n, [one, two, few, many]) {
  if (n === 1) return one
  if (n === 2) return two
  const mod = n % 100
  if (mod >= 3 && mod <= 10) return `${n} ${few}`
  return `${n} ${many}`
}

export const NIGHTS = ['ليلة واحدة', 'ليلتان', 'ليالٍ', 'ليلة']
export const GUESTS = ['ضيف واحد', 'ضيفان', 'ضيوف', 'ضيفًا']
export const PEOPLE = ['شخص واحد', 'شخصان', 'أشخاص', 'شخصًا']
export const HOURS = ['ساعة واحدة', 'ساعتان', 'ساعات', 'ساعة']
export const DAYS = ['يوم واحد', 'يومان', 'أيام', 'يومًا']

// Riyadh, not UTC. The panel groups bookings into today / upcoming / past
// against dates the backend writes in Saudi time, so a plain toISOString here
// would move a booking into "past" three hours before the day actually ends
// for the guest standing in the lobby.
export const todayISO = () =>
  new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().split('T')[0]

/** "2026-09-10" → "10 سبتمبر", Latin digits to match the ids and prices around it. */
export function formatISODate(iso) {
  if (!iso) return '—'
  try {
    return new Date(`${iso}T00:00:00Z`).toLocaleDateString(DATE_LOCALE, {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  } catch {
    return iso
  }
}

// The amenities a listing can carry, as a closed list.
//
// The keys must stay identical to `hasio-mobile-app/constants/amenities.ts`:
// the app looks the stored key up there to draw an icon and the guest's own
// language beside it, and a key only this file knows about falls back to being
// printed raw. Add to both files or to neither. The English label is not needed
// here — this panel is Arabic-only.
export const AMENITIES = [
  { key: 'wifi', label: 'واي فاي' },
  { key: 'parking', label: 'موقف سيارات' },
  { key: 'ac', label: 'تكييف' },
  { key: 'breakfast', label: 'إفطار' },
  { key: 'restaurant', label: 'مطعم' },
  { key: 'pool', label: 'مسبح' },
  { key: 'gym', label: 'نادي رياضي' },
  { key: 'tv', label: 'تلفاز' },
  { key: 'laundry', label: 'خدمة غسيل' },
  { key: 'room_service', label: 'خدمة الغرف' },
  { key: 'reception_24h', label: 'استقبال ٢٤ ساعة' },
  { key: 'elevator', label: 'مصعد' },
  { key: 'family_rooms', label: 'غرف عائلية' },
  { key: 'prayer_room', label: 'مصلى' },
  { key: 'kitchen', label: 'مطبخ صغير' },
  { key: 'airport_shuttle', label: 'نقل من المطار' },
  { key: 'garden', label: 'حديقة أو تراس' },
  { key: 'non_smoking', label: 'غرف لغير المدخنين' },
]

export const AMENITY_LABELS = Object.fromEntries(AMENITIES.map(a => [a.key, a.label]))

export function formatMoney(amount, currency = 'ر.س') {
  if (amount === undefined || amount === null) return '—'
  return `${Number(amount).toLocaleString('en-US')} ${currency}`
}
