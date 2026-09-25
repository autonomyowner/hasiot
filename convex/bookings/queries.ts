import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { isPlaceholderEmail } from "../lib/contact";
import { riyadhMonthKey, todayRiyadhISO } from "../lib/dates";
import { isBookableStay } from "../listings/pricing";
import { withoutSuspendedOwners } from "../listings/queries";
import {
  computeServiceQuote,
  isBookableService,
  isPublicService,
  SERVICE_ERRORS,
  type ServiceQuoteResult,
} from "../services/logic";
import {
  ACTIVE_STAY_STATUSES,
  BOOKING_ERRORS,
  computeStayQuote,
  overlaps,
  type BookingStatus,
} from "./logic";

// Hard ceilings so no query can scan an unbounded number of documents.
const MAX_LIST = 200;
const MAX_OWNED_LISTINGS = 50;
const MAX_OWNED_SERVICES = 200;

/**
 * The rows a client that predates service bookings may see.
 *
 * The iOS 1.0.2 and Android 1.0.0 apps call these queries and cannot be
 * updated. They render `booking.listing.name_en` without a null check, so a
 * service booking — which has no listing — would crash them. They never ask
 * for services, so they never get one; 1.1.0 passes `includeServices: true`.
 */
export function visibleToLegacyClients<T extends Pick<Doc<"bookings">, "kind">>(rows: T[]): T[] {
  return rows.filter((row) => row.kind !== "service");
}

/**
 * The service a booking row carries: what a card shows, and one image.
 *
 * Null for a listing booking — and for a service booking whose service was
 * deleted since, so a reader must never assume `kind === "service"` means
 * there is a service to show.
 */
export function serviceSummary(service: Doc<"services"> | null) {
  if (!service) return null;
  return {
    _id: service._id,
    title_en: service.title_en,
    title_ar: service.title_ar,
    serviceType: service.serviceType,
    city: service.city,
    // One image is all a list row needs.
    images: service.images?.slice(0, 1) ?? [],
    priceUnit: service.priceUnit,
    contactPhone: service.contactPhone,
  };
}

export type ServiceSummary = NonNullable<ReturnType<typeof serviceSummary>>;

/** The place a guest's booking row carries, as the 1.0.2 app renders it. */
function guestListingSummary(listing: Doc<"listings"> | null) {
  if (!listing) return null;
  return {
    _id: listing._id,
    name_en: listing.name_en,
    name_ar: listing.name_ar,
    category: listing.category,
    category_ar: listing.category_ar,
    address: listing.address,
    phone: listing.phone,
    city: listing.city,
    // One image is all a list row needs; sending the whole array would put
    // every photo of every booked place on the wire.
    images: listing.images?.slice(0, 1) ?? [],
    coordinates: listing.coordinates,
    checkInTime: listing.checkInTime,
    checkOutTime: listing.checkOutTime,
  };
}

/**
 * The traveller as a host or provider sees them in an inbox: someone to call.
 * One shape for both inboxes.
 */
export function touristSummary(tourist: Doc<"users"> | null) {
  if (!tourist) return null;
  return {
    _id: tourist._id,
    firstName: tourist.firstName,
    lastName: tourist.lastName,
    // A phone sign-up's address is synthesised and undeliverable — showing
    // it would invite the owner to email a black hole.
    email: isPlaceholderEmail(tourist.email) ? null : tourist.email,
    phone: tourist.phone,
    phoneVerified: tourist.phoneVerified ?? false,
  };
}

/**
 * The provider as a traveller sees them on a service booking.
 *
 * The service's own contact number is public — it is on the service sheet
 * already. The provider's personal number is theirs, and a traveller gets it
 * only once the provider has said yes: confirmed, or completed afterwards.
 */
export function providerContact(
  service: Pick<Doc<"services">, "contactPhone"> | null,
  owner: Pick<Doc<"users">, "firstName" | "lastName" | "phone"> | null,
  status: string
): { firstName?: string; lastName?: string; phone?: string } | null {
  if (!owner) return null;
  const listed = service?.contactPhone?.trim();
  const personal = status === "confirmed" || status === "completed" ? owner.phone : undefined;
  return { firstName: owner.firstName, lastName: owner.lastName, phone: listed || personal };
}

