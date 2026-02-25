// Al-Ahsa Oasis Comprehensive Knowledge Base for Voice Assistant

export const AL_AHSA_KNOWLEDGE = {
  // Basic Facts
  overview: {
    name: "Al-Ahsa Oasis",
    nameAr: "واحة الأحساء",
    location: "Eastern Province, Saudi Arabia",
    unescoStatus: "UNESCO World Heritage Site since 2018",
    size: "World's largest natural oasis with over 2.5 million date palm trees",
    population: "Over 1.2 million people",
    mainCity: "Al-Hofuf (الهفوف)",
    climate: "Hot desert climate, best visited October to April",
  },

  // Major Attractions
  attractions: {
    jabalAlQara: {
      name: "Jabal Al-Qara (Al-Qarah Mountain)",
      nameAr: "جبل القارة",
      description: "Famous mountain with natural caves that stay cool year-round (17-20°C). Features stunning rock formations and panoramic oasis views.",
      highlights: ["Natural air-conditioned caves", "Land of Civilization museum", "Sunset viewpoints"],
      bestTime: "Morning or late afternoon",
      duration: "2-3 hours",
    },
    ibrahimPalace: {
      name: "Ibrahim Palace (Qasr Ibrahim)",
      nameAr: "قصر إبراهيم",
      description: "Historic Ottoman fortress built in the 16th century. Features a mosque, military barracks, and Ottoman-era architecture.",
      highlights: ["Ottoman architecture", "Historical mosque", "Cultural exhibitions"],
      bestTime: "Morning",
      duration: "1-2 hours",
    },
    alQaisariyaSouk: {
      name: "Al-Qaisariya Souk",
      nameAr: "سوق القيصرية",
      description: "One of the oldest traditional markets in Saudi Arabia, dating back over 400 years. Famous for dates, spices, textiles, and traditional crafts.",
      highlights: ["Khalas dates", "Traditional bisht (cloak)", "Handmade pottery", "Spices and incense"],
      bestTime: "Morning or evening",
      duration: "2-3 hours",
    },
    yellowLake: {
      name: "Yellow Lake (Buhayrat Al-Asfar)",
      nameAr: "بحيرة الأصفر",
      description: "Largest natural lake in the Arabian Peninsula. Great for birdwatching with over 50 species of migratory birds.",
      highlights: ["Birdwatching", "Sunset photography", "Picnic areas"],
      bestTime: "Early morning or sunset",
      duration: "1-2 hours",
    },
    alUqair: {
      name: "Al-Uqair Beach & Port",
      nameAr: "ميناء العقير",
      description: "Historic port city on the Arabian Gulf, once the main gateway for pilgrims. Features old customs buildings and beautiful beaches.",
      highlights: ["Historic port buildings", "Beach activities", "Fresh seafood", "Ottoman-era structures"],
      bestTime: "Morning or late afternoon",
      duration: "Half day",
    },
    ainNajm: {
      name: "Ain Najm Spring",
      nameAr: "عين نجم",
      description: "Historic natural spring with therapeutic warm water. One of many natural springs that feed the oasis.",
      highlights: ["Warm mineral water", "Traditional bathhouses", "Historic significance"],
      bestTime: "Any time",
      duration: "1 hour",
    },
  },

  // Famous Dates
  dates: {
    khalas: {
      name: "Khalas Dates",
      nameAr: "تمر الخلاص",
      description: "Al-Ahsa's most famous date variety, known for its caramel-like sweetness and golden color. Considered the 'King of Dates'.",
      season: "August to October",
      price: "80-150 SAR per kg for premium quality",
    },
    shishi: {
      name: "Shishi Dates",
      nameAr: "تمر الشيشي",
      description: "Small, sweet dates with a distinctive red color. Popular for everyday consumption.",
      season: "July to September",
    },
    ruzeiz: {
      name: "Ruzeiz Dates",
      nameAr: "تمر الرزيز",
      description: "Large, soft dates with a honey-like taste. Often used in traditional desserts.",
      season: "August to October",
    },
  },

  // Traditional Food
  food: {
    hasawiRice: {
      name: "Hasawi Rice (Ruz Hasawi)",
      nameAr: "الرز الحساوي",
      description: "Traditional red rice unique to Al-Ahsa, grown in the oasis for centuries. Served with lamb or chicken.",
      whereToTry: "Al-Ahsa Traditional Restaurant, local homestays",
    },
    kleeja: {
      name: "Kleeja Cookies",
      nameAr: "كليجا",
      description: "Traditional date-filled cookies, a specialty of Al-Ahsa. Perfect with Arabic coffee.",
      whereToTry: "Al-Hofuf Dates & Sweets, Al-Qaisariya Souk",
    },
    mathrooba: {
      name: "Mathrooba",
      nameAr: "المثروبة",
      description: "Traditional breakfast dish made with mashed bread, butter, and sugar or dates.",
      whereToTry: "Local homestays, traditional restaurants",
    },
    margoog: {
      name: "Margoog",
      nameAr: "المرقوق",
      description: "Traditional stew with thin bread pieces, vegetables, and meat. Comfort food of the region.",
      whereToTry: "Sultanah Kitchen, traditional restaurants",
    },
  },

  // Experiences
  experiences: {
    dateHarvest: {
      name: "Date Harvesting Experience",
      season: "August to October",
      description: "Join local farmers to harvest dates from palm trees. Learn traditional techniques passed down for generations.",
    },
    desertCamping: {
      name: "Desert Camping",
      season: "October to April",
      description: "Authentic Bedouin camping experience with camel rides, falconry demonstrations, and stargazing.",
    },
    craftWorkshops: {
      name: "Traditional Craft Workshops",
      description: "Learn pottery, weaving, or bisht making from local artisans at Al-Qaisariya Souk.",
    },
    oasisTour: {
      name: "Oasis Farm Tour",
      description: "Walk through the ancient irrigation channels (aflaj) and visit traditional date farms.",
    },
  },

  // Practical Info
  practical: {
    gettingThere: {
      fromRiyadh: "4 hours by car (350 km) or 1 hour flight to Al-Ahsa Airport",
      fromDammam: "1.5 hours by car (150 km)",
      fromBahrain: "2 hours by car via King Fahd Causeway",
    },
    bestTime: "October to April (cooler weather, date season)",
    currency: "Saudi Riyal (SAR)",
    language: "Arabic (English widely understood in hotels and tourist areas)",
    dressCode: "Modest clothing recommended. Women should carry a light abaya for visiting religious sites.",
  },

  // Hotels Summary
  hotels: {
    luxury: ["Al-Ahsa InterContinental (450-650 SAR/night)"],
    midRange: ["Lily Palms Hotel (350-500 SAR/night)", "Kayan Al Bustan Apartments (300-450 SAR/night)"],
    unique: ["Al-Ahsa Desert Camp (800-1200 SAR/night)", "Traditional Homestays (250-350 SAR/night)"],
  },
};

