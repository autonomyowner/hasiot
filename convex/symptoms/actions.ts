"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "anthropic/claude-3.5-haiku";

const SYSTEM_PROMPT = `You are a medical symptom assessment assistant for Tabra, an Algerian healthcare platform. Your role is to conduct a thorough symptom interview before providing any recommendations.

CRITICAL RULES:
1. NEVER provide diagnosis or recommendations after just 1-2 messages
2. You MUST ask at least 3-5 follow-up questions before giving any analysis
3. Gather information systematically about:
   - Main symptom details (location, type, intensity 1-10)
   - Duration (when did it start? constant or intermittent?)
   - Associated symptoms (fever, nausea, fatigue, etc.)
   - What makes it better or worse
   - Relevant medical history
   - Current medications
   - Recent activities or changes

CONVERSATION FLOW:
1. First message: Acknowledge the symptom, ask about duration and intensity
2. Second message: Ask about associated symptoms
3. Third message: Ask about what triggers or relieves it
4. Fourth message: Ask about medical history if relevant
5. Only after gathering sufficient info: Provide analysis

RESPONSE FORMAT:
- If still gathering information, respond conversationally in the user's language
- Keep responses concise (2-3 sentences max)
- Be empathetic but professional
- Ask ONE question at a time

When you have enough information (usually after 4-5 exchanges), respond with JSON:
{
  "ready": true,
  "possibleConditions": [
    {"name": "Condition", "name_ar": "الحالة", "probability": "high|medium|low", "description": "Brief explanation"}
  ],
  "recommendedSpecialty": "specialty in English",
  "recommendedSpecialty_ar": "التخصص بالعربية",
  "urgencyLevel": "emergency|urgent|routine|self_care",
  "generalAdvice": "Advice in user's language",
  "generalAdvice_ar": "النصيحة بالعربية",
  "disclaimer": "This is not a medical diagnosis. Please consult a healthcare professional."
}

If still gathering info, respond with JSON:
{
  "ready": false,
  "message": "Your follow-up question in the user's language",
  "message_ar": "السؤال بالعربية"
}

Urgency Levels:
- emergency: Chest pain, difficulty breathing, severe bleeding, stroke symptoms
- urgent: High fever, severe pain, infection signs
- routine: Mild persistent symptoms
- self_care: Minor issues

IMPORTANT: Be thorough. A good assessment takes time. Never rush to conclusions.`;

export const analyzeSymptoms = action({
  args: {
    symptoms: v.string(),
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
    analysis?: {
      possibleConditions: Array<{
        name: string;
        name_ar?: string;
        probability: string;
        description?: string;
      }>;
      recommendedSpecialty: string;
      recommendedSpecialty_ar?: string;
      urgencyLevel: string;
      generalAdvice?: string;
      generalAdvice_ar?: string;
      disclaimer: string;
    };
    analysisId?: string;
    error?: string;
  }> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return { success: false, ready: false, error: "OpenRouter API key not configured" };
    }

    const language = args.language || "ar";
    const languageInstruction =
      language === "ar"
        ? "Respond in Arabic (Algerian dialect is fine)."
        : language === "fr"
        ? "Respond in French."
        : "Respond in English.";

    // Build conversation messages
    const messages: Array<{ role: string; content: string }> = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n${languageInstruction}`,
      },
    ];

    // Add conversation history if exists
    if (args.conversationHistory && args.conversationHistory.length > 0) {
      messages.push(...args.conversationHistory);
    }

    // Add current user message
    messages.push({
      role: "user",
      content: args.symptoms,
    });

    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://tabra.dz",
          "X-Title": "Tabra Healthcare",
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          temperature: 0.4,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter API error:", errorText);
        return { success: false, ready: false, error: "Failed to analyze symptoms" };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return { success: false, ready: false, error: "No response from AI" };
      }

      // Try to parse as JSON
      let parsed;
      try {
        // Try to extract JSON from the response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          // No JSON found - treat as conversational response
          return {
            success: true,
            ready: false,
            message: content,
            message_ar: language === "ar" ? content : undefined,
          };
        }
      } catch {
        // Not JSON - it's a conversational response
        return {
          success: true,
          ready: false,
          message: content,
          message_ar: language === "ar" ? content : undefined,
        };
      }

      // Check if analysis is ready
      if (parsed.ready === false) {
        return {
          success: true,
          ready: false,
          message: parsed.message,
          message_ar: parsed.message_ar,
        };
      }

      // Analysis is ready
      if (parsed.ready === true && parsed.possibleConditions) {
        // Ensure disclaimer exists
        if (!parsed.disclaimer) {
          parsed.disclaimer =
            language === "ar"
              ? "هذا التحليل للمعلومات فقط وليس تشخيصاً طبياً. يرجى استشارة طبيب مختص."
              : language === "fr"
              ? "Cette analyse est à titre informatif uniquement. Veuillez consulter un médecin."
              : "This analysis is for informational purposes only. Please consult a healthcare professional.";
        }

        // Try to get the current user to store analysis with userId
        let userId = undefined;
        try {
          const currentUser = await ctx.runQuery(api.users.queries.getCurrentUser, {});
          if (currentUser) {
            userId = currentUser._id;
          }
        } catch {
          // Not authenticated — store without userId
        }

        const analysisId = await ctx.runMutation(api.symptoms.mutations.storeAnalysis, {
          userId,
          symptoms: args.symptoms,
          language,
          analysis: {
            possibleConditions: parsed.possibleConditions,
            recommendedSpecialty: parsed.recommendedSpecialty,
            recommendedSpecialty_ar: parsed.recommendedSpecialty_ar,
            urgencyLevel: parsed.urgencyLevel,
            generalAdvice: parsed.generalAdvice,
            generalAdvice_ar: parsed.generalAdvice_ar,
            disclaimer: parsed.disclaimer,
          },
        });

        return {
          success: true,
          ready: true,
          analysis: {
            possibleConditions: parsed.possibleConditions,
            recommendedSpecialty: parsed.recommendedSpecialty,
            recommendedSpecialty_ar: parsed.recommendedSpecialty_ar,
            urgencyLevel: parsed.urgencyLevel,
            generalAdvice: parsed.generalAdvice,
            generalAdvice_ar: parsed.generalAdvice_ar,
            disclaimer: parsed.disclaimer,
          },
          analysisId,
        };
      }

      // Fallback - treat as conversational
      return {
        success: true,
        ready: false,
        message: content,
      };
    } catch (error) {
      console.error("Symptom analysis error:", error);
      return {
        success: false,
        ready: false,
        error: "An error occurred during symptom analysis",
      };
    }
  },
});