type UserBookingRow = Doc<"bookings"> & {
  listing: ReturnType<typeof guestListingSummary>;
  /** Only with `includeServices`: absent for the apps that predate services. */
  service?: ServiceSummary | null;
};

/**
 * A traveller's bookings, newest first.
 *
 * Without `includeServices` this is exactly what the 1.0.2 and 1.0.0 apps
 * have always received: no service bookings, and no `service` key.
 */
export async function userBookingsForUser(
  ctx: QueryCtx,
  user: Doc<"users">,
  args: { status?: string; limit?: number; includeServices?: boolean }
): Promise<UserBookingRow[]> {
  const take = Math.min(args.limit ?? MAX_LIST, MAX_LIST);
  const status = args.status;

  let bookings = status
    ? await ctx.db
        .query("bookings")
        .withIndex("by_userId_and_status", (q) => q.eq("userId", user._id).eq("status", status))
        .order("desc")
        .take(take)
    : await ctx.db
        .query("bookings")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(take);

  if (!args.includeServices) {
    bookings = visibleToLegacyClients(bookings);
  }

  return await Promise.all(
    bookings.map(async (booking): Promise<UserBookingRow> => {
      const listing = booking.listingId ? await ctx.db.get(booking.listingId) : null;
      const row = { ...booking, listing: guestListingSummary(listing) };
      if (!args.includeServices) return row;

      const service = booking.serviceId ? await ctx.db.get(booking.serviceId) : null;
      return { ...row, service: serviceSummary(service) };
    })
  );
}

// Get current user's bookings
export const getUserBookings = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
    includeServices: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return [];
    }
    return await userBookingsForUser(ctx, user, args);
  },
});

type ViewerRole = "guest" | "host" | "provider" | "admin";

type BookingDetail = Doc<"bookings"> & {
  listing: Doc<"listings"> | null;
  viewerRole: ViewerRole;
  guest: { firstName?: string; lastName?: string; phone?: string; email: string | null } | null;
  /** Only with `includeServices`; null on listing bookings and deleted services. */
  service?: Doc<"services"> | null;
  /** Only with `includeServices`; null on listing bookings. */
  provider?: ReturnType<typeof providerContact>;
};

/**
 * One booking, for the people allowed to see it: the traveller who made it,
 * the host of its place or the provider of its service, and support.
 *
 * Without `includeServices` a service booking is not found — an old app
 * tapping a service notification lands here, and "not found" is what it can
 * render, a listing-less booking is not (visibleToLegacyClients) — and a
 * listing booking has exactly the keys it always had.
 */
export async function bookingForViewer(
  ctx: QueryCtx,
  user: Doc<"users">,
  args: { bookingId: Id<"bookings">; includeServices?: boolean }
): Promise<BookingDetail | null> {
  const booking = await ctx.db.get(args.bookingId);
  if (!booking) return null;

  if (booking.kind === "service" && !args.includeServices) return null;

  const listing = booking.listingId ? await ctx.db.get(booking.listingId) : null;
  const service = booking.serviceId ? await ctx.db.get(booking.serviceId) : null;
  const isService = booking.kind === "service";

  const isGuest = booking.userId === user._id;
  const isHost = listing?.ownerId === user._id;
  // The service's current owner, as for acting on the booking
  // (requireBookingManager). Once the service is deleted, the booking's own
  // record of who provided it is all there is.
  const isProvider = isService && (service ? service.ownerId : booking.ownerId) === user._id;
  if (!isGuest && !isHost && !isProvider && user.role !== "admin") {
    return null;
  }

  const other = isGuest ? null : await ctx.db.get(booking.userId);
  const viewerRole: ViewerRole = isGuest ? "guest" : isHost ? "host" : isProvider ? "provider" : "admin";

  const detail: BookingDetail = {
    ...booking,
    listing,
    viewerRole,
    // A host or provider opening a booking needs to be able to reach the guest.
    guest: other
      ? {
          firstName: other.firstName,
          lastName: other.lastName,
          phone: other.phone,
          email: isPlaceholderEmail(other.email) ? null : other.email,
        }
      : null,
  };
  if (!args.includeServices) return detail;

  const providerId = isService ? (service?.ownerId ?? booking.ownerId) : undefined;
  const owner = providerId ? await ctx.db.get(providerId) : null;
  return {
    ...detail,
    service,
    provider: isService ? providerContact(service, owner, booking.status) : null,
  };
}

