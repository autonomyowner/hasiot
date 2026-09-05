import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";

/**
 * Real Eastern Province hotels for the Lodging tab.
 *
 * Sourced from the hotels' own sites, at the owner's request:
 *   razanahotelaljubail.com, tamayahotel.com, radissonhotels.com
 *
 * Three things are deliberately missing, and all three are the same decision —
 * publish what the source actually says and nothing more:
 *
 * 1. NO `pricePerNight`. None of the three publishes a nightly rate; they all
 *    quote through a date-based booking engine. `isBookableStay` gates on that
 *    field, so these appear in the directory with their real phone number and
 *    website and no Book button. That is the honest state for a hotel that has
 *    not agreed to sell rooms through Hasio — a Hasio booking reaches nobody
 *    until the listing has a host. Set rates from the admin panel once there is
 *    an agreement.
 *
 * 2. The five Radisson properties carry no photographs, phone or website.
 *    radissonhotels.com returns 403 to automated requests, and working around
 *    an explicit block to take a company's images is not something to do
 *    quietly. Their names, cities and descriptions are public facts and are
 *    enough to list them.
 *
 * 3. Tamaya's phone number came back mangled from the page (two different
 *    numbers in one field) and its published email belongs to the web agency,
 *    not the front desk. Both omitted rather than guessed — a wrong phone
 *    number on a hotel listing sends a guest to a stranger.
 *
 * Coordinates are city centres, except Half Moon Bay which is known. These are
 * street addresses without a geocoder, so the pin lands in the right city and
 * the address line carries the rest. Do not upgrade this to a guessed pin.
 */

type HotelSeed = {
  name_en: string;
  name_ar: string;
  category: string;
  category_ar: string;
  address: string;
  city: string;
  coordinates: { lat: number; lng: number };
  phone?: string;
  email?: string;
  website?: string;
  priceRange?: string;
  amenities?: string[];
  description_en: string;
  description_ar: string;
};

const JUBAIL = { lat: 27.0174, lng: 49.6225 };
const KHOBAR = { lat: 26.2794, lng: 50.2083 };
const DAMMAM = { lat: 26.4207, lng: 50.0888 };
const HALF_MOON_BAY = { lat: 26.14, lng: 50.16 };

