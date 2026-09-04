import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import { makeT, NOW, seedHotel, seedSlot, seedStay, seedUser, TODAY } from "../test.utils";
import { PENDING_TTL_MS } from "./logic";

const LATER = NOW + PENDING_TTL_MS + 1000;

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
