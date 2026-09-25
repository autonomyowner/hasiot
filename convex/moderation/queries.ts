import { query, type QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { getAuthenticatedAppUser, requireAdmin } from "../auth";

export type ReportTarget = {
  title: string;
  subtitle?: string;
  status?: string;
  ownerId?: string;
  /** For a review: the place or service it rates, so the admin can judge it in context. */
  reviewOf?: { type: "listing" | "service"; id: string; title: string };
};

/**
 * The reported item, hydrated so an admin can judge it in place, or null when
 * it no longer exists. targetId is stored as a plain string because it is
 * polymorphic, so it is normalised back to a typed id before the lookup.
 *
 * An "ai_message" report has nothing to look up: the planner's reply lives
 * only on the phone, so the report carries its text in `details` (contract
 * section 7) and that text is the target.
 */
export async function reportTarget(
  ctx: QueryCtx,
  report: Doc<"contentReports">
): Promise<ReportTarget | null> {
  if (report.targetType === "listing") {
    const id = ctx.db.normalizeId("listings", report.targetId);
    const listing = id ? await ctx.db.get(id) : null;
    if (!listing) return null;
    return {
      title: listing.name_ar || listing.name_en,
      subtitle: listing.name_en,
      status: listing.status,
      ownerId: listing.ownerId,
    };
  }

  if (report.targetType === "service") {
    const id = ctx.db.normalizeId("services", report.targetId);
    const service = id ? await ctx.db.get(id) : null;
    if (!service) return null;
    return {
      title: service.title_ar || service.title_en,
      subtitle: service.title_en,
      status: service.status,
      ownerId: service.ownerId,
    };
  }

  if (report.targetType === "review") {
    const id = ctx.db.normalizeId("reviews", report.targetId);
    const review = id ? await ctx.db.get(id) : null;
    if (!review) return null;
    const listing = review.listingId ? await ctx.db.get(review.listingId) : null;
    const service = review.serviceId ? await ctx.db.get(review.serviceId) : null;
    return {
      title: review.content ?? "",
      subtitle: `${review.rating}/5`,
      ownerId: review.userId,
      reviewOf: listing
        ? { type: "listing", id: listing._id, title: listing.name_ar || listing.name_en }
        : service
          ? { type: "service", id: service._id, title: service.title_ar || service.title_en }
          : undefined,
    };
  }

  if (report.targetType === "ai_message") {
    return { title: report.details ?? "", subtitle: "AI" };
  }

  return null;
}

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
        const target = await reportTarget(ctx, report);

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
