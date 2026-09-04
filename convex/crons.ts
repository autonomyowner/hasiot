import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled jobs.
 *
 * Convex crons are specified in UTC and Saudi Arabia is UTC+3 year-round, so
 * the local hour each job runs at is the UTC hour plus three. The names carry
 * the Riyadh time because that is the one that matters when someone asks why
 * a guest got a text at a strange hour.
 */
const crons = cronJobs();

// Hourly rather than daily: a request that dies at 03:00 should not sit
// looking alive until the next morning, because it is holding a unit the
// guest could otherwise book elsewhere.
crons.interval(
  "expire pending stay requests",
  { hours: 1 },
  internal.bookings.lifecycle.expirePendingRequests,
  {}
);

// 09:00 Riyadh. Early enough to still change plans, late enough not to wake
// anyone.
crons.daily(
  "check-in reminders (09:00 Riyadh)",
  { hourUTC: 6, minuteUTC: 0 },
  internal.bookings.lifecycle.sendCheckInReminders,
  {}
);

// 04:00 Riyadh, after the date has rolled over and before anyone is looking
// at their dashboard.
crons.daily(
  "complete finished stays (04:00 Riyadh)",
  { hourUTC: 1, minuteUTC: 0 },
  internal.bookings.lifecycle.completeFinishedStays,
  {}
);

export default crons;
