import type { Feather } from "@expo/vector-icons";

type FeatherName = keyof typeof Feather.glyphMap;

/**
 * Pick an icon for an amenity string.
 *
 * Amenities are free text, not an enum: the posting form takes a
 * comma-separated line and splits it (`post-lodging.tsx`), so a host types
 * whatever they like, in either language, in whatever case. There is nothing
 * to look up against — hence keyword matching over both scripts rather than a
 * table of known keys.
 *
 * Order matters. The list is scanned top to bottom and the first hit wins, so
 * the narrower patterns sit above the ones that would otherwise swallow them
 * (breakfast before restaurant, both of which are coffee-ish).
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
  { match: /24|round the clock|على مدار/i, icon: "clock" },
];

/**
 * `check` is the fallback rather than nothing: an amenity the list does not
 * recognise is still a real amenity, and a chip with no icon beside chips that
 * have one reads as broken rather than as unknown.
 */
export function amenityIcon(amenity: string): FeatherName {
  const value = amenity.trim();
  for (const rule of RULES) {
    if (rule.match.test(value)) return rule.icon;
  }
  return "check";
}
