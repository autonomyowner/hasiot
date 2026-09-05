import { internalMutation } from "../_generated/server";

/**
 * Seed listings for the Eastern Province OUTSIDE Al-Ahsa.
 *
 * This is deliberately NOT part of `seedListings`, which opens by deleting
 * every row in the table. That is fine for a fresh dev database and ruinous on
 * production, where owner-posted listings, priced hotels, bookings, reviews and
 * favourites all point at existing ids. This mutation only ever inserts, and
 * skips any name it already finds, so it is safe to run against prod and safe
 * to run twice.
 *
 * What is in here, and what is not:
 * - Public places — corniches, beaches, museums, forts, markets. They cost
 *   nothing to visit, so a listing that is slightly wrong wastes nobody's money.
 * - A few real, long-established hotels and restaurants, with NO invented phone
 *   number and NO `pricePerNight`. A hotel is only bookable once it has a rate
 *   (see `useConvexData`), so these appear in the directory without offering a
 *   room nobody has agreed to sell. Price them from the admin panel when a real
 *   agreement exists.
 * - No `rating`. The seeded catalogue used to carry invented scores on 54 of 55
 *   rows; `admin/devTools:clearSeededRatings` cleaned that up and this must not
 *   reintroduce it.
 * - NO images. Stock photos of the wrong beach are worse than no photo at all,
 *   and the cards fall back to a warm sand panel. Real photographs are attached
 *   separately by `attachListingImages`, from files the owner supplies.
 *
 * Five of the thirteen cities are absent — Abqaiq, Nairyah, Qaryat Al Ulya,
 * Al Udayd and Al Bayda. They are industrial or sparsely populated desert
 * governorates with no public attraction that could be named with confidence,
 * and inventing one would be worse than an empty filter.
 *
 * Coordinates are accurate to roughly a kilometre — enough for a directions
 * link to land in the right district. The address line carries the detail.
 */

type Seed = {
  type: string;
  name_en: string;
  name_ar: string;
  category: string;
  category_ar: string;
  address: string;
  city: string;
  coordinates: { lat: number; lng: number };
  priceRange?: string;
  description_en: string;
  description_ar: string;
};

