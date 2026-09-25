import type { QueryCtx } from "../_generated/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type {
  Expression,
  FilterBuilder,
  GenericTableInfo,
  NamedTableInfo,
  PaginationOptions,
  PaginationResult,
} from "convex/server";
import { canonicalCity, EASTERN_PROVINCE_CITIES, hasAliases, matchesCity } from "../lib/cities";
import { isPlaceholderEmail } from "../lib/contact";

/**
 * What the admin panel reads, with the admin already checked.
 *
 * The queries in queries.ts and users.ts call requireAdmin and then one of
 * these. convex-test cannot get past requireAdmin (it cannot stand up Better
 * Auth), so the shaping and the paging live here, where a test reaches them.
 */

// Search results are ranked, not paged: one capped array.
const MAX_SEARCH = 50;

// === Shared shaping ===

/** Load each distinct id once. A page of fifty rows from three owners costs three reads. */
async function loadAll<T extends "users" | "listings" | "services">(
  ctx: QueryCtx,
  ids: Iterable<Id<T> | undefined>
): Promise<Map<string, Doc<T>>> {
  const unique = [...new Set([...ids].filter((id): id is Id<T> => id !== undefined))];
  const docs = (await Promise.all(unique.map((id) => ctx.db.get(id)))) as (Doc<T> | null)[];
  const found = new Map<string, Doc<T>>();
  unique.forEach((id, i) => {
    const doc = docs[i];
    if (doc) found.set(id, doc);
  });
  return found;
}

/**
 * The name the panel shows for a person. A phone sign-up has no name and a
 * synthesised address on a domain that takes no mail, so its number stands in
 * rather than "966501234567@phone.hasio.xyz".
 */
export function displayName(user: Doc<"users">): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (isPlaceholderEmail(user.email)) return user.phone ?? user.email;
  return user.email;
}

/** An address a person can actually write to, or null for a phone sign-up's placeholder. */
function realEmail(user: Doc<"users">): string | null {
  return isPlaceholderEmail(user.email) ? null : user.email;
}

/** The owner on a service row (contract section 8, adminListServices). */
export function ownerSummary(user: Doc<"users">) {
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: realEmail(user),
    isSuspended: user.isSuspended ?? false,
  };
}

/**
 * The panel's booking row (contract section 8, adminListBookings): the booking
 * plus what it is for, who booked it and who has to honour it.
 *
 * The owner is read from the listing or service as it is now — the same
 * source the booking manager check trusts — and falls back to the booking's
 * own copy only when that document is gone.
 */
export async function bookingRows(ctx: QueryCtx, bookings: Doc<"bookings">[]) {
  const listings = await loadAll(ctx, bookings.map((b) => b.listingId));
  const services = await loadAll(ctx, bookings.map((b) => b.serviceId));

  const ownerIdOf = (b: Doc<"bookings">): Id<"users"> | undefined => {
    if (b.serviceId) {
      const service = services.get(b.serviceId);
      return service ? service.ownerId : b.ownerId;
    }
    if (b.listingId) {
      const listing = listings.get(b.listingId);
      return listing ? listing.ownerId : b.ownerId;
    }
    return b.ownerId;
  };

  const users = await loadAll(ctx, [...bookings.map((b) => b.userId), ...bookings.map(ownerIdOf)]);

  return bookings.map((booking) => {
    const listing = booking.listingId ? listings.get(booking.listingId) : undefined;
    const service = booking.serviceId ? services.get(booking.serviceId) : undefined;
    const guest = users.get(booking.userId);
    const ownerId = ownerIdOf(booking);
    const owner = ownerId ? users.get(ownerId) : undefined;
    return {
      ...booking,
      listing: listing ? { _id: listing._id, name_ar: listing.name_ar, name_en: listing.name_en } : null,
      service: service ? { _id: service._id, title_ar: service.title_ar, title_en: service.title_en } : null,
      // Null only when the account is gone, which account deletion prevents
      // by deleting the guest's bookings with it.
      guest: guest
        ? {
            _id: guest._id,
            name: displayName(guest),
            phone: guest.phone ?? null,
            phoneVerified: guest.phoneVerified ?? false,
          }
        : null,
      // `phone` beyond the contract's { _id, name }: the owner is who support
      // calls when confirming on a business's behalf, as listAllBookings did.
      owner: owner ? { _id: owner._id, name: displayName(owner), phone: owner.phone ?? null } : null,
    };
  });
}

