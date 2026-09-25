import { query } from "../_generated/server";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { getAuthenticatedAppUser } from "../auth";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { canonicalCity, hasAliases, matchesCity } from "../lib/cities";
import { isBookableService, isPublicService } from "./logic";

// Hard ceilings — see the matching constants in listings/queries.ts.
const MAX_SCAN = 1000;
const MAX_LIST = 200;

/** The fields of a service's owner that decide what travellers see. */
export type ServiceOwner = Pick<
  Doc<"users">,
  "role" | "isApproved" | "isSuspended" | "firstName" | "lastName" | "createdAt"
>;

type Owners = ReadonlyMap<string, ServiceOwner | null>;

/**
 * The services a traveller may see, each marked `bookable`.
 *
 * Public means approved and offered by an owner who still exists and is not
 * suspended (isPublicService) — suspending an account hides everything it
 * published without touching each service. On top of that, the viewer's own
 * blocks, and the city, compared through the sub-areas that fold into it, so a
 * service stored as "Hofuf" answers a request for "Al Ahsa".
 */
export function publicServiceRows<S extends Doc<"services">>(
  services: S[],
  owners: Owners,
  filters: { blockedIds?: ReadonlySet<string>; city?: string } = {}
): Array<S & { bookable: boolean }> {
  const rows: Array<S & { bookable: boolean }> = [];
  for (const service of services) {
    const owner = owners.get(service.ownerId) ?? null;
    if (!isPublicService(service, owner)) continue;
    if (filters.blockedIds?.has(service.ownerId)) continue;
    if (filters.city && !matchesCity(service.city, filters.city)) continue;
    rows.push({ ...service, bookable: isBookableService(service, owner) });
  }
  return rows;
}

/**
 * One service for its detail sheet, or null when the viewer may not see it.
 *
 * The provider is named and dated, never contacted from here: the phone a
 * traveller may call is the service's own contactPhone, and the owner's
 * personal number only reaches a traveller through a confirmed booking.
 */
export function publicServiceDetail(
  service: Doc<"services"> | null,
  owner: ServiceOwner | null,
  blockedIds: ReadonlySet<string>
) {
  if (!service || !isPublicService(service, owner) || blockedIds.has(service.ownerId)) return null;
  return {
    ...service,
    bookable: isBookableService(service, owner),
    provider: owner
      ? { firstName: owner.firstName, lastName: owner.lastName, memberSince: owner.createdAt }
      : null,
  };
}

/** Hits from several searches, each service once, in the order first found. */
export function mergeSearchHits<T extends { _id: string }>(...lists: T[][]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const list of lists) {
    for (const hit of list) {
      if (seen.has(hit._id)) continue;
      seen.add(hit._id);
      merged.push(hit);
    }
  }
  return merged;
}

/**
 * Public services per city, under the canonical name. Grouped exactly as
 * matchesCity compares, so a city chip's count is the number of services the
 * same chip then lists.
 */
export function countServiceCities(
  services: Doc<"services">[],
  owners: Owners
): Array<{ city: string; count: number }> {
  const counts = new Map<string, number>();
  for (const service of publicServiceRows(services, owners)) {
    const city = canonicalCity(service.city);
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => a.city.localeCompare(b.city));
}

async function getBlockedIds(ctx: QueryCtx): Promise<Set<string>> {
  const user = await getAuthenticatedAppUser(ctx);
  if (!user) return new Set();
  const blocks = await ctx.db
    .query("userBlocks")
    .withIndex("by_blocker", (q) => q.eq("blockerId", user._id))
    .collect();
  return new Set(blocks.map((b) => b.blockedUserId as string));
}

/** Each distinct owner read once, however many services they have on the page. */
async function loadOwners(
  ctx: QueryCtx,
  services: Array<{ ownerId: Id<"users"> }>
): Promise<Map<string, Doc<"users"> | null>> {
  const ids = [...new Set(services.map((s) => s.ownerId))];
  const docs = await Promise.all(ids.map((id) => ctx.db.get(id)));
  return new Map(ids.map((id, i) => [id as string, docs[i]]));
}

