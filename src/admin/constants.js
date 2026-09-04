// Shared lookups for the admin panel. These used to be duplicated inside
// individual tabs (the city list three times, type labels four times), which is
// how the pending-accounts tab ended up labelling `businessType` with the
// listing category list.

// Al-Ahsa governorate only — Hasio is not a nationwide guide.
export const CITIES = [
  'Hofuf', 'Mubarraz', 'Al Oyoun', 'Al Omran', 'Al Jafer',
  'Al Battaliyah', 'Al Taraf', 'Al Shuqaiq', 'Al Qarah', 'Al Kilabiyah',
  'Al Jishshah', 'Al Fudhool', 'Al Marah', 'Al Hulaila', 'Al Salhiyah',
]

export const CITY_LABELS = {
  'Hofuf': 'الهفوف',
  'Mubarraz': 'المبرز',
  'Al Oyoun': 'العيون',
  'Al Omran': 'العمران',
  'Al Jafer': 'الجفر',
  'Al Battaliyah': 'البطالية',
  'Al Taraf': 'الطرف',
  'Al Shuqaiq': 'الشقيق',
  'Al Qarah': 'القارة',
  'Al Kilabiyah': 'الكلابية',
  'Al Jishshah': 'الجشة',
  'Al Fudhool': 'الفضول',
  'Al Marah': 'المراح',
  'Al Hulaila': 'الحليلة',
  'Al Salhiyah': 'الصالحية',
}

export const cityLabel = (city) => CITY_LABELS[city] || city || '—'

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

export const ROLE_LABELS = {
  tourist: 'سائح',
  business_owner: 'صاحب عمل',
  service_provider: 'مزود خدمة',
  admin: 'مدير',
}

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
  listing: 'إعلان',
  service: 'خدمة',
  review: 'تقييم',
}

export const REPORT_STATUSES = [
  { value: 'pending', label: 'معلقة' },
  { value: 'actioned', label: 'تم اتخاذ إجراء' },
  { value: 'dismissed', label: 'مرفوضة' },
  { value: 'reviewed', label: 'تمت المراجعة' },
]

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

// A listing's review state. "seed" is not a stored value — it is the absence
// of one, which is how the original Al-Ahsa data is distinguished from
// anything a host submitted.
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

export const PRICE_RANGES = [
  { value: '$', label: '$ اقتصادي' },
  { value: '$$', label: '$$ متوسط' },
  { value: '$$$', label: '$$$ مرتفع' },
  { value: '$$$$', label: '$$$$ فاخر' },
]

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

export function formatMoney(amount, currency = 'ر.س') {
  if (amount === undefined || amount === null) return '—'
  return `${Number(amount).toLocaleString('en-US')} ${currency}`
}
