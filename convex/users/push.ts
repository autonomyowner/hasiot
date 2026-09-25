import { mutation, type MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { AUTH_ERRORS } from "../lib/errors";

/**
 * The devices a person receives push notifications on.
 *
 * One row per Expo push token in `pushTokens`, not an array on the user,
 * because a phone changes hands: when someone else signs in on it, the token
 * moves to them, and the previous account must stop receiving its bookings on
 * a phone it no longer holds. Delivery (notifications/deliver.ts) reads this
 * table; the old `users.pushTokens` array is never written.
 *
 * The seams take an already-resolved user, like everywhere else, because
 * convex-test cannot resolve the Better Auth component.
 */

/** What an Expo push token looks like; both spellings Expo has issued. */
export const PUSH_TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]]{1,200}\]$/;

/** Enough for a phone, a tablet and a couple of reinstalls. */
export const MAX_DEVICES_PER_USER = 5;

export const PUSH_ERRORS = {
  INVALID_TOKEN: "رمز الإشعارات غير صالح. / Invalid push token.",
} as const;

export async function registerPushTokenForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { token: string; platform?: string },
  now: number = Date.now()
): Promise<{ ok: true }> {
  if (!PUSH_TOKEN_PATTERN.test(args.token)) {
    throw new ConvexError(PUSH_ERRORS.INVALID_TOKEN);
  }

  // Normally zero or one row. More would be the leftovers of two
  // registrations racing; keep the first and fold the rest into it.
  const [existing, ...duplicates] = await ctx.db
    .query("pushTokens")
    .withIndex("by_token", (q) => q.eq("token", args.token))
    .collect();
  for (const row of duplicates) await ctx.db.delete(row._id);

  if (existing) {
    // Whoever signs in on the phone now owns it, including when that is
    // someone else: the last account stops getting its notices there.
    await ctx.db.patch(existing._id, {
      userId: user._id,
      platform: args.platform ?? existing.platform,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("pushTokens", {
      token: args.token,
      userId: user._id,
      platform: args.platform,
      createdAt: now,
      updatedAt: now,
    });
  }

  await keepNewestDevices(ctx, user);
  return { ok: true };
}

/**
 * Forget this device for this user — on sign-out, before the session goes.
 * Signed out already, or a token that is unknown or now someone else's: a
 * no-op, so a sign-out never fails on it.
 */
export async function unregisterPushTokenForUser(
  ctx: MutationCtx,
  user: Doc<"users"> | null,
  token: string
): Promise<{ ok: true }> {
  if (!user) return { ok: true };

  const rows = await ctx.db
    .query("pushTokens")
    .withIndex("by_token", (q) => q.eq("token", token))
    .collect();
  for (const row of rows) {
    if (row.userId === user._id) await ctx.db.delete(row._id);
  }
  return { ok: true };
}

/**
 * Trim a user to their newest devices. A token Expo still accepts but nobody
 * uses (an old phone in a drawer) would otherwise collect forever, and every
 * notification is sent to each one.
 */
async function keepNewestDevices(ctx: MutationCtx, user: Doc<"users">): Promise<void> {
  const devices = await ctx.db
    .query("pushTokens")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  if (devices.length <= MAX_DEVICES_PER_USER) return;

  devices.sort((a, b) => b.updatedAt - a.updatedAt || b._creationTime - a._creationTime);
  for (const stale of devices.slice(MAX_DEVICES_PER_USER)) {
    await ctx.db.delete(stale._id);
  }
}

/**
 * Called by the app once the person has allowed notifications (asked in
 * context, never at first launch — design D14), and again on each sign-in.
 */
export const registerPushToken = mutation({
  args: {
    token: v.string(),
    platform: v.optional(v.union(v.literal("ios"), v.literal("android"))),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await registerPushTokenForUser(ctx, user, args);
  },
});

/** Called by the app on sign-out, before the session is dropped. */
export const unregisterPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    return await unregisterPushTokenForUser(ctx, user, args.token);
  },
});