const LISTINGS: Seed[] = [
  // === DAMMAM ===
  {
    type: "attraction", name_en: "Dammam Corniche", name_ar: "كورنيش الدمام",
    category: "entertainment", category_ar: "ترفيه",
    address: "Corniche Road, Dammam", city: "Dammam",
    coordinates: { lat: 26.452, lng: 50.108 },
    description_en: "Kilometres of Gulf waterfront with gardens, play areas and evening walks — the city's living room after sunset.",
    description_ar: "واجهة بحرية ممتدة على الخليج بحدائق وألعاب وممشى مسائي — متنفس المدينة بعد الغروب.",
  },
  {
    type: "attraction", name_en: "King Fahd Park Dammam", name_ar: "حديقة الملك فهد بالدمام",
    category: "entertainment", category_ar: "ترفيه",
    address: "King Fahd Park, Dammam", city: "Dammam",
    coordinates: { lat: 26.396, lng: 50.079 },
    description_en: "One of the largest parks in the Kingdom: lakes, lawns, a small train and shaded picnic ground.",
    description_ar: "من أكبر الحدائق في المملكة: بحيرات ومساحات خضراء وقطار صغير وأماكن للجلوس تحت الظل.",
  },
  {
    type: "attraction", name_en: "Half Moon Bay", name_ar: "خليج نصف القمر",
    category: "natural_landmark", category_ar: "معلم طبيعي",
    address: "Half Moon Bay, south of Dammam", city: "Dammam",
    coordinates: { lat: 26.14, lng: 50.16 },
    description_en: "A crescent of sand where the dunes meet the Gulf. Swimming, water sports, horse riding and resorts along the shore.",
    description_ar: "خليج على شكل هلال تلتقي فيه الكثبان بالخليج. سباحة ورياضات مائية وركوب خيل ومنتجعات على الشاطئ.",
  },
  {
    type: "attraction", name_en: "Dammam Regional Museum", name_ar: "متحف الدمام الإقليمي",
    category: "museum", category_ar: "متحف",
    address: "Dammam", city: "Dammam",
    coordinates: { lat: 26.434, lng: 50.103 },
    description_en: "The archaeology and heritage of the Eastern Province, from Dilmun-era finds to the pearling age.",
    description_ar: "آثار المنطقة الشرقية وتراثها، من عصر دلمون إلى زمن الغوص على اللؤلؤ.",
  },
  {
    type: "attraction", name_en: "Dammam Central Fish Market", name_ar: "سوق السمك المركزي بالدمام",
    category: "market", category_ar: "سوق",
    address: "Fish Market, Dammam Port area", city: "Dammam",
    coordinates: { lat: 26.447, lng: 50.112 },
    description_en: "The morning catch straight off the Gulf boats — hammour, shrimp, kingfish. Pick your fish and have it grilled on the spot.",
    description_ar: "صيد الصباح مباشرة من قوارب الخليج — هامور وربيان وكنعد. اختر سمكتك واطلب شواءها في الحال.",
  },
  {
    type: "hotel", name_en: "Sheraton Dammam Hotel & Convention Centre", name_ar: "شيراتون الدمام",
    category: "business_hotel", category_ar: "فندق أعمال",
    address: "1st Street, Dammam", city: "Dammam",
    coordinates: { lat: 26.427, lng: 50.104 },
    priceRange: "$$$",
    description_en: "Long-established business hotel in central Dammam, close to the corniche.",
    description_ar: "فندق أعمال عريق في وسط الدمام، قريب من الكورنيش.",
  },
  {
    type: "restaurant", name_en: "Al Baik Dammam", name_ar: "البيك الدمام",
    category: "fast_food", category_ar: "وجبات سريعة",
    address: "Dammam", city: "Dammam",
    coordinates: { lat: 26.43, lng: 50.1 },
    priceRange: "$",
    description_en: "Saudi Arabia's beloved fried chicken — the Dammam branches.",
    description_ar: "الدجاج المقلي المحبوب في السعودية — فروع الدمام.",
  },

  // === AL KHOBAR (includes Dhahran) ===
  {
    type: "attraction", name_en: "Ithra — King Abdulaziz Center for World Culture", name_ar: "إثراء — مركز الملك عبدالعزيز الثقافي العالمي",
    category: "museum", category_ar: "متحف",
    address: "Dhahran, Al Khobar", city: "Al Khobar",
    coordinates: { lat: 26.3049, lng: 50.1443 },
    description_en: "The province's cultural landmark: museums, a children's museum, cinema, library, theatre and a rolling exhibition programme, inside an unmistakable building.",
    description_ar: "معلم الشرقية الثقافي: متاحف ومتحف للأطفال وسينما ومكتبة ومسرح وبرنامج معارض متجدد، داخل مبنى لا يُنسى.",
  },
  {
    type: "attraction", name_en: "Al Khobar Corniche", name_ar: "كورنيش الخبر",
    category: "entertainment", category_ar: "ترفيه",
    address: "Prince Faisal bin Fahd Road, Al Khobar", city: "Al Khobar",
    coordinates: { lat: 26.284, lng: 50.211 },
    description_en: "A long seafront promenade facing Bahrain, lined with cafes and a favourite for evening walks.",
    description_ar: "ممشى بحري طويل يطل باتجاه البحرين، تحفّه المقاهي وهو المفضل للمشي مساءً.",
  },
  {
    type: "attraction", name_en: "Al Khobar Water Tower", name_ar: "برج الماء بالخبر",
    category: "historical_site", category_ar: "موقع تاريخي",
    address: "Corniche, Al Khobar", city: "Al Khobar",
    coordinates: { lat: 26.2895, lng: 50.2073 },
    description_en: "The city's best-known silhouette, standing over the corniche and lit after dark.",
    description_ar: "أشهر معالم المدينة، يقف على الكورنيش ويُضاء بعد المغيب.",
  },
  {
    type: "attraction", name_en: "King Fahd Causeway", name_ar: "جسر الملك فهد",
    category: "entertainment", category_ar: "ترفيه",
    address: "Causeway Road, Al Khobar", city: "Al Khobar",
    coordinates: { lat: 26.174, lng: 50.129 },
    description_en: "The 25 km crossing to Bahrain, with a viewing tower and restaurant at the midpoint.",
    description_ar: "معبر بطول 25 كم إلى البحرين، وفي منتصفه برج للمشاهدة ومطعم.",
  },
  {
    type: "hotel", name_en: "Le Meridien Al Khobar", name_ar: "لو ميريديان الخبر",
    category: "business_hotel", category_ar: "فندق أعمال",
    address: "Corniche, Al Khobar", city: "Al Khobar",
    coordinates: { lat: 26.287, lng: 50.201 },
    priceRange: "$$$$",
    description_en: "Long-standing hotel near the Khobar corniche and the causeway road.",
    description_ar: "فندق عريق قرب كورنيش الخبر وطريق الجسر.",
  },
  {
    type: "restaurant", name_en: "Al Romansiah Al Khobar", name_ar: "الرومانسية الخبر",
    category: "traditional_food", category_ar: "مطبخ تقليدي",
    address: "Al Khobar", city: "Al Khobar",
    coordinates: { lat: 26.29, lng: 50.199 },
    priceRange: "$$",
    description_en: "The Saudi favourite for kabsa, mandi and mathlouta — generous portions, family sections.",
    description_ar: "الوجهة السعودية المفضلة للكبسة والمندي والمثلوثة — أطباق كريمة وأقسام عائلية.",
  },

  // === QATIF ===
  {
    type: "attraction", name_en: "Tarout Castle", name_ar: "قلعة تاروت",
    category: "historical_site", category_ar: "موقع تاريخي",
    address: "Tarout Island, Qatif", city: "Qatif",
    coordinates: { lat: 26.5733, lng: 50.0553 },
    description_en: "A fortress on one of the oldest continuously inhabited sites in the Gulf, above the old quarter of Tarout island.",
    description_ar: "قلعة على واحد من أقدم المواقع المأهولة في الخليج، تعلو الحي القديم في جزيرة تاروت.",
  },
  {
    type: "attraction", name_en: "Qatif Fish Market", name_ar: "سوق السمك بالقطيف",
    category: "market", category_ar: "سوق",
    address: "Qatif", city: "Qatif",
    coordinates: { lat: 26.557, lng: 50.013 },
    description_en: "Widely held to be the best fish market in the province, busiest early in the morning.",
    description_ar: "يُعدّ من أفضل أسواق السمك في المنطقة، وأنشط ما يكون في الصباح الباكر.",
  },
  {
    type: "attraction", name_en: "Qatif Oasis", name_ar: "واحة القطيف",
    category: "natural_landmark", category_ar: "معلم طبيعي",
    address: "Qatif", city: "Qatif",
    coordinates: { lat: 26.545, lng: 50.0 },
    description_en: "Palm groves and old irrigation channels running down to the shore — a coastal oasis, unlike any other in the Kingdom.",
    description_ar: "بساتين نخيل وقنوات ري قديمة تمتد حتى الساحل — واحة بحرية لا مثيل لها في المملكة.",
  },
  {
    type: "attraction", name_en: "Darin Port and Castle", name_ar: "ميناء وقلعة دارين",
    category: "historical_site", category_ar: "موقع تاريخي",
    address: "Darin, Tarout Island, Qatif", city: "Qatif",
    coordinates: { lat: 26.53, lng: 50.08 },
    description_en: "The old pearling harbour of the Eastern coast, with the remains of its castle and merchant houses.",
    description_ar: "ميناء الغوص على اللؤلؤ القديم على الساحل الشرقي، وبقايا قلعته وبيوت تجّاره.",
  },

  // === JUBAIL ===
  {
    type: "attraction", name_en: "Jubail Church", name_ar: "كنيسة الجبيل الأثرية",
    category: "historical_site", category_ar: "موقع تاريخي",
    address: "Jubail", city: "Jubail",
    coordinates: { lat: 27.035, lng: 49.66 },
    description_en: "A 4th-century church, among the oldest known in the Gulf and a rare survival from the region's pre-Islamic centuries.",
    description_ar: "كنيسة تعود إلى القرن الرابع الميلادي، من أقدم ما عُرف في الخليج وشاهد نادر على قرون ما قبل الإسلام.",
  },
  {
    type: "attraction", name_en: "Fanateer Beach", name_ar: "شاطئ الفناتير",
    category: "natural_landmark", category_ar: "معلم طبيعي",
    address: "Fanateer, Jubail", city: "Jubail",
    coordinates: { lat: 27.048, lng: 49.632 },
    description_en: "Jubail's family beach: shallow, calm water, a long promenade and cafes behind the sand.",
    description_ar: "شاطئ الجبيل العائلي: مياه ضحلة هادئة وممشى طويل ومقاهٍ خلف الرمال.",
  },
  {
    type: "attraction", name_en: "Jubail Corniche", name_ar: "كورنيش الجبيل",
    category: "entertainment", category_ar: "ترفيه",
    address: "Jubail", city: "Jubail",
    coordinates: { lat: 27.01, lng: 49.658 },
    description_en: "Waterfront gardens and walkways along the Gulf, busy on winter evenings.",
    description_ar: "حدائق وممشى على الواجهة البحرية، تزدحم في أمسيات الشتاء.",
  },

  // === RAS TANURA ===
  {
    type: "attraction", name_en: "Ras Tanura Beach", name_ar: "شاطئ رأس تنورة",
    category: "natural_landmark", category_ar: "معلم طبيعي",
    address: "Ras Tanura", city: "Ras Tanura",
    coordinates: { lat: 26.654, lng: 50.1626 },
    description_en: "Palm-backed sand on the peninsula north of Dammam. Parts of the area are Aramco-controlled, so check access before setting out.",
    description_ar: "رمال يظللها النخيل في شبه الجزيرة شمال الدمام. بعض المناطق تتبع أرامكو، لذا تأكد من إمكانية الدخول قبل التوجه.",
  },

  // === KHAFJI ===
  {
    type: "attraction", name_en: "Khafji Corniche", name_ar: "كورنيش الخفجي",
    category: "entertainment", category_ar: "ترفيه",
    address: "Khafji", city: "Khafji",
    coordinates: { lat: 28.439, lng: 48.491 },
    description_en: "The quiet northern end of the Kingdom's Gulf coast, at the Kuwaiti border.",
    description_ar: "الطرف الشمالي الهادئ من ساحل المملكة على الخليج، عند الحدود الكويتية.",
  },
  {
    type: "attraction", name_en: "Khafji Beach", name_ar: "شاطئ الخفجي",
    category: "natural_landmark", category_ar: "معلم طبيعي",
    address: "Khafji", city: "Khafji",
    coordinates: { lat: 28.425, lng: 48.505 },
    description_en: "Long, empty sand with almost no crowds — the province's most remote swimming.",
    description_ar: "رمال طويلة خالية تقريباً من الزحام — أبعد أماكن السباحة في المنطقة.",
  },

  // === HAFAR AL BATIN ===
  {
    type: "attraction", name_en: "Wadi Al Batin", name_ar: "وادي الباطن",
    category: "natural_landmark", category_ar: "معلم طبيعي",
    address: "Hafar Al Batin", city: "Hafar Al Batin",
    coordinates: { lat: 28.4337, lng: 45.9601 },
    description_en: "The broad desert valley the city is named for. After the winter rains it greens over and the camping season begins.",
    description_ar: "الوادي الصحراوي الواسع الذي سُمّيت المدينة عليه. بعد أمطار الشتاء يخضرّ ويبدأ موسم التخييم.",
  },
];

export const seedEasternProvince = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("listings").collect();
    const taken = new Set(existing.map((l) => l.name_en));
    const now = Date.now();

    let inserted = 0;
    const skipped: string[] = [];

    for (const listing of LISTINGS) {
      if (taken.has(listing.name_en)) {
        skipped.push(listing.name_en);
        continue;
      }
      await ctx.db.insert("listings", {
        ...listing,
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

    return { inserted, skipped, totalAfter: existing.length + inserted };
  },
});
