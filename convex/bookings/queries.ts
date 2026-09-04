import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { isPlaceholderEmail } from "../lib/contact";
import { riyadhMonthKey, todayRiyadhISO } from "../lib/dates";
import { isBookableStay } from "../listings/pricing";
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

// Get current user's bookings
export const getUserBookings = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return [];
    }

    const take = Math.min(args.limit ?? MAX_LIST, MAX_LIST);

    let bookings;
    if (args.status) {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_userId_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .take(take);
    } else {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .order("desc")
        .take(take);
    }

    // Enrich with listing info
    const enrichedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const listing = await ctx.db.get(booking.listingId);
        return {
          ...booking,
          listing: listing
            ? {
                _id: listing._id,
                name_en: listing.name_en,
                name_ar: listing.name_ar,
                category: listing.category,
                category_ar: listing.category_ar,
                address: listing.address,
                phone: listing.phone,
                city: listing.city,
                // One image is all a list row needs; sending the whole array
                // would put every photo of every booked place on the wire.
                images: listing.images?.slice(0, 1) ?? [],
                coordinates: listing.coordinates,
                checkInTime: listing.checkInTime,
                checkOutTime: listing.checkOutTime,
              }
            : null,
        };
      })
    );

    return enrichedBookings;
  },
});

// Get a single booking
export const getBooking = query({
  args: { bookingId: v.id("bookings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return null;
    }

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    const listing = await ctx.db.get(booking.listingId);

    // The guest who booked, the host who has to honour it, and support.
    const isGuest = booking.userId === user._id;
    const isHost = listing?.ownerId === user._id;
    if (!isGuest && !isHost && user.role !== "admin") {
      return null;
    }

    const other = isGuest ? null : await ctx.db.get(booking.userId);

    return {
      ...booking,
      listing,
      viewerRole: isGuest ? ("guest" as const) : isHost ? ("host" as const) : ("admin" as const),
      // A host opening a booking needs to be able to reach the guest.
      guest: other
        ? {
            firstName: other.firstName,
            lastName: other.lastName,
            phone: other.phone,
            email: isPlaceholderEmail(other.email) ? null : other.email,
          }
        : null,
    };
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
    const bookings = status
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

    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        const [tourist, listing] = await Promise.all([
          ctx.db.get(booking.userId),
          ctx.db.get(booking.listingId),
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
          tourist: tourist
            ? {
                _id: tourist._id,
                firstName: tourist.firstName,
                lastName: tourist.lastName,
                // A phone sign-up's address is synthesised and undeliverable —
                // showing it to a host would invite them to email a black hole.
                email: isPlaceholderEmail(tourist.email) ? null : tourist.email,
                phone: tourist.phone,
                phoneVerified: tourist.phoneVerified ?? false,
              }
            : null,
        };
      })
    );

    return enriched;
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

    const [pendingRows, confirmedRows, completedRows, listings] = await Promise.all([
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
    if (!listing || !isBookableStay(listing)) {
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