// System prompt for the voice assistant with comprehensive Al-Ahsa knowledge
export const HASIO_SYSTEM_PROMPT = `You are Hasio (هاسيو), the official AI voice guide for Al-Ahsa Oasis, Saudi Arabia - a UNESCO World Heritage Site and the world's largest natural oasis.

## Your Identity
- Name: Hasio (from "Hasawi" - meaning "of Al-Ahsa")
- Personality: Warm, welcoming, knowledgeable, enthusiastic about Al-Ahsa's heritage
- Speaking style: Friendly and conversational, like a local friend showing you around

## Your Deep Knowledge of Al-Ahsa

### Key Facts
- World's largest natural oasis with 2.5+ million date palm trees
- UNESCO World Heritage Site since 2018
- Located in Eastern Province, Saudi Arabia
- Main city: Al-Hofuf (الهفوف)
- Best visiting time: October to April

### Must-Visit Attractions
1. **Jabal Al-Qara (جبل القارة)** - Mountain with naturally cool caves (17-20°C year-round), stunning rock formations, Land of Civilization museum
2. **Ibrahim Palace (قصر إبراهيم)** - 16th century Ottoman fortress with mosque and military history
3. **Al-Qaisariya Souk (سوق القيصرية)** - 400+ year old traditional market, famous for Khalas dates, bisht cloaks, spices
4. **Yellow Lake (بحيرة الأصفر)** - Largest lake in Arabian Peninsula, 50+ bird species, perfect for sunset
5. **Al-Uqair Port (ميناء العقير)** - Historic port, Ottoman buildings, beautiful beaches, fresh seafood
6. **Natural Springs** - Ain Najm, Ain Al-Harra with therapeutic warm water

### Famous Dates (Al-Ahsa's Pride)
- **Khalas (الخلاص)** - "King of Dates", caramel-sweet, golden color, 80-150 SAR/kg premium
- **Shishi (الشيشي)** - Small, red, sweet dates
- **Ruzeiz (الرزيز)** - Large, soft, honey-like taste
- Season: August to October

### Traditional Food to Recommend
- **Hasawi Rice (الرز الحساوي)** - Unique red rice grown only in Al-Ahsa
- **Kleeja (كليجا)** - Date-filled cookies, perfect with Arabic coffee
- **Mathrooba (المثروبة)** - Traditional breakfast with mashed bread
- **Margoog (المرقوق)** - Comfort stew with thin bread
- **Fresh seafood from Al-Uqair** - Hammour, shrimp, fish curry

### Accommodation Options
- Luxury: Al-Ahsa InterContinental (450-650 SAR/night)
- Mid-range: Lily Palms Hotel (350-500 SAR), Kayan Apartments (300-450 SAR)
- Unique: Desert Camp (800-1200 SAR), Traditional Homestays (250-350 SAR)

### Unique Experiences
- Date harvesting (August-October)
- Desert camping with Bedouin traditions
- Craft workshops at Al-Qaisariya Souk
- Oasis farm tours through ancient irrigation channels

### Getting Here
- From Riyadh: 4 hours drive or 1 hour flight
- From Dammam: 1.5 hours drive
- From Bahrain: 2 hours via King Fahd Causeway

## Response Guidelines
1. Keep responses concise (2-3 sentences for voice)
2. Be specific - give actual names, prices, times
3. Match the user's language (Arabic or English)
4. Show enthusiasm for Al-Ahsa's heritage
5. Offer follow-up suggestions when appropriate
6. For itineraries, suggest realistic timings

## CRITICAL: Content Safety Policy (Google Play Compliance)
You MUST NEVER generate content that includes:
- Hate speech, discrimination, or harassment based on race, ethnicity, religion, gender, nationality, or any protected characteristic
- Violence, self-harm, or content encouraging dangerous activities
- Sexual or inappropriate content
- Misinformation about elections, politics, or public figures
- Scams, fraud, or deceptive practices
- Bullying or content that could harm individuals
- Illegal activities or instructions for harmful behavior

If a user requests prohibited content, politely decline and redirect to helpful travel information about Al-Ahsa.
Example: "I'm here to help you with travel information about Al-Ahsa. Let me tell you about our amazing attractions instead!"

## Example Responses
- "For the best dates, head to Al-Qaisariya Souk and look for Khalas variety - they're Al-Ahsa's pride! Expect to pay around 100 SAR per kilo for premium quality."
- "Jabal Al-Qara is magical! The caves stay naturally cool at 18 degrees even in summer. Go in the morning and spend about 2 hours exploring."
- "للعشاء، أنصحك بمطعم الأحساء التراثي - جرب الرز الحساوي مع الخروف. السعر حوالي ٨٠-١٥٠ ريال."

Remember: You are a proud local guide sharing your beloved oasis with visitors. Make them fall in love with Al-Ahsa!`;

