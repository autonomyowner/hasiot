import type { Feather } from "@expo/vector-icons";
import type { Language } from "@/types";

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * The amenities a host can switch on, as a fixed list.
 *
 * It used to be free text: the posting form took a comma-separated line in each
 * language and split it, so "WiFi", "wi-fi" and "واي فاي" were three different
 * amenities and the detail sheet had to guess an icon by keyword. A closed list
 * means the guest sees the same words on every listing, the icon is exact, and
 * the Arabic label is not something each host has to type again.
 *
 * The label lives here rather than in `translations.ts` on purpose: a key, its
 * icon and its two labels are one fact, and splitting them across two files is
 * how they drift. Nothing else in the app needs these strings.
 *
 * Order is the order they are offered in and shown in — roughly what a guest
 * asks about first.
 */
export const AMENITIES = [
  { key: "wifi", icon: "wifi", en: "Wi-Fi", ar: "واي فاي" },
  { key: "parking", icon: "truck", en: "Parking", ar: "موقف سيارات" },
  { key: "ac", icon: "wind", en: "Air conditioning", ar: "تكييف" },
  { key: "breakfast", icon: "sunrise", en: "Breakfast", ar: "إفطار" },
  { key: "restaurant", icon: "coffee", en: "Restaurant", ar: "مطعم" },
  { key: "pool", icon: "droplet", en: "Swimming pool", ar: "مسبح" },
  { key: "gym", icon: "activity", en: "Gym", ar: "نادي رياضي" },
  { key: "tv", icon: "tv", en: "TV", ar: "تلفاز" },
  { key: "laundry", icon: "refresh-cw", en: "Laundry", ar: "خدمة غسيل" },
  { key: "room_service", icon: "bell", en: "Room service", ar: "خدمة الغرف" },
  { key: "reception_24h", icon: "clock", en: "24-hour reception", ar: "استقبال ٢٤ ساعة" },
  { key: "elevator", icon: "chevrons-up", en: "Elevator", ar: "مصعد" },
  { key: "family_rooms", icon: "users", en: "Family rooms", ar: "غرف عائلية" },
  { key: "prayer_room", icon: "moon", en: "Prayer room", ar: "مصلى" },
  { key: "kitchen", icon: "box", en: "Kitchenette", ar: "مطبخ صغير" },
  { key: "airport_shuttle", icon: "navigation", en: "Airport shuttle", ar: "نقل من المطار" },
  { key: "garden", icon: "sun", en: "Garden or terrace", ar: "حديقة أو تراس" },
  { key: "non_smoking", icon: "slash", en: "Non-smoking rooms", ar: "غرف لغير المدخنين" },
] as const satisfies readonly {
  key: string;
  icon: FeatherName;
  en: string;
  ar: string;
}[];

export type AmenityKey = (typeof AMENITIES)[number]["key"];

const BY_KEY = new Map(AMENITIES.map((amenity) => [amenity.key, amenity]));

/**
 * Keyword match for anything not on the list.
 *
 * Listings created before the toggles, and anything an admin types by hand,
 * still carry free text — in either language and any case. Order matters: the
 * list is scanned top to bottom and the first hit wins, so the narrower
 * patterns sit above the ones that would otherwise swallow them (breakfast
 * before restaurant, both of which are coffee-ish).
 */
const RULES: { match: RegExp; icon: FeatherName }[] = [
  { match: /wi-?fi|internet|wireless|واي ?فاي|إنترنت|انترنت|شبكة/i, icon: "wifi" },
  { match: /park|garage|valet|موقف|مواقف|مرآب|جراج/i, icon: "truck" },
  { match: /pool|swim|مسبح|سباحة/i, icon: "droplet" },
  { match: /breakfast|فطور|إفطار/i, icon: "sunrise" },
  { match: /restaurant|dining|cafe|coffee|مطعم|مقهى|كافيه/i, icon: "coffee" },
  { match: /air ?con|a\/c|\bac\b|conditioning|تكييف|مكيف/i, icon: "wind" },
  { match: /gym|fitness|sport|نادي|رياض|لياقة/i, icon: "activity" },
  { match: /\btv\b|television|screen|تلفاز|تلفزيون|شاشة/i, icon: "tv" },
  { match: /laundry|dry ?clean|غسيل|مغسلة|كوي/i, icon: "refresh-cw" },
  { match: /elevator|lift|مصعد/i, icon: "chevrons-up" },
  { match: /security|guard|cctv|أمن|حراسة|مراقبة/i, icon: "shield" },
  { match: /family|kid|child|عائل|أطفال|اطفال/i, icon: "users" },
  { match: /pet|حيوان/i, icon: "heart" },
  { match: /no[- ]?smok|منع التدخين|ممنوع التدخين/i, icon: "slash" },
  { match: /garden|terrace|outdoor|balcon|حديقة|شرفة|تراس/i, icon: "sun" },
  { match: /view|sea|beach|إطلالة|بحر|شاطئ/i, icon: "eye" },
  { match: /prayer|mosque|مصلى|مسجد/i, icon: "moon" },
  { match: /kitchen|kitchenette|مطبخ/i, icon: "box" },
  { match: /shuttle|airport|مطار|نقل/i, icon: "navigation" },
  { match: /24|round the clock|على مدار/i, icon: "clock" },
];

/**
 * `check` is the fallback rather than nothing: an amenity the list does not
 * recognise is still a real amenity, and a chip with no icon beside chips that
 * have one reads as broken rather than as unknown.
 */
export function amenityIcon(amenity: string): FeatherName {
  const value = amenity.trim();
  const known = BY_KEY.get(value as AmenityKey);
  if (known) return known.icon;

  for (const rule of RULES) {
    if (rule.match.test(value)) return rule.icon;
  }
  return "check";
}

/**
 * What to draw for one stored amenity: a label in the reader's language and the
 * icon beside it. A stored value that is not one of the keys is shown as it was
 * written — it is the host's own words, and translating them is not ours to do.
 */
export function resolveAmenity(
  amenity: string,
  language: Language
): { icon: FeatherName; label: string } {
  const value = amenity.trim();
  const known = BY_KEY.get(value as AmenityKey);
  if (known) {
    return { icon: known.icon, label: language === "ar" ? known.ar : known.en };
  }
  return { icon: amenityIcon(value), label: value };
}
