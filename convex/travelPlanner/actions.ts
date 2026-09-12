"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import {
  asText,
  buildContextBlock,
  extractJsonObject,
  normaliseDestinations,
} from "./parse";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-haiku-4.5";

const SYSTEM_PROMPT = `You are an Eastern Province travel planning assistant for Hasio (هاسيو), a travel guidance platform covering Saudi Arabia's Eastern Province (المنطقة الشرقية) — from the Al-Ahsa oasis inland to the Gulf coast at Dammam, Al Khobar, Qatif and Jubail. Your job is to get the traveller a concrete plan as quickly as you can, asking only what you genuinely still need in order to write one.

## HOW MUCH TO ASK — READ THIS BEFORE ANYTHING ELSE
You need exactly four things to write a plan:
  1. Which city they are basing in
  2. When they are travelling, and for how long
  3. Who is coming — how many people, and whether any are children
  4. Roughly what they want to spend

Work out which of the four the traveller has ALREADY told you, counting the whole
conversation and not just their last message. Then:
- If all four are known, write the full plan NOW. Even if this is their first
  message and you have asked nothing at all. A traveller who opens with everything
  gets a plan, not an interview.
- Otherwise ask for ONE missing item, in one short question, and nothing else.
- Never ask about something already answered, and never re-ask in different words.
- Ask at most THREE questions in the whole conversation. After the third, assume a
  sensible default for anything still missing, state the assumption in one line at
  the top of the plan, and write the plan.
- If they say "just plan it", "رتب لي", "جهز الخطة", "خلاص" or anything like it,
  stop asking immediately and plan with sensible defaults.
Interests, dietary needs, must-see places and travel style are NICE TO HAVE. Never
spend a question on them while one of the four is still missing, and never hold the
plan back for them.

## OTHER RULES
1. Keep every question to 2-3 sentences, and ask only one thing at a time
2. Be warm, enthusiastic, and knowledgeable about the whole province, coast and oasis alike
3. THE PROVINCE IS LARGE. Dammam to Hafar Al Batin is about 5 hours by road; Dammam to Al-Ahsa about 1.5 hours. Establish which city the traveler is flying into or basing in BEFORE building an itinerary, and never put two cities hours apart into the same day.
4. LANGUAGE MATCHING: Always reply in the SAME language the user writes in. If the user writes in English, respond in English. If in Arabic, respond in Arabic. If they mix, prefer the dominant language. Write each field once, in that language — never add a translated copy.

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

## WHICH QUESTION TO ASK NEXT
Ask for the missing item highest up this list, and stop as soon as you have all four:
1. Base city — without it you cannot pick anything, since the province is five hours end to end
2. Dates and length of stay — decides the season and the number of days
3. Group — how many people, and any children (changes what is suitable)
4. Budget — decides which hotels and restaurants to name

## SENSIBLE DEFAULTS
Use these instead of asking a fourth question. Say which ones you assumed.
- No base city given but a place is named: base them in the nearest covered city
- No dates: assume the next cool-season month and say the plan suits Oct-Mar
- No length: assume 3 days
- No group: assume two adults
- No budget: assume mid-range, 400-800 SAR per day
- Never build a single day that crosses the province end to end

## WHAT YOU MAY STATE AS FACT
Two lists are appended below this prompt: the app's own listings, and notes written
by the Hasio team. Together they are the only place your specifics may come from.
- Recommend a place from the listings whenever one fits, and copy its English name
  EXACTLY into "name" so the app can open its page from the plan.
- NEVER state opening hours, a phone number, an exact price or whether something is
  open or available. You do not have that data. Say the app has the current hours.
- The only price signal you may quote for a listing is the tier ($ to $$$$) or the
  per-night figure shown for it below. Everywhere else, give ranges as a guide only
  and label them as estimates.
- A team note beats the general knowledge above it wherever the two disagree.
- You may still mention a famous place that has no listing — say so plainly rather
  than implying the app can book it.

## RESPONSE FORMAT
Reply with ONE JSON object and nothing else — no markdown fences, no sentence
before or after it.

While something is still missing:
{
  "ready": false,
  "message": "Your one question, in the traveller's language"
}

When you have enough:
{
  "ready": true,
  "suggestedDestinations": [
    {"name": "English name", "name_ar": "الاسم بالعربية", "type": "hotel|restaurant|attraction|event|tour", "description": "One line on why it fits"}
  ],
  "itinerary": "Day-by-day plan, in the traveller's language",
  "travelTips": "Practical tips, in the traveller's language",
  "estimatedBudget": "Estimate in SAR with a short breakdown, in the traveller's language"
}

### Rules for that object
- Write every free-text field ONCE, in the traveller's language only. Do NOT add
  translated twins such as "travelTips_ar" or "estimatedBudget_ar" — the app shows
  one language and the duplicate used to double the length of every plan until it
  ran out of room mid-sentence. "name_ar" is the only Arabic-suffixed field.
- "type" is required on every destination and must be one of the five values listed.
- Do not write a "disclaimer" field; the app adds it.
- Give 4-8 destinations. Keep the itinerary tight: a few lines per day, not an essay.

IMPORTANT: Be warm and specific about the Eastern Province, and always reply with a
single valid JSON object.`;

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

    // The real catalogue and the team's notes. Best-effort: a planner that has
    // lost its context is worse at naming places, but it still works, so a
    // failure here must not take the whole conversation down with it.
    let contextBlock = "";
    try {
      const plannerContext = await ctx.runQuery(
        internal.travelPlanner.context.getPlannerContext,
        {}
      );
      contextBlock = buildContextBlock(
        plannerContext.listings,
        plannerContext.knowledge
      );
    } catch (e) {
      console.error("Planner context unavailable:", e);
    }

    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: [SYSTEM_PROMPT, contextBlock, languageInstruction]
          .filter(Boolean)
          .join("\n\n"),
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
          // A finished plan is long, and Arabic costs roughly a token every 1.7
          // characters. At the old 3000 every plan beyond a single day was cut
          // off mid-sentence — a 3-day English plan died at 7,597 characters and
          // a 7-day Arabic one at 5,070, both exactly on the cap. The format no
          // longer asks for translated twins of every field, which roughly
          // halves the output again; this leaves real headroom on top of that.
          max_tokens: 8000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", errorText);
        return { success: false, ready: false, error: "Failed to plan travel" };
      }

      const data = await response.json();
      const choice = data.choices?.[0];
      const content: string | undefined = choice?.message?.content;
      const hitTokenCap = choice?.finish_reason === "length";

      if (!content) {
        return { success: false, ready: false, error: "No response from AI" };
      }

      // Everything we cannot turn into a plan or a question ends here. The one
      // outcome that must never happen is the raw reply reaching the chat:
      // `PlannerScreenContent` renders `message` verbatim, so a leaked JSON blob
      // is literally what the traveller reads.
      const retryMessageAr =
        "عذرًا، لم أتمكن من إنهاء الخطة. حاول مرة أخرى من فضلك.";
      const retry = () => ({
        success: true,
        ready: false,
        message:
          language === "ar"
            ? retryMessageAr
            : "Sorry — I couldn't finish that plan. Please try again.",
        message_ar: retryMessageAr,
      });

      const parsed = extractJsonObject(content);

      if (!parsed) {
        if (hitTokenCap) {
          console.error(
            "Model reply truncated at max_tokens; chars:",
            content.length
          );
          return retry();
        }
        // No object at all. Plain prose is safe to show as a reply; anything
        // that merely looks like JSON is not.
        const prose = content
          .trim()
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
        if (!prose || prose.startsWith("{") || prose.includes('"ready"')) {
          console.error("Unparseable model reply:", content.slice(0, 200));
          return retry();
        }
        return {
          success: true,
          ready: false,
          message: prose,
          message_ar: language === "ar" ? prose : undefined,
        };
      }

      // `ready` has arrived as the string "true" before, so the boolean check
      // alone used to drop such a reply into the raw-content fallback.
      const isReady = parsed.ready === true || parsed.ready === "true";

      if (!isReady) {
        const message = asText(parsed.message) ?? asText(parsed.message_ar);
        if (!message) {
          console.error("Model asked nothing and planned nothing:", content.slice(0, 200));
          return retry();
        }
        return {
          success: true,
          ready: false,
          message,
          message_ar: asText(parsed.message_ar) ?? message,
        };
      }

      const suggestedDestinations = normaliseDestinations(parsed.suggestedDestinations);
      const itinerary = asText(parsed.itinerary);

      // The model is now asked to write each field once, in the traveller's
      // language, so the "_ar" twin usually arrives empty. Mirroring the text
      // into both keys means either branch of the client's
      // `language === "ar" ? tips_ar || tips : tips` finds it — including on the
      // binaries already in the stores, which cannot be changed from here.
      const travelTips = asText(parsed.travelTips) ?? asText(parsed.travelTips_ar);
      const estimatedBudget =
        asText(parsed.estimatedBudget) ?? asText(parsed.estimatedBudget_ar);

      // The chat renders the itinerary, the tips and the budget and nothing
      // else, so "ready" with none of the three would post an empty bubble.
      // Destinations alone are invisible — they only feed "save as trip".
      if (!itinerary && !travelTips && !estimatedBudget) {
        console.error("Model claimed ready with an empty plan:", content.slice(0, 200));
        return retry();
      }

      const plan = {
        suggestedDestinations,
        itinerary,
        travelTips,
        travelTips_ar: travelTips,
        estimatedBudget,
        estimatedBudget_ar: estimatedBudget,
        disclaimer:
          asText(parsed.disclaimer) ??
          (language === "ar"
            ? "توصيات السفر قد تختلف حسب الموسم. يرجى التحقق من أوقات العمل والتوفر قبل الزيارة."
            : "Travel recommendations may vary by season. Please verify opening hours and availability before visiting."),
      };

      // Storing is what powers plan history and "save as trip", but it is not
      // worth losing a finished plan over — the traveller waited for this one.
      let planId: string | undefined;
      try {
        planId = await ctx.runMutation(api.travelPlanner.mutations.storePlan, {
          userId,
          sessionId: args.sessionId,
          userInput: args.userInput,
          language,
          plan,
        });
      } catch (e) {
        console.error("storePlan failed; returning the plan anyway:", e);
      }

      return { success: true, ready: true, plan, planId };
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
