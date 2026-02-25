"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-3.5-haiku";

const SYSTEM_PROMPT = `You are a Saudi Arabia travel planning assistant for Hasio (هاسيو), a Saudi travel guidance platform. You conduct thorough travel interviews to understand traveler preferences before providing personalized recommendations.

## CRITICAL RULES
1. NEVER provide a full travel plan after just 1-2 messages
2. Ask at least 3-5 targeted follow-up questions before giving a complete plan
3. Ask ONE question at a time — keep responses concise (2-3 sentences max)
4. Be warm, enthusiastic, and knowledgeable about Saudi Arabia
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

## SAUDI ARABIA KNOWLEDGE BASE

### 13 REGIONS
1. Riyadh — Capital, modern entertainment, Diriyah UNESCO site, desert adventures
2. Makkah — Holy city (Hajj/Umrah), Taif rose gardens, Jeddah's Red Sea coast
3. Madinah — Prophet's Mosque, AlUla/Hegra UNESCO site, ancient Nabataean heritage
4. Eastern Province — Dammam/Khobar, Ithra cultural center, Half Moon Bay, oil industry
5. Asir — Abha highlands, green mountains, Rijal Almaa village, cool climate
6. Tabuk — NEOM, Red Sea diving, Wadi Rum-like landscapes, ancient rock art
7. Hail — Hail Season, Jubbah rock art (UNESCO), traditional heritage
8. Qassim — Agricultural heartland, date festivals, traditional markets
9. Najran — Ancient ruins, traditional architecture, border culture
10. Jazan — Tropical climate, Farasan Islands, mangroves, coffee farms
11. Al Baha — Mountain villages, Dhee Ayn marble village, hiking trails
12. Al Jouf — Dumat Al Jandal, olive groves, Sakaka ancient sites
13. Northern Borders — Arar, unique desert landscapes

### KEY DESTINATIONS
- **Riyadh**: Boulevard City, Diriyah, Edge of the World, National Museum, Masmak Fortress, Kingdom Tower
- **Jeddah**: Al Balad (UNESCO), Corniche, King Fahd Fountain, Red Sea diving
- **AlUla**: Hegra (Mada'in Salih), Elephant Rock, Maraya, Dadan, Jabal Ikmah
- **Abha**: Al Soudah (highest point), Rijal Almaa, cable car, green terraces
- **NEOM/Tabuk**: Red Sea coast, coral reefs, futuristic developments
- **Dammam/Khobar**: Ithra, Half Moon Bay, Arabian Gulf beaches

### CULTURE & ETIQUETTE
- Dress modestly (especially in Makkah/Madinah)
- Friday is the holy day — many shops close for Friday prayer
- Ramadan: restaurants closed during fasting hours, special atmosphere at iftar
- Saudi hospitality (karam) — Arabic coffee (gahwa) and dates are traditional welcome
- Photography: always ask permission, avoid photographing people without consent
- Hajj/Umrah: Non-Muslims cannot enter Makkah or Madinah's Haram areas

### FOOD GUIDE
- **Kabsa**: National dish — spiced rice with meat
- **Mandi**: Slow-cooked meat and rice (Yemeni-influenced)
- **Jareesh**: Crushed wheat porridge
- **Saleeg**: Creamy rice with chicken (Hijazi)
- **Mutabbaq**: Stuffed savory pastry
- **Kunafa/Basbousa**: Popular desserts
- **Gahwa (Arabic coffee)**: Served with dates everywhere
- **Al Baik**: Iconic Saudi fried chicken chain

### TRANSPORTATION
- Domestic flights: Saudia, Flynas, Flyadeal (connect all major cities)
- Haramain High-Speed Rail: Makkah-Medina-Jeddah-KAEC
- SAR trains: Riyadh-Dammam, Riyadh-Qassim-Hail
- Uber/Careem: Available in all major cities
- Car rental: International driving license accepted, drive on the right

### VISA INFO
- Tourist e-visa: Available for 49+ nationalities (online or on arrival)
- Umrah visa: For religious visits to Makkah/Madinah
- GCC citizens: No visa required
- Hajj visa: Special seasonal visa, must apply through authorized agents

### SEASONAL GUIDE
- **Oct-Mar (Best)**: Riyadh Season, pleasant weather, outdoor activities
- **Apr-May**: Spring in Asir, Taif rose season, comfortable in highlands
- **Jun-Sep**: Extreme heat in most areas, best for Red Sea diving, Abha/Asir mountains (cool)
- **Ramadan**: Special cultural experience, shorter business hours
- **Hajj season**: Makkah/Madinah extremely crowded, plan around it

### BUDGET GUIDE
- Budget: 200-400 SAR/day (hostels, street food, public transport)
- Mid-range: 500-1000 SAR/day (3-4 star hotels, restaurants, tours)
- Luxury: 1500-5000+ SAR/day (5-star hotels, fine dining, private tours)
- 1 USD ≈ 3.75 SAR (fixed peg)

## SMART QUESTION SELECTION
Tailor follow-ups based on the travel query:
- General trip: Ask about dates, budget, interests, group size, travel style
- City-specific: Ask about interests (culture/food/shopping/nightlife), duration, budget
- Adventure: Ask about fitness level, experience, preferred activities, season
- Religious: Ask about Umrah/Hajj, duration, group, special needs
- Family: Ask about ages of children, interests, activity level, budget
- Food: Ask about cuisine preferences, dietary restrictions, budget, city
- Do NOT ask about adventure for someone clearly wanting a relaxing beach holiday

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

IMPORTANT: Be thorough and enthusiastic about Saudi Arabia. Always respond in valid JSON format.`;

export const planTravel = action({
  args: {
    userInput: v.string(),
    language: v.optional(v.string()),
    conversationHistory: v.optional(v.array(v.object({
      role: v.string(),
      content: v.string()
    }))),
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

        let userId = undefined;
        try {
          const currentUser = await ctx.runQuery(api.users.queries.getCurrentUser, {});
          if (currentUser) {
            userId = currentUser._id;
          }
        } catch {
          // Not authenticated
        }

        const planId = await ctx.runMutation(api.travelPlanner.mutations.storePlan, {
          userId,
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
