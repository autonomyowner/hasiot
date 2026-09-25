import type { QueryCtx } from "../_generated/server";
import type { DataModel, Doc, Id } from "../_generated/dataModel";
import type { Value } from "convex/values";
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
import { riyadhMonthKey } from "../lib/dates";
import { toAdminUserRow } from "./service";

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
type BookingFilter = FilterBuilder<NamedTableInfo<DataModel, "bookings">>;

// === Listings, users and the activity log (the paged tables) ===

type ListingFilter = FilterBuilder<NamedTableInfo<DataModel, "listings">>;
type UserFilter = FilterBuilder<NamedTableInfo<DataModel, "users">>;

/** "Has at least one": neither missing nor an empty array. */
function nonEmpty<TI extends GenericTableInfo>(
  q: FilterBuilder<TI>,
  field: Expression<Value[] | undefined>,
  wanted: boolean
): Expression<boolean> {
  return wanted
    ? q.and(q.neq(field, undefined), q.neq(field, []))
    : q.or(q.eq(field, undefined), q.eq(field, []));
}

/**
 * The listings table, filtered inside the query.
 *
 * `status: "seed"` selects the rows with no status at all — seed data, which
 * predates the approval flow and counts as published everywhere.
 */
export async function listListingsPage(
  ctx: QueryCtx,
  args: {
    paginationOpts: PaginationOptions;
    type?: string;
    city?: string;
    status?: string;
    hasImages?: boolean;
    hasWorkingHours?: boolean;
    order?: string;
  }
): Promise<PaginationResult<Doc<"listings">>> {
  const { type, city, status, hasImages, hasWorkingHours } = args;

  // The narrowest index the filters allow; status wins because the pending
  // queue is the one that grows. A city with old sub-areas cannot use the
  // city index, which matches one exact string.
  const byStatus = status !== undefined && status !== "seed";
  const byType = !byStatus && type !== undefined;
  const byCity = !byStatus && !byType && city !== undefined && !hasAliases(city);
  const base = byStatus
    ? ctx.db.query("listings").withIndex("by_status", (q) => q.eq("status", status))
    : byType
      ? ctx.db.query("listings").withIndex("by_type", (q) => q.eq("type", type))
      : byCity
        ? ctx.db.query("listings").withIndex("by_city", (q) => q.eq("city", city))
        : ctx.db.query("listings");

  const conditions: ((q: ListingFilter) => Expression<boolean>)[] = [];
  if (status === "seed") conditions.push((q) => q.eq(q.field("status"), undefined));
  if (type !== undefined && !byType) conditions.push((q) => q.eq(q.field("type"), type));
  if (city !== undefined && !byCity) conditions.push((q) => cityFilter(q, q.field("city"), city));
  if (hasImages !== undefined) conditions.push((q) => nonEmpty(q, q.field("images"), hasImages));
  if (hasWorkingHours !== undefined) {
    conditions.push((q) => nonEmpty(q, q.field("workingHours"), hasWorkingHours));
  }

  let query = base.order(args.order === "oldest" ? "asc" : "desc");
  if (conditions.length > 0) query = query.filter((q) => q.and(...conditions.map((c) => c(q))));

  const result = await query.paginate(args.paginationOpts);
  // Only the sub-area superset in cityFilter can let a stranger through.
  return city ? { ...result, page: result.page.filter((l) => matchesCity(l.city, city)) } : result;
}

/** The accounts table, filtered inside the query, as the panel's rows. */
export async function listUsersPage(
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions; role?: string; phoneVerified?: boolean; suspended?: boolean }
) {
  const { role, phoneVerified, suspended } = args;
  const base = role
    ? ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", role))
    : ctx.db.query("users");

  // "Not verified" includes never having tried (undefined), hence neq true.
  const conditions: ((q: UserFilter) => Expression<boolean>)[] = [];
  if (phoneVerified !== undefined) {
    conditions.push((q) =>
      phoneVerified ? q.eq(q.field("phoneVerified"), true) : q.neq(q.field("phoneVerified"), true)
    );
  }
  if (suspended !== undefined) {
    conditions.push((q) =>
      suspended ? q.eq(q.field("isSuspended"), true) : q.neq(q.field("isSuspended"), true)
    );
  }

  let query = base.order("desc");
  if (conditions.length > 0) query = query.filter((q) => q.and(...conditions.map((c) => c(q))));

  const result = await query.paginate(args.paginationOpts);
  return { ...result, page: result.page.map(toAdminUserRow) };
}

/**
 * The admin action log, newest first. Rows are append-only, so creation order
 * is the chronology. A target-type filter runs over that order rather than
 * the by_target index, which would sort by target id instead of by time.
 */
