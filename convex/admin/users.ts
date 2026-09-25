import { query } from "../_generated/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { requireAdmin } from "../auth";
import { toAdminUserRow } from "./service";
import { listUsersPage } from "./views";
import type { Doc } from "../_generated/dataModel";

/**
 * The admin panel's view of accounts.
 *
 * Two entry points rather than one: browsing pages through an index, searching
 * goes through the search index. They cannot be combined — Convex search
 * results are ranked by relevance and are not paginable the way an index scan
 * is — so the panel keeps exactly one of them active at a time, the same shape
 * the listings tab already uses.
 */

const MAX_SEARCH = 100;

/**
 * Search results are ranked, not paged, so these flags are checked on the
 * results. The paged browse (listUsersPage) filters inside the query instead:
 * after the page was fetched, a filter could empty it while matches remained.
 */
function matchesFlags(
  user: Doc<"users">,
  args: { phoneVerified?: boolean; suspended?: boolean }
): boolean {
  if (args.phoneVerified !== undefined && (user.phoneVerified ?? false) !== args.phoneVerified) {
    return false;
  }
  if (args.suspended !== undefined && (user.isSuspended ?? false) !== args.suspended) {
    return false;
  }
  return true;
}

export const adminListUsers = query({
  args: {
    paginationOpts: paginationOptsValidator,
    role: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    suspended: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await listUsersPage(ctx, args);
  },
});

export const adminSearchUsers = query({
  args: {
    searchQuery: v.string(),
    role: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    suspended: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const term = args.searchQuery.trim().toLowerCase();
    if (term.length < 2) return [];

    const found = new Map<string, Doc<"users">>();

    const results = await ctx.db
      .query("users")
      .withSearchIndex("search_users", (q) =>
        args.role ? q.search("searchText", term).eq("role", args.role) : q.search("searchText", term)
      )
      .take(MAX_SEARCH);
    for (const user of results) found.set(user._id, user);

    // The search index tokenises, so a partial number like "0501" matches
    // nothing. An exact lookup covers the case where an operator pastes a whole
    // number or address off a booking.
    if (term.includes("@")) {
      const byEmail = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", term))
        .first();
      if (byEmail) found.set(byEmail._id, byEmail);
    } else if (/^\+?\d[\d\s-]{6,}$/.test(term)) {
      const normalised = term.startsWith("+") ? term : `+${term.replace(/\D/g, "")}`;
      const byPhone = await ctx.db
        .query("users")
        .withIndex("by_phone", (q) => q.eq("phone", normalised))
        .first();
      if (byPhone) found.set(byPhone._id, byPhone);
    }

    return Array.from(found.values())
      .filter((user) => matchesFlags(user, args))
      .map(toAdminUserRow);
  },
});
