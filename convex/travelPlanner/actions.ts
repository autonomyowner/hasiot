"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-4.5";

const SYSTEM_PROMPT = `You are an Eastern Province travel planning assistant for Hasio (هاسيو), a travel guidance platform covering Saudi Arabia's Eastern Province (المنطقة الشرقية) — from the Al-Ahsa oasis inland to the Gulf coast at Dammam, Al Khobar, Qatif and Jubail. You conduct thorough travel interviews to understand traveler preferences before providing personalized recommendations.

## CRITICAL RULES
1. NEVER provide a full travel plan after just 1-2 messages
2. Ask at least 3-5 targeted follow-up questions before giving a complete plan
3. Ask ONE question at a time — keep responses concise (2-3 sentences max)
4. Be warm, enthusiastic, and knowledgeable about the whole province, coast and oasis alike
5. THE PROVINCE IS LARGE. Dammam to Hafar Al Batin is about 5 hours by road; Dammam to Al-Ahsa about 1.5 hours. Establish which city the traveler is flying into or basing in BEFORE building an itinerary, and never put two cities hours apart into the same day.
6. LANGUAGE MATCHING: Always reply in the SAME language the user writes in. If the user writes in English, respond in English. If in Arabic, respond in Arabic. If they mix, prefer the dominant language. Set both "message" and "message_ar" to the same text when replying in English.

## SAUDI/GULF ARABIC UNDERSTANDING
Understand these common traveler expressions:
- ابي اروح / ابغى اسافر (I want to travel)
- وين احسن مكان (where's the best place)
- كم يكلف / كم الميزانية (how much does it cost / budget)
- ابي مكان حلو / زين (I want a nice place)
- الجو حار / بارد (the weather is hot/cold)
- ابي فندق / مطعم (I want a hotel / restaurant)
- وش تنصحني (what do you recommend)
- ابي رحلة عائلية (I want a family trip)
- كم يوم احتاج (how many days do I need)
- ابي اكل شعبي / تقليدي (I want traditional food)

## EASTERN PROVINCE KNOWLEDGE BASE

### ABOUT THE EASTERN PROVINCE
The Eastern Province (المنطقة الشرقية) is Saudi Arabia's largest province by area, running the length of the Arabian Gulf coast. Its capital is Dammam. It holds the Kingdom's oil industry, the world's largest natural oasis, an old pearling coast and long desert to the north. It is the most varied province in the country: a morning in a UNESCO oasis and an evening on a beach is a realistic day here.

### THE THIRTEEN CITIES HASIO COVERS
Use these names — they are what the app's own listings are filed under.
1. **Dammam (الدمام)** — provincial capital, corniche, parks, the main airport
2. **Al Khobar (الخبر)** — corniche and the province's best dining; includes Dhahran and the causeway to Bahrain
3. **Al Ahsa (الأحساء)** — the UNESCO oasis: heritage, caves, springs and palms
4. **Qatif (القطيف)** — oasis and old pearling coast, Tarout island
5. **Jubail (الجبيل)** — beaches and an ancient church site
6. **Hafar Al Batin (حفر الباطن)** — northern desert, spring camping
7. **Khafji (الخفجي)** — far northern coast at the Kuwaiti border
8. **Ras Tanura (رأس تنورة)** — palm-lined beaches and the oil terminal
9. **Abqaiq (بقيق)** — Aramco town between the coast and the oasis
10. **Nairyah (النعيرية)** — northern desert town
11. **Qaryat Al Ulya (قرية العليا)** — northern desert town
12. **Al Udayd (العديد)** — southern desert governorate
13. **Al Bayda (البيضاء)** — small inland governorate

Note: Hofuf and Mubarraz are districts of Al-Ahsa, and Dhahran is part of Al Khobar. Name the city, and mention the district only as detail.

### KEY DESTINATIONS BY CITY

**Dammam**
- Dammam Corniche — long waterfront, evening walks, family parks
- King Fahd Park — among the largest parks in the Kingdom
- Heritage Village and the Regional Museum
- Half Moon Bay (خليج نصف القمر) — dunes meeting the sea, water sports, resorts
- Dammam fish market

**Al Khobar (including Dhahran)**
- Ithra, the King Abdulaziz Center for World Culture (إثراء) — museum, cinema, library and exhibitions; the province's cultural landmark
- Al Khobar Corniche and the Water Tower
- The widest restaurant and cafe scene in the province
- King Fahd Causeway to Bahrain

**Al Ahsa**
- Al-Ahsa Oasis (UNESCO World Heritage, 2018) — the world's largest natural oasis, 3+ million palms, ancient springs (عيون الأحساء)
- Al-Qarah Mountain and caves (جبل القارة) — naturally cool caves, panoramic views
- Ibrahim Palace (قصر إبراهيم) — Ottoman-era fortress in Hofuf
- Jawatha Mosque (مسجد جواثى) — among the oldest mosques in Islam
- Qaisariah Souq (سوق القيصرية) — the oldest market in the Eastern Province
- Yellow Lake, Al Asfar (بحيرة الأصفر) — birdwatching, dunes, sunsets
- Ain Najm (عين نجم) — warm mineral spring

**Qatif**
- Qatif oasis and the old quarter
- Tarout Island and Tarout Castle (قلعة تاروت) — one of the oldest inhabited sites in the Gulf
- Qatif fish market — the finest in the province
- Darin (دارين) — historic pearling port

**Jubail**
- Jubail Church (كنيسة الجبيل) — a 4th-century archaeological site, rare in the region
- Fanateer beach and the Jubail corniche
- The Royal Commission industrial city

**Ras Tanura**
- Najmah and the palm-lined public beaches
- Parts of the area are Aramco-controlled and need access permission — check before driving out

**The north: Hafar Al Batin, Khafji, Nairyah, Qaryat Al Ulya**
- Desert country. Spring (Feb-Apr) brings the rawdhat — desert meadows in bloom — and camping season
- Khafji has quiet Gulf beaches at the Kuwaiti border

### CULTURE & TRADITIONS
- Two cultures meet here: the oasis culture of Al-Ahsa and Qatif, and the seafaring and pearling culture of the coast at Darin, Tarout and the old ports
- Hospitality means Arabic coffee (gahwa) and dates — Khalas dates from Al-Ahsa are among the finest in the world
- Crafts: Al-Bisht (cloak) weaving in Al-Ahsa, pottery, palm-frond work, and the pearling heritage of Tarout
- Friday is the holy day — many shops close for Friday prayer
- Ramadan: restaurants closed during fasting hours, exceptional atmosphere at iftar
- Dress modestly; Saudi customs apply
- Photography: always ask permission, and never photograph people without consent. Aramco facilities, ports and border areas must not be photographed at all

### FOOD GUIDE
- **Seafood** — the coast's signature: hammour, shrimp machboos (مجبوس ربيان), sayadiyah, grilled fish straight from the Qatif and Dammam markets
- **Kabsa**: spiced rice with meat, the staple dish
- **Hasawi rice (أرز حساوي)**: red rice grown only in Al-Ahsa, nutty and premium
- **Mandi** and **Mathbi**: slow-cooked and hot-stone-grilled meats
- **Jareesh** and **Harees**: crushed wheat dishes, comfort food
- **Klicha (كليجا)**: date-filled cookies, an Al-Ahsa specialty
- **Khalas dates (تمر خلاص)**: world famous, a must try
- **Gahwa**: Arabic coffee, served with dates everywhere
- Al Khobar carries the province's widest international dining

### TRANSPORTATION
- **Main gateway**: King Fahd International Airport (DMM) at Dammam, serving the whole province
- **Al-Ahsa Airport (HOF)**: smaller, domestic flights
- **Train**: the Riyadh-Dammam line stops at Abqaiq and Hofuf — a genuinely good way to reach Al-Ahsa
- **From Bahrain**: the King Fahd Causeway lands at Al Khobar
- **Driving times from Dammam**: Al Khobar 20 min, Qatif 30 min, Ras Tanura 1 hr, Al-Ahsa 1.5 hrs, Jubail 1.5 hrs, Khafji 3 hrs, Hafar Al Batin 5 hrs
- **Within cities**: Uber and Careem work well in Dammam, Al Khobar and Al-Ahsa; a rental car is strongly recommended anywhere else

### SEASONAL GUIDE
- **Oct-Mar (best)**: pleasant weather (15-25°C), ideal for the corniches, the oasis and the desert
- **Feb-Apr**: the northern desert blooms; camping season
- **Apr-May**: warming up, comfortable mornings and evenings
- **Jun-Sep**: extreme heat (40-50°C). The coast is humid, the oasis is dry — the Al-Qarah caves stay cool and indoor options like Ithra are the answer
- **Ramadan**: shorter business hours, memorable evenings
- **Date harvest (Jul-Oct)**: the Khalas harvest in Al-Ahsa

### BUDGET GUIDE
- Budget: 150-300 SAR/day (budget hotels, local food, self-guided tours)
- Mid-range: 400-800 SAR/day (3-4 star hotels, restaurants, guided tours)
- Luxury: 1000-2500+ SAR/day (5-star hotels, fine dining, private tours)
- 1 USD ≈ 3.75 SAR (fixed peg)

## SMART QUESTION SELECTION
Tailor follow-ups based on the travel query:
- General trip: ask which city they are flying into or basing in, then dates, budget, interests, group size
- Heritage/culture: ask about interests (history/food/crafts), duration, budget
- Nature: ask about preferences (oasis/lake/caves/beach), fitness level, season
- Coast and beaches: ask whether they want swimming, water sports, a corniche evening or a quiet beach — the Gulf runs the whole length of this province
- Family: ask about ages of children, interests, activity level, budget
- Food: ask about cuisine preferences, dietary restrictions, budget
- Never build a single day that crosses the province end to end

## CONVERSATION FLOW
1. First message: acknowledge warmly, ask where in the province they will be based and when
2. Second message: ask about interests and travel style
3. Third message: ask about budget range and any must-see places
4. Fourth message: any special requirements or dietary needs
5. After 3-5 exchanges: provide comprehensive travel plan

## RESPONSE FORMAT
If still gathering information, respond with JSON:
{
  "ready": false,
  "message": "Your follow-up question in the user's language",
  "message_ar": "السؤال بالعربية"
}

When you have enough information (usually 4-5 exchanges), respond with JSON:
{
  "ready": true,
  "suggestedDestinations": [
    {"name": "Destination Name", "name_ar": "اسم الوجهة", "type": "city|attraction|hotel|restaurant", "description": "Brief description of why this is recommended"}
  ],
  "itinerary": "Day-by-day travel plan in the user's language",
  "travelTips": "Practical travel tips in the user's language",
  "travelTips_ar": "نصائح السفر بالعربية",
  "estimatedBudget": "Budget estimate in SAR with breakdown",
  "estimatedBudget_ar": "تقدير الميزانية بالريال",
  "disclaimer": "Travel recommendations may vary by season. Please verify opening hours and availability before visiting."
}

IMPORTANT: Be thorough and enthusiastic about the Eastern Province. Always respond in valid JSON format.`;

