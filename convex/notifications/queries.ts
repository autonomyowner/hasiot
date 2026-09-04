import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// The inbox is a recent-activity feed, not an archive. Everything older than
// the last fifty events is history the guest can no longer act on.
const MAX_INBOX = 50;
// Enough to render a badge. Past this the exact number stops mattering and
// "50+" is the honest answer.
const MAX_UNREAD_COUNT = 50;

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(MAX_INBOX);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return 0;

    // readAt is undefined until the guest opens it, so the index range is
    // exactly the unread rows — no scan of the read ones.
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .take(MAX_UNREAD_COUNT);

    return unread.length;
  },
});

export const getNotification = query({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return null;

    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.userId !== user._id) return null;
    return notification;
  },
});
