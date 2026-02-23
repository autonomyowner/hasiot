import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get user's symptom analysis history
export const getMyAnalyses = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return [];
    }

    const analyses = await ctx.db
      .query("symptomAnalyses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    if (args.limit) {
      return analyses.slice(0, args.limit);
    }

    return analyses;
  },
});

// Get a single analysis by ID
export const getAnalysis = query({
  args: { analysisId: v.id("symptomAnalyses") },
  handler: async (ctx, args) => {
    const analysis = await ctx.db.get(args.analysisId);

    if (!analysis) {
      return null;
    }

    // Check if user has access
    if (analysis.userId) {
      // If analysis has a userId, verify ownership
      const user = await getAuthenticatedAppUser(ctx);
      if (!user || analysis.userId !== user._id) {
        return null;
      }
    }

    return analysis;
  },
});
