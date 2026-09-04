import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { addDays, todayRiyadhISO } from "../lib/dates";
import { notifyBookingEvent } from "../notifications/internal";

/**
 * The jobs that move bookings along when nobody taps anything.
 *
 * All three are driven by crons.ts. Each takes an optional clock argument so
 * the tests can decide what "now" means instead of waiting two days.
 *
 * A note on the index ranges below: `undefined` sorts before every value in a
 * Convex index, so a bare `lt("expiresAt", now)` would sweep in every legacy
 * booking whose expiresAt was never set. Each query pairs the upper bound with
 * a lower one to exclude them.
 */

// Bounded so one very busy hour cannot produce an unbounded transaction. The
// leftovers are picked up by the next run.
const BATCH = 100;

export const expirePendingRequests = internalMutation({
  args: { now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();

    const stale = await ctx.db
      .query("bookings")
      .withIndex("by_status_and_expiresAt", (q) =>
        q.eq("status", "pending").gt("expiresAt", 0).lt("expiresAt", now)
      )
      .take(BATCH);

    for (const booking of stale) {
      await ctx.db.patch(booking._id, { status: "expired", updatedAt: now });
      const updated = await ctx.db.get(booking._id);
      if (updated) await notifyBookingEvent(ctx, "booking.expired", updated, {}, now);
    }

    return { expired: stale.length };
  },
});

export const sendCheckInReminders = internalMutation({
  args: { today: v.optional(v.string()), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const tomorrow = addDays(args.today ?? todayRiyadhISO(now), 1);

    const arriving = await ctx.db
      .query("bookings")
      .withIndex("by_status_and_checkIn", (q) =>
        q.eq("status", "confirmed").eq("checkIn", tomorrow)
      )
      .take(BATCH * 2);

    let sent = 0;
    for (const booking of arriving) {
      // reminderSentAt makes this idempotent: a retry, or a second cron run in
      // the same day, must not text the same guest twice.
      if (booking.reminderSentAt) continue;

      await ctx.db.patch(booking._id, { reminderSentAt: now });
      await notifyBookingEvent(ctx, "booking.reminder", booking, {}, now);
      sent += 1;
    }

    return { sent };
  },
});

export const completeFinishedStays = internalMutation({
  args: { today: v.optional(v.string()), now: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const today = args.today ?? todayRiyadhISO(now);

    // checkOut is exclusive, so a stay ending today is finished once the date
    // has rolled over — hence `< today`, not `<= today`.
    const finished = await ctx.db
      .query("bookings")
      .withIndex("by_status_and_checkOut", (q) =>
        q.eq("status", "confirmed").gt("checkOut", "").lt("checkOut", today)
      )
      .take(BATCH * 2);

    for (const booking of finished) {
      await ctx.db.patch(booking._id, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
    }

    return { completed: finished.length };
  },
});

/**
 * One-off backfill for bookings made before ownerId was denormalised onto the
 * row. Without it, a host's inbox silently omits their older bookings.
 */
export const backfillOwnerIds = internalMutation({
  args: {},
  handler: async (ctx) => {
    const bookings = await ctx.db.query("bookings").take(500);

    let patched = 0;
    for (const booking of bookings) {
      if (booking.ownerId) continue;
      const listing = await ctx.db.get(booking.listingId);
      if (!listing?.ownerId) continue;

      await ctx.db.patch(booking._id, { ownerId: listing.ownerId });
      patched += 1;
    }

    return { patched, scanned: bookings.length };
  },
});