// Get a single booking
export const getBooking = query({
  args: {
    bookingId: v.id("bookings"),
    includeServices: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return null;
    }
    return await bookingForViewer(ctx, user, args);
  },
});

// Get available slots for a listing on a specific date
export const getAvailableSlots = query({
  args: {
    listingId: v.id("listings"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      return { slots: [], workingHours: null };
    }

    const schedule = await ctx.db
      .query("availabilitySchedules")
      .withIndex("by_listingId_and_date", (q) =>
        q.eq("listingId", args.listingId).eq("date", args.date)
      )
      .unique();

    if (schedule) {
      return {
        slots: schedule.slots.filter((s) => s.isAvailable),
        workingHours: listing.workingHours,
      };
    }

    const dayOfWeek = getDayOfWeek(args.date);
    const daySchedule = listing.workingHours?.find(
      (wh) => wh.day.toLowerCase() === dayOfWeek.toLowerCase()
    );

    if (!daySchedule || daySchedule.isClosed) {
      return { slots: [], workingHours: listing.workingHours };
    }

    const slots = generateTimeSlots(daySchedule.open, daySchedule.close, 30);

    const existingBookings = await ctx.db
      .query("bookings")
      .withIndex("by_listingId_and_date", (q) =>
        q.eq("listingId", args.listingId).eq("date", args.date)
      )
      .collect();

    const bookedTimes = new Set(
      existingBookings
        .filter((b) => b.status !== "cancelled")
        .map((b) => b.time)
    );

    return {
      slots: slots.map((time) => ({
        time,
        isAvailable: !bookedTimes.has(time),
      })),
      workingHours: listing.workingHours,
    };
  },
});

// Get upcoming bookings count for dashboard
export const getUpcomingCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return 0;
    }

    // Riyadh, not UTC — otherwise a booking for today drops off the count
    // three hours before midnight local time.
    const today = todayRiyadhISO();

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "confirmed")
      )
      .take(MAX_LIST);

    // A stay counts as upcoming until the guest checks out, not until they
    // check in.
    return bookings.filter((b) => (b.checkOut ?? b.date) >= today).length;
  },
});

// Get business's bookings (for business dashboard)
/**
 * A host's booking inbox.
 *
 * Reads straight off `by_ownerId_and_status` rather than fanning out over the
 * host's listings: the fan-out took one query per listing and then filtered by
 * status *after* slicing to 200, so a busy host filtering for pending requests
 * could be shown fewer than they actually had. `ownerId` is denormalised onto
 * the booking for exactly this reason.
 */
export const getBusinessBookings = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || (user.role !== "business_owner" && user.role !== "service_provider")) {
      return [];
    }

    const status = args.status;
    const rows = status
      ? await ctx.db
          .query("bookings")
          .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", user._id).eq("status", status))
          .order("desc")
          .take(MAX_LIST)
      : await ctx.db
          .query("bookings")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
          .order("desc")
          .take(MAX_LIST);

    // The host inbox is for places. A provider's service bookings have their
    // own inbox (getProviderBookings), and the 1.0.2 app renders this one.
    const bookings = visibleToLegacyClients(rows);

    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        const [tourist, listing] = await Promise.all([
          ctx.db.get(booking.userId),
          booking.listingId ? ctx.db.get(booking.listingId) : null,
        ]);
        return {
          ...booking,
          listing: listing
            ? {
                _id: listing._id,
                name_en: listing.name_en,
                name_ar: listing.name_ar,
                city: listing.city,
                images: listing.images?.slice(0, 1) ?? [],
              }
            : null,
          tourist: touristSummary(tourist),
        };
      })
    );

    return enriched;
  },
});

/**
 * A provider's booking inbox: their service bookings, newest first, each with
 * the service and the traveller to call.
 *
 * Read off `by_ownerId`, like the host inbox, with the kind filtered inside
 * the query so that a provider who also hosts a place still gets a full page
 * of service bookings.
 */
