import type { Language } from "@/types";

/**
 * What a listing's `category` key reads as.
 *
 * The database stores keys — `natural_landmark`, `traditional_food` — and the
 * cards used to print them as they came: the chip on a Featured card read
 * "natural_landmark" in English, and a place an owner posted showed the
 * English key in Arabic too, because only the seed carries `category_ar`.
 *
 * The keys are the union of what the seed writes (convex/listings/mutations.ts),
 * what the admin panel offers (src/admin/constants.js, CATEGORIES) and what the
 * owner's destination form sends. The Arabic follows the admin panel's labels,
 * so the website and the app name a place's kind the same way.
 */
const LABELS: Record<string, { en: string; ar: string }> = {
  // Stays
  luxury_hotel: { en: "Luxury hotel", ar: "فندق فاخر" },
  business_hotel: { en: "Business hotel", ar: "فندق أعمال" },
  mid_range_hotel: { en: "Mid-range hotel", ar: "فندق متوسط" },
  budget_hotel: { en: "Budget hotel", ar: "فندق اقتصادي" },
  boutique_hotel: { en: "Boutique hotel", ar: "فندق بوتيك" },
  resort: { en: "Resort", ar: "منتجع" },
  // Food
  traditional_food: { en: "Traditional food", ar: "مطبخ تقليدي" },
  fine_dining: { en: "Fine dining", ar: "مطعم فاخر" },
  seafood: { en: "Seafood", ar: "مأكولات بحرية" },
  international: { en: "International", ar: "عالمي" },
  fast_food: { en: "Fast food", ar: "وجبات سريعة" },
  cafe: { en: "Café", ar: "مقهى" },
  market: { en: "Market", ar: "سوق" },
  // Places, tours and events
  historical_site: { en: "Historic site", ar: "موقع تاريخي" },
  museum: { en: "Museum", ar: "متحف" },
  natural_landmark: { en: "Natural landmark", ar: "معلم طبيعي" },
  entertainment: { en: "Entertainment", ar: "ترفيه" },
  cultural_tour: { en: "Cultural tour", ar: "جولة ثقافية" },
  adventure: { en: "Adventure", ar: "مغامرة" },
  seasonal_event: { en: "Seasonal event", ar: "فعالية موسمية" },
  // The owner's destination form
  historical: { en: "Historical", ar: "تاريخي" },
  natural: { en: "Natural", ar: "طبيعي" },
  cultural: { en: "Cultural", ar: "ثقافي" },
  recreational: { en: "Recreational", ar: "ترفيهي" },
  religious: { en: "Religious", ar: "ديني" },
};

/**
 * A category key as a reader should see it. A key nobody has labelled yet
 * still reads as words — "night_market" becomes "Night market" — rather than
 * as a database identifier; in Arabic the stored `category_ar` is preferred
 * when there is one, since it came from a person.
 */
export function categoryLabel(
  key: string | undefined,
  language: Language,
  storedArabic?: string
): string {
  if (!key) return "";
  const known = LABELS[key];
  if (language === "ar") {
    return storedArabic || known?.ar || humanize(key);
  }
  return known?.en ?? humanize(key);
}

function humanize(key: string): string {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