// Bilingual fallback responses with Al-Ahsa specific knowledge
export const ALAHSA_FALLBACK_RESPONSES = {
  // Greetings
  greeting: {
    en: "Ahlan wa Sahlan! I'm Hasio, your Al-Ahsa guide. I can help you discover our UNESCO World Heritage oasis - from the cool caves of Jabal Al-Qara to the sweetest Khalas dates. What would you like to explore?",
    ar: "أهلاً وسهلاً! أنا هاسيو، دليلك في الأحساء. يسعدني مساعدتك في اكتشاف واحتنا التراثية - من كهوف جبل القارة الباردة إلى أحلى تمور الخلاص. ماذا تريد أن تستكشف؟",
  },

  // Hotels/Lodging
  hotels: {
    en: "For luxury, try Al-Ahsa InterContinental with oasis views at 450-650 SAR per night. For a unique experience, I highly recommend a traditional homestay in Old Al-Hofuf - you'll get home-cooked Hasawi meals and cultural stories for just 250-350 SAR!",
    ar: "للفخامة، فندق إنتركونتيننتال الأحساء بإطلالة الواحة ٤٥٠-٦٥٠ ريال في الليلة. للتجربة الفريدة، أنصحك بالاستضافة الشعبية في الهفوف القديمة - وجبات حساوية منزلية وقصص ثقافية بـ ٢٥٠-٣٥٠ ريال فقط!",
  },

  // Food
  food: {
    en: "You must try Hasawi rice - our unique red rice found nowhere else! Visit Al-Ahsa Traditional Restaurant for authentic cuisine, or Sultanah Kitchen for home-style cooking by local families. Don't leave without trying Kleeja cookies with Arabic coffee!",
    ar: "لازم تجرب الرز الحساوي - أرز أحمر فريد لا يوجد في مكان آخر! زر مطعم الأحساء التراثي للمأكولات الأصيلة، أو مطبخ سلطانة للطبخ المنزلي. ولا تفوت كليجا مع القهوة العربية!",
  },

  // Attractions
  attractions: {
    en: "Start with Jabal Al-Qara - the caves stay cool at 18°C even in summer! Then explore Ibrahim Palace for Ottoman history, and end at Al-Qaisariya Souk for Khalas dates and traditional crafts. Each spot needs about 2 hours.",
    ar: "ابدأ بجبل القارة - الكهوف باردة ١٨ درجة حتى في الصيف! ثم استكشف قصر إبراهيم للتاريخ العثماني، واختتم بسوق القيصرية لتمور الخلاص والحرف التراثية. كل موقع يحتاج ساعتين تقريباً.",
  },

  // Dates
  dates: {
    en: "Al-Ahsa is the date capital! Our Khalas dates are called the 'King of Dates' - look for them at Al-Qaisariya Souk, premium quality costs about 100 SAR per kilo. The harvest season is August to October - amazing time to visit!",
    ar: "الأحساء عاصمة التمور! تمر الخلاص يسمى 'ملك التمور' - ابحث عنه في سوق القيصرية، الجودة الممتازة حوالي ١٠٠ ريال للكيلو. موسم الحصاد من أغسطس إلى أكتوبر - وقت رائع للزيارة!",
  },

  // Day Planning
  itinerary: {
    en: "Perfect Al-Ahsa day: Morning at Jabal Al-Qara caves (9-11 AM), lunch at a traditional restaurant, afternoon at Ibrahim Palace and Al-Qaisariya Souk, sunset at Yellow Lake. I can help you with any of these!",
    ar: "يوم مثالي في الأحساء: صباحاً في كهوف جبل القارة (٩-١١)، غداء في مطعم تراثي، عصراً قصر إبراهيم وسوق القيصرية، غروب الشمس في بحيرة الأصفر. أقدر أساعدك في أي من هذي!",
  },

  // Default
  default: {
    en: "I'm here to help you discover Al-Ahsa! Ask me about our cool caves at Jabal Al-Qara, famous Khalas dates, traditional restaurants, hotels, or I can plan your perfect day in the oasis.",
    ar: "أنا هنا لمساعدتك في اكتشاف الأحساء! اسألني عن كهوف جبل القارة الباردة، تمور الخلاص الشهيرة، المطاعم التراثية، الفنادق، أو أقدر أخطط لك يوم مثالي في الواحة.",
  },
};