export async function listActivityPage(
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions; action?: string; targetType?: string }
) {
  const { action, targetType } = args;
  const base = action
    ? ctx.db.query("adminActivity").withIndex("by_action", (q) => q.eq("action", action))
    : ctx.db.query("adminActivity");

  let query = base.order("desc");
  if (targetType) query = query.filter((q) => q.eq(q.field("targetType"), targetType));

  return await query.paginate(args.paginationOpts);
}

// === Bookings (the bookings tab) ===

/** "slot" is the legacy restaurant booking: `kind` "slot", or no kind at all. */
export type BookingKind = "stay" | "service" | "slot";

function kindFilter(q: BookingFilter, kind: BookingKind): Expression<boolean> {
  if (kind === "slot") {
    return q.or(q.eq(q.field("kind"), undefined), q.eq(q.field("kind"), "slot"));
  }
  return q.eq(q.field("kind"), kind);
}

/**
 * Every booking, newest first, for support: stays, service bookings and old
 * slots, with what was booked, who booked it and who has to honour it.
 * `listAllBookings` stays for the dashboard's "recent bookings" card.
 */
export async function listBookingsPage(
  ctx: QueryCtx,
  args: { paginationOpts: PaginationOptions; status?: string; kind?: BookingKind }
): Promise<PaginationResult<AdminBookingRow>> {
  const { status, kind } = args;
  const base = status
    ? ctx.db.query("bookings").withIndex("by_status", (q) => q.eq("status", status))
    : ctx.db.query("bookings");

  let query = base.order("desc");
  if (kind) query = query.filter((q) => kindFilter(q, kind));

  const result = await query.paginate(args.paginationOpts);
  return { ...result, page: await bookingRows(ctx, result.page) };
}

/** Arabic-Indic and Persian digits to ASCII: the panel is Arabic, and so is its keyboard. */
function toLatinDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * The stored form (E.164, "+9665…") of a phone number an operator pasted or
 * typed, or null when the text is not a phone number. Accepts the local Saudi
 * forms ("05…", "5…"), a "00" prefix, spaces and dashes, and Arabic digits.
 */
