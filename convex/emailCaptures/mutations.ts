import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const captureEmail = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate
    const existing = await ctx.db
      .query("emailCaptures")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return { success: true, duplicate: true };
    }

    await ctx.db.insert("emailCaptures", {
      email: args.email,
      source: args.source,
      createdAt: Date.now(),
    });

    return { success: true, duplicate: false };
  },
});
