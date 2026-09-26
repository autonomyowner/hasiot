import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { isPlaceholderEmail } from "../lib/contact";
import { addDays, toRiyadhISODate, todayRiyadhISO } from "../lib/dates";

/**
 * Partner analytics and the guest CRM (contract:
 * docs/superpowers/contracts/2026-09-26-partner-analytics-crm.md).
 *
 * Seams, as everywhere in this backend: each takes a ctx and an already
 * resolved user, so convex-test can reach them without Better Auth. The
 * public wrappers in queries.ts / mutations.ts only authenticate.
 */

export const PARTNER_ERRORS = {
  NOT_PARTNER: "هذه الصفحة للشركاء المعتمدين فقط. / This page is for approved partners only.",
  GUEST_NOT_FOUND: "لم نجد هذا الضيف. / We could not find this guest.",
  NOTE_TOO_LONG:
    "الملاحظة طويلة جدًا (2000 حرف كحد أقصى). / The note is too long (2000 characters at most).",
  BAD_TAGS:
    "الوسوم غير صالحة: 10 كحد أقصى، و24 حرفًا لكل وسم. / Invalid tags: at most 10, each up to 24 characters.",
} as const;

/**
 * Read ceilings. An object rather than constants so a test can lower the
 * booking cap instead of seeding 2000 rows to see `truncated`.
 */
export const PARTNER_LIMITS = {
  bookings: 2000,
  items: 200,
  reviewsPerItem: 500,
  guests: 500,
  guestBookings: 500,
  notes: 5000,
};

export const MAX_NOTE = 2000;
export const MAX_TAGS = 10;
export const MAX_TAG = 24;

export type Period = "30d" | "90d" | "12m";
type Reader = Pick<QueryCtx, "db">;
type Booking = Doc<"bookings">;
type PartnerKind = "listing" | "service";

export type AccountStatus =
  | { status: "signed_out" }
  | { status: "no_account" }
  | { status: "suspended"; reason: string | null }
  | { status: "active" };

/**
 * What the portal needs to know before routing a signed-in person, and which
 * getCurrentUser cannot say: a suspended account reads as signed out there
 * (getAuthenticatedAppUser returns null), which the portal would otherwise
 * mistake for a new sign-up and send to Join. Same join as
 * getAuthenticatedAppUser — authId first, then email for pre-trigger rows —
 * and it reveals nothing about anyone but the caller.
 */
export async function accountStatusFor(
  ctx: Reader,
  authUser: { _id: string; email?: string | null } | null
): Promise<AccountStatus> {
  if (!authUser) return { status: "signed_out" };
  const user =
    (await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()) ??
    (authUser.email
      ? await ctx.db
          .query("users")
          .withIndex("by_email", (q) => q.eq("email", authUser.email!))
          .first()
      : null);
  if (!user) return { status: "no_account" };
  if (user.isSuspended) return { status: "suspended", reason: user.suspendedReason ?? null };
  return { status: "active" };
}

/**
 * Only an approved host or provider whose account is not suspended. The
 * refusal is the same for every reason, so the page need not tell a pending
 * applicant apart from a suspended one.
 */
export function requirePartner(user: Doc<"users">): PartnerKind {
  const partnerRole = user.role === "business_owner" || user.role === "service_provider";
  if (!partnerRole || user.isApproved !== true || user.isSuspended === true) {
    throw new ConvexError(PARTNER_ERRORS.NOT_PARTNER);
  }
  return user.role === "service_provider" ? "service" : "listing";
}

/** The partner's bookings, newest first, capped; `truncated` when the cap came back full. */
async function partnerBookings(ctx: Reader, user: Doc<"users">, kind: PartnerKind) {
  const cap = PARTNER_LIMITS.bookings;
  const rows = await ctx.db
    .query("bookings")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
    .order("desc")
    .filter((q) =>
      kind === "service" ? q.eq(q.field("kind"), "service") : q.neq(q.field("kind"), "service")
    )
    .take(cap);
  return { rows, truncated: rows.length >= cap };
}

const isWon = (b: Pick<Booking, "status">) => b.status === "confirmed" || b.status === "completed";

function fullName(user: Pick<Doc<"users">, "firstName" | "lastName"> | null): string | null {
  if (!user) return null;
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// ---------------------------------------------------------------- dates

function mondayOf(iso: string): string {
  const dow = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((dow + 6) % 7));
}

