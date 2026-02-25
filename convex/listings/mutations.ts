import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Create a new listing
export const createListing = mutation({
  args: {
    type: v.string(),
    name_en: v.string(),
    name_ar: v.string(),
    category: v.string(),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    region: v.optional(v.string()),
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    workingHours: v.optional(
      v.array(
        v.object({
          day: v.string(),
          open: v.string(),
          close: v.string(),
          isClosed: v.optional(v.boolean()),
        })
      )
    ),
    languages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const listingId = await ctx.db.insert("listings", {
      ...args,
      rating: 0,
      reviewCount: 0,
      isVerified: false,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return listingId;
  },
});

// Update a listing
export const updateListing = mutation({
  args: {
    listingId: v.id("listings"),
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    category: v.optional(v.string()),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      })
    ),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    workingHours: v.optional(
      v.array(
        v.object({
          day: v.string(),
          open: v.string(),
          close: v.string(),
          isClosed: v.optional(v.boolean()),
        })
      )
    ),
    languages: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { listingId, ...updates } = args;

    const listing = await ctx.db.get(listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    const filteredUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(listingId, filteredUpdates);

    return { success: true };
  },
});

// Add a review for a listing
export const addReview = mutation({
  args: {
    listingId: v.id("listings"),
    bookingId: v.optional(v.id("bookings")),
    rating: v.number(),
    content: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    let isVerified = false;
    if (args.bookingId) {
      const booking = await ctx.db.get(args.bookingId);
      if (booking && booking.userId === user._id && booking.status === "completed") {
        isVerified = true;
      }
    }

    const reviewId = await ctx.db.insert("reviews", {
      userId: user._id,
      listingId: args.listingId,
      bookingId: args.bookingId,
      rating: args.rating,
      content: args.content,
      isAnonymous: args.isAnonymous || false,
      isVerified,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await updateListingRating(ctx, args.listingId);

    return reviewId;
  },
});

// Internal function to update listing's average rating
async function updateListingRating(ctx: { db: any }, listingId: string) {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_listingId", (q: any) => q.eq("listingId", listingId))
    .collect();

  if (reviews.length === 0) {
    return;
  }

  const totalRating = reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0);
  const avgRating = totalRating / reviews.length;

  await ctx.db.patch(listingId, {
    rating: Math.round(avgRating * 10) / 10,
    reviewCount: reviews.length,
    updatedAt: Date.now(),
  });
}

// Save listing's working hours
export const saveWorkingHours = mutation({
  args: {
    listingId: v.id("listings"),
    workingHours: v.array(
      v.object({
        day: v.string(),
        open: v.string(),
        close: v.string(),
        isClosed: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    await ctx.db.patch(args.listingId, {
      workingHours: args.workingHours,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Seed listings with Saudi Arabia data
export const seedListings = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Clear existing listings
    const existing = await ctx.db.query("listings").collect();
    for (const listing of existing) {
      await ctx.db.delete(listing._id);
    }

    const now = Date.now();

    const listings = [
      // === HOTELS - Riyadh (10) ===
      { type: "hotel", name_en: "The Ritz-Carlton Riyadh", name_ar: "فندق ريتز كارلتون الرياض", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Al Hada Area, Mekkah Road", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6295, lng: 46.6907 }, phone: "+966 11 802 8020", priceRange: "$$$$", rating: 4.8, description_en: "Iconic luxury hotel set within 52 acres of landscaped gardens", description_ar: "فندق فاخر أيقوني يقع في 52 فدانا من الحدائق" },
      { type: "hotel", name_en: "Four Seasons Hotel Riyadh", name_ar: "فندق فور سيزونز الرياض", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Kingdom Centre, King Fahad Road", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7113, lng: 46.6745 }, phone: "+966 11 211 5000", priceRange: "$$$$", rating: 4.7, description_en: "Located in the iconic Kingdom Centre tower", description_ar: "يقع في برج المملكة الشهير" },
      { type: "hotel", name_en: "Marriott Hotel Riyadh", name_ar: "فندق ماريوت الرياض", category: "business_hotel", category_ar: "فندق أعمال", address: "King Saud Road, Al Murabba", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6369, lng: 46.7200 }, phone: "+966 11 477 9300", priceRange: "$$$", rating: 4.3, description_en: "Premium business hotel in the heart of Riyadh", description_ar: "فندق أعمال متميز في قلب الرياض" },
      { type: "hotel", name_en: "Hilton Riyadh Hotel & Residences", name_ar: "فندق هيلتون الرياض", category: "business_hotel", category_ar: "فندق أعمال", address: "King Fahad Road", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6908, lng: 46.6853 }, phone: "+966 11 481 0000", priceRange: "$$$", rating: 4.4, description_en: "Modern hotel with panoramic city views", description_ar: "فندق عصري بإطلالات بانورامية على المدينة" },
      { type: "hotel", name_en: "Hyatt Regency Riyadh Olaya", name_ar: "حياة ريجنسي الرياض العليا", category: "business_hotel", category_ar: "فندق أعمال", address: "King Fahad Road, Olaya", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6944, lng: 46.6850 }, phone: "+966 11 241 1234", priceRange: "$$$", rating: 4.2, description_en: "Upscale hotel in Riyadh's commercial district", description_ar: "فندق راقي في حي الأعمال" },
      { type: "hotel", name_en: "Novotel Riyadh Al Anoud", name_ar: "نوفوتيل الرياض العنود", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "King Fahd Road, Al Olaya", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6830, lng: 46.6840 }, phone: "+966 11 466 0088", priceRange: "$$", rating: 4.0, description_en: "Comfortable mid-range hotel in central Riyadh", description_ar: "فندق مريح في وسط الرياض" },
      { type: "hotel", name_en: "Holiday Inn Riyadh Izdihar", name_ar: "هوليداي إن الرياض إزدهار", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "Al Izdihar, Northern Ring Road", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7580, lng: 46.6510 }, phone: "+966 11 454 8000", priceRange: "$$", rating: 3.9, description_en: "Affordable comfort near shopping areas", description_ar: "راحة بأسعار معقولة بالقرب من مناطق التسوق" },
      { type: "hotel", name_en: "Narcissus Hotel & Spa Riyadh", name_ar: "فندق ومنتجع نرجس الرياض", category: "boutique_hotel", category_ar: "فندق بوتيك", address: "Olaya Street", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6921, lng: 46.6856 }, phone: "+966 11 282 2888", priceRange: "$$$", rating: 4.5, description_en: "Boutique luxury hotel with world-class spa", description_ar: "فندق بوتيك فاخر مع سبا عالمي" },
      { type: "hotel", name_en: "Centro Waha by Rotana", name_ar: "سنترو واحة من روتانا", category: "budget_hotel", category_ar: "فندق اقتصادي", address: "Olaya District", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6900, lng: 46.6780 }, phone: "+966 11 230 5555", priceRange: "$", rating: 3.8, description_en: "Smart budget hotel for business travelers", description_ar: "فندق اقتصادي ذكي لرجال الأعمال" },
      { type: "hotel", name_en: "Al Faisaliah Hotel", name_ar: "فندق الفيصلية", category: "luxury_hotel", category_ar: "فندق فاخر", address: "King Fahad Road, Al Faisaliah District", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6906, lng: 46.6855 }, phone: "+966 11 273 2000", priceRange: "$$$$", rating: 4.6, description_en: "Landmark hotel in the iconic Al Faisaliah Tower", description_ar: "فندق بارز في برج الفيصلية الشهير" },

      // === HOTELS - Jeddah (8) ===
      { type: "hotel", name_en: "Park Hyatt Jeddah", name_ar: "بارك حياة جدة", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Al Hamra District, Corniche", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5425, lng: 39.1529 }, phone: "+966 12 231 1234", priceRange: "$$$$", rating: 4.7, description_en: "Luxury beachfront hotel on the Jeddah Corniche", description_ar: "فندق فاخر على واجهة كورنيش جدة" },
      { type: "hotel", name_en: "Rosewood Jeddah", name_ar: "روزوود جدة", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Al Andalus Road", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5368, lng: 39.1723 }, phone: "+966 12 263 6666", priceRange: "$$$$", rating: 4.6, description_en: "Ultra-luxury hotel with Red Sea views", description_ar: "فندق فائق الفخامة بإطلالات على البحر الأحمر" },
      { type: "hotel", name_en: "Waldorf Astoria Jeddah Qasr Al Sharq", name_ar: "والدورف أستوريا جدة قصر الشرق", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Corniche Road", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5219, lng: 39.1557 }, phone: "+966 12 692 2222", priceRange: "$$$$", rating: 4.5, description_en: "Palatial luxury on Jeddah's waterfront", description_ar: "فخامة قصر على واجهة جدة البحرية" },
      { type: "hotel", name_en: "Jeddah Hilton Hotel", name_ar: "فندق جدة هيلتون", category: "business_hotel", category_ar: "فندق أعمال", address: "Al Corniche Road", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5480, lng: 39.1500 }, phone: "+966 12 214 5000", priceRange: "$$$", rating: 4.2, description_en: "Established hotel on the Jeddah Corniche", description_ar: "فندق عريق على كورنيش جدة" },
      { type: "hotel", name_en: "Radisson Blu Hotel Jeddah", name_ar: "راديسون بلو جدة", category: "business_hotel", category_ar: "فندق أعمال", address: "Al Corniche Road", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5300, lng: 39.1600 }, phone: "+966 12 231 6000", priceRange: "$$$", rating: 4.1, description_en: "Modern hotel near the waterfront", description_ar: "فندق عصري بالقرب من الواجهة البحرية" },
      { type: "hotel", name_en: "Elaf Jeddah Hotel", name_ar: "فندق إيلاف جدة", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "Palestine Street", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5195, lng: 39.1867 }, phone: "+966 12 665 2000", priceRange: "$$", rating: 3.9, description_en: "Well-located hotel for Umrah travelers", description_ar: "فندق بموقع متميز لزوار العمرة" },
      { type: "hotel", name_en: "Swiss-Belhotel Jeddah", name_ar: "سويس بل هوتيل جدة", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "Al Madinah Road", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5100, lng: 39.1900 }, phone: "+966 12 697 7222", priceRange: "$$", rating: 3.8, description_en: "Comfortable hotel near Jeddah's attractions", description_ar: "فندق مريح بالقرب من معالم جدة" },
      { type: "hotel", name_en: "Makarem Annakheel Hotel & Resort", name_ar: "فندق ومنتجع مكارم النخيل", category: "resort", category_ar: "منتجع", address: "Corniche Road", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5380, lng: 39.1460 }, phone: "+966 12 264 0000", priceRange: "$$$", rating: 4.3, description_en: "Resort-style hotel on Jeddah's Corniche", description_ar: "فندق منتجعي على كورنيش جدة" },

      // === HOTELS - Mecca (4) ===
      { type: "hotel", name_en: "Raffles Makkah Palace", name_ar: "رافلز قصر مكة", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Abraj Al-Bait, King Abdul Aziz Endowment", city: "Mecca", region: "Makkah", coordinates: { lat: 21.4186, lng: 39.8256 }, phone: "+966 12 571 6666", priceRange: "$$$$", rating: 4.8, description_en: "Ultra-luxury hotel overlooking the Grand Mosque", description_ar: "فندق فائق الفخامة يطل على المسجد الحرام" },
      { type: "hotel", name_en: "Swissotel Makkah", name_ar: "سويس أوتيل مكة", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Abraj Al-Bait Complex", city: "Mecca", region: "Makkah", coordinates: { lat: 21.4180, lng: 39.8260 }, phone: "+966 12 571 8000", priceRange: "$$$$", rating: 4.6, description_en: "Premium hotel steps from the Haram", description_ar: "فندق متميز على بعد خطوات من الحرم" },
      { type: "hotel", name_en: "Hilton Suites Makkah", name_ar: "هيلتون سويتس مكة", category: "business_hotel", category_ar: "فندق أعمال", address: "Jabal Omar", city: "Mecca", region: "Makkah", coordinates: { lat: 21.4170, lng: 39.8220 }, phone: "+966 12 557 1111", priceRange: "$$$", rating: 4.3, description_en: "Modern suites near the Grand Mosque", description_ar: "أجنحة عصرية بالقرب من المسجد الحرام" },
      { type: "hotel", name_en: "Dar Al Tawhid InterContinental", name_ar: "دار التوحيد إنتركونتيننتال", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Ibrahim Al Khalil Street", city: "Mecca", region: "Makkah", coordinates: { lat: 21.4200, lng: 39.8270 }, phone: "+966 12 574 1111", priceRange: "$$$$", rating: 4.5, description_en: "Prestigious hotel adjacent to Masjid Al Haram", description_ar: "فندق مرموق ملاصق للمسجد الحرام" },

      // === HOTELS - Medina (4) ===
      { type: "hotel", name_en: "The Oberoi Medina", name_ar: "أوبروي المدينة", category: "luxury_hotel", category_ar: "فندق فاخر", address: "King Faisal Road", city: "Medina", region: "Madinah", coordinates: { lat: 24.4672, lng: 39.6112 }, phone: "+966 14 818 1818", priceRange: "$$$$", rating: 4.7, description_en: "World-class luxury near the Prophet's Mosque", description_ar: "فخامة عالمية بالقرب من المسجد النبوي" },
      { type: "hotel", name_en: "Dar Al Iman InterContinental", name_ar: "دار الإيمان إنتركونتيننتال", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Central Area", city: "Medina", region: "Madinah", coordinates: { lat: 24.4680, lng: 39.6130 }, phone: "+966 14 867 5555", priceRange: "$$$$", rating: 4.5, description_en: "Luxury hotel overlooking Al Masjid An Nabawi", description_ar: "فندق فاخر يطل على المسجد النبوي" },
      { type: "hotel", name_en: "Crowne Plaza Medina", name_ar: "كراون بلازا المدينة", category: "business_hotel", category_ar: "فندق أعمال", address: "Central Area", city: "Medina", region: "Madinah", coordinates: { lat: 24.4665, lng: 39.6100 }, phone: "+966 14 811 4444", priceRange: "$$$", rating: 4.2, description_en: "Premium hotel in the heart of Medina", description_ar: "فندق متميز في قلب المدينة المنورة" },
      { type: "hotel", name_en: "Millennium Al Aqeeq Hotel", name_ar: "فندق ميلينيوم العقيق", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "Abu Bakr Al Siddiq Road", city: "Medina", region: "Madinah", coordinates: { lat: 24.4620, lng: 39.6140 }, phone: "+966 14 366 2222", priceRange: "$$", rating: 4.0, description_en: "Comfortable stay near the Prophet's Mosque", description_ar: "إقامة مريحة بالقرب من المسجد النبوي" },

      // === HOTELS - Other cities (5) ===
      { type: "hotel", name_en: "Kempinski Hotel Al Othman", name_ar: "فندق كمبنسكي العثمان", category: "luxury_hotel", category_ar: "فندق فاخر", address: "Prince Turkey Street", city: "Al Khobar", region: "Eastern Province", coordinates: { lat: 26.2789, lng: 50.2083 }, phone: "+966 13 864 5000", priceRange: "$$$$", rating: 4.5, description_en: "Luxury waterfront hotel in Al Khobar", description_ar: "فندق فاخر على الواجهة البحرية في الخبر" },
      { type: "hotel", name_en: "Sheraton Dammam Hotel", name_ar: "فندق شيراتون الدمام", category: "business_hotel", category_ar: "فندق أعمال", address: "1st Street, Corniche", city: "Dammam", region: "Eastern Province", coordinates: { lat: 26.4367, lng: 50.1140 }, phone: "+966 13 834 0000", priceRange: "$$$", rating: 4.1, description_en: "Established hotel on the Dammam Corniche", description_ar: "فندق عريق على كورنيش الدمام" },
      { type: "hotel", name_en: "Habitas AlUla", name_ar: "هابيتاس العلا", category: "boutique_hotel", category_ar: "فندق بوتيك", address: "Ashar Valley", city: "AlUla", region: "Madinah", coordinates: { lat: 26.6174, lng: 37.9209 }, phone: "+966 14 820 4444", priceRange: "$$$$", rating: 4.9, description_en: "Eco-luxury resort nestled in AlUla's canyons", description_ar: "منتجع بيئي فاخر في أودية العلا" },
      { type: "hotel", name_en: "Banyan Tree AlUla", name_ar: "بانيان تري العلا", category: "luxury_hotel", category_ar: "فندق فاخر", address: "AlUla Old Town", city: "AlUla", region: "Madinah", coordinates: { lat: 26.6200, lng: 37.9180 }, phone: "+966 14 820 5555", priceRange: "$$$$", rating: 4.8, description_en: "Luxury tented villas with desert views", description_ar: "فلل خيام فاخرة بإطلالات صحراوية" },
      { type: "hotel", name_en: "InterContinental Abha", name_ar: "إنتركونتيننتال أبها", category: "resort", category_ar: "منتجع", address: "Abha Dam Road", city: "Abha", region: "Asir", coordinates: { lat: 18.2164, lng: 42.5053 }, phone: "+966 17 224 7777", priceRange: "$$$", rating: 4.3, description_en: "Mountain resort in the green highlands of Abha", description_ar: "منتجع جبلي في مرتفعات أبها الخضراء" },

      // === RESTAURANTS - Riyadh (12) ===
      { type: "restaurant", name_en: "Najd Village", name_ar: "قرية نجد", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Takhassusi Street", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7250, lng: 46.6520 }, phone: "+966 11 462 5555", priceRange: "$$$", rating: 4.6, description_en: "Authentic Najdi cuisine in a traditional village setting", description_ar: "مطبخ نجدي أصيل في أجواء قرية تقليدية" },
      { type: "restaurant", name_en: "Lusin", name_ar: "لوسين", category: "international", category_ar: "عالمي", address: "Tahlia Street", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6930, lng: 46.6810 }, phone: "+966 11 462 0009", priceRange: "$$$", rating: 4.5, description_en: "Premium Armenian cuisine in an elegant setting", description_ar: "مطبخ أرمني فاخر في أجواء أنيقة" },
      { type: "restaurant", name_en: "Globe Restaurant", name_ar: "مطعم ذا غلوب", category: "fine_dining", category_ar: "مطعم فاخر", address: "Al Faisaliah Tower", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6906, lng: 46.6860 }, phone: "+966 11 273 2222", priceRange: "$$$$", rating: 4.7, description_en: "Fine dining in the sphere of Al Faisaliah Tower", description_ar: "مطعم فاخر في كرة برج الفيصلية" },
      { type: "restaurant", name_en: "Mama Noura", name_ar: "ماما نورة", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Multiple locations", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6780, lng: 46.6900 }, phone: "+966 11 462 1555", priceRange: "$", rating: 4.3, description_en: "Famous Saudi shawarma and grills chain", description_ar: "سلسلة شاورما ومشاوي سعودية شهيرة" },
      { type: "restaurant", name_en: "Al Baik", name_ar: "البيك", category: "fast_food", category_ar: "وجبات سريعة", address: "Multiple locations", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6850, lng: 46.6750 }, phone: "+966 920 000 225", priceRange: "$", rating: 4.5, description_en: "Saudi Arabia's beloved fried chicken chain", description_ar: "سلسلة الدجاج المقلي المحبوبة في السعودية" },
      { type: "restaurant", name_en: "Takya", name_ar: "تكية", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "King Abdullah Road", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7100, lng: 46.6700 }, phone: "+966 11 415 0000", priceRange: "$$", rating: 4.4, description_en: "Modern Saudi cuisine with a traditional twist", description_ar: "مطبخ سعودي عصري بلمسة تقليدية" },
      { type: "restaurant", name_en: "Nusr-Et Steakhouse", name_ar: "نصرت ستيك هاوس", category: "fine_dining", category_ar: "مطعم فاخر", address: "Al Faisaliah District", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6910, lng: 46.6870 }, phone: "+966 11 206 1111", priceRange: "$$$$", rating: 4.3, description_en: "World-famous steakhouse by Salt Bae", description_ar: "مطعم ستيك عالمي الشهرة" },
      { type: "restaurant", name_en: "Jinaah", name_ar: "جناح", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Diriyah", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7340, lng: 46.5720 }, phone: "+966 11 486 0000", priceRange: "$$$", rating: 4.6, description_en: "Fine Saudi dining in historic Diriyah", description_ar: "مطعم سعودي فاخر في الدرعية التاريخية" },
      { type: "restaurant", name_en: "The Butcher Shop & Grill", name_ar: "ذا بوتشر شوب", category: "international", category_ar: "عالمي", address: "Tahlia Street", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6940, lng: 46.6800 }, phone: "+966 11 462 7774", priceRange: "$$$", rating: 4.2, description_en: "South African steakhouse concept", description_ar: "مفهوم مطعم ستيك جنوب أفريقي" },
      { type: "restaurant", name_en: "Myazu", name_ar: "ميازو", category: "international", category_ar: "عالمي", address: "Prince Mohammed Bin Abdulaziz Road", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6960, lng: 46.6830 }, phone: "+966 11 282 1234", priceRange: "$$$", rating: 4.4, description_en: "Japanese-Italian fusion fine dining", description_ar: "مطعم فاخر ياباني إيطالي" },
      { type: "restaurant", name_en: "Al Romansiah", name_ar: "الرومانسية", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Multiple locations", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7000, lng: 46.7100 }, phone: "+966 920 001 014", priceRange: "$$", rating: 4.1, description_en: "Popular Saudi restaurant chain for kabsa and mandi", description_ar: "سلسلة مطاعم سعودية مشهورة بالكبسة والمندي" },
      { type: "restaurant", name_en: "Suhail Restaurant", name_ar: "مطعم سهيل", category: "seafood", category_ar: "مأكولات بحرية", address: "Northern Ring Road", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7400, lng: 46.6600 }, phone: "+966 11 454 2222", priceRange: "$$$", rating: 4.3, description_en: "Premium fresh seafood in Riyadh", description_ar: "مأكولات بحرية طازجة فاخرة في الرياض" },

      // === RESTAURANTS - Jeddah (10) ===
      { type: "restaurant", name_en: "Al Nakheel Restaurant", name_ar: "مطعم النخيل", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Hamra Corniche", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5450, lng: 39.1500 }, phone: "+966 12 663 3333", priceRange: "$$$", rating: 4.4, description_en: "Hijazi cuisine with Red Sea views", description_ar: "مطبخ حجازي بإطلالة على البحر الأحمر" },
      { type: "restaurant", name_en: "Twina Restaurant", name_ar: "مطعم توينا", category: "seafood", category_ar: "مأكولات بحرية", address: "Al Corniche", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5470, lng: 39.1520 }, phone: "+966 12 606 6666", priceRange: "$$$", rating: 4.5, description_en: "Fresh seafood restaurant on Jeddah waterfront", description_ar: "مطعم مأكولات بحرية على واجهة جدة" },
      { type: "restaurant", name_en: "Bab Al Yaman", name_ar: "باب اليمن", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Balad, Historic Jeddah", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.4850, lng: 39.1860 }, phone: "+966 12 647 2222", priceRange: "$", rating: 4.3, description_en: "Authentic Yemeni food in Historic Jeddah", description_ar: "طعام يمني أصيل في جدة التاريخية" },
      { type: "restaurant", name_en: "Pier 7", name_ar: "بير 7", category: "fine_dining", category_ar: "مطعم فاخر", address: "Al Hamra District", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5420, lng: 39.1510 }, phone: "+966 12 231 5577", priceRange: "$$$$", rating: 4.6, description_en: "Fine dining complex with multiple restaurants", description_ar: "مجمع مطاعم فاخرة متعددة" },
      { type: "restaurant", name_en: "Al Baik Jeddah", name_ar: "البيك جدة", category: "fast_food", category_ar: "وجبات سريعة", address: "Multiple locations", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5200, lng: 39.1750 }, phone: "+966 920 000 225", priceRange: "$", rating: 4.7, description_en: "The original Al Baik - Jeddah's pride", description_ar: "البيك الأصلي - فخر جدة" },
      { type: "restaurant", name_en: "Mataam Al Sharq", name_ar: "مطعم الشرق", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Prince Sultan Street", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5600, lng: 39.1340 }, phone: "+966 12 660 4444", priceRange: "$$", rating: 4.2, description_en: "Traditional Middle Eastern cuisine", description_ar: "مطبخ شرقي تقليدي" },
      { type: "restaurant", name_en: "Sakura Japanese Restaurant", name_ar: "مطعم ساكورا الياباني", category: "international", category_ar: "عالمي", address: "Tahlia Street", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5550, lng: 39.1400 }, phone: "+966 12 665 8888", priceRange: "$$$", rating: 4.3, description_en: "Authentic Japanese cuisine in Jeddah", description_ar: "مطبخ ياباني أصيل في جدة" },
      { type: "restaurant", name_en: "Burgerizzr", name_ar: "برقرايزر", category: "fast_food", category_ar: "وجبات سريعة", address: "Multiple locations", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5300, lng: 39.1700 }, phone: "+966 920 011 229", priceRange: "$", rating: 4.1, description_en: "Popular Saudi gourmet burger chain", description_ar: "سلسلة برجر سعودية مشهورة" },
      { type: "restaurant", name_en: "Habara Bukhari Restaurant", name_ar: "مطعم هبارة البخاري", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Safa District", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5500, lng: 39.1550 }, phone: "+966 12 605 1111", priceRange: "$$", rating: 4.4, description_en: "Famous for Bukhari rice and lamb", description_ar: "مشهور بالرز البخاري واللحم" },
      { type: "restaurant", name_en: "Crab House", name_ar: "كراب هاوس", category: "seafood", category_ar: "مأكولات بحرية", address: "Al Corniche", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5380, lng: 39.1490 }, phone: "+966 12 233 0000", priceRange: "$$$", rating: 4.2, description_en: "Fresh crab and seafood on the Corniche", description_ar: "سلطعون ومأكولات بحرية طازجة على الكورنيش" },

      // === RESTAURANTS - Other cities (5) ===
      { type: "restaurant", name_en: "Heritage Village Restaurant", name_ar: "مطعم القرية التراثية", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Heritage Village", city: "Dammam", region: "Eastern Province", coordinates: { lat: 26.4300, lng: 50.1100 }, phone: "+966 13 826 1111", priceRange: "$$", rating: 4.2, description_en: "Traditional Saudi cuisine in heritage setting", description_ar: "مطبخ سعودي تقليدي في أجواء تراثية" },
      { type: "restaurant", name_en: "Maharaja Palace", name_ar: "قصر المهراجا", category: "international", category_ar: "عالمي", address: "Prince Turkey Street", city: "Al Khobar", region: "Eastern Province", coordinates: { lat: 26.2800, lng: 50.2100 }, phone: "+966 13 887 3333", priceRange: "$$$", rating: 4.3, description_en: "Authentic Indian cuisine in Al Khobar", description_ar: "مطبخ هندي أصيل في الخبر" },
      { type: "restaurant", name_en: "Asir Kitchen", name_ar: "مطبخ عسير", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Miftaha Village", city: "Abha", region: "Asir", coordinates: { lat: 18.2200, lng: 42.5000 }, phone: "+966 17 226 3333", priceRange: "$$", rating: 4.4, description_en: "Authentic Asiri cuisine with mountain herbs", description_ar: "مطبخ عسيري أصيل بالأعشاب الجبلية" },
      { type: "restaurant", name_en: "Dammam Fish Market", name_ar: "سوق السمك الدمام", category: "seafood", category_ar: "مأكولات بحرية", address: "Al Corniche", city: "Dammam", region: "Eastern Province", coordinates: { lat: 26.4400, lng: 50.1000 }, phone: "+966 13 827 5555", priceRange: "$$", rating: 4.1, description_en: "Fresh-catch seafood from the Gulf", description_ar: "مأكولات بحرية طازجة من الخليج" },
      { type: "restaurant", name_en: "Sarat Mountain Grill", name_ar: "مشاوي سراة", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Souda Road", city: "Abha", region: "Asir", coordinates: { lat: 18.2500, lng: 42.4500 }, phone: "+966 17 228 1111", priceRange: "$$", rating: 4.3, description_en: "Mountain grills with stunning highland views", description_ar: "مشاوي جبلية بإطلالات خلابة" },

      // === ATTRACTIONS (20) ===
      { type: "attraction", name_en: "Diriyah - At-Turaif District", name_ar: "الدرعية - حي الطريف", category: "historical_site", category_ar: "موقع تاريخي", address: "Diriyah", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7343, lng: 46.5726 }, priceRange: "$$", rating: 4.7, description_en: "UNESCO World Heritage Site, birthplace of Saudi Arabia", description_ar: "موقع تراث عالمي لليونسكو، مهد الدولة السعودية" },
      { type: "attraction", name_en: "National Museum of Saudi Arabia", name_ar: "المتحف الوطني السعودي", category: "museum", category_ar: "متحف", address: "King Abdulaziz Historical Center", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6477, lng: 46.7105 }, priceRange: "$", rating: 4.5, description_en: "Comprehensive museum of Saudi history and culture", description_ar: "متحف شامل للتاريخ والثقافة السعودية" },
      { type: "attraction", name_en: "Al Balad - Historic Jeddah", name_ar: "البلد - جدة التاريخية", category: "historical_site", category_ar: "موقع تاريخي", address: "Al Balad, Old Town", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.4852, lng: 39.1862 }, priceRange: "$", rating: 4.6, description_en: "UNESCO World Heritage Site with Hijazi architecture", description_ar: "موقع تراث عالمي بعمارة حجازية" },
      { type: "attraction", name_en: "Hegra (Mada'in Salih)", name_ar: "الحجر (مدائن صالح)", category: "historical_site", category_ar: "موقع تاريخي", address: "AlUla", city: "AlUla", region: "Madinah", coordinates: { lat: 26.7865, lng: 37.9533 }, priceRange: "$$", rating: 4.9, description_en: "Saudi's first UNESCO World Heritage Site — Nabataean tombs", description_ar: "أول موقع تراث عالمي في السعودية - مقابر نبطية" },
      { type: "attraction", name_en: "Edge of the World (Jebel Fihrayn)", name_ar: "حافة العالم (جبل فهرين)", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Northwest of Riyadh", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.8500, lng: 46.1667 }, priceRange: "$", rating: 4.8, description_en: "Dramatic cliff edge overlooking a vast valley", description_ar: "حافة صخرية مذهلة تطل على وادي شاسع" },
      { type: "attraction", name_en: "Boulevard Riyadh City", name_ar: "بوليفارد الرياض سيتي", category: "entertainment", category_ar: "ترفيه", address: "Hittin District", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7655, lng: 46.6340 }, priceRange: "$$", rating: 4.4, description_en: "Mega entertainment district with events and dining", description_ar: "منطقة ترفيه ضخمة بفعاليات ومطاعم" },
      { type: "attraction", name_en: "Elephant Rock (Jabal Al-Fil)", name_ar: "صخرة الفيل (جبل الفيل)", category: "natural_landmark", category_ar: "معلم طبيعي", address: "AlUla", city: "AlUla", region: "Madinah", coordinates: { lat: 26.6700, lng: 37.8100 }, priceRange: "$", rating: 4.7, description_en: "Iconic elephant-shaped rock formation", description_ar: "تكوين صخري أيقوني على شكل فيل" },
      { type: "attraction", name_en: "Jeddah Corniche", name_ar: "كورنيش جدة", category: "waterfront", category_ar: "واجهة بحرية", address: "Al Corniche Road", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5440, lng: 39.1490 }, priceRange: "$", rating: 4.3, description_en: "30km waterfront promenade along the Red Sea", description_ar: "ممشى بحري 30 كم على البحر الأحمر" },
      { type: "attraction", name_en: "King Fahd Fountain", name_ar: "نافورة الملك فهد", category: "landmark", category_ar: "معلم", address: "Jeddah Corniche", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.4989, lng: 39.1516 }, priceRange: "$", rating: 4.2, description_en: "World's tallest fountain — 312 meters high", description_ar: "أطول نافورة في العالم - 312 متر" },
      { type: "attraction", name_en: "Al Wahbah Crater", name_ar: "فوهة الوعبة", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Taif Road", city: "Taif", region: "Makkah", coordinates: { lat: 22.9030, lng: 41.1380 }, priceRange: "$", rating: 4.6, description_en: "Volcanic crater with white salt flat floor", description_ar: "فوهة بركانية بأرضية ملحية بيضاء" },
      { type: "attraction", name_en: "Farasan Islands", name_ar: "جزر فرسان", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Red Sea", city: "Jizan", region: "Jizan", coordinates: { lat: 16.7000, lng: 42.1167 }, priceRange: "$$", rating: 4.5, description_en: "Pristine island archipelago with marine life", description_ar: "أرخبيل جزر بكر بحياة بحرية غنية" },
      { type: "attraction", name_en: "Masmak Fortress", name_ar: "قصر المصمك", category: "historical_site", category_ar: "موقع تاريخي", address: "Al Dirah, Old Riyadh", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6312, lng: 46.7137 }, priceRange: "$", rating: 4.3, description_en: "Historic fortress where modern Saudi Arabia began", description_ar: "القلعة التاريخية حيث بدأت السعودية الحديثة" },
      { type: "attraction", name_en: "The Red Sea Coast", name_ar: "ساحل البحر الأحمر", category: "natural_landmark", category_ar: "معلم طبيعي", address: "NEOM", city: "Tabuk", region: "Tabuk", coordinates: { lat: 27.9500, lng: 35.3500 }, priceRange: "$$$", rating: 4.7, description_en: "Pristine coral reefs and crystal-clear waters", description_ar: "شعاب مرجانية بكر ومياه صافية" },
      { type: "attraction", name_en: "Al Soudah Park", name_ar: "منتزه السودة", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Al Soudah Mountain", city: "Abha", region: "Asir", coordinates: { lat: 18.2700, lng: 42.3700 }, priceRange: "$", rating: 4.5, description_en: "Highest point in Saudi Arabia with cable car", description_ar: "أعلى نقطة في السعودية مع تلفريك" },
      { type: "attraction", name_en: "Ithra (King Abdulaziz Center)", name_ar: "إثراء (مركز الملك عبدالعزيز)", category: "museum", category_ar: "متحف", address: "Dhahran", city: "Dammam", region: "Eastern Province", coordinates: { lat: 26.3120, lng: 50.1360 }, priceRange: "$$", rating: 4.6, description_en: "World-class cultural center with museum and theater", description_ar: "مركز ثقافي عالمي بمتحف ومسرح" },
      { type: "attraction", name_en: "Half Moon Bay", name_ar: "خليج نصف القمر", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Al Khobar Road", city: "Dammam", region: "Eastern Province", coordinates: { lat: 26.2000, lng: 50.2500 }, priceRange: "$", rating: 4.2, description_en: "Crescent-shaped beach on the Arabian Gulf", description_ar: "شاطئ هلالي على الخليج العربي" },
      { type: "attraction", name_en: "Rijal Almaa Heritage Village", name_ar: "قرية رجال ألمع التراثية", category: "historical_site", category_ar: "موقع تاريخي", address: "Rijal Almaa", city: "Abha", region: "Asir", coordinates: { lat: 18.2100, lng: 42.2800 }, priceRange: "$", rating: 4.7, description_en: "Colorful stone tower village — UNESCO tentative list", description_ar: "قرية أبراج حجرية ملونة - قائمة يونسكو المؤقتة" },
      { type: "attraction", name_en: "Maraya Concert Hall", name_ar: "قاعة مرايا", category: "entertainment", category_ar: "ترفيه", address: "Ashar Valley", city: "AlUla", region: "Madinah", coordinates: { lat: 26.6600, lng: 37.8300 }, priceRange: "$$$", rating: 4.8, description_en: "World's largest mirrored building in a desert canyon", description_ar: "أكبر مبنى مرايا في العالم وسط وادي صحراوي" },
      { type: "attraction", name_en: "Taif Rose Farms", name_ar: "مزارع ورد الطائف", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Al Hada Road", city: "Taif", region: "Makkah", coordinates: { lat: 21.2700, lng: 40.4200 }, priceRange: "$", rating: 4.4, description_en: "Fragrant rose farms producing famous Taif rose oil", description_ar: "مزارع ورد عطرة تنتج زيت ورد الطائف الشهير" },
      { type: "attraction", name_en: "King Abdullah Economic City", name_ar: "مدينة الملك عبدالله الاقتصادية", category: "entertainment", category_ar: "ترفيه", address: "Rabigh", city: "Jeddah", region: "Makkah", coordinates: { lat: 22.4000, lng: 39.0800 }, priceRange: "$$", rating: 4.0, description_en: "Planned city with beach resorts and golf", description_ar: "مدينة مخططة بمنتجعات شاطئية وغولف" },

      // === EVENTS & TOURS (10) ===
      { type: "event", name_en: "Riyadh Season", name_ar: "موسم الرياض", category: "seasonal_event", category_ar: "موسم", address: "Multiple venues", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.7136, lng: 46.6753 }, priceRange: "$$", rating: 4.5, description_en: "Annual mega entertainment festival (Oct-Mar)", description_ar: "مهرجان ترفيهي ضخم سنوي (أكتوبر-مارس)" },
      { type: "event", name_en: "Jeddah Season", name_ar: "موسم جدة", category: "seasonal_event", category_ar: "موسم", address: "Multiple venues", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.5433, lng: 39.1728 }, priceRange: "$$", rating: 4.3, description_en: "Summer entertainment festival on the Red Sea coast", description_ar: "مهرجان ترفيهي صيفي على ساحل البحر الأحمر" },
      { type: "tour", name_en: "AlUla Heritage Tour", name_ar: "جولة العلا التراثية", category: "cultural_tour", category_ar: "جولة ثقافية", address: "AlUla Visitor Center", city: "AlUla", region: "Madinah", coordinates: { lat: 26.6174, lng: 37.9209 }, phone: "+966 14 820 1111", priceRange: "$$$", rating: 4.8, description_en: "Guided tour of Hegra, Dadan, and Old Town", description_ar: "جولة مرشدة في الحجر ودادان والبلدة القديمة" },
      { type: "tour", name_en: "Desert Safari - Red Sand Dunes", name_ar: "سفاري الصحراء - الرمال الحمراء", category: "adventure", category_ar: "مغامرة", address: "Al Thumama Desert", city: "Riyadh", region: "Riyadh", coordinates: { lat: 25.0000, lng: 46.6000 }, phone: "+966 50 123 4567", priceRange: "$$", rating: 4.6, description_en: "4x4 dune bashing, camel rides, and Bedouin dinner", description_ar: "تطعيس بالسيارات، ركوب جمال، وعشاء بدوي" },
      { type: "tour", name_en: "Red Sea Diving - NEOM", name_ar: "غوص البحر الأحمر - نيوم", category: "adventure", category_ar: "مغامرة", address: "NEOM Coast", city: "Tabuk", region: "Tabuk", coordinates: { lat: 27.9500, lng: 35.3500 }, phone: "+966 55 987 6543", priceRange: "$$$", rating: 4.7, description_en: "Scuba diving in pristine Red Sea coral reefs", description_ar: "غوص في الشعاب المرجانية البكر بالبحر الأحمر" },
      { type: "tour", name_en: "Edge of the World Hiking", name_ar: "رحلة حافة العالم", category: "adventure", category_ar: "مغامرة", address: "Jebel Fihrayn", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.8500, lng: 46.1667 }, phone: "+966 50 234 5678", priceRange: "$$", rating: 4.5, description_en: "Guided hiking to the dramatic cliff edge", description_ar: "رحلة مشي مرشدة إلى حافة الجرف المذهلة" },
      { type: "event", name_en: "AlUla Moments Festival", name_ar: "مهرجان لحظات العلا", category: "seasonal_event", category_ar: "موسم", address: "AlUla", city: "AlUla", region: "Madinah", coordinates: { lat: 26.6174, lng: 37.9209 }, priceRange: "$$$", rating: 4.7, description_en: "Art, music, and cultural experiences in ancient AlUla", description_ar: "تجارب فنية وموسيقية وثقافية في العلا العريقة" },
      { type: "tour", name_en: "Jeddah Old Town Walking Tour", name_ar: "جولة مشي في جدة القديمة", category: "cultural_tour", category_ar: "جولة ثقافية", address: "Al Balad, Bab Makkah", city: "Jeddah", region: "Makkah", coordinates: { lat: 21.4852, lng: 39.1862 }, phone: "+966 50 345 6789", priceRange: "$", rating: 4.4, description_en: "Explore UNESCO-listed coral stone buildings and souks", description_ar: "استكشف المباني المرجانية وأسواق جدة القديمة" },
      { type: "tour", name_en: "Asir Highland Nature Tour", name_ar: "جولة طبيعة مرتفعات عسير", category: "adventure", category_ar: "مغامرة", address: "Al Soudah", city: "Abha", region: "Asir", coordinates: { lat: 18.2700, lng: 42.3700 }, phone: "+966 50 456 7890", priceRange: "$$", rating: 4.4, description_en: "Explore misty mountains, terraced farms, and baboons", description_ar: "استكشف الجبال الضبابية والمدرجات والقرود" },
      { type: "event", name_en: "Saudi Cup Horse Race", name_ar: "كأس السعودية لسباقات الخيل", category: "seasonal_event", category_ar: "موسم", address: "King Abdulaziz Racecourse", city: "Riyadh", region: "Riyadh", coordinates: { lat: 24.6500, lng: 46.6400 }, priceRange: "$$$$", rating: 4.6, description_en: "World's richest horse race — $20M prize", description_ar: "أغلى سباق خيول في العالم - جائزة 20 مليون دولار" },
    ];

    let inserted = 0;
    for (const listing of listings) {
      await ctx.db.insert("listings", {
        ...listing,
        reviewCount: 0,
        isVerified: true,
        isActive: true,
        languages: ["ar", "en"],
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
    }

    return { inserted };
  },
});

