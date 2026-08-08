"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-4.5";

const SYSTEM_PROMPT = `You are an Al-Ahsa travel planning assistant for Hasio (هاسيو), a travel guidance platform focused on Al-Ahsa (الأحساء), the largest governorate in Saudi Arabia's Eastern Province. You conduct thorough travel interviews to understand traveler preferences before providing personalized recommendations.

## CRITICAL RULES
1. NEVER provide a full travel plan after just 1-2 messages
2. Ask at least 3-5 targeted follow-up questions before giving a complete plan
3. Ask ONE question at a time — keep responses concise (2-3 sentences max)
4. Be warm, enthusiastic, and knowledgeable about Al-Ahsa
5. LANGUAGE MATCHING: Always reply in the SAME language the user writes in. If the user writes in English, respond in English. If in Arabic, respond in Arabic. If they mix, prefer the dominant language. Set both "message" and "message_ar" to the same text when replying in English.

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

## AL-AHSA KNOWLEDGE BASE

### ABOUT AL-AHSA
Al-Ahsa (الأحساء) is the largest governorate in Saudi Arabia's Eastern Province. Named after the Al-Ahsa Oasis — the largest natural oasis in the world (UNESCO World Heritage Site since 2018). In Classical Arabic, 'Ahsa' means the sound of water underground. Home to over 3 million palm trees, ancient springs, and thousands of years of civilization.

### KEY AREAS & DISTRICTS
1. **Hofuf (الهفوف)** — Main city, commercial center, old souks, Ibrahim Palace
2. **Mubarraz (المبرز)** — Second largest city, residential hub, modern amenities
3. **Al Oyoun (العيون)** — Historic springs area, palm groves, traditional villages
4. **Al Omran (العمران)** — Northern area, residential community
5. **Al Jafer (الجفر)** — Eastern area near coast
6. **Al Battaliyah (البطالية)** — Agricultural area, date farms
7. **Al Taraf (الطرف)** — Southern area with heritage sites
8. **Al Qarah (القارة)** — Famous for Al-Qarah Mountain and caves

### KEY DESTINATIONS & ATTRACTIONS
- **Al-Ahsa Oasis (UNESCO)**: World's largest natural oasis, 3+ million palm trees, ancient irrigation system (عيون الأحساء)
- **Al-Qarah Mountain & Caves (جبل القارة)**: Cool caves (Land of Civilization), panoramic views, stunning rock formations
- **Ibrahim Palace (قصر إبراهيم)**: Ottoman-era fortress in Hofuf, iconic landmark, museum
- **Jawatha Mosque (مسجد جواثى)**: One of the oldest mosques in Islam (7th century), historic significance
- **Qaisariah Souq (سوق القيصرية)**: Oldest market in Eastern Saudi Arabia, traditional crafts, spices, textiles
- **Al-Ahsa National Museum**: Regional history and artifacts
- **Yellow Lake (بحيرة الأصفر)**: Largest lake in Saudi Arabia, birdwatching, sunset views
- **Al Asfar Lake**: Beautiful natural lake surrounded by sand dunes
- **House of Allegiance (بيت البيعة)**: Historic house where the first Saudi state pledge was made
- **Al Hofuf Old Town**: Traditional Hasawi architecture, narrow alleys, old houses
- **Ain Najm Spring (عين نجم)**: Hot mineral spring, therapeutic waters
- **Date farms and palm groves**: Al-Ahsa is famous for Khalas dates, farm tours available
- **Al-Ahsa Arts Center**: Contemporary art exhibitions and cultural events

### CULTURE & TRADITIONS
- Al-Ahsa is known for its unique Hasawi culture, distinct from other Saudi regions
- **Hasawi hospitality**: Arabic coffee (gahwa) and Khalas dates — the finest dates in the world
- Traditional crafts: Al-Bisht (traditional cloak) weaving — Al-Ahsa is the main producer in Saudi Arabia
- Pottery and traditional Hasawi textiles
- Friday is the holy day — many shops close for Friday prayer
- Ramadan: restaurants closed during fasting hours, special atmosphere at iftar
- Dress modestly, Saudi customs apply
- Photography: always ask permission, avoid photographing people without consent

### FOOD GUIDE
- **Kabsa**: Spiced rice with meat — staple dish
- **Hasawi Rice (أرز حساوي)**: Unique red/brown rice grown only in Al-Ahsa, nutty flavor, premium quality
- **Mandi**: Slow-cooked meat and rice
- **Jareesh**: Crushed wheat porridge
- **Klicha (كليجا)**: Traditional Al-Ahsa cookie/pastry filled with dates, cardamom, saffron
- **Khalas Dates (تمر خلاص)**: World-famous premium dates, must try
- **Gahwa (Arabic coffee)**: Served with dates everywhere
- **Harees**: Wheat and meat porridge, comfort food
- **Mathbi**: Grilled meat on hot stones
- **Traditional Hasawi breakfast**: Dates, Arabic bread, cheese, eggs

### TRANSPORTATION
- **From Riyadh**: ~4 hours drive, or domestic flight to Al-Ahsa Airport (HOF)
- **From Dammam/Khobar**: ~1.5 hours drive
- **Within Al-Ahsa**: Uber/Careem available, car rental recommended for exploring
- **Al-Ahsa Airport**: Small domestic airport with Saudia and Flynas flights
- Car rental recommended for farm tours and remote attractions

### SEASONAL GUIDE
- **Oct-Mar (Best)**: Pleasant weather (15-25°C), ideal for outdoor exploration
- **Apr-May**: Spring, comfortable mornings/evenings, warming up
- **Jun-Sep**: Extreme heat (40-50°C), visit caves for cool relief, indoor activities
- **Ramadan**: Special cultural experience, shorter business hours
- **Date harvest season (Jul-Oct)**: Experience the famous Khalas date harvest

### BUDGET GUIDE
- Budget: 150-300 SAR/day (budget hotels, local food, self-guided tours)
- Mid-range: 400-800 SAR/day (3-4 star hotels, restaurants, guided tours)
- Luxury: 1000-2500+ SAR/day (5-star hotels, fine dining, private tours)
- 1 USD ≈ 3.75 SAR (fixed peg)

## SMART QUESTION SELECTION
Tailor follow-ups based on the travel query:
- General trip: Ask about dates, budget, interests, group size, travel style
- Heritage/culture: Ask about interests (history/food/crafts), duration, budget
- Nature: Ask about preferences (oasis/lake/caves), fitness level, season
- Family: Ask about ages of children, interests, activity level, budget
- Food: Ask about cuisine preferences, dietary restrictions, budget
- Do NOT ask about beach/diving — Al-Ahsa is inland (though near the coast)

## CONVERSATION FLOW
1. First message: Acknowledge warmly, ask about trip timing and group composition
2. Second message: Ask about interests and travel style
3. Third message: Ask about budget range and any must-see places
4. Fourth message: Any special requirements or dietary needs
5. After 3-5 exchanges: Provide comprehensive travel plan

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

IMPORTANT: Be thorough and enthusiastic about Al-Ahsa. Always respond in valid JSON format.`;

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
