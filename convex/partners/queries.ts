import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { authComponent, getAuthenticatedAppUser } from "../auth";
import { AUTH_ERRORS } from "../lib/errors";
import { accountStatusFor, analyticsFor, getGuestFor, listGuestsFor } from "./service";

/** Signed out / no account / suspended (with the admin's reason) / active. Never throws. */
export const getAccountStatus = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx).catch(() => null);
    return await accountStatusFor(ctx, authUser ?? null);
  },
});

/** Partner analytics and guest CRM reads. Rules live in ./service.ts. */

export const getAnalytics = query({
  args: { period: v.union(v.literal("30d"), v.literal("90d"), v.literal("12m")) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await analyticsFor(ctx, user, { period: args.period, now: Date.now() });
  },
});

export const listGuests = query({
  args: {
    search: v.optional(v.string()),
    tag: v.optional(v.string()),
    sort: v.optional(v.union(v.literal("recent"), v.literal("spent"), v.literal("bookings"))),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await listGuestsFor(ctx, user, args);
  },
});

export const getGuest = query({
  args: { guestId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await getGuestFor(ctx, user, args.guestId);
  },
});
