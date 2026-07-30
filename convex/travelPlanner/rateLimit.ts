import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

const WINDOW_MS = 24 * 60 * 60 * 1000;

// Fixed-window rate limiter: one row per key, window anchored at the first
// request and reset in place after 24h. Internal-only — clients cannot call
// this directly, so counts cannot be tampered with.
export const checkAndIncrement = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const row = await ctx.db
      .query("rateLimits")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (!row || now - row.windowStart >= WINDOW_MS) {
      if (row) {
        await ctx.db.patch(row._id, { windowStart: now, count: 1 });
      } else {
        await ctx.db.insert("rateLimits", { key: args.key, windowStart: now, count: 1 });
      }
      return { allowed: true, remaining: args.limit - 1 };
    }

    if (row.count >= args.limit) {
      return { allowed: false, remaining: 0 };
    }

    await ctx.db.patch(row._id, { count: row.count + 1 });
    return { allowed: true, remaining: args.limit - row.count - 1 };
  },
});
