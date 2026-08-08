import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedAppUser } from "../auth";
import { QueryCtx } from "../_generated/server";

// Hard ceilings — see the matching constants in listings/queries.ts.
const MAX_SCAN = 1000;
const MAX_LIST = 200;

async function getBlockedIds(ctx: QueryCtx): Promise<Set<string>> {
  const user = await getAuthenticatedAppUser(ctx);
  if (!user) return new Set();
  const blocks = await ctx.db
    .query("userBlocks")
    .withIndex("by_blocker", (q) => q.eq("blockerId", user._id))
    .collect();
  return new Set(blocks.map((b) => b.blockedUserId as string));
}

// Get authenticated user's own services
export const getMyServices = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const services = await ctx.db
      .query("services")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(MAX_LIST);

    if (args.status) {
      return services.filter((s) => s.status === args.status);
    }

    return services;
  },
});

// Shared index selection for both the capped and paginated list queries.
function buildServiceQuery(ctx: QueryCtx, args: { serviceType?: string }) {
  if (args.serviceType) {
    return ctx.db
      .query("services")
      .withIndex("by_serviceType", (q) => q.eq("serviceType", args.serviceType!));
  }
  return ctx.db.query("services");
}

/**
 * Cursor-paginated browse listing. Used by /services ("load more").
 * Filtering happens per page, so a page may come back shorter than numItems.
 */
export const listServicesPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await buildServiceQuery(ctx, args).paginate(args.paginationOpts);
    const blockedIds = await getBlockedIds(ctx);

    let page = result.page
      .filter((s) => s.status === "approved")
      .filter((s) => !blockedIds.has(s.ownerId as string));

    if (args.city) {
      page = page.filter((s) => s.city === args.city);
    }

    return { ...result, page };
  },
});

// List approved services (public), hard-capped.
export const listServices = query({
  args: {
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const services = await buildServiceQuery(ctx, args).take(MAX_SCAN);

    const blockedIds = await getBlockedIds(ctx);
    let filtered = services
      .filter((s) => s.status === "approved")
      .filter((s) => !blockedIds.has(s.ownerId as string));

    if (args.city) {
      filtered = filtered.filter((s) => s.city === args.city);
    }

    return filtered.slice(0, Math.min(args.limit ?? 500, MAX_SCAN));
  },
});

// Distinct cities across approved services — powers the /services city filter,
// which previously derived its options from only the first page of results.
export const getServiceCities = query({
  args: {},
  handler: async (ctx) => {
    const services = await ctx.db.query("services").take(MAX_SCAN);

    const cityMap = new Map<string, number>();
    for (const service of services) {
      if (service.status !== "approved" || !service.city) continue;
      cityMap.set(service.city, (cityMap.get(service.city) || 0) + 1);
    }

    return Array.from(cityMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => a.city.localeCompare(b.city));
  },
});

// Get a single service by ID (public — only returns approved services)
export const getService = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.status !== "approved") return null;
    return service;
  },
});

// Search services by title (public)
export const searchServices = query({
  args: {
    searchQuery: v.string(),
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let searchBuilder = ctx.db
      .query("services")
      .withSearchIndex("search_services", (q) => {
        let search = q.search("title_en", args.searchQuery);
        if (args.serviceType) search = search.eq("serviceType", args.serviceType);
        if (args.city) search = search.eq("city", args.city);
        return search;
      });

    const results = await searchBuilder.take(MAX_LIST);

    const blockedIds = await getBlockedIds(ctx);
    const approved = results
      .filter((s) => s.status === "approved")
      .filter((s) => !blockedIds.has(s.ownerId as string));

    return approved.slice(0, Math.min(args.limit ?? 50, MAX_LIST));
  },
});