export type AdminBookingRow = Awaited<ReturnType<typeof bookingRows>>[number];

// === Filters that run before .paginate() ===
//
// A filter applied to a page after it was fetched can empty it while matches
// remain further on, and the panel then says "no results". Everything that can
// be written as a Convex filter is therefore applied in the query itself, so
// each page holds up to numItems matching rows.

/**
 * Names the database is known to store for the thirteen cities and their old
 * sub-areas (every seed row before 2026-09-04 says Hofuf or Mubarraz).
 *
 * Only a hint for the query filter below. Whether a name belongs to a city is
 * always decided by lib/cities' canonicalCity, so an entry missing here costs a
 * shorter page, never a wrong answer.
 */
const KNOWN_CITY_NAMES: readonly string[] = [
  ...EASTERN_PROVINCE_CITIES,
  "Hofuf",
  "Al Hofuf",
  "Mubarraz",
  "Al Mubarraz",
  "Al Oyoun",
  "Al Omran",
  "Al Jafer",
  "Al Battaliyah",
  "Al Taraf",
  "Al Shuqaiq",
  "Al Qarah",
  "Al Kilabiyah",
  "Al Jishshah",
  "Al Fudhool",
  "Al Marah",
  "Al Hulaila",
  "Al Salhiyah",
  "Dhahran",
  "Saihat",
  "Safwa",
  "Darin",
  "Tarout",
];

/**
 * "The stored city belongs to `requested`", as a Convex filter.
 *
 * A city without sub-areas is one exact string. A city with them (Al Ahsa is
 * also Hofuf, Mubarraz, …) cannot be matched exactly, because a filter cannot
 * call canonicalCity and lib/cities keeps its alias table private — so the
 * filter keeps everything not known to belong to another city, a superset of
 * the matches, and the caller runs matchesCity over the page to drop anything
 * that slipped through. The superset direction is the safe one: it can let an
 * unknown name through to be dropped, but never loses a real match.
 */
export function cityFilter<TI extends GenericTableInfo>(
  q: FilterBuilder<TI>,
  field: Expression<string | undefined>,
  requested: string
): Expression<boolean> {
  const target = canonicalCity(requested);
  if (!hasAliases(requested)) return q.eq(field, target);
  const elsewhere = KNOWN_CITY_NAMES.filter((name) => canonicalCity(name) !== target);
  return q.and(q.neq(field, undefined), ...elsewhere.map((name) => q.neq(field, name)));
}

type ServiceFilter = FilterBuilder<NamedTableInfo<DataModel, "services">>;

// === Accounts ===

// Hard ceiling per role, as listPendingBusinesses always had.
const MAX_PENDING = 200;

/**
 * Business and provider accounts not yet approved, each saying whether it has
 * uploaded a document and, if an admin turned it down, why. The panel shows an
 * account without a document as such instead of leaving it in the queue with
 * a greyed-out button nobody can explain.
 */
export async function pendingBusinessRows(ctx: QueryCtx) {
  const [owners, providers] = await Promise.all(
    (["business_owner", "service_provider"] as const).map((role) =>
      ctx.db
        .query("users")
        .withIndex("by_role_and_approval", (q) => q.eq("role", role).eq("isApproved", false))
        .take(MAX_PENDING)
    )
  );

  return [...owners, ...providers].map((user) => ({
    ...user,
    hasDocument: user.cvFileId !== undefined,
    accountRejectionReason: user.accountRejectionReason,
  }));
}

// === Services (the live-services tab) ===

export type AdminServiceRow = Doc<"services"> & { owner: ReturnType<typeof ownerSummary> | null };

