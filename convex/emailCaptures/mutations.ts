import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { enforceRateLimit } from "../rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const captureEmail = mutation({
  args: {
    email: v.string(),
    source: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // This endpoint is unauthenticated, so it needs its own guards: a format
    // check, a normalized dedupe key, and both per-address and global caps so
    // a script can't flood the table (which the admin panel reads wholesale).
    const email = args.email.trim().toLowerCase();

    if (!EMAIL_RE.test(email)) {
      throw new Error("البريد الإلكتروني غير صالح / Invalid email address");
    }

    await enforceRateLimit(ctx, "emailCapture:global", 500);
    await enforceRateLimit(ctx, `emailCapture:${email}`, 3);

    // Check for duplicate
    const existing = await ctx.db
      .query("emailCaptures")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();

    if (existing) {
      return { success: true, duplicate: true };
    }

    await ctx.db.insert("emailCaptures", {
      email,
      source: args.source,
      createdAt: Date.now(),
    });

    return { success: true, duplicate: false };
  },
});