export async function providerBookingsForUser(
  ctx: QueryCtx,
  user: Doc<"users">,
  args: { status?: string }
) {
  if (user.role !== "service_provider") return [];

  const status = args.status;
  const rows = status
    ? await ctx.db
        .query("bookings")
        .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", user._id).eq("status", status))
        .order("desc")
        .filter((q) => q.eq(q.field("kind"), "service"))
        .take(MAX_LIST)
    : await ctx.db
        .query("bookings")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .order("desc")
        .filter((q) => q.eq(q.field("kind"), "service"))
        .take(MAX_LIST);

  return await Promise.all(
    rows.map(async (booking) => {
      const [tourist, service] = await Promise.all([
        ctx.db.get(booking.userId),
        booking.serviceId ? ctx.db.get(booking.serviceId) : null,
      ]);
      return { ...booking, service: serviceSummary(service), tourist: touristSummary(tourist) };
    })
  );
}

export const getProviderBookings = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];
    return await providerBookingsForUser(ctx, user, args);
  },
});

/** "Today" and "this month" for the provider dashboard, on the Riyadh clock. */
export function providerStatsWindow(now: number): { today: string; month: string } {
  return { today: todayRiyadhISO(now), month: riyadhMonthKey(now) };
}

type StatsRow = Pick<Doc<"bookings">, "date" | "checkIn" | "checkOut" | "totalAmount">;

/**
 * The provider dashboard's numbers, from their service bookings by status.
 *
 * Upcoming is confirmed work that has not ended (checkOut is exclusive, and
 * the morning job completes it). A month is the month the service took place
 * in, on the Riyadh calendar. Revenue counts confirmed and completed alike, as
 * for hosts: the money is owed either way, and leaving completed out would
 * make the figure fall as the month's work gets done.
 */
export function computeProviderStats(
  rows: { pending: StatsRow[]; confirmed: StatsRow[]; completed: StatsRow[] },
  services: number,
  today: string,
  month: string
) {
  const inMonth = (b: StatsRow) => (b.checkIn ?? b.date).startsWith(month);
  return {
    pending: rows.pending.length,
    upcoming: rows.confirmed.filter((b) => (b.checkOut ?? b.date) >= today).length,
    completedMonth: rows.completed.filter(inMonth).length,
    revenueMonth: [...rows.confirmed, ...rows.completed]
      .filter(inMonth)
      .reduce((sum, b) => sum + (b.totalAmount ?? 0), 0),
    services,
    currency: "SAR" as const,
  };
}

export async function providerStatsForUser(ctx: QueryCtx, user: Doc<"users">, now: number) {
  if (user.role !== "service_provider") return null;

  const byStatus = (status: BookingStatus) =>
    ctx.db
      .query("bookings")
      .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", user._id).eq("status", status))
      .filter((q) => q.eq(q.field("kind"), "service"))
      .take(MAX_LIST);

  const [pending, confirmed, completed, services] = await Promise.all([
    byStatus("pending"),
    byStatus("confirmed"),
    byStatus("completed"),
    ctx.db
      .query("services")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(MAX_OWNED_SERVICES),
  ]);

  const { today, month } = providerStatsWindow(now);
  return computeProviderStats({ pending, confirmed, completed }, services.length, today, month);
}

export const getProviderStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return null;
    return await providerStatsForUser(ctx, user, Date.now());
  },
});

/**
 * Headline numbers for the host dashboard, which until now showed hardcoded
 * zeros.
 */
export const getOwnerStats = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || (user.role !== "business_owner" && user.role !== "service_provider")) {
      return null;
    }

    const today = todayRiyadhISO();
    const month = riyadhMonthKey(Date.now());

    const [pendingAll, confirmedAll, completedAll, listings] = await Promise.all([
      ctx.db
        .query("bookings")
        .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", user._id).eq("status", "pending"))
        .take(MAX_LIST),
      ctx.db
        .query("bookings")
        .withIndex("by_ownerId_and_status", (q) =>
          q.eq("ownerId", user._id).eq("status", "confirmed")
        )
        .take(MAX_LIST),
      ctx.db
        .query("bookings")
        .withIndex("by_ownerId_and_status", (q) =>
          q.eq("ownerId", user._id).eq("status", "completed")
        )
        .take(MAX_LIST),
      ctx.db
        .query("listings")
        .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
        .take(MAX_OWNED_LISTINGS),
    ]);

    // Place numbers only: a provider's services have getProviderStats.
    const pendingRows = visibleToLegacyClients(pendingAll);
    const confirmedRows = visibleToLegacyClients(confirmedAll);
    const completedRows = visibleToLegacyClients(completedAll);

    const upcoming = confirmedRows.filter((b) => (b.checkOut ?? b.date) >= today).length;

    // Confirmed and completed both count: the host has the money either way,
    // and excluding completed would make revenue fall as stays finish.
    const revenueMonth = [...confirmedRows, ...completedRows]
      .filter((b) => (b.checkIn ?? b.date).startsWith(month))
      .reduce((sum, b) => sum + (b.totalAmount ?? 0), 0);

    return {
      pending: pendingRows.length,
      upcoming,
      revenueMonth,
      listings: listings.length,
      currency: "SAR",
    };
  },
});

