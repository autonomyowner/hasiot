import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get user's travel plan history
export const getMyPlans = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return [];
    }

    const plans = await ctx.db
      .query("travelPlans")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    if (args.limit) {
      return plans.slice(0, args.limit);
    }

    return plans;
  },
});

// Get a single plan by ID
export const getPlan = query({
  args: { planId: v.id("travelPlans") },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.planId);

    if (!plan) {
      return null;
    }

    if (plan.userId) {
      const user = await getAuthenticatedAppUser(ctx);
      if (!user || plan.userId !== user._id) {
        return null;
      }
    }

    return plan;
  },
});
