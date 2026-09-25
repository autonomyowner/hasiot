import { mutation, type MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedAppUser, requireAdmin } from "../auth";
import { enforceRateLimit } from "../rateLimit";
import { logAdminAction } from "../admin/activity";
import { AUTH_ERRORS } from "../lib/errors";

const VALID_REASONS = ["spam", "inappropriate", "offensive", "fraud", "other"];
// "ai_message" (1.1.0): a reply from the travel planner. It is not a document
// — the conversation lives on the traveller's phone — so its id is the
// client's own message id, and the text travels with the report in `details`.
const VALID_TARGET_TYPES = ["listing", "service", "review", "ai_message"];

/** A planner message id is a short client-made key, never a paragraph. */
export const MAX_MESSAGE_ID = 200;
/** How much of a reported planner message is kept with the report. */
export const MAX_MESSAGE_TEXT = 2000;

/**
 * Refusals, Arabic then English. The app shows its own "could not report"
 * text for any failure, so these are for logs and support rather than an API
 * the app matches on — but as ConvexErrors they at least survive production,
 * which redacts a plain Error's message to "Server Error".
 */
export const REPORT_ERRORS = {
  INVALID_TARGET: "نوع البلاغ غير صالح. / Invalid report target.",
  INVALID_REASON: "سبب البلاغ غير صالح. / Invalid report reason.",
  INVALID_MESSAGE_ID: "معرّف الرسالة غير صالح. / Invalid message id.",
} as const;

/**
 * File a report, with the reporter already resolved (the seam the tests call;
 * convex-test cannot get past getAuthenticatedAppUser).
 */
export async function reportContentForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { targetType: string; targetId: string; reason: string; details?: string },
  now: number = Date.now()
): Promise<{ success: true; reportId: Id<"contentReports">; alreadyReported: boolean }> {
  if (!VALID_TARGET_TYPES.includes(args.targetType)) {
    throw new ConvexError(REPORT_ERRORS.INVALID_TARGET);
  }
  if (!VALID_REASONS.includes(args.reason)) {
    throw new ConvexError(REPORT_ERRORS.INVALID_REASON);
  }

  let details = args.details;
  if (args.targetType === "ai_message") {
    if (!args.targetId.trim() || args.targetId.length > MAX_MESSAGE_ID) {
      throw new ConvexError(REPORT_ERRORS.INVALID_MESSAGE_ID);
    }
    // Cut rather than refused: a planner itinerary can run past this, and a
    // traveller reporting a long harmful reply should not be told the report
    // failed. The admin reads the start of it, and the id says which one.
    details = args.details?.slice(0, MAX_MESSAGE_TEXT);
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
    details,
    status: "pending",
    createdAt: now,
  });

  return { success: true, reportId, alreadyReported: false };
}

export const reportContent = mutation({
  args: {
    targetType: v.string(),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await reportContentForUser(ctx, user, args);
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