/**
 * Price a stay without committing to it.
 *
 * Public and never throws, because the app calls this live as the guest drags
 * across a calendar — a half-selected range is a normal intermediate state,
 * not an error. It runs the same computeStayQuote the booking mutation does,
 * so the number shown is the number charged.
 */
export const quoteStay = query({
  args: {
    listingId: v.id("listings"),
    checkIn: v.string(),
    checkOut: v.string(),
    guests: v.number(),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    // A suspended host's place is not quoted, as it cannot be booked.
    if (
      !listing ||
      !isBookableStay(listing) ||
      (await withoutSuspendedOwners(ctx, [listing])).length === 0
    ) {
      return { ok: false as const, error: BOOKING_ERRORS.NOT_BOOKABLE };
    }

    const quoted = computeStayQuote(listing, args, todayRiyadhISO());
    if (!quoted.ok) {
      return { ok: false as const, error: quoted.error };
    }

    // Same overlap rule as createStayBooking, so the sheet can grey out dates
    // rather than letting the guest fill in a form that is going to be refused.
    const existing = await ctx.db
      .query("bookings")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(MAX_LIST);

    const occupied = existing.filter(
      (b) =>
        b.kind === "stay" &&
        ACTIVE_STAY_STATUSES.includes(b.status as BookingStatus) &&
        b.checkIn &&
        b.checkOut &&
        overlaps({ checkIn: b.checkIn, checkOut: b.checkOut }, quoted.quote)
    ).length;

    return {
      ok: true as const,
      quote: quoted.quote,
      available: listing.unitCount === undefined || occupied < listing.unitCount,
      checkInTime: listing.checkInTime,
      checkOutTime: listing.checkOutTime,
    };
  },
});

/**
 * The quote a service booking would get, or why there is none. Never throws.
 */
export function quoteServiceFor(
  service: Doc<"services"> | null,
  owner: Pick<Doc<"users">, "role" | "isApproved" | "isSuspended"> | null,
  args: { date: string; time: string; quantity?: number; partySize?: number },
  today: string,
  now: number
): ServiceQuoteResult {
  if (!service || !isPublicService(service, owner)) {
    return { ok: false, error: SERVICE_ERRORS.SERVICE_UNAVAILABLE };
  }
  if (!isBookableService(service, owner)) {
    return { ok: false, error: SERVICE_ERRORS.NOT_BOOKABLE };
  }
  return computeServiceQuote(service, args, today, now);
}

/**
 * Price a service booking without committing to it.
 *
 * Public and never throws, like quoteStay: the sheet calls it live while the
 * traveller is still choosing a day and a start time. It runs the same
 * computeServiceQuote as createServiceBooking, so the number shown is the
 * number charged.
 */
export const quoteService = query({
  args: {
    serviceId: v.id("services"),
    date: v.string(),
    time: v.string(),
    quantity: v.optional(v.number()),
    partySize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    const owner = service ? await ctx.db.get(service.ownerId) : null;
    const now = Date.now();
    return quoteServiceFor(service, owner, args, todayRiyadhISO(now), now);
  },
});

// Get listing's schedule
export const getListingSchedule = query({
  args: {
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      return null;
    }
    return {
      workingHours: listing.workingHours || [],
    };
  },
});

function getDayOfWeek(dateStr: string): string {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

function generateTimeSlots(
  openTime: string,
  closeTime: string,
  intervalMinutes: number
): string[] {
  const slots: string[] = [];

  const [openHour, openMin] = openTime.split(":").map(Number);
  const [closeHour, closeMin] = closeTime.split(":").map(Number);

  let currentMinutes = openHour * 60 + openMin;
  const endMinutes = closeHour * 60 + closeMin;

  while (currentMinutes < endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(
      `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
    );
    currentMinutes += intervalMinutes;
  }

  return slots;
}
