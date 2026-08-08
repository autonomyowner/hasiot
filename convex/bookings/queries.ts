import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

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

    if (!booking || booking.userId !== user._id) {
      return null;
    }

    const listing = await ctx.db.get(booking.listingId);

    return {
      ...booking,
      listing,
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

    const today = new Date().toISOString().split("T")[0];

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "confirmed")
      )
      .take(MAX_LIST);

    return bookings.filter((b) => b.date >= today).length;
  },
});

// Get business's bookings (for business dashboard)
export const getBusinessBookings = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || (user.role !== "business_owner" && user.role !== "service_provider")) {
      return [];
    }

    // Resolve owned listings via the ownerId index. This previously scanned the
    // whole listings table in JS and matched on email, which both scaled badly
    // and only ever returned bookings for a single listing.
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .take(MAX_OWNED_LISTINGS);

    if (listings.length === 0) {
      return [];
    }

    const perListing = await Promise.all(
      listings.map((listing) =>
        ctx.db
          .query("bookings")
          .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
          .order("desc")
          .take(MAX_LIST)
      )
    );

    let bookings = perListing
      .flat()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_LIST);

    if (args.status) {
      bookings = bookings.filter((b) => b.status === args.status);
    }

    // Bookings can now span several owned listings, so name the listing on each
    // row rather than leaving the dashboard to guess.
    const listingsById = new Map(listings.map((l) => [l._id as string, l]));

    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        const tourist = await ctx.db.get(booking.userId);
        const listing = listingsById.get(booking.listingId as string);
        return {
          ...booking,
          listing: listing
            ? { _id: listing._id, name_en: listing.name_en, name_ar: listing.name_ar }
            : null,
          tourist: tourist
            ? {
                _id: tourist._id,
                firstName: tourist.firstName,
                lastName: tourist.lastName,
                email: tourist.email,
                phone: tourist.phone,
              }
            : null,
        };
      })
    );

    return enriched;
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
