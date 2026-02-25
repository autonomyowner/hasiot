import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Store a travel plan
export const storePlan = mutation({
  args: {
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.string()),
    userInput: v.string(),
    language: v.string(),
    plan: v.object({
      suggestedDestinations: v.array(
        v.object({
          name: v.string(),
          name_ar: v.optional(v.string()),
          type: v.string(),
          description: v.optional(v.string()),
        })
      ),
      itinerary: v.optional(v.string()),
      travelTips: v.optional(v.string()),
      travelTips_ar: v.optional(v.string()),
      estimatedBudget: v.optional(v.string()),
      estimatedBudget_ar: v.optional(v.string()),
      disclaimer: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    const planId = await ctx.db.insert("travelPlans", {
      userId: args.userId,
      sessionId: args.sessionId,
      userInput: args.userInput,
      language: args.language,
      plan: args.plan,
      createdAt: Date.now(),
    });

    return planId;
  },
});
