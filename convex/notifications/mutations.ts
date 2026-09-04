import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Bounds the write set of a "mark all read" tap. Anything past this is older
// than the inbox shows anyway.
const MAX_MARK_ALL = 200;

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const notification = await ctx.db.get(args.notificationId);
    // Someone else's notification is not found, as far as this caller knows.
    if (!notification || notification.userId !== user._id) {
      throw new Error("Notification not found");
    }
    if (notification.readAt) return { success: true };

    await ctx.db.patch(args.notificationId, { readAt: Date.now() });
    return { success: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_userId_and_readAt", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      .take(MAX_MARK_ALL);

    const now = Date.now();
    for (const notification of unread) {
      await ctx.db.patch(notification._id, { readAt: now });
    }

    return { marked: unread.length };
  },
});