// === Business user content submission ===

const BUSINESS_OWNER_TYPES = ["hotel", "restaurant", "attraction", "event"];
const SERVICE_PROVIDER_TYPES = ["tour"];

// Submit a new listing (business owner / service provider)
export const submitListing = mutation({
  args: {
    type: v.string(),
    name_en: v.string(),
    name_ar: v.string(),
    category: v.string(),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    region: v.optional(v.string()),
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    workingHours: v.optional(
      v.array(
        v.object({
          day: v.string(),
          open: v.string(),
          close: v.string(),
          isClosed: v.optional(v.boolean()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const role = user.role;
    if (role !== "business_owner" && role !== "service_provider") {
      throw new Error("Only business owners and service providers can submit listings");
    }
    if (!user.isApproved) {
      throw new Error("Your account must be approved before submitting listings");
    }

    // Validate type based on role
    if (role === "business_owner" && !BUSINESS_OWNER_TYPES.includes(args.type)) {
      throw new Error("Business owners can post: hotel, restaurant, attraction, event");
    }
    if (role === "service_provider" && !SERVICE_PROVIDER_TYPES.includes(args.type)) {
      throw new Error("Service providers can post: tour");
    }

    const now = Date.now();
    const listingId = await ctx.db.insert("listings", {
      ...args,
      ownerId: user._id,
      status: "pending",
      rating: 0,
      reviewCount: 0,
      isVerified: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return listingId;
  },
});

// Update own listing (resets status to pending)
export const updateMyListing = mutation({
  args: {
    listingId: v.id("listings"),
    type: v.optional(v.string()),
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    category: v.optional(v.string()),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      })
    ),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    workingHours: v.optional(
      v.array(
        v.object({
          day: v.string(),
          open: v.string(),
          close: v.string(),
          isClosed: v.optional(v.boolean()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.ownerId !== user._id) throw new Error("Not your listing");

    const { listingId, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {
      updatedAt: Date.now(),
      status: "pending", // Reset status on edit
      rejectionReason: undefined,
    };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(listingId, filteredUpdates);
    return { success: true };
  },
});

// Delete own listing
export const deleteMyListing = mutation({
  args: {
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const listing = await ctx.db.get(args.listingId);
    if (!listing) throw new Error("Listing not found");
    if (listing.ownerId !== user._id) throw new Error("Not your listing");

    await ctx.db.delete(args.listingId);
    return { success: true };
  },
});