/**
 * The city to filter on inside the query, when that is exact.
 *
 * A city with sub-areas ("Al Ahsa" holds rows stored as "Hofuf", "Mubarraz"…)
 * cannot be expressed as one equality, so it is matched per row afterwards. A
 * city without any is exactly its own name, and filtering it here keeps a page
 * full rather than trimming it after the fact.
 */
function exactCity(city: string | undefined): string | null {
  if (!city || hasAliases(city)) return null;
  return canonicalCity(city);
}

/**
 * Approved services, filtered inside the query so that a page of results is
 * a page of approved ones, however many others wait for review. Owner checks
 * (suspension, blocks) need a second read and happen per page.
 */
function approvedServices(ctx: QueryCtx, args: { serviceType?: string; city?: string }) {
  const base = args.serviceType
    ? ctx.db
        .query("services")
        .withIndex("by_serviceType", (q) => q.eq("serviceType", args.serviceType!))
        .filter((q) => q.eq(q.field("status"), "approved"))
    : ctx.db.query("services").withIndex("by_status", (q) => q.eq("status", "approved"));

  const city = exactCity(args.city);
  return city === null ? base : base.filter((q) => q.eq(q.field("city"), city));
}

// Get authenticated user's own services — suspended ones included, with
// their suspendedReason, so the provider can see what was taken down and why.
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

/**
 * Cursor-paginated browse listing ("load more").
 *
 * Status, type and an exact city are filtered inside the query, so they never
 * shorten a page. A suspended or blocked owner, or a city with sub-areas, is
 * dropped per page, which can still return fewer than numItems — keep loading
 * while `isDone` is false.
 */
export const listServicesPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const result = await approvedServices(ctx, args).paginate(args.paginationOpts);
    const [owners, blockedIds] = await Promise.all([loadOwners(ctx, result.page), getBlockedIds(ctx)]);

    return { ...result, page: publicServiceRows(result.page, owners, { blockedIds, city: args.city }) };
  },
});

// List public services, hard-capped. Each row carries `bookable`.
export const listServices = query({
  args: {
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const services = await approvedServices(ctx, args).take(MAX_SCAN);
    const [owners, blockedIds] = await Promise.all([loadOwners(ctx, services), getBlockedIds(ctx)]);

    const rows = publicServiceRows(services, owners, { blockedIds, city: args.city });
    return rows.slice(0, Math.min(args.limit ?? 500, MAX_SCAN));
  },
});

// Public services per city — powers the services city filter.
export const getServiceCities = query({
  args: {},
  handler: async (ctx) => {
    const services = await approvedServices(ctx, {}).take(MAX_SCAN);
    return countServiceCities(services, await loadOwners(ctx, services));
  },
});

/**
 * A single service for its detail sheet: null unless travellers may see it and
 * the viewer has not blocked its provider.
 */
export const getService = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service) return null;

    const [owner, blockedIds] = await Promise.all([ctx.db.get(service.ownerId), getBlockedIds(ctx)]);
    return publicServiceDetail(service, owner, blockedIds);
  },
});

/**
 * Search services by title, in English and in Arabic.
 *
 * A Convex search index covers one field, so this runs one search per title
 * and merges them. The city is deliberately not a search filter: an index
 * equality would miss a service stored as "Hofuf" when "Al Ahsa" is asked for,
 * so the city is matched afterwards, like everywhere else.
 */
export const searchServices = query({
  args: {
    searchQuery: v.string(),
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const [english, arabic] = await Promise.all([
      ctx.db
        .query("services")
        .withSearchIndex("search_services", (q) => {
          const search = q.search("title_en", args.searchQuery);
          return args.serviceType ? search.eq("serviceType", args.serviceType) : search;
        })
        .take(MAX_LIST),
      ctx.db
        .query("services")
        .withSearchIndex("search_services_ar", (q) => {
          const search = q.search("title_ar", args.searchQuery);
          return args.serviceType ? search.eq("serviceType", args.serviceType) : search;
        })
        .take(MAX_LIST),
    ]);

    const hits = mergeSearchHits(english, arabic);
    const [owners, blockedIds] = await Promise.all([loadOwners(ctx, hits), getBlockedIds(ctx)]);

    return publicServiceRows(hits, owners, { blockedIds, city: args.city }).slice(
      0,
      Math.min(args.limit ?? 50, MAX_LIST)
    );
  },
});
