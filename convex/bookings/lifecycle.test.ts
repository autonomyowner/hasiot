import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import {
  makeT,
  NOW,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedSlot,
  seedStay,
  seedUser,
  TODAY,
} from "../test.utils";
import type { TestT } from "../test.utils";
import { riyadhDateTimeToTimestamp } from "../lib/dates";
import { PENDING_TTL_MS } from "./logic";

const LATER = NOW + PENDING_TTL_MS + 1000;

/** A provider's "Oasis day tour" and a traveller, for the service cases. */
async function tour(t: TestT) {
  const ownerId = await seedUser(t, { role: "service_provider", isApproved: true, email: "p@example.com" });
  const userId = await seedUser(t, { phoneVerified: true, email: "t@example.com" });
  const serviceId = await seedService(t, { ownerId, title_en: "Oasis day tour", title_ar: "جولة الواحة" });
  return { ownerId, userId, serviceId };
}

describe("expirePendingRequests", () => {
  it("expires a request the host never answered, and tells the guest", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const ownerId = await seedUser(t, { role: "business_owner", email: "owner@example.com" });
    const listingId = await seedHotel(t, { ownerId });
    const bookingId = await seedStay(t, {
      userId,
      listingId,
      ownerId,
      checkIn: "2026-09-20",
      checkOut: "2026-09-22",
      expiresAt: NOW + PENDING_TTL_MS,
    });

    const result = await t.mutation(internal.bookings.lifecycle.expirePendingRequests, { now: LATER });

    expect(result).toEqual({ expired: 1 });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ status: "expired" });

    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ userId, type: "booking.expired" });
  });

  it("leaves a request that still has time on it", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-09-20",
      checkOut: "2026-09-22",
      expiresAt: NOW + PENDING_TTL_MS,
    });

    expect(
      await t.mutation(internal.bookings.lifecycle.expirePendingRequests, { now: NOW + 1000 })
    ).toEqual({ expired: 0 });
  });

  it("never touches a booking that predates expiresAt", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    // undefined sorts before every value in a Convex index, so a bare
    // lt("expiresAt", now) would sweep this one up and expire a live booking.
    const legacyId = await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-09-20",
      checkOut: "2026-09-22",
    });
    const slotId = await seedSlot(t, { userId, listingId, date: "2026-09-20" });

    expect(
      await t.mutation(internal.bookings.lifecycle.expirePendingRequests, { now: LATER })
    ).toEqual({ expired: 0 });
    expect(await t.run((ctx) => ctx.db.get(legacyId))).toMatchObject({ status: "pending" });
    expect(await t.run((ctx) => ctx.db.get(slotId))).toMatchObject({ status: "pending" });
  });

  it("ignores requests the host already answered", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    for (const status of ["confirmed", "declined", "cancelled"]) {
      await seedStay(t, {
        userId,
        listingId,
        checkIn: "2026-09-20",
        checkOut: "2026-09-22",
        status,
        expiresAt: NOW + PENDING_TTL_MS,
      });
    }

    expect(
      await t.mutation(internal.bookings.lifecycle.expirePendingRequests, { now: LATER })
    ).toEqual({ expired: 0 });
  });
});

describe("sendCheckInReminders", () => {
  it("reminds a guest the day before they arrive", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    const bookingId = await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-09-04", // tomorrow, given TODAY
      checkOut: "2026-09-06",
      status: "confirmed",
    });

    const result = await t.mutation(internal.bookings.lifecycle.sendCheckInReminders, {
      today: TODAY,
      now: NOW,
    });

    expect(result).toEqual({ sent: 1 });
    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox[0]).toMatchObject({ userId, type: "booking.reminder" });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ reminderSentAt: NOW });
  });

  it("does not remind the same guest twice", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-09-04",
      checkOut: "2026-09-06",
      status: "confirmed",
    });

    await t.mutation(internal.bookings.lifecycle.sendCheckInReminders, { today: TODAY, now: NOW });
    // A retry, or a second run in the same day, must be silent.
    const second = await t.mutation(internal.bookings.lifecycle.sendCheckInReminders, {
      today: TODAY,
      now: NOW,
    });

    expect(second).toEqual({ sent: 0 });
    expect(await t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(1);
  });

  it("ignores arrivals that are not tomorrow, and stays not yet confirmed", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    await seedStay(t, { userId, listingId, checkIn: "2026-09-10", checkOut: "2026-09-12", status: "confirmed" });
    await seedStay(t, { userId, listingId, checkIn: TODAY, checkOut: "2026-09-05", status: "confirmed" });
    await seedStay(t, { userId, listingId, checkIn: "2026-09-04", checkOut: "2026-09-06", status: "pending" });

    expect(
      await t.mutation(internal.bookings.lifecycle.sendCheckInReminders, { today: TODAY, now: NOW })
    ).toEqual({ sent: 0 });
  });
});

