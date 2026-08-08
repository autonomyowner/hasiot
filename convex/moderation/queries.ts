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

/**
 * Blocked accounts for the signed-in user, hydrated with a display name so the
 * app can offer an unblock list. Blocks whose target user no longer exists are
 * skipped rather than rendered as empty rows.
 */
export const getMyBlockedUsers = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const blocks = await ctx.db
      .query("userBlocks")
      .withIndex("by_blocker", (q) => q.eq("blockerId", user._id))
      .collect();

    const hydrated = await Promise.all(
      blocks.map(async (block) => {
        const blocked = await ctx.db.get(block.blockedUserId);
        if (!blocked) return null;
        return {
          blockId: block._id,
          blockedUserId: block.blockedUserId,
          createdAt: block.createdAt,
          firstName: blocked.firstName,
          lastName: blocked.lastName,
          role: blocked.role,
        };
      })
    );

    return hydrated.filter((b): b is NonNullable<typeof b> => b !== null);
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
      .take(200);

    return Promise.all(
      reports.map(async (report) => {
        const reporter = await ctx.db.get(report.reporterId);

        // Hydrate the reported item so an admin can judge it in place. targetId
        // is stored as a plain string because it is polymorphic, so it has to be
        // normalized back to a typed id before lookup.
        let target: {
          title: string;
          subtitle?: string;
          status?: string;
          ownerId?: string;
        } | null = null;

        if (report.targetType === "listing") {
          const id = ctx.db.normalizeId("listings", report.targetId);
          const listing = id ? await ctx.db.get(id) : null;
          if (listing) {
            target = {
              title: listing.name_ar || listing.name_en,
              subtitle: listing.name_en,
              status: listing.status,
              ownerId: listing.ownerId,
            };
          }
        } else if (report.targetType === "service") {
          const id = ctx.db.normalizeId("services", report.targetId);
          const service = id ? await ctx.db.get(id) : null;
          if (service) {
            target = {
              title: service.title_ar || service.title_en,
              subtitle: service.title_en,
              status: service.status,
              ownerId: service.ownerId,
            };
          }
        } else if (report.targetType === "review") {
          const id = ctx.db.normalizeId("reviews", report.targetId);
          const review = id ? await ctx.db.get(id) : null;
          if (review) {
            target = {
              title: review.content ?? "",
              subtitle: `${review.rating}/5`,
              ownerId: review.userId,
            };
          }
        }

        return {
          ...report,
          target,
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
