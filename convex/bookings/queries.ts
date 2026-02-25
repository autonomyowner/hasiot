import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

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

    let bookings;
    if (args.status) {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_userId_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else {
      bookings = await ctx.db
        .query("bookings")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
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

    if (args.limit) {
      return enrichedBookings.slice(0, args.limit);
    }

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
      .collect();

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

    const listings = await ctx.db.query("listings").collect();
    const listing = listings.find(
      (l) => l.email === user.email
    );

    if (!listing) {
      return [];
    }

    let bookings = await ctx.db
      .query("bookings")
      .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
      .order("desc")
      .collect();

    if (args.status) {
      bookings = bookings.filter((b) => b.status === args.status);
    }

    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        const tourist = await ctx.db.get(booking.userId);
        return {
          ...booking,
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
