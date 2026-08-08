import { internalMutation, MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Fixed-window rate limiter: one row per key, window anchored at the first
 * request and reset in place after 24h.
 *
 * Mutations call `enforceRateLimit` directly (they already have a MutationCtx).
 * Actions go through the `checkAndIncrement` internalMutation below, since they
 * have no database access of their own. Neither path is callable by a client,
 * so counts cannot be tampered with.
 */
async function bump(ctx: MutationCtx, key: string, limit: number) {
  const now = Date.now();
  const row = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (!row || now - row.windowStart >= WINDOW_MS) {
    if (row) {
      await ctx.db.patch(row._id, { windowStart: now, count: 1 });
    } else {
      await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    }
    return { allowed: true, remaining: limit - 1 };
  }

  if (row.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  await ctx.db.patch(row._id, { count: row.count + 1 });
  return { allowed: true, remaining: limit - row.count - 1 };
}

/**
 * Consume one unit against `key`. Throws a bilingual, user-facing error when
 * the daily allowance is exhausted.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  key: string,
  limit: number,
  message = "لقد تجاوزت الحد المسموح لهذا اليوم. يرجى المحاولة غدًا. / Daily limit reached. Please try again tomorrow."
) {
  const result = await bump(ctx, key, limit);
  if (!result.allowed) {
    throw new Error(message);
  }
  return result;
}

// Action-facing entry point — actions cannot touch the database directly.
export const checkAndIncrement = internalMutation({
  args: {
    key: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => bump(ctx, args.key, args.limit),
});