describe("completeFinishedStays", () => {
  it("completes a stay once its check-out date has passed", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    const bookingId = await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-08-28",
      checkOut: "2026-09-02",
      status: "confirmed",
    });

    expect(
      await t.mutation(internal.bookings.lifecycle.completeFinishedStays, { today: TODAY, now: NOW })
    ).toEqual({ completed: 1 });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({
      status: "completed",
      completedAt: NOW,
    });
  });

  it("leaves a guest who is still checked in", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    // Check-out is exclusive, so a stay ending today is not finished yet.
    await seedStay(t, { userId, listingId, checkIn: "2026-09-01", checkOut: TODAY, status: "confirmed" });
    await seedStay(t, { userId, listingId, checkIn: "2026-09-10", checkOut: "2026-09-12", status: "confirmed" });

    expect(
      await t.mutation(internal.bookings.lifecycle.completeFinishedStays, { today: TODAY, now: NOW })
    ).toEqual({ completed: 0 });
  });

  it("ignores slot bookings, which have no check-out", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    await seedSlot(t, { userId, listingId, date: "2026-08-20", status: "confirmed" });

    expect(
      await t.mutation(internal.bookings.lifecycle.completeFinishedStays, { today: TODAY, now: NOW })
    ).toEqual({ completed: 0 });
  });
});

