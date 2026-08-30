import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser, requireAdmin } from "../auth";
import { enforceRateLimit } from "../rateLimit";
import { logAdminAction } from "../admin/activity";

const VALID_REASONS = ["spam", "inappropriate", "offensive", "fraud", "other"];
const VALID_TARGET_TYPES = ["listing", "service", "review"];

export const reportContent = mutation({
  args: {
    targetType: v.string(),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Sign in to report content");

    if (!VALID_TARGET_TYPES.includes(args.targetType)) {
      throw new Error("Invalid target type");
    }
    if (!VALID_REASONS.includes(args.reason)) {
      throw new Error("Invalid reason");
    }

    const existing = await ctx.db
      .query("contentReports")
      .withIndex("by_reporter", (q) => q.eq("reporterId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("targetType"), args.targetType),
          q.eq(q.field("targetId"), args.targetId),
          q.eq(q.field("status"), "pending")
        )
      )
      .first();

    if (existing) {
      return { success: true, reportId: existing._id, alreadyReported: true };
    }

    // The duplicate guard above is per-target; this bounds mass-reporting
    // across many different targets from one account.
    await enforceRateLimit(
      ctx,
      `report:${user._id}`,
      20,
      "لقد وصلت إلى الحد اليومي للبلاغات. يرجى المحاولة غدًا. / You've reached today's reporting limit. Please try again tomorrow."
    );

    const reportId = await ctx.db.insert("contentReports", {
      reporterId: user._id,
      targetType: args.targetType,
      targetId: args.targetId,
      reason: args.reason,
      details: args.details,
      status: "pending",
      createdAt: Date.now(),
    });

    return { success: true, reportId, alreadyReported: false };
  },
});

export const blockUser = mutation({
  args: { blockedUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Sign in to block users");
    if (user._id === args.blockedUserId) {
      throw new Error("You cannot block yourself");
    }

    const existing = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_and_blocked", (q) =>
        q.eq("blockerId", user._id).eq("blockedUserId", args.blockedUserId)
      )
      .first();

    if (existing) return { success: true, alreadyBlocked: true };

    await ctx.db.insert("userBlocks", {
      blockerId: user._id,
      blockedUserId: args.blockedUserId,
      createdAt: Date.now(),
    });

    return { success: true, alreadyBlocked: false };
  },
});

export const unblockUser = mutation({
  args: { blockedUserId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Sign in to manage blocks");

    const existing = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker_and_blocked", (q) =>
        q.eq("blockerId", user._id).eq("blockedUserId", args.blockedUserId)
      )
      .first();

    if (existing) await ctx.db.delete(existing._id);
    return { success: true };
  },
});

export const resolveReport = mutation({
  args: {
    reportId: v.id("contentReports"),
    status: v.string(), // "reviewed" | "dismissed" | "actioned"
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!["reviewed", "dismissed", "actioned"].includes(args.status)) {
      throw new Error("Invalid status");
    }
    await ctx.db.patch(args.reportId, {
      status: args.status,
      reviewedByAdminId: admin._id,
      reviewedAt: Date.now(),
    });

    const report = await ctx.db.get(args.reportId);
    await logAdminAction(ctx, admin, {
      action: "report." + args.status,
      targetType: "report",
      targetId: args.reportId,
      summary: report ? report.targetType + ": " + report.reason : undefined,
    });
    return { success: true };
  },
});