function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + by;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** `YYYY-MM-DD` one year back; 29 February becomes the 28th. */
function sameDayLastYear(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y - 1, m, 0)).getUTCDate();
  return `${y - 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
}

type Window = { from: string; to: string };

/**
 * The period on the Riyadh calendar, both ends inclusive, and the window of
 * the same length just before it. Twelve months are whole calendar months,
 * the current one included, so the chart never shows a half month at the left.
 */
export function periodWindows(period: Period, now: number) {
  const today = todayRiyadhISO(now);
  if (period === "12m") {
    const month = today.slice(0, 7);
    const from = `${shiftMonth(month, -11)}-01`;
    return {
      current: { from, to: today },
      // The same stretch a year earlier. Ending it on the day before `from`
      // would make it twelve whole months against eleven and a bit, and every
      // change early in a month would read as a drop.
      previous: { from: `${shiftMonth(month, -23)}-01`, to: sameDayLastYear(today) },
      bucket: "month" as const,
    };
  }
  const days = period === "30d" ? 30 : 90;
  const from = addDays(today, -(days - 1));
  return {
    current: { from, to: today },
    previous: { from: addDays(from, -days), to: addDays(from, -1) },
    bucket: period === "30d" ? ("day" as const) : ("week" as const),
  };
}

function bucketKey(bucket: "day" | "week" | "month", iso: string): string {
  if (bucket === "day") return iso;
  if (bucket === "week") return mondayOf(iso);
  return iso.slice(0, 7);
}

function seriesKeys(bucket: "day" | "week" | "month", w: Window): string[] {
  const keys: string[] = [];
  if (bucket === "month") {
    const last = w.to.slice(0, 7);
    for (let m = w.from.slice(0, 7); m <= last; m = shiftMonth(m, 1)) keys.push(m);
    return keys;
  }
  const step = bucket === "day" ? 1 : 7;
  const start = bucket === "day" ? w.from : mondayOf(w.from);
  for (let d = start; d <= w.to; d = addDays(d, step)) keys.push(d);
  return keys;
}

const createdDay = (b: Pick<Booking, "createdAt">) => toRiyadhISODate(b.createdAt);
const inWindow = (b: Pick<Booking, "createdAt">, w: Window) => {
  const d = createdDay(b);
  return d >= w.from && d <= w.to;
};

// ---------------------------------------------------------------- analytics

export type Totals = {
  requests: number;
  confirmed: number;
  declined: number;
  revenue: number;
  avgBookingValue: number | null;
  acceptanceRate: number | null;
  medianResponseMinutes: number | null;
  nightsSold: number;
  repeatGuestShare: number | null;
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function totalsFor(rows: Booking[], w: Window, firstSeen: Map<Id<"users">, string>): Totals {
  const won = rows.filter(isWon);
  const declined = rows.filter((b) => b.status === "declined").length;
  const expired = rows.filter((b) => b.status === "expired").length;
  const revenue = won.reduce((sum, b) => sum + (b.totalAmount ?? 0), 0);
  const answered = won.length + declined + expired;
  const minutes = rows
    .filter((b) => typeof b.respondedAt === "number")
    .map((b) => (b.respondedAt! - b.createdAt) / 60_000);
  const med = median(minutes);

  // A repeat guest is one in this window whose first request to this partner
  // came before the window started.
  const guests = new Set(rows.map((b) => b.userId));
  let repeat = 0;
  for (const g of guests) if ((firstSeen.get(g) ?? w.from) < w.from) repeat++;

  return {
    requests: rows.length,
    confirmed: won.length,
    declined,
    revenue,
    avgBookingValue: won.length ? revenue / won.length : null,
    acceptanceRate: answered ? won.length / answered : null,
    medianResponseMinutes: med === null ? null : Math.round(med),
    nightsSold: won.filter((b) => b.kind === "stay").reduce((sum, b) => sum + (b.nights ?? 0), 0),
    repeatGuestShare: guests.size ? repeat / guests.size : null,
  };
}

type Item = { id: string; kind: PartnerKind; name_en: string; name_ar: string };

async function ownedItems(ctx: Reader, user: Doc<"users">, kind: PartnerKind): Promise<Item[]> {
  if (kind === "service") {
    const services = await ctx.db
      .query("services")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(PARTNER_LIMITS.items);
    return services.map((s) => ({ id: s._id, kind, name_en: s.title_en, name_ar: s.title_ar }));
  }
  const listings = await ctx.db
    .query("listings")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
    .take(PARTNER_LIMITS.items);
  return listings.map((l) => ({ id: l._id, kind, name_en: l.name_en, name_ar: l.name_ar }));
}

const itemIdOf = (b: Booking): string | undefined => (b.kind === "service" ? b.serviceId : b.listingId);

async function itemReviews(ctx: Reader, item: Item): Promise<Doc<"reviews">[]> {
  return item.kind === "service"
    ? await ctx.db
        .query("reviews")
        .withIndex("by_serviceId", (q) => q.eq("serviceId", item.id as Id<"services">))
        .take(PARTNER_LIMITS.reviewsPerItem)
    : await ctx.db
        .query("reviews")
        .withIndex("by_listingId", (q) => q.eq("listingId", item.id as Id<"listings">))
        .take(PARTNER_LIMITS.reviewsPerItem);
}

export async function analyticsFor(
  ctx: Reader,
  user: Doc<"users">,
  args: { period: Period; now: number }
) {
  const kind = requirePartner(user);
  const { current, previous, bucket } = periodWindows(args.period, args.now);
  const { rows, truncated } = await partnerBookings(ctx, user, kind);

  // Earliest request date per guest, over everything read.
  const firstSeen = new Map<Id<"users">, string>();
  for (const b of rows) {
    const d = createdDay(b);
    const seen = firstSeen.get(b.userId);
    if (!seen || d < seen) firstSeen.set(b.userId, d);
  }

  const now = rows.filter((b) => inWindow(b, current));
  const before = rows.filter((b) => inWindow(b, previous));

  const series = seriesKeys(bucket, current).map((key) => ({
    key,
    label: key,
    requests: 0,
    confirmed: 0,
    revenue: 0,
  }));
  const byKey = new Map(series.map((s) => [s.key, s]));
  for (const b of now) {
    const point = byKey.get(bucketKey(bucket, createdDay(b)));
    if (!point) continue;
    point.requests++;
    if (isWon(b)) {
      point.confirmed++;
      point.revenue += b.totalAmount ?? 0;
    }
  }

  const outcomes = { pending: 0, confirmed: 0, completed: 0, declined: 0, expired: 0, cancelled: 0, no_show: 0 };
  for (const b of now) {
    if (b.status in outcomes) outcomes[b.status as keyof typeof outcomes]++;
  }

  const owned = await ownedItems(ctx, user, kind);
  const reviewsByItem = await Promise.all(owned.map((item) => itemReviews(ctx, item)));
  const items = owned.map((item, i) => {
    const mine = now.filter((b) => itemIdOf(b) === item.id);
    const won = mine.filter(isWon);
    const reviews = reviewsByItem[i];
    return {
      ...item,
      requests: mine.length,
      confirmed: won.length,
      revenue: won.reduce((sum, b) => sum + (b.totalAmount ?? 0), 0),
      rating: reviews.length ? round1(reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) : null,
      reviewCount: reviews.length,
    };
  });

  const allReviews = reviewsByItem.flatMap((reviews, i) => reviews.map((r) => ({ r, item: owned[i] })));
  const distribution: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (const { r } of allReviews) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating)));
    distribution[star - 1]++;
  }
  const latestRows = [...allReviews].sort((a, b) => b.r.createdAt - a.r.createdAt).slice(0, 5);
  const latest = await Promise.all(
    latestRows.map(async ({ r, item }) => ({
      rating: r.rating,
      content: r.content?.trim() ? r.content : null,
      // An anonymous review stays anonymous to the partner too.
      guestName: r.isAnonymous ? null : fullName(await ctx.db.get(r.userId)),
      createdAt: r.createdAt,
      itemName_en: item.name_en,
      itemName_ar: item.name_ar,
    }))
  );

  return {
    period: args.period,
    from: current.from,
    to: current.to,
    bucket,
    truncated,
    currency: "SAR" as const,
    totals: totalsFor(now, current, firstSeen),
    previous: totalsFor(before, previous, firstSeen),
    series,
    outcomes,
    items,
    ratings: {
      average: allReviews.length
        ? round1(allReviews.reduce((s, { r }) => s + r.rating, 0) / allReviews.length)
        : null,
      count: allReviews.length,
      distribution,
      latest,
    },
  };
}

// ---------------------------------------------------------------- guests

async function notesOf(ctx: Reader, ownerId: Id<"users">) {
  const rows = await ctx.db
    .query("partnerGuestNotes")
    .withIndex("by_ownerId_and_guestId", (q) => q.eq("ownerId", ownerId))
    .take(PARTNER_LIMITS.notes);
  return new Map(rows.map((row) => [row.guestId, row]));
}

const digitsOf = (s: string | undefined | null) => (s ?? "").replace(/\D/g, "");

export async function listGuestsFor(
  ctx: Reader,
  user: Doc<"users">,
  args: { search?: string; tag?: string; sort?: "recent" | "spent" | "bookings"; now?: number }
) {
  const kind = requirePartner(user);
  // A confirmed stay that has not begun is booked, not visited: the list
  // used to show next month's arrival as a guest's "last visit".
  const today = todayRiyadhISO(args.now ?? Date.now());
  const { rows, truncated } = await partnerBookings(ctx, user, kind);

  type Acc = {
    guestId: Id<"users">;
    bookings: number;
    completed: number;
    spent: number;
    firstAt: number;
    lastAt: number;
    lastVisit: string | null;
  };
  const byGuest = new Map<Id<"users">, Acc>();
  for (const b of rows) {
    let acc = byGuest.get(b.userId);
    if (!acc) {
      acc = { guestId: b.userId, bookings: 0, completed: 0, spent: 0, firstAt: b.createdAt, lastAt: b.createdAt, lastVisit: null };
      byGuest.set(b.userId, acc);
    }
    acc.bookings++;
    if (b.status === "completed") acc.completed++;
    acc.firstAt = Math.min(acc.firstAt, b.createdAt);
    acc.lastAt = Math.max(acc.lastAt, b.createdAt);
    if (isWon(b)) {
      acc.spent += b.totalAmount ?? 0;
      const visit = b.checkIn ?? b.date;
      if (visit && visit <= today && (!acc.lastVisit || visit > acc.lastVisit)) acc.lastVisit = visit;
    }
  }

  const notes = await notesOf(ctx, user._id);
  const people = await Promise.all([...byGuest.keys()].map((id) => ctx.db.get(id)));
  let guests = [...byGuest.values()].map((acc, i) => {
    const person = people[i];
    const note = notes.get(acc.guestId);
    return {
      ...acc,
      name: fullName(person),
      phone: person?.phone ?? null,
      // A number may be typed without an SMS code while Saudi SMS is down
      // (lib/phoneRules.ts); the partner is told which it is.
      phoneVerified: person?.phoneVerified ?? false,
      tags: note?.tags ?? [],
      hasNote: !!note && note.note.trim().length > 0,
    };
  });

  const search = args.search?.trim().toLowerCase();
  if (search) {
    const digits = digitsOf(search);
    guests = guests.filter(
      (g) =>
        (g.name ?? "").toLowerCase().includes(search) ||
        (digits.length > 0 && digitsOf(g.phone).includes(digits))
    );
  }
  const tag = args.tag?.trim().toLowerCase();
  if (tag) guests = guests.filter((g) => g.tags.some((t) => t.toLowerCase() === tag));

  const sort = args.sort ?? "recent";
  guests.sort((a, b) =>
    sort === "spent"
      ? b.spent - a.spent || b.lastAt - a.lastAt
      : sort === "bookings"
        ? b.bookings - a.bookings || b.lastAt - a.lastAt
        : b.lastAt - a.lastAt
  );

  return {
    truncated,
    guests: guests.slice(0, PARTNER_LIMITS.guests).map((g) => ({
      guestId: g.guestId,
      name: g.name,
      phone: g.phone,
      phoneVerified: g.phoneVerified,
      bookings: g.bookings,
      completed: g.completed,
      spent: g.spent,
      firstAt: g.firstAt,
      lastAt: g.lastAt,
      lastVisit: g.lastVisit,
      tags: g.tags,
      hasNote: g.hasNote,
    })),
  };
}

/**
 * The guest's bookings with this partner, in the partner's kind, newest first.
 * Empty means "not your guest", which every caller turns into GUEST_NOT_FOUND —
 * the same answer as for an id that does not exist, so nothing can be probed.
 */
async function bookingsWithPartner(ctx: Reader, user: Doc<"users">, kind: PartnerKind, guestId: Id<"users">) {
  return await ctx.db
    .query("bookings")
    .withIndex("by_userId", (q) => q.eq("userId", guestId))
    .order("desc")
    .filter((q) =>
      q.and(
        q.eq(q.field("ownerId"), user._id),
        kind === "service" ? q.eq(q.field("kind"), "service") : q.neq(q.field("kind"), "service")
      )
    )
    .take(PARTNER_LIMITS.guestBookings);
}

async function noteRow(ctx: Reader, ownerId: Id<"users">, guestId: Id<"users">) {
  return await ctx.db
    .query("partnerGuestNotes")
    .withIndex("by_ownerId_and_guestId", (q) => q.eq("ownerId", ownerId).eq("guestId", guestId))
    .first();
}

export async function getGuestFor(ctx: Reader, user: Doc<"users">, guestId: Id<"users">) {
  const kind = requirePartner(user);
  const guest = await ctx.db.get(guestId);
  const rows = guest ? await bookingsWithPartner(ctx, user, kind, guestId) : [];
  if (!guest || rows.length === 0) throw new ConvexError(PARTNER_ERRORS.GUEST_NOT_FOUND);

  const note = await noteRow(ctx, user._id, guestId);
  const names = new Map<string, { name_en: string; name_ar: string } | null>();
  for (const b of rows) {
    const id = itemIdOf(b);
    if (!id || names.has(id)) continue;
    if (b.kind === "service") {
      const s = await ctx.db.get(id as Id<"services">);
      names.set(id, s ? { name_en: s.title_en, name_ar: s.title_ar } : null);
    } else {
      const l = await ctx.db.get(id as Id<"listings">);
      names.set(id, l ? { name_en: l.name_en, name_ar: l.name_ar } : null);
    }
  }

  return {
    guestId,
    name: fullName(guest),
    phone: guest.phone ?? null,
    phoneVerified: guest.phoneVerified ?? false,
    // A phone sign-up's synthesised address cannot receive mail.
    email: isPlaceholderEmail(guest.email) ? null : guest.email,
    note: note?.note ?? "",
    tags: note?.tags ?? [],
    noteUpdatedAt: note?.updatedAt ?? null,
    bookings: rows.map((b) => {
      const id = itemIdOf(b);
      const item = id ? names.get(id) : null;
      return {
        _id: b._id,
        confirmationCode: b.confirmationCode,
        kind: b.kind,
        status: b.status,
        itemName_en: item?.name_en ?? "",
        itemName_ar: item?.name_ar ?? "",
        checkIn: b.checkIn,
        checkOut: b.checkOut,
        date: b.date,
        time: b.time,
        nights: b.nights,
        quantity: b.quantity,
        guests: b.guests,
        totalAmount: b.totalAmount,
        createdAt: b.createdAt,
      };
    }),
  };
}

/** Trimmed, empties dropped, first spelling kept among case-insensitive duplicates. */
export function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out;
}

export async function saveGuestNoteFor(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { guestId: Id<"users">; note: string; tags: string[]; now?: number }
): Promise<{ ok: true }> {
  const kind = requirePartner(user);
  const guest = await ctx.db.get(args.guestId);
  if (!guest || (await bookingsWithPartner(ctx, user, kind, args.guestId)).length === 0) {
    throw new ConvexError(PARTNER_ERRORS.GUEST_NOT_FOUND);
  }

  const note = args.note.trim();
  if (note.length > MAX_NOTE) throw new ConvexError(PARTNER_ERRORS.NOTE_TOO_LONG);
  const tags = cleanTags(args.tags);
  if (tags.length > MAX_TAGS || tags.some((t) => t.length > MAX_TAG)) {
    throw new ConvexError(PARTNER_ERRORS.BAD_TAGS);
  }

  const existing = await noteRow(ctx, user._id, args.guestId);
  if (!note && tags.length === 0) {
    if (existing) await ctx.db.delete(existing._id);
    return { ok: true };
  }
  const fields = { note, tags, updatedAt: args.now ?? Date.now() };
  if (existing) await ctx.db.patch(existing._id, fields);
  else await ctx.db.insert("partnerGuestNotes", { ownerId: user._id, guestId: args.guestId, ...fields });
  return { ok: true };
}