describe("service bookings through the same jobs", () => {
  it("expires a request the provider never answered, and tells the traveller in service words", async () => {
    const t = makeT();
    const { ownerId, userId, serviceId } = await tour(t);
    const bookingId = await seedServiceBooking(t, {
      userId,
      serviceId,
      ownerId,
      date: "2026-09-20",
      expiresAt: NOW + PENDING_TTL_MS,
    });

    expect(
      await t.mutation(internal.bookings.lifecycle.expirePendingRequests, { now: LATER })
    ).toEqual({ expired: 1 });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ status: "expired" });

    const [notice] = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(notice).toMatchObject({ userId, type: "booking.expired", title_en: "Request expired" });
    expect(notice.body_en).toContain("The provider of Oasis day tour did not respond within 48 hours");
    expect(notice.data).toMatchObject({ bookingId, serviceId, target: "booking" });
  });

  it("closes a same-day request at the start time it was never answered by", async () => {
    const t = makeT();
    const { ownerId, userId, serviceId } = await tour(t);
    const start = riyadhDateTimeToTimestamp(TODAY, "10:00");
    const bookingId = await seedServiceBooking(t, {
      userId,
      serviceId,
      ownerId,
      date: TODAY,
      time: "10:00",
      // What createServiceForUser writes when the start comes before 48 hours.
      expiresAt: start,
    });

    expect(
      await t.mutation(internal.bookings.lifecycle.expirePendingRequests, { now: start - 60_000 })
    ).toEqual({ expired: 0 });
    expect(
      await t.mutation(internal.bookings.lifecycle.expirePendingRequests, { now: start + 60_000 })
    ).toEqual({ expired: 1 });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ status: "expired" });
  });

  it("reminds the traveller the day before, naming the service and its start time", async () => {
    const t = makeT();
    const { ownerId, userId, serviceId } = await tour(t);
    const bookingId = await seedServiceBooking(t, {
      userId,
      serviceId,
      ownerId,
      date: "2026-09-04", // tomorrow, given TODAY
      time: "09:00",
      status: "confirmed",
      confirmationCode: "HSO-TOUR2",
    });

    expect(
      await t.mutation(internal.bookings.lifecycle.sendCheckInReminders, { today: TODAY, now: NOW })
    ).toEqual({ sent: 1 });

    const [reminder] = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(reminder).toMatchObject({
      userId,
      type: "booking.reminder",
      title_en: "Your booking is tomorrow",
      title_ar: "موعدك غدًا",
      body_en: "Oasis day tour, 2026-09-04 at 09:00. Code HSO-TOUR2.",
    });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ reminderSentAt: NOW });
  });

  it("completes a service once its checkOut has passed", async () => {
    const t = makeT();
    const { ownerId, userId, serviceId } = await tour(t);
    // 1 September, so checkOut is 2 September, before TODAY.
    const bookingId = await seedServiceBooking(t, {
      userId,
      serviceId,
      ownerId,
      date: "2026-09-01",
      status: "confirmed",
    });

    expect(
      await t.mutation(internal.bookings.lifecycle.completeFinishedStays, { today: TODAY, now: NOW })
    ).toEqual({ completed: 1 });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ status: "completed", completedAt: NOW });
  });

  it("completes yesterday's service this morning, so 'How was it?' is asked the next day", async () => {
    const t = makeT();
    const { ownerId, userId, serviceId } = await tour(t);
    // Yesterday's tour: its checkOut (the day after, exclusive) is today. A
    // stay leaving today is still in its room; a tour that ran yesterday is
    // over, and waiting for `checkOut < today` would ask a day late.
    const yesterday = await seedServiceBooking(t, {
      userId,
      serviceId,
      ownerId,
      date: "2026-09-02",
      status: "confirmed",
    });
    const today = await seedServiceBooking(t, { userId, serviceId, ownerId, date: TODAY, status: "confirmed" });
    const unanswered = await seedServiceBooking(t, { userId, serviceId, ownerId, date: "2026-09-02" });

    expect(
      await t.mutation(internal.bookings.lifecycle.completeFinishedStays, { today: TODAY, now: NOW })
    ).toEqual({ completed: 1 });
    expect(await t.run((ctx) => ctx.db.get(yesterday))).toMatchObject({ status: "completed" });
    expect(await t.run((ctx) => ctx.db.get(today))).toMatchObject({ status: "confirmed" });
    // Only confirmed work completes; a request nobody answered expires instead.
    expect(await t.run((ctx) => ctx.db.get(unanswered))).toMatchObject({ status: "pending" });
  });

  it("still leaves a stay whose checkOut is today", async () => {
    const t = makeT();
    const { userId } = await tour(t);
    const listingId = await seedHotel(t);
    const stayId = await seedStay(t, { userId, listingId, checkIn: "2026-09-01", checkOut: TODAY, status: "confirmed" });

    expect(
      await t.mutation(internal.bookings.lifecycle.completeFinishedStays, { today: TODAY, now: NOW })
    ).toEqual({ completed: 0 });
    expect(await t.run((ctx) => ctx.db.get(stayId))).toMatchObject({ status: "confirmed" });
  });
});

describe("backfillOwnerIds", () => {
  it("fills in the owner for bookings made before it was denormalised", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const ownerId = await seedUser(t, { role: "business_owner", email: "owner@example.com" });
    const listingId = await seedHotel(t, { ownerId });
    const bookingId = await seedStay(t, { userId, listingId, checkIn: "2026-09-10", checkOut: "2026-09-12" });

    expect(await t.mutation(internal.bookings.lifecycle.backfillOwnerIds, {})).toMatchObject({
      patched: 1,
    });
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ ownerId });
  });

  it("skips bookings on ownerless seed listings", async () => {
    const t = makeT();
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    await seedStay(t, { userId, listingId, checkIn: "2026-09-10", checkOut: "2026-09-12" });

    expect(await t.mutation(internal.bookings.lifecycle.backfillOwnerIds, {})).toMatchObject({
      patched: 0,
    });
  });
});
