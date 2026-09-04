import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { buildSearchTextFrom } from "../users/search";

/**
 * Promote an existing user to admin from the command line:
 *
 *   npx convex run admin/devTools:grantAdmin '{"email":"owner@example.com"}'
 *   npx convex run admin/devTools:grantAdmin '{"email":"owner@example.com"}' --prod
 *
 * This is an internalMutation, so it is not callable by any client — only by
 * someone who already holds deploy credentials for the project, who could edit
 * the row in the dashboard anyway. It exists because "open the Convex dashboard
 * and change a field by hand" is an awkward step to hand to the owner, and a
 * typo there silently produces an account that cannot reach /admin.
 *
 * The user must already exist in the `users` table (they sign up first).
 */
export const grantAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error(
        `No user with email ${args.email}. They must sign in once before being made an admin.`
      );
    }

    await ctx.db.patch(user._id, { role: "admin", updatedAt: Date.now() });
    return { userId: user._id, email: user.email, role: "admin" };
  },
});

/**
 * The reverse, for when an admin leaves. Demotes to tourist rather than
 * deleting: their bookings, trips and favourites stay attached to the account.
 */
export const revokeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) throw new Error(`No user with email ${args.email}.`);
    if (user.role !== "admin") throw new Error(`${args.email} is not an admin.`);

    await ctx.db.patch(user._id, { role: "tourist", updatedAt: Date.now() });
    return { userId: user._id, email: user.email, role: "tourist" };
  },
});

/** Who currently holds admin. Useful before revoking one. */
export const listAdmins = internalMutation({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(50);
    return admins.map((a) => ({ email: a.email, createdAt: a.createdAt }));
  },
});

/**
 * Demo and development helpers.
 *
 * All internalMutations, so no client can reach them — only someone who
 * already holds deploy credentials, who could edit the rows by hand anyway.
 * They exist so setting up a demo is one command instead of ten clicks in the
 * dashboard, where a typo silently produces data that looks right and is not.
 */

/** Nightly rates for the seeded Al-Ahsa hotels, so they become bookable. */
const DEMO_RATES: Record<string, { pricePerNight: number; maxGuests: number; unitCount: number }> = {
  "InterContinental Al Ahsa": { pricePerNight: 650, maxGuests: 4, unitCount: 10 },
  "Ramada by Wyndham Al Ahsa": { pricePerNight: 420, maxGuests: 3, unitCount: 8 },
  "Rose Garden Hotel Hofuf": { pricePerNight: 480, maxGuests: 2, unitCount: 4 },
  "Al Koot Heritage Hotel": { pricePerNight: 380, maxGuests: 2, unitCount: 5 },
  "Palm Resort Al Ahsa": { pricePerNight: 550, maxGuests: 4, unitCount: 6 },
};

/**
 * Price the seeded hotels.
 *
 * Deliberately a patch rather than a re-seed: seedListings wipes the listings
 * table, which would take every booking's target with it.
 */
export const seedDemoStays = internalMutation({
  args: {},
  handler: async (ctx) => {
    const hotels = await ctx.db
      .query("listings")
      .withIndex("by_type", (q) => q.eq("type", "hotel"))
      .take(200);

    const patched: string[] = [];
    const now = Date.now();

    for (const hotel of hotels) {
      const rate = DEMO_RATES[hotel.name_en];
      if (!rate) continue;

      await ctx.db.patch(hotel._id, {
        ...rate,
        currency: "SAR",
        checkInTime: "15:00",
        checkOutTime: "12:00",
        updatedAt: now,
      });
      patched.push(hotel.name_en);
    }

    return { patched, unmatched: Object.keys(DEMO_RATES).filter((n) => !patched.includes(n)) };
  },
});

/**
 * Hand a seeded listing to a real account, so there is a host who can confirm
 * bookings. The seeded Al-Ahsa data has no owner, so nothing in it can be
 * managed from the app until this runs.
 */
export const assignListingOwner = internalMutation({
  args: { email: v.string(), listingName_en: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) throw new Error(`No user with email ${args.email}`);

    const listing = await ctx.db
      .query("listings")
      .withSearchIndex("search_listings", (q) => q.search("name_en", args.listingName_en))
      .first();
    if (!listing) throw new Error(`No listing matching ${args.listingName_en}`);

    await ctx.db.patch(listing._id, {
      ownerId: user._id,
      status: "approved",
      isActive: true,
      updatedAt: Date.now(),
    });

    // A host who is not an approved business owner cannot see their own
    // dashboard, which makes the assignment useless.
    await ctx.db.patch(user._id, {
      role: user.role === "admin" ? "admin" : "business_owner",
      isApproved: true,
      updatedAt: Date.now(),
    });

    return { listingId: listing._id, listingName: listing.name_en, ownerId: user._id };
  },
});

/**
 * Mark a phone verified without sending an SMS.
 *
 * Development only. The real path is OTP — this exists so a demo rehearsal
 * does not need working SMS, and so tests of the booking flow do not burn
 * Twilio credit.
 */
export const grantVerifiedPhone = internalMutation({
  args: { email: v.string(), phone: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    if (!user) throw new Error(`No user with email ${args.email}`);

    await ctx.db.patch(user._id, {
      phone: args.phone,
      phoneVerified: true,
      updatedAt: Date.now(),
    });

    return { userId: user._id, phone: args.phone };
  },
});

/** Fill in searchText for accounts created before admin user search existed. */
export const backfillUserSearchText = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(1000);

    let patched = 0;
    for (const user of users) {
      if (user.searchText) continue;
      await ctx.db.patch(user._id, {
        searchText: buildSearchTextFrom(user),
      });
      patched += 1;
    }

    return { patched, scanned: users.length };
  },
});

/**
 * Clear ratings that no review ever produced.
 *
 * The seeded Al-Ahsa catalogue shipped with an invented score on almost every
 * listing (3.7 to 4.9) and `reviewCount` unset — decoration, not data. Left in
 * place, the first genuine review would turn a fabricated 4.8 into a real 3.0
 * and look like a bug rather than the truth arriving.
 *
 * Safe to run repeatedly: it recomputes from the reviews that exist, so a
 * listing with real reviews keeps its real average.
 */
export const clearSeededRatings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    let cleared = 0;

    for (const listing of listings) {
      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
        .take(1);

      if (reviews.length === 0 && listing.rating !== undefined) {
        await ctx.db.patch(listing._id, {
          rating: undefined,
          reviewCount: undefined,
          updatedAt: Date.now(),
        });
        cleared += 1;
      }
    }

    return { scanned: listings.length, cleared };
  },
});