const HOTELS: HotelSeed[] = [
  {
    name_en: "Razana Hotel Al Jubail",
    name_ar: "فندق رزانة الجبيل",
    category: "resort", category_ar: "منتجع",
    address: "8204 King Faisal Ibn Abd Al Aziz Road, Al Jubail 31482",
    city: "Jubail",
    coordinates: JUBAIL,
    phone: "+966 56 544 2502",
    email: "sales.jubail@razanahotels.com",
    website: "https://razanahotelaljubail.com",
    priceRange: "$$$",
    amenities: ["restaurant", "pool", "gym", "ac", "family_rooms", "elevator", "non_smoking"],
    description_en: "A seafront hotel with direct beach access, sea-view suites, an indoor pool, spa and fitness centre, and its own restaurant.",
    description_ar: "فندق على الواجهة البحرية بمدخل مباشر إلى الشاطئ، وأجنحة تطل على البحر، ومسبح داخلي وسبا وصالة رياضية ومطعم خاص به.",
  },
  {
    name_en: "Tamaya Hotel Al Khobar",
    name_ar: "فندق تمايا الخبر",
    category: "mid_range_hotel", category_ar: "فندق متوسط",
    address: "Al Mshorah Street, Al Aqrabiyah, Al Khobar 34446",
    city: "Al Khobar",
    coordinates: KHOBAR,
    website: "https://www.tamayahotel.com",
    priceRange: "$$",
    amenities: ["wifi", "parking", "breakfast", "pool", "family_rooms"],
    description_en: "Seventy-two rooms in the quiet Al Aqrabiyah district, a short drive from the corniche. Soundproofed windows, rain showers, a breakfast cafe and an indoor pool.",
    description_ar: "اثنتان وسبعون غرفة في حي العقربية الهادئ، على مسافة قصيرة من الكورنيش. نوافذ عازلة للصوت ودشات مطرية ومقهى للإفطار ومسبح داخلي.",
  },
  {
    name_en: "Radisson Blu Hotel Dhahran",
    name_ar: "فندق راديسون بلو الظهران",
    category: "business_hotel", category_ar: "فندق أعمال",
    address: "Dhahran business district, Al Khobar",
    city: "Al Khobar",
    coordinates: KHOBAR,
    priceRange: "$$$",
    description_en: "Eighty-two rooms and suites in the Dhahran business district, within reach of the Aramco headquarters and greater Dammam.",
    description_ar: "اثنتان وثمانون غرفة وجناحاً في حي الأعمال بالظهران، على مقربة من مقر أرامكو ومنطقة الدمام الكبرى.",
  },
  {
    name_en: "Radisson Blu Residence Dhahran",
    name_ar: "راديسون بلو ريزيدنس الظهران",
    category: "business_hotel", category_ar: "فندق أعمال",
    address: "Aramco business district, Dhahran, Al Khobar",
    city: "Al Khobar",
    coordinates: KHOBAR,
    priceRange: "$$$",
    amenities: ["kitchen"],
    description_en: "Ninety-two serviced apartments in the Aramco business district — a kitchen and a sitting room, with a hotel front desk.",
    description_ar: "اثنتان وتسعون شقة مخدومة في حي أرامكو للأعمال — مطبخ وصالة، مع خدمات استقبال فندقية.",
  },
  {
    name_en: "Radisson Blu Resort, Al Khobar Half Moon Bay",
    name_ar: "منتجع راديسون بلو الخبر نصف القمر",
    category: "resort", category_ar: "منتجع",
    address: "Half Moon Bay, Sahtei Nesf Al Qamar 31952, Al Khobar",
    city: "Al Khobar",
    coordinates: HALF_MOON_BAY,
    website: "https://www.radissonhotels.com/en-us/hotels/radisson-blu-resort-al-khobar-half-moon-bay",
    priceRange: "$$$$",
    amenities: ["pool", "restaurant", "prayer_room", "family_rooms"],
    description_en: "On the shore of Half Moon Bay with direct beach access: an outdoor pool, separate spas for men and women, children's facilities and a prayer room.",
    description_ar: "على شاطئ خليج نصف القمر بمدخل مباشر إلى البحر: مسبح خارجي، وسبا منفصل للرجال والنساء، ومرافق للأطفال ومصلى.",
  },
  {
    name_en: "Park Inn by Radisson Jubail Industrial City",
    name_ar: "بارك إن باي راديسون الجبيل الصناعية",
    category: "business_hotel", category_ar: "فندق أعمال",
    address: "Jubail Industrial City, near Fanateer",
    city: "Jubail",
    coordinates: JUBAIL,
    priceRange: "$$",
    description_en: "Eight hundred metres from the sea and the Fanateer beach district, on the edge of the industrial city.",
    description_ar: "على بعد ثمانمئة متر من البحر وحي الفناتير الشاطئي، على أطراف المدينة الصناعية.",
  },
  {
    name_en: "Radisson Hotel & Apartments Dammam Industrial City",
    name_ar: "فندق وشقق راديسون الدمام الصناعية",
    category: "business_hotel", category_ar: "فندق أعمال",
    address: "Dammam Industrial City",
    city: "Dammam",
    coordinates: DAMMAM,
    priceRange: "$$",
    amenities: ["kitchen"],
    description_en: "Rooms and apartments built for longer stays in the Dammam industrial city.",
    description_ar: "غرف وشقق مهيأة للإقامات الطويلة في مدينة الدمام الصناعية.",
  },
];

export const seedHotels = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("listings").collect();
    const taken = new Set(existing.map((l) => l.name_en));
    const now = Date.now();

    let inserted = 0;
    const skipped: string[] = [];

    for (const hotel of HOTELS) {
      if (taken.has(hotel.name_en)) {
        skipped.push(hotel.name_en);
        continue;
      }
      await ctx.db.insert("listings", {
        ...hotel,
        type: "hotel",
        region: "Eastern Province",
        reviewCount: 0,
        isVerified: true,
        isActive: true,
        languages: ["ar", "en"],
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }

    return { inserted, skipped };
  },
});

/**
 * Move a listing to a different city.
 *
 * Half Moon Bay was seeded under Dammam; every source places it at Dhahran,
 * which this app folds into Al Khobar, and the resort on its shore is filed
 * there. A landmark and the hotel on it must not sit in two different cities.
 */
export const setListingCity = internalMutation({
  args: { name_en: v.string(), city: v.string() },
  handler: async (ctx, args) => {
    const listings = await ctx.db.query("listings").collect();
    const listing = listings.find((l) => l.name_en === args.name_en);
    if (!listing) return { moved: false, reason: "not found" };

    await ctx.db.patch(listing._id, { city: args.city, updatedAt: Date.now() });
    return { moved: true, from: listing.city, to: args.city };
  },
});

/** Raw census: every listing by city and status, ignoring the public filter. */
export const listingCensus = internalQuery({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    const byCity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const hidden: string[] = [];

    for (const l of listings) {
      byCity[l.city] = (byCity[l.city] ?? 0) + 1;
      const s = l.status ?? "(none)";
      byStatus[s] = (byStatus[s] ?? 0) + 1;
      if (l.isActive === false || (l.status && l.status !== "approved")) {
        hidden.push(`${l.name_en} [${l.city}] status=${l.status ?? "-"} active=${l.isActive}`);
      }
    }
    return { total: listings.length, byCity, byStatus, hidden };
  },
});