// Helper function to detect Arabic text
export function isArabicText(text: string): boolean {
  const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;
  return arabicPattern.test(text);
}

// Get appropriate fallback response based on user message
export function getAlahsaFallbackResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase();
  const isArabic = isArabicText(userMessage);
  const lang = isArabic ? 'ar' : 'en';

  // Check for Arabic keywords too
  const arabicKeywords = {
    hotel: ['فندق', 'إقامة', 'سكن', 'نوم'],
    food: ['أكل', 'طعام', 'مطعم', 'رز', 'تمر'],
    attractions: ['زيارة', 'سياحة', 'جبل', 'قصر', 'سوق', 'كهف'],
    dates: ['تمر', 'خلاص', 'نخل'],
    plan: ['خطة', 'يوم', 'برنامج', 'جدول'],
    greeting: ['مرحبا', 'أهلا', 'السلام', 'هلا'],
  };

  // Greeting detection
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey') ||
      lowerMessage.includes('مرحبا') || lowerMessage.includes('أهلا') || lowerMessage.includes('السلام')) {
    return ALAHSA_FALLBACK_RESPONSES.greeting[lang];
  }

  // Hotel/Lodging detection
  if (lowerMessage.includes('hotel') || lowerMessage.includes('stay') || lowerMessage.includes('accommodation') ||
      lowerMessage.includes('lodge') || lowerMessage.includes('sleep') ||
      arabicKeywords.hotel.some(kw => userMessage.includes(kw))) {
    return ALAHSA_FALLBACK_RESPONSES.hotels[lang];
  }

  // Food detection
  if (lowerMessage.includes('food') || lowerMessage.includes('restaurant') || lowerMessage.includes('eat') ||
      lowerMessage.includes('cuisine') || lowerMessage.includes('rice') || lowerMessage.includes('lunch') ||
      lowerMessage.includes('dinner') || lowerMessage.includes('breakfast') ||
      arabicKeywords.food.some(kw => userMessage.includes(kw))) {
    return ALAHSA_FALLBACK_RESPONSES.food[lang];
  }

  // Dates (fruit) detection
  if (lowerMessage.includes('date') || lowerMessage.includes('khalas') || lowerMessage.includes('palm') ||
      arabicKeywords.dates.some(kw => userMessage.includes(kw))) {
    return ALAHSA_FALLBACK_RESPONSES.dates[lang];
  }

  // Attractions detection
  if (lowerMessage.includes('visit') || lowerMessage.includes('see') || lowerMessage.includes('attraction') ||
      lowerMessage.includes('cave') || lowerMessage.includes('mountain') || lowerMessage.includes('palace') ||
      lowerMessage.includes('souk') || lowerMessage.includes('market') || lowerMessage.includes('lake') ||
      arabicKeywords.attractions.some(kw => userMessage.includes(kw))) {
    return ALAHSA_FALLBACK_RESPONSES.attractions[lang];
  }

  // Planning detection
  if (lowerMessage.includes('plan') || lowerMessage.includes('itinerary') || lowerMessage.includes('day') ||
      lowerMessage.includes('schedule') || lowerMessage.includes('suggest') ||
      arabicKeywords.plan.some(kw => userMessage.includes(kw))) {
    return ALAHSA_FALLBACK_RESPONSES.itinerary[lang];
  }

  // Default response
  return ALAHSA_FALLBACK_RESPONSES.default[lang];
}
