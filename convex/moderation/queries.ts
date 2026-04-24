import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser, requireAdmin } from "../auth";

export const getMyBlockedUserIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];
    const blocks = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker", (q) => q.eq("blockerId", user._id))
      .collect();
    return blocks.map((b) => b.blockedUserId);
  },
});

export const listPendingReports = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const status = args.status ?? "pending";
    const reports = await ctx.db
      .query("contentReports")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .collect();

    return Promise.all(
      reports.map(async (report) => {
        const reporter = await ctx.db.get(report.reporterId);
        return {
          ...report,
          reporter: reporter
            ? {
                _id: reporter._id,
                email: reporter.email,
                firstName: reporter.firstName,
                lastName: reporter.lastName,
              }
            : null,
        };
      })
    );
  },
});