export function phoneSearchKey(term: string): string | null {
  const text = toLatinDigits(term).trim();
  if (!/^\+?[\d\s\-()]+$/.test(text)) return null;
  const digits = text.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (text.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length === 10 && digits.startsWith("05")) return `+966${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith("5")) return `+966${digits}`;
  return `+${digits}`;
}

const CODE = /^(?:HSO-?)?([A-Z0-9]{5})$/i;
const PHONE_MATCHES = 5;

/**
 * Find bookings the way support is asked about them: the confirmation code a
 * guest reads out ("HSO-7K3M2", in any case, with or without the prefix), or
 * the phone number of the guest who made them. One capped array, like every
 * search in the panel.
 */
export async function searchBookingsForAdmin(
  ctx: QueryCtx,
  args: { search: string }
): Promise<AdminBookingRow[]> {
  const term = args.search.trim();
  if (!term) return [];

  const code = CODE.exec(term);
  if (code) {
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_confirmationCode", (q) => q.eq("confirmationCode", `HSO-${code[1].toUpperCase()}`))
      .take(MAX_SEARCH);
    return await bookingRows(ctx, bookings);
  }

  const phone = phoneSearchKey(term);
  if (!phone) return [];

  const guests = await ctx.db
    .query("users")
    .withIndex("by_phone", (q) => q.eq("phone", phone))
    .take(PHONE_MATCHES);
  const perGuest = await Promise.all(
    guests.map((guest) =>
      ctx.db
        .query("bookings")
        .withIndex("by_userId", (q) => q.eq("userId", guest._id))
        .order("desc")
        .take(MAX_SEARCH)
    )
  );
  const bookings = perGuest
    .flat()
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, MAX_SEARCH);

  return await bookingRows(ctx, bookings);
}

// === Dashboard ===

// Counts are exact below these read caps; past them the dashboard says so.
// Convex fails a query outright past ~16k reads, and this dashboard used to
// collect seven whole tables on every page load.
const STATS_CAP = 5000;
const REPORTS_CAP = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The dashboard's numbers, as of `now`.
 *
 * Additive only: the panel already on production reads these fields and the
 * backend deploys before the panel, so none may be renamed or change meaning.
 */
export async function computeDashboardStats(ctx: QueryCtx, now: number = Date.now()) {
  const listings = await ctx.db.query("listings").take(STATS_CAP);
  const bookings = await ctx.db.query("bookings").take(STATS_CAP);
  const users = await ctx.db.query("users").take(STATS_CAP);
  const knowledgeData = await ctx.db.query("travelKnowledge").take(STATS_CAP);
  const travelPlans = await ctx.db.query("travelPlans").take(STATS_CAP);
  const emailCaptures = await ctx.db.query("emailCaptures").take(STATS_CAP);
  const services = await ctx.db.query("services").take(STATS_CAP);

  // Everything below is derived from the rows already fetched above, apart
  // from the indexed report count — the point is to add the numbers the
  // operator acts on without adding table scans.
  const pendingReports = await ctx.db
    .query("contentReports")
    .withIndex("by_status", (q) => q.eq("status", "pending"))
    .take(REPORTS_CAP);

  const bookingsByStatus = {
    pending: bookings.filter((b) => b.status === "pending").length,
    confirmed: bookings.filter((b) => b.status === "confirmed").length,
    completed: bookings.filter((b) => b.status === "completed").length,
    cancelled: bookings.filter((b) => b.status === "cancelled").length,
    no_show: bookings.filter((b) => b.status === "no_show").length,
    declined: bookings.filter((b) => b.status === "declined").length,
    expired: bookings.filter((b) => b.status === "expired").length,
  };

  // The number the operator chases: stay requests a host has not answered.
  const awaitingOwner = bookings.filter((b) => b.kind === "stay" && b.status === "pending").length;

  const thisMonth = riyadhMonthKey(now);
  const stayRevenueMonth = bookings
    .filter(
      (b) =>
        b.kind === "stay" &&
        (b.status === "confirmed" || b.status === "completed") &&
        (b.checkIn ?? b.date).startsWith(thisMonth)
    )
    .reduce((sum, b) => sum + (b.totalAmount ?? 0), 0);

  // Every listing sits in exactly one review state, which makes this a true
  // part-to-whole — the shape the dashboard's segmented bar needs. Seed rows
  // carry no status at all and are treated as published everywhere else.
  const listingsByStatus = {
    approved: listings.filter((l) => l.status === "approved").length,
    pending: listings.filter((l) => l.status === "pending").length,
    rejected: listings.filter((l) => l.status === "rejected").length,
    suspended: listings.filter((l) => l.status === "suspended").length,
    seed: listings.filter((l) => l.status === undefined).length,
  };

  const listingsByType = {
    hotel: listings.filter((l) => l.type === "hotel").length,
    restaurant: listings.filter((l) => l.type === "restaurant").length,
    attraction: listings.filter((l) => l.type === "attraction").length,
    event: listings.filter((l) => l.type === "event").length,
    tour: listings.filter((l) => l.type === "tour").length,
  };

  const weekAgo = now - 7 * DAY_MS;
  const today = new Date(now).toISOString().split("T")[0];
  const inAWeek = new Date(now + 7 * DAY_MS).toISOString().split("T")[0];

  // Daily buckets for the dashboard's trend charts. Built from the rows
  // already fetched above by bucketing createdAt, so the charts cost nothing:
  // no extra query, no extra document read.
  const TREND_DAYS = 14;
  const dayKeys: string[] = [];
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    dayKeys.push(new Date(now - i * DAY_MS).toISOString().split("T")[0]);
  }
  const bucket = (rows: { createdAt: number }[]) => {
    const counts = new Map(dayKeys.map((d) => [d, 0]));
    for (const row of rows) {
      const key = new Date(row.createdAt).toISOString().split("T")[0];
      const current = counts.get(key);
      if (current !== undefined) counts.set(key, current + 1);
    }
    return dayKeys.map((d) => counts.get(d) ?? 0);
  };

  const trend = {
    days: dayKeys,
    listings: bucket(listings),
    bookings: bucket(bookings),
    users: bucket(users),
  };

  const pendingBusinesses = users.filter(
    (u) => (u.role === "business_owner" || u.role === "service_provider") && u.isApproved === false
  ).length;

  // Pending bookings split by who has to act, so each one is counted once.
  // pendingBookings (every pending booking) overlaps awaitingOwner, and the
  // panel used to list the two side by side and add them up.
  const awaitingProvider = bookings.filter((b) => b.kind === "service" && b.status === "pending").length;
  const pendingSlotBookings = bookings.filter(
    (b) => b.status === "pending" && b.kind !== "stay" && b.kind !== "service"
  ).length;

  // The accounts an admin can decide on now. pendingBusinesses also counts
  // accounts still waiting on their owner: no document yet, or turned down
  // and not re-uploaded.
  const accountsAwaitingReview = users.filter(
    (u) =>
      (u.role === "business_owner" || u.role === "service_provider") &&
      u.isApproved === false &&
      u.cvFileId !== undefined &&
      u.accountRejectionReason === undefined
  ).length;

  const pendingContent = listings.filter((l) => l.status === "pending").length;
  const pendingServices = services.filter((s) => s.status === "pending").length;

  // Every piece of waiting work in exactly one queue.
  const queues = {
    content: pendingContent,
    services: pendingServices,
    accounts: accountsAwaitingReview,
    reports: pendingReports.length,
    stayRequests: awaitingOwner,
    serviceRequests: awaitingProvider,
    slotBookings: pendingSlotBookings,
  };

  const truncated = [listings, bookings, users, knowledgeData, travelPlans, emailCaptures, services].some(
    (rows) => rows.length >= STATS_CAP
  );

  return {
    statsCap: STATS_CAP,
    truncated,
    totalListings: listings.length,
    totalBookings: bookings.length,
    totalUsers: users.length,
    totalKnowledgeData: knowledgeData.length,
    totalTravelPlans: travelPlans.length,
    bookingsByStatus,
    listingsByType,
    listingsByStatus,
    totalEmailCaptures: emailCaptures.length,
    activeListings: listings.filter((l) => l.isActive !== false).length,
    verifiedListings: listings.filter((l) => l.isVerified === true).length,
    pendingContent,
    totalServices: services.length,
    pendingServices,

    // Work waiting on the operator, which is what the dashboard leads with.
    pendingBusinesses,
    pendingReports: pendingReports.length,
    // Every pending booking of every kind, stays included.
    pendingBookings: bookingsByStatus.pending,
    // Waiting on a *host*, not on us — the operator's job here is to chase
    // the host, not to approve anything.
    awaitingOwner,

    // --- 1.1.0, additive ---
    // Each queue once: the "needs action" list should be built from these,
    // and its total is queueTotal, never a sum that counts a stay twice.
    queues,
    queueTotal: Object.values(queues).reduce((sum, n) => sum + n, 0),
    awaitingProvider,
    pendingSlotBookings,
    accountsAwaitingReview,
    // True when any count stopped at its read cap: the figures are floors,
    // and the panel says so (الأرقام تقريبية) instead of showing them as exact.
    capped: truncated || pendingReports.length >= REPORTS_CAP,

    // Accounts
    verifiedUsers: users.filter((u) => u.phoneVerified === true).length,
    suspendedUsers: users.filter((u) => u.isSuspended === true).length,
    phoneSignups: users.filter((u) => isPlaceholderEmail(u.email)).length,

    // Money, for the month so far
    stayRevenueMonth,
    currency: "SAR",

    // Content quality: a listing with no photo renders as a blank card in the
    // app, and one with no working hours can never offer a booking slot.
    listingsMissingImages: listings.filter((l) => !l.images || l.images.length === 0).length,
    listingsMissingHours: listings.filter((l) => !l.workingHours || l.workingHours.length === 0).length,

    // Momentum
    newUsersThisWeek: users.filter((u) => u.createdAt >= weekAgo).length,
    newListingsThisWeek: listings.filter((l) => l.createdAt >= weekAgo).length,
    upcomingBookings: bookings.filter(
      (b) => b.date >= today && b.date <= inAWeek && b.status !== "cancelled"
    ).length,

    trend,
  };
}

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

const USER_BOOKINGS = 20;
const USER_OWNED = 50;
const USER_REPORTS = 20;

/**
 * One account for the user drawer (contract section 8, adminGetUser): the
 * table row, why it was turned down, the trips it booked, what it publishes,
 * and the reports filed against what it published or wrote.
 */
export async function getUserForAdmin(ctx: QueryCtx, userId: Id<"users">) {
  const user = await ctx.db.get(userId);
  if (!user) return null;

  const [bookings, listings, services, reviews] = await Promise.all([
    ctx.db
      .query("bookings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(USER_BOOKINGS),
    ctx.db
      .query("listings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(USER_OWNED),
    ctx.db
      .query("services")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(USER_OWNED),
    ctx.db
      .query("reviews")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(USER_OWNED),
  ]);

  // A report names its target by type and id, so the reports against this
  // account are found through each thing it owns. Every lookup is one small
  // indexed range, bounded by the caps above.
  const targets: { type: string; id: string; title: string }[] = [
    ...listings.map((l) => ({ type: "listing", id: l._id as string, title: l.name_ar || l.name_en })),
    ...services.map((s) => ({ type: "service", id: s._id as string, title: s.title_ar || s.title_en })),
    ...reviews.map((r) => ({ type: "review", id: r._id as string, title: r.content ?? `${r.rating}/5` })),
  ];
  const found = await Promise.all(
    targets.map(async (target) =>
      (
        await ctx.db
          .query("contentReports")
          .withIndex("by_target", (q) => q.eq("targetType", target.type).eq("targetId", target.id))
          .order("desc")
          .take(USER_REPORTS)
      ).map((report) => ({ ...report, targetTitle: target.title }))
    )
  );
  const reports = found
    .flat()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, USER_REPORTS);

  return {
    ...toAdminUserRow(user),
    accountRejectionReason: user.accountRejectionReason,
    accountRejectedAt: user.accountRejectedAt,
    bookings: await bookingRows(ctx, bookings),
    listings,
    services,
    reports,
  };
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