async function serviceRows(ctx: QueryCtx, services: Doc<"services">[]): Promise<AdminServiceRow[]> {
  const owners = await loadAll(ctx, services.map((s) => s.ownerId));
  return services.map((service) => {
    const owner = owners.get(service.ownerId);
    return { ...service, owner: owner ? ownerSummary(owner) : null };
  });
}

/** Browse services, newest first, filtered in the query so no page comes back empty early. */
export async function listServicesPage(
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions; status?: string; serviceType?: string; city?: string }
): Promise<PaginationResult<AdminServiceRow>> {
  const { status, serviceType, city } = args;

  // The narrowest index the filters allow; the rest become query filters.
  const base = status
    ? ctx.db.query("services").withIndex("by_status", (q) => q.eq("status", status))
    : serviceType
      ? ctx.db.query("services").withIndex("by_serviceType", (q) => q.eq("serviceType", serviceType))
      : ctx.db.query("services");

  const conditions: ((q: ServiceFilter) => Expression<boolean>)[] = [];
  if (status && serviceType) conditions.push((q) => q.eq(q.field("serviceType"), serviceType));
  if (city) conditions.push((q) => cityFilter(q, q.field("city"), city));

  let query = base.order("desc");
  if (conditions.length > 0) query = query.filter((q) => q.and(...conditions.map((c) => c(q))));

  const result = await query.paginate(args.paginationOpts);
  const page = city ? result.page.filter((s) => matchesCity(s.city, city)) : result.page;

  return { ...result, page: await serviceRows(ctx, page) };
}

/**
 * Search services by title, English and Arabic. Convex search results are
 * ranked, not pageable, so this is its own query returning one capped array —
 * the listings tab's shape (adminSearchListings).
 */
export async function searchServicesForAdmin(
  ctx: QueryCtx,
  args: { search: string; status?: string; serviceType?: string; city?: string }
): Promise<AdminServiceRow[]> {
  const term = args.search.trim();
  if (!term) return [];

  const [byEnglish, byArabic] = await Promise.all([
    ctx.db
      .query("services")
      .withSearchIndex("search_services", (q) => {
        const search = q.search("title_en", term);
        return args.serviceType ? search.eq("serviceType", args.serviceType) : search;
      })
      .take(MAX_SEARCH),
    ctx.db
      .query("services")
      .withSearchIndex("search_services_ar", (q) => {
        const search = q.search("title_ar", term);
        return args.serviceType ? search.eq("serviceType", args.serviceType) : search;
      })
      .take(MAX_SEARCH),
  ]);

  // Each index ranks on its own scale, so the English hits come first and
  // duplicates are dropped rather than interleaving incomparable scores. City
  // is checked after the merge: the index matches one exact string, and a city
  // stands for its old sub-areas too.
  const seen = new Set<string>();
  const merged: Doc<"services">[] = [];
  for (const service of [...byEnglish, ...byArabic]) {
    if (seen.has(service._id)) continue;
    seen.add(service._id);
    if (args.status && service.status !== args.status) continue;
    if (args.city && !matchesCity(service.city, args.city)) continue;
    merged.push(service);
  }

  return await serviceRows(ctx, merged.slice(0, MAX_SEARCH));
}

/**
 * One service with everything the detail drawer shows: its owner, the last ten
 * bookings (with who booked them) and how many reports about it are open.
 */
export async function getServiceForAdmin(ctx: QueryCtx, serviceId: Id<"services">) {
  const service = await ctx.db.get(serviceId);
  if (!service) return null;

  const [row] = await serviceRows(ctx, [service]);

  const bookings = await ctx.db
    .query("bookings")
    .withIndex("by_serviceId", (q) => q.eq("serviceId", serviceId))
    .order("desc")
    .take(10);

  const openReports = await ctx.db
    .query("contentReports")
    .withIndex("by_target", (q) => q.eq("targetType", "service").eq("targetId", serviceId))
    .filter((q) => q.eq(q.field("status"), "pending"))
    .take(100);

  return {
    ...row,
    recentBookings: await bookingRows(ctx, bookings),
    openReports: openReports.length,
  };
}