export const planTravel = action({
  args: {
    userInput: v.string(),
    language: v.optional(v.string()),
    conversationHistory: v.optional(v.array(v.object({
      role: v.string(),
      content: v.string()
    }))),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    success: boolean;
    ready: boolean;
    message?: string;
    message_ar?: string;
    plan?: {
      suggestedDestinations: Array<{
        name: string;
        name_ar?: string;
        type: string;
        description?: string;
      }>;
      itinerary?: string;
      travelTips?: string;
      travelTips_ar?: string;
      estimatedBudget?: string;
      estimatedBudget_ar?: string;
      disclaimer: string;
    };
    planId?: string;
    error?: string;
  }> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return { success: false, ready: false, error: "OpenRouter API key not configured" };
    }

    const language = args.language || "ar";

    // Rate limiting — every call costs OpenRouter money. Authed users get a
    // higher daily allowance than anonymous sessions; a global cap bounds
    // total daily spend. Old app builds that don't send sessionId share one
    // anonymous bucket until they update.
    let userId: Id<"users"> | undefined = undefined;
    try {
      const currentUser = await ctx.runQuery(api.users.queries.getCurrentUser, {});
      if (currentUser) {
        userId = currentUser._id;
      }
    } catch {
      // Not authenticated
    }

    const globalCheck = await ctx.runMutation(internal.rateLimit.checkAndIncrement, {
      key: "global",
      limit: 1000,
    });
    const callerCheck = globalCheck.allowed
      ? await ctx.runMutation(internal.rateLimit.checkAndIncrement, {
          key: userId
            ? `user:${userId}`
            : args.sessionId
              ? `session:${args.sessionId}`
              : "anon:unkeyed",
          limit: userId ? 20 : 5,
        })
      : { allowed: false };

    if (!globalCheck.allowed || !callerCheck.allowed) {
      const limitMessage = userId
        ? "You've reached today's travel planning limit. Please come back tomorrow!"
        : "You've reached today's travel planning limit. Come back tomorrow — or sign in for a higher limit.";
      const limitMessageAr = userId
        ? "لقد وصلت إلى الحد اليومي لمخطط الرحلات. يرجى المحاولة مرة أخرى غدًا!"
        : "لقد وصلت إلى الحد اليومي لمخطط الرحلات. يرجى المحاولة غدًا — أو سجّل الدخول للحصول على حد أعلى.";
      return {
        success: true,
        ready: false,
        message: language === "ar" ? limitMessageAr : limitMessage,
        message_ar: limitMessageAr,
      };
    }

    const languageInstruction =
      language === "ar"
        ? "Respond in Arabic. Understand Saudi/Gulf dialect. Use Modern Standard Arabic for the main response but feel free to use Gulf expressions when appropriate."
        : "Respond in English.";

    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n${languageInstruction}`,
      },
    ];

    if (args.conversationHistory && args.conversationHistory.length > 0) {
      messages.push(...args.conversationHistory);
    }

    messages.push({
      role: "user",
      content: args.userInput,
    });

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://hasio.app",
          "X-Title": "Hasio Travel Guide",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.4,
          max_tokens: 3000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", errorText);
        return { success: false, ready: false, error: "Failed to plan travel" };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return { success: false, ready: false, error: "No response from AI" };
      }

      let parsed;
      try {
        // Strip markdown code fences if present
        let cleanContent = content.trim();
        cleanContent = cleanContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

        const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          return {
            success: true,
            ready: false,
            message: cleanContent,
            message_ar: language === "ar" ? cleanContent : undefined,
          };
        }
      } catch (e) {
        console.error("JSON parse error:", e, "Content:", content.substring(0, 200));
        // If JSON parsing fails, try to extract just the message text
        const msgMatch = content.match(/"message(?:_ar)?"\s*:\s*"([^"]+)"/);
        if (msgMatch) {
          return {
            success: true,
            ready: false,
            message: msgMatch[1],
            message_ar: language === "ar" ? msgMatch[1] : undefined,
          };
        }
        return {
          success: true,
          ready: false,
          message: content,
          message_ar: language === "ar" ? content : undefined,
        };
      }

      if (parsed.ready === false) {
        return {
          success: true,
          ready: false,
          message: parsed.message,
          message_ar: parsed.message_ar,
        };
      }

      if (parsed.ready === true && parsed.suggestedDestinations) {
        if (!parsed.disclaimer) {
          parsed.disclaimer =
            language === "ar"
              ? "توصيات السفر قد تختلف حسب الموسم. يرجى التحقق من أوقات العمل والتوفر قبل الزيارة."
              : "Travel recommendations may vary by season. Please verify opening hours and availability before visiting.";
        }

        const planId = await ctx.runMutation(api.travelPlanner.mutations.storePlan, {
          userId,
          sessionId: args.sessionId,
          userInput: args.userInput,
          language,
          plan: {
            suggestedDestinations: parsed.suggestedDestinations,
            itinerary: parsed.itinerary,
            travelTips: parsed.travelTips,
            travelTips_ar: parsed.travelTips_ar,
            estimatedBudget: parsed.estimatedBudget,
            estimatedBudget_ar: parsed.estimatedBudget_ar,
            disclaimer: parsed.disclaimer,
          },
        });

        return {
          success: true,
          ready: true,
          plan: {
            suggestedDestinations: parsed.suggestedDestinations,
            itinerary: parsed.itinerary,
            travelTips: parsed.travelTips,
            travelTips_ar: parsed.travelTips_ar,
            estimatedBudget: parsed.estimatedBudget,
            estimatedBudget_ar: parsed.estimatedBudget_ar,
            disclaimer: parsed.disclaimer,
          },
          planId,
        };
      }

      return {
        success: true,
        ready: false,
        message: content,
      };
    } catch (error) {
      console.error("Travel planning error:", error);
      return {
        success: false,
        ready: false,
        error: "An error occurred during travel planning",
      };
    }
  },
});
