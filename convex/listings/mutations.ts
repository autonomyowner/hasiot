import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser, requireAdmin } from "../auth";
import { enforceRateLimit } from "../rateLimit";
import { logAdminAction, labelFor } from "../admin/activity";

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
    await requireAdmin(ctx);

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
    await requireAdmin(ctx);

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

    // Prevent duplicate reviews
    const existingReview = await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q: any) => q.eq("listingId", args.listingId))
      .filter((q: any) => q.eq(q.field("userId"), user._id))
      .first();
    if (existingReview) {
      throw new Error("You have already reviewed this listing");
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
    const admin = await requireAdmin(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    await ctx.db.patch(args.listingId, {
      workingHours: args.workingHours,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: "listing.hours",
      targetType: "listing",
      targetId: args.listingId,
      summary: labelFor(listing),
    });

    return { success: true };
  },
});

// Seed listings with Al-Ahsa data
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
      // === HOTELS - Hofuf (8) ===
      { type: "hotel", name_en: "InterContinental Al Ahsa", name_ar: "إنتركونتيننتال الأحساء", category: "luxury_hotel", category_ar: "فندق فاخر", address: "King Abdullah Road, Al Mubarraz", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.4106, lng: 49.5855 }, phone: "+966 13 510 0000", priceRange: "$$$$", rating: 4.6, description_en: "Premier luxury hotel in the heart of Al-Ahsa with oasis views", description_ar: "فندق فاخر في قلب الأحساء بإطلالات على الواحة" },
      { type: "hotel", name_en: "Ramada by Wyndham Al Ahsa", name_ar: "رمادا من ويندام الأحساء", category: "business_hotel", category_ar: "فندق أعمال", address: "King Faisal Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3628, lng: 49.5872 }, phone: "+966 13 582 8888", priceRange: "$$$", rating: 4.2, description_en: "Modern business hotel near Hofuf city center", description_ar: "فندق أعمال عصري بالقرب من وسط الهفوف" },
      { type: "hotel", name_en: "Holiday Inn Al Ahsa", name_ar: "هوليداي إن الأحساء", category: "business_hotel", category_ar: "فندق أعمال", address: "Riyadh Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3750, lng: 49.5700 }, phone: "+966 13 531 0000", priceRange: "$$$", rating: 4.1, description_en: "Comfortable hotel ideal for families and business travelers", description_ar: "فندق مريح مثالي للعائلات ورجال الأعمال" },
      { type: "hotel", name_en: "Al Ahsa Grand Hotel", name_ar: "فندق الأحساء الكبير", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "King Abdulaziz Street, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3800, lng: 49.5850 }, phone: "+966 13 580 5000", priceRange: "$$", rating: 4.0, description_en: "Well-established hotel in central Hofuf with traditional hospitality", description_ar: "فندق عريق في وسط الهفوف بضيافة تقليدية" },
      { type: "hotel", name_en: "Garden Plaza Hotel Al Ahsa", name_ar: "فندق جاردن بلازا الأحساء", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "Al Khaldiya District, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3900, lng: 49.5750 }, phone: "+966 13 586 7000", priceRange: "$$", rating: 3.9, description_en: "Family-friendly hotel surrounded by palm gardens", description_ar: "فندق عائلي محاط بحدائق النخيل" },
      { type: "hotel", name_en: "Rose Garden Hotel Hofuf", name_ar: "فندق روز جاردن الهفوف", category: "boutique_hotel", category_ar: "فندق بوتيك", address: "Al Nuzha District, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3700, lng: 49.6000 }, phone: "+966 13 582 3000", priceRange: "$$$", rating: 4.3, description_en: "Boutique hotel with rooftop terrace overlooking the oasis", description_ar: "فندق بوتيك بتراس على السطح يطل على الواحة" },
      { type: "hotel", name_en: "Braira Al Ahsa Hotel", name_ar: "فندق بريرة الأحساء", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "Prince Sultan Street, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3550, lng: 49.5900 }, phone: "+966 13 531 5555", priceRange: "$$", rating: 3.8, description_en: "Modern hotel with spacious suites near the old quarter", description_ar: "فندق عصري بأجنحة واسعة بالقرب من الحي القديم" },
      { type: "hotel", name_en: "Swiss International Palace Hotel", name_ar: "فندق سويس إنترناشيونال بالاس", category: "budget_hotel", category_ar: "فندق اقتصادي", address: "Airport Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.2950, lng: 49.4850 }, phone: "+966 13 580 1000", priceRange: "$", rating: 3.7, description_en: "Affordable hotel near Al-Ahsa airport", description_ar: "فندق اقتصادي بالقرب من مطار الأحساء" },

      // === HOTELS - Mubarraz (4) ===
      { type: "hotel", name_en: "Al Koot Heritage Hotel", name_ar: "فندق الكوت التراثي", category: "boutique_hotel", category_ar: "فندق بوتيك", address: "Near Al Koot Fort, Mubarraz", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4280, lng: 49.5690 }, phone: "+966 13 530 4000", priceRange: "$$$", rating: 4.4, description_en: "Heritage-style boutique hotel near the historic Al Koot fortress", description_ar: "فندق بوتيك تراثي بالقرب من قلعة الكوت التاريخية" },
      { type: "hotel", name_en: "Golden Tulip Al Ahsa", name_ar: "جولدن توليب الأحساء", category: "business_hotel", category_ar: "فندق أعمال", address: "Commercial District, Mubarraz", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4200, lng: 49.5800 }, phone: "+966 13 530 8000", priceRange: "$$$", rating: 4.0, description_en: "Business hotel in the commercial heart of Mubarraz", description_ar: "فندق أعمال في قلب المبرز التجاري" },
      { type: "hotel", name_en: "Oasis Suites Al Ahsa", name_ar: "أجنحة الواحة الأحساء", category: "mid_range_hotel", category_ar: "فندق متوسط", address: "Al Rashidiya, Mubarraz", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4150, lng: 49.5750 }, phone: "+966 13 533 2000", priceRange: "$$", rating: 3.9, description_en: "Comfortable suites ideal for extended stays in Al-Ahsa", description_ar: "أجنحة مريحة مثالية للإقامة الطويلة في الأحساء" },
      { type: "hotel", name_en: "Palm Resort Al Ahsa", name_ar: "منتجع النخيل الأحساء", category: "resort", category_ar: "منتجع", address: "Al Ahsa Oasis Road, Mubarraz", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4350, lng: 49.5500 }, phone: "+966 13 535 0000", priceRange: "$$$", rating: 4.5, description_en: "Oasis resort surrounded by 3 million palm trees", description_ar: "منتجع واحة محاط بـ 3 ملايين نخلة" },

      // === RESTAURANTS - Hofuf (10) ===
      { type: "restaurant", name_en: "Al Hasawi Kitchen", name_ar: "المطبخ الحساوي", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Old Hofuf Quarter", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3600, lng: 49.5870 }, phone: "+966 13 582 1111", priceRange: "$$", rating: 4.6, description_en: "Authentic Hasawi cuisine — famous for Al-Ahsa rice dishes and majboos", description_ar: "مطبخ حساوي أصيل - مشهور بأطباق الأرز الحساوية والمجبوس" },
      { type: "restaurant", name_en: "Bait Al Qahwa", name_ar: "بيت القهوة", category: "cafe", category_ar: "مقهى", address: "Souq Al Qaisariya, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3565, lng: 49.5890 }, phone: "+966 13 580 0555", priceRange: "$", rating: 4.5, description_en: "Traditional coffee house serving Hasawi coffee and dates in the historic souq", description_ar: "بيت قهوة تقليدي يقدم القهوة الحساوية والتمور في السوق التاريخي" },
      { type: "restaurant", name_en: "Al Romansiah Al Ahsa", name_ar: "الرومانسية الأحساء", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "King Faisal Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3700, lng: 49.5800 }, phone: "+966 920 001 014", priceRange: "$$", rating: 4.2, description_en: "Popular Saudi chain serving kabsa, mandi, and mathlouta", description_ar: "سلسلة سعودية مشهورة بالكبسة والمندي والمثلوثة" },
      { type: "restaurant", name_en: "Mama Noura Al Ahsa", name_ar: "ماما نورة الأحساء", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Prince Sultan Street, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3650, lng: 49.5950 }, phone: "+966 11 462 1555", priceRange: "$", rating: 4.3, description_en: "Famous shawarma and grills — Al-Ahsa branch", description_ar: "شاورما ومشاوي مشهورة - فرع الأحساء" },
      { type: "restaurant", name_en: "Dar Al Tammar", name_ar: "دار التمّار", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Near Ibrahim Palace, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3830, lng: 49.5870 }, phone: "+966 13 580 8888", priceRange: "$$", rating: 4.4, description_en: "Date-themed restaurant showcasing Al-Ahsa's famous dates in every dish", description_ar: "مطعم التمور يعرض تمور الأحساء الشهيرة في كل طبق" },
      { type: "restaurant", name_en: "Al Baik Al Ahsa", name_ar: "البيك الأحساء", category: "fast_food", category_ar: "وجبات سريعة", address: "King Abdullah Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3750, lng: 49.5700 }, phone: "+966 920 000 225", priceRange: "$", rating: 4.5, description_en: "Saudi Arabia's beloved fried chicken chain — Al-Ahsa branch", description_ar: "سلسلة الدجاج المقلي المحبوبة - فرع الأحساء" },
      { type: "restaurant", name_en: "Mashawi Al Oasis", name_ar: "مشاوي الواحة", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Nuzha District, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3680, lng: 49.6050 }, phone: "+966 13 582 6666", priceRange: "$$", rating: 4.3, description_en: "Premium grills and kebabs in a garden setting among palm trees", description_ar: "مشاوي وكباب فاخرة في حديقة بين أشجار النخيل" },
      { type: "restaurant", name_en: "Al Waha Seafood", name_ar: "أسماك الواحة", category: "seafood", category_ar: "مأكولات بحرية", address: "Riyadh Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3900, lng: 49.5650 }, phone: "+966 13 580 3333", priceRange: "$$$", rating: 4.1, description_en: "Fresh Gulf seafood including hammour and shrimp machboos", description_ar: "مأكولات بحرية طازجة من الخليج تشمل الهامور ومجبوس الربيان" },
      { type: "restaurant", name_en: "Bab Al Hasa", name_ar: "باب الحسا", category: "fine_dining", category_ar: "مطعم فاخر", address: "InterContinental Hotel, Mubarraz", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.4100, lng: 49.5860 }, phone: "+966 13 510 0100", priceRange: "$$$$", rating: 4.5, description_en: "Fine dining featuring modern takes on traditional Hasawi cuisine", description_ar: "مطعم فاخر يقدم لمسات عصرية على المطبخ الحساوي التقليدي" },
      { type: "restaurant", name_en: "Mathlouta House", name_ar: "بيت المثلوثة", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Hofuf Old Town", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3580, lng: 49.5880 }, phone: "+966 13 581 4444", priceRange: "$", rating: 4.7, description_en: "Specializes in mathlouta — Al-Ahsa's signature rice, meat, and wheat dish", description_ar: "متخصص في المثلوثة - الطبق المميز للأحساء من الأرز واللحم والقمح" },

      // === RESTAURANTS - Mubarraz & Other Al-Ahsa Cities (6) ===
      { type: "restaurant", name_en: "Deira Restaurant", name_ar: "مطعم الديرة", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Al Koot District, Mubarraz", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4250, lng: 49.5700 }, phone: "+966 13 530 7777", priceRange: "$$", rating: 4.3, description_en: "Traditional Hasawi and Gulf cuisine near Al Koot Fort", description_ar: "مطبخ حساوي وخليجي تقليدي بالقرب من قلعة الكوت" },
      { type: "restaurant", name_en: "Spring Cafe Al Oyoun", name_ar: "مقهى العيون", category: "cafe", category_ar: "مقهى", address: "Near Al Jawhariya Spring, Al Oyoun", city: "Al Oyoun", region: "Eastern Province", coordinates: { lat: 25.5680, lng: 49.5430 }, phone: "+966 13 540 1111", priceRange: "$", rating: 4.4, description_en: "Charming cafe near the natural springs of Al Oyoun village", description_ar: "مقهى ساحر بالقرب من عيون المياه الطبيعية في قرية العيون" },
      { type: "restaurant", name_en: "Al Omran Grills", name_ar: "مشاوي العمران", category: "traditional_food", category_ar: "مطبخ تقليدي", address: "Main Street, Al Omran", city: "Al Omran", region: "Eastern Province", coordinates: { lat: 25.5100, lng: 49.5300 }, phone: "+966 13 545 2222", priceRange: "$", rating: 4.1, description_en: "Local grill house famous for lamb tikka and fresh bread", description_ar: "مطعم مشاوي محلي مشهور بتكة اللحم والخبز الطازج" },
      { type: "restaurant", name_en: "Hasawi Dates Bistro", name_ar: "بيسترو تمور الحساء", category: "cafe", category_ar: "مقهى", address: "Date Market Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3590, lng: 49.5850 }, phone: "+966 13 581 9000", priceRange: "$$", rating: 4.5, description_en: "Artisan cafe serving dishes and desserts made with Al-Ahsa's famous Khalas dates", description_ar: "مقهى حرفي يقدم أطباق وحلويات من تمور خلاص الأحساء الشهيرة" },
      { type: "restaurant", name_en: "Al Jafr Fish House", name_ar: "بيت أسماك الجفر", category: "seafood", category_ar: "مأكولات بحرية", address: "Al Jafr Village", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3250, lng: 49.6200 }, phone: "+966 13 546 3333", priceRange: "$$", rating: 4.2, description_en: "Fresh catch from nearby Gulf waters, served village-style", description_ar: "أسماك طازجة من مياه الخليج القريبة بطريقة القرية" },
      { type: "restaurant", name_en: "Oasis Garden Restaurant", name_ar: "مطعم حديقة الواحة", category: "international", category_ar: "عالمي", address: "Palm Resort, Mubarraz", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4340, lng: 49.5510 }, phone: "+966 13 535 0100", priceRange: "$$$", rating: 4.3, description_en: "International and Middle Eastern cuisine in a lush palm garden setting", description_ar: "مطبخ عالمي وشرق أوسطي في أجواء حديقة نخيل خضراء" },

      // === ATTRACTIONS (18) ===
      { type: "attraction", name_en: "Al-Ahsa Oasis", name_ar: "واحة الأحساء", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Al-Ahsa Governorate", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3800, lng: 49.5900 }, priceRange: "$", rating: 4.9, description_en: "UNESCO World Heritage Site — world's largest natural oasis with 3 million palm trees", description_ar: "موقع تراث عالمي لليونسكو - أكبر واحة طبيعية في العالم بـ 3 ملايين نخلة" },
      { type: "attraction", name_en: "Ibrahim Palace", name_ar: "قصر إبراهيم", category: "historical_site", category_ar: "موقع تاريخي", address: "Old Hofuf Quarter", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3784, lng: 49.5860 }, phone: "+966 13 580 0000", priceRange: "$", rating: 4.7, description_en: "16th-century Ottoman fortress with a mosque, bath house, and military barracks", description_ar: "قلعة عثمانية من القرن السادس عشر تضم مسجداً وحماماً وثكنات عسكرية" },
      { type: "attraction", name_en: "Al Qarah Mountain", name_ar: "جبل القارة", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Al Qarah Village, 12km east of Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.4070, lng: 49.6890 }, priceRange: "$", rating: 4.8, description_en: "Unique mountain with naturally cool caves — warm in winter and cool in summer", description_ar: "جبل فريد بكهوف باردة طبيعياً - دافئ في الشتاء وبارد في الصيف" },
      { type: "attraction", name_en: "Souq Al Qaisariya", name_ar: "سوق القيصرية", category: "historical_site", category_ar: "موقع تاريخي", address: "Old Hofuf Quarter", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3565, lng: 49.5895 }, priceRange: "$", rating: 4.6, description_en: "400-year-old covered marketplace — one of the oldest souqs in Arabia", description_ar: "سوق مسقوف عمره 400 عام - أحد أقدم الأسواق في الجزيرة العربية" },
      { type: "attraction", name_en: "Jawatha Mosque", name_ar: "مسجد جواثا", category: "historical_site", category_ar: "موقع تاريخي", address: "Al Kilabiyah Village", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.4240, lng: 49.6460 }, priceRange: "$", rating: 4.7, description_en: "One of the oldest mosques in Islam — second mosque where Friday prayers were held", description_ar: "من أقدم المساجد في الإسلام - ثاني مسجد أقيمت فيه صلاة الجمعة" },
      { type: "attraction", name_en: "Yellow Lake (Asfar Lake)", name_ar: "بحيرة الأصفر", category: "natural_landmark", category_ar: "معلم طبيعي", address: "East of Al-Ahsa Oasis", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.4500, lng: 49.7300 }, priceRange: "$", rating: 4.5, description_en: "Largest natural lake in the Arabian Peninsula, surrounded by sand dunes and wildlife", description_ar: "أكبر بحيرة طبيعية في شبه الجزيرة العربية، محاطة بالكثبان والحياة البرية" },
      { type: "attraction", name_en: "Al Koot Fortress", name_ar: "قلعة الكوت", category: "historical_site", category_ar: "موقع تاريخي", address: "Mubarraz Center", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4283, lng: 49.5694 }, priceRange: "$", rating: 4.4, description_en: "Historic Ottoman-era fortress overlooking Mubarraz, now a cultural center", description_ar: "قلعة تاريخية من العهد العثماني تطل على المبرز، الآن مركز ثقافي" },
      { type: "attraction", name_en: "Al-Ahsa National Museum", name_ar: "متحف الأحساء الوطني", category: "museum", category_ar: "متحف", address: "Ibrahim Palace Complex, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3790, lng: 49.5855 }, priceRange: "$", rating: 4.3, description_en: "Museum showcasing Al-Ahsa's 7,000-year history, archaeological finds, and heritage", description_ar: "متحف يعرض تاريخ الأحساء عبر 7000 عام والاكتشافات الأثرية والتراث" },
      { type: "attraction", name_en: "Ain Najm Spring", name_ar: "عين نجم", category: "natural_landmark", category_ar: "معلم طبيعي", address: "South of Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3200, lng: 49.5800 }, priceRange: "$", rating: 4.3, description_en: "Natural hot sulfur spring known for its therapeutic properties", description_ar: "عين كبريتية حارة طبيعية معروفة بخصائصها العلاجية" },
      { type: "attraction", name_en: "Ain Al Hara Spring", name_ar: "عين الحارة", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Al Hara District, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3650, lng: 49.5950 }, priceRange: "$", rating: 4.2, description_en: "One of Al-Ahsa's famous natural springs — an ancient water source", description_ar: "إحدى عيون الأحساء الشهيرة - مصدر مياه قديم" },
      { type: "attraction", name_en: "Al-Ahsa Date Market", name_ar: "سوق التمور الأحساء", category: "market", category_ar: "سوق", address: "Date Market Road, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3570, lng: 49.5840 }, priceRange: "$", rating: 4.5, description_en: "Seasonal date market offering 30+ varieties including premium Khalas dates", description_ar: "سوق تمور موسمي يقدم أكثر من 30 صنفاً بما فيها تمور خلاص الفاخرة" },
      { type: "attraction", name_en: "Land of Civilizations Museum", name_ar: "متحف أرض الحضارات", category: "museum", category_ar: "متحف", address: "Al Mubarraz", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4200, lng: 49.5750 }, priceRange: "$", rating: 4.4, description_en: "Private museum with over 5,000 artifacts spanning Al-Ahsa's ancient civilizations", description_ar: "متحف خاص يضم أكثر من 5000 قطعة أثرية تمتد عبر حضارات الأحساء القديمة" },
      { type: "attraction", name_en: "Al Oyoun Village", name_ar: "قرية العيون", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Al Oyoun", city: "Al Oyoun", region: "Eastern Province", coordinates: { lat: 25.5680, lng: 49.5430 }, priceRange: "$", rating: 4.3, description_en: "Scenic village famous for its natural springs and lush green palm gardens", description_ar: "قرية خلابة مشهورة بعيونها الطبيعية وحدائق النخيل الخضراء" },
      { type: "attraction", name_en: "Al Shabah Cave", name_ar: "غار الشبعة", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Near Al Qarah Mountain", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.4050, lng: 49.6920 }, priceRange: "$", rating: 4.2, description_en: "Natural cave system inside Al Qarah mountain with unique rock formations", description_ar: "نظام كهوف طبيعي داخل جبل القارة بتكوينات صخرية فريدة" },
      { type: "attraction", name_en: "Hofuf Old Quarter", name_ar: "حي الهفوف القديم", category: "historical_site", category_ar: "موقع تاريخي", address: "Old Town, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3580, lng: 49.5870 }, priceRange: "$", rating: 4.4, description_en: "Winding alleys and traditional mud-brick houses from the old merchant quarter", description_ar: "أزقة متعرجة وبيوت طينية تقليدية من حي التجار القديم" },
      { type: "attraction", name_en: "Al-Ahsa Palm Farms", name_ar: "مزارع نخيل الأحساء", category: "natural_landmark", category_ar: "معلم طبيعي", address: "Throughout Al-Ahsa Oasis", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3950, lng: 49.6100 }, priceRange: "$", rating: 4.6, description_en: "Sprawling palm farms producing world-famous Khalas, Shishi, and Ruzeiz dates", description_ar: "مزارع نخيل مترامية تنتج تمور خلاص وشيشي ورزيز المشهورة عالمياً" },
      { type: "attraction", name_en: "Al Mubarraz Corniche", name_ar: "كورنيش المبرز", category: "entertainment", category_ar: "ترفيه", address: "Al Mubarraz Lake", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4400, lng: 49.5600 }, priceRange: "$", rating: 4.0, description_en: "Lakeside promenade with walking paths, playgrounds, and family recreation areas", description_ar: "ممشى على البحيرة مع مسارات مشي وملاعب ومناطق ترفيه عائلية" },
      { type: "attraction", name_en: "Al Uqair Beach & Fort", name_ar: "شاطئ وقلعة العقير", category: "historical_site", category_ar: "موقع تاريخي", address: "Al Uqair, 80km from Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.6380, lng: 50.2070 }, priceRange: "$", rating: 4.5, description_en: "Historic port with Ottoman fort ruins on a pristine Arabian Gulf beach", description_ar: "ميناء تاريخي مع أطلال قلعة عثمانية على شاطئ بكر على الخليج العربي" },

      // === EVENTS & TOURS (10) ===
      { type: "event", name_en: "Al-Ahsa Dates Festival", name_ar: "مهرجان تمور الأحساء", category: "seasonal_event", category_ar: "موسم", address: "Date Market, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3570, lng: 49.5840 }, priceRange: "$", rating: 4.7, description_en: "Annual harvest festival celebrating Al-Ahsa's world-famous dates (Aug-Oct)", description_ar: "مهرجان حصاد سنوي يحتفي بتمور الأحساء المشهورة عالمياً (أغسطس-أكتوبر)" },
      { type: "event", name_en: "Al-Ahsa Heritage Festival", name_ar: "مهرجان الأحساء التراثي", category: "seasonal_event", category_ar: "موسم", address: "Ibrahim Palace, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3784, lng: 49.5860 }, priceRange: "$", rating: 4.5, description_en: "Cultural festival with traditional crafts, Hasawi arts, and folk performances", description_ar: "مهرجان ثقافي بحرف تقليدية وفنون حساوية وعروض شعبية" },
      { type: "tour", name_en: "Al Qarah Caves Tour", name_ar: "جولة كهوف القارة", category: "adventure", category_ar: "مغامرة", address: "Al Qarah Mountain", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.4070, lng: 49.6890 }, phone: "+966 50 555 1234", priceRange: "$$", rating: 4.8, description_en: "Guided exploration of the naturally cool caves inside Al Qarah mountain", description_ar: "استكشاف مرشد للكهوف الباردة طبيعياً داخل جبل القارة" },
      { type: "tour", name_en: "Oasis Heritage Walking Tour", name_ar: "جولة مشي تراث الواحة", category: "cultural_tour", category_ar: "جولة ثقافية", address: "Souq Al Qaisariya, Hofuf", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3565, lng: 49.5895 }, phone: "+966 50 666 5678", priceRange: "$", rating: 4.6, description_en: "Walk through 400-year-old souq, Ibrahim Palace, and old quarter with local guide", description_ar: "جولة مشي في السوق عمره 400 عام وقصر إبراهيم والحي القديم مع مرشد محلي" },
      { type: "tour", name_en: "Al-Ahsa Desert Safari", name_ar: "سفاري صحراء الأحساء", category: "adventure", category_ar: "مغامرة", address: "Al-Ahsa Desert, South of Oasis", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.2000, lng: 49.6000 }, phone: "+966 50 777 9012", priceRange: "$$", rating: 4.5, description_en: "4x4 dune bashing in Al-Ahsa sands with Bedouin camp dinner and stargazing", description_ar: "تطعيس في رمال الأحساء مع عشاء مخيم بدوي ومراقبة النجوم" },
      { type: "tour", name_en: "Palm Farm Experience", name_ar: "تجربة مزرعة النخيل", category: "cultural_tour", category_ar: "جولة ثقافية", address: "Al-Ahsa Oasis Farms", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3950, lng: 49.6100 }, phone: "+966 50 888 3456", priceRange: "$$", rating: 4.7, description_en: "Visit a traditional palm farm — learn date harvesting, taste 20+ varieties, and make date syrup", description_ar: "زيارة مزرعة نخيل تقليدية - تعلم حصاد التمور وتذوق أكثر من 20 صنفاً وصنع دبس التمر" },
      { type: "tour", name_en: "Al Uqair Coastal Trip", name_ar: "رحلة ساحل العقير", category: "adventure", category_ar: "مغامرة", address: "Al Uqair Port", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.6380, lng: 50.2070 }, phone: "+966 50 999 7890", priceRange: "$$", rating: 4.4, description_en: "Day trip to the historic Al Uqair port — fort ruins, beach, and Gulf seafood lunch", description_ar: "رحلة يوم لميناء العقير التاريخي - أطلال القلعة والشاطئ وغداء مأكولات بحرية" },
      { type: "event", name_en: "Hasawi Nights", name_ar: "ليالي حساوية", category: "seasonal_event", category_ar: "موسم", address: "Various venues, Al-Ahsa", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3600, lng: 49.5870 }, priceRange: "$$", rating: 4.4, description_en: "Evening cultural events with Hasawi music, poetry, and traditional performances", description_ar: "فعاليات ثقافية مسائية بموسيقى وشعر وعروض تقليدية حساوية" },
      { type: "tour", name_en: "Natural Springs Tour", name_ar: "جولة العيون الطبيعية", category: "cultural_tour", category_ar: "جولة ثقافية", address: "Al-Ahsa Springs", city: "Hofuf", region: "Eastern Province", coordinates: { lat: 25.3650, lng: 49.5950 }, phone: "+966 50 111 2345", priceRange: "$", rating: 4.5, description_en: "Visit Al-Ahsa's legendary springs — Ain Al Hara, Ain Najm, Ain Um Sabaa, and more", description_ar: "زيارة عيون الأحساء الأسطورية - عين الحارة وعين نجم وعين أم سبعة وغيرها" },
      { type: "event", name_en: "Al-Ahsa Food Festival", name_ar: "مهرجان الأحساء للطعام", category: "seasonal_event", category_ar: "موسم", address: "Al Mubarraz Events Center", city: "Mubarraz", region: "Eastern Province", coordinates: { lat: 25.4200, lng: 49.5750 }, priceRange: "$$", rating: 4.3, description_en: "Annual food festival showcasing Hasawi cuisine, cooking competitions, and local produce", description_ar: "مهرجان طعام سنوي يعرض المطبخ الحساوي ومسابقات الطبخ والمنتجات المحلية" },
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

    await enforceRateLimit(
      ctx,
      `listing:${user._id}`,
      20,
      "لقد وصلت إلى الحد اليومي لإضافة الأماكن. يرجى المحاولة غدًا. / You've reached today's limit for new listings. Please try again tomorrow."
    );

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
