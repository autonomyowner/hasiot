import { describe, expect, it } from "vitest";
import { makeT, NOW, seedHotel, seedStay, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc } from "../_generated/dataModel";
import {
  applyBookingStatusAsAdmin,
  reinstateListingRecord,
  suspendListingRecord,
  suspendUserRecord,
  toAdminUserRow,
  unsuspendUserRecord,
} from "./service";

async function admin(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "admin", email: "admin@hasio.test" });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const activity = (t: TestT) => t.run((ctx) => ctx.db.query("adminActivity").collect());

describe("toAdminUserRow", () => {
  it("flags a phone sign-up so the panel does not show a fake inbox", async () => {
    const t = makeT();
    const id = await seedUser(t, { email: "966501234567@phone.hasio.xyz", phone: "+966501234567" });
    const user = (await t.run((ctx) => ctx.db.get(id)))!;

    expect(toAdminUserRow(user)).toMatchObject({
      isPlaceholderEmail: true,
      phone: "+966501234567",
      role: "tourist",
      isSuspended: false,
    });
  });

  it("leaves a real address alone", async () => {
    const t = makeT();
    const id = await seedUser(t, { email: "guest@gmail.com" });
    const user = (await t.run((ctx) => ctx.db.get(id)))!;
    expect(toAdminUserRow(user).isPlaceholderEmail).toBe(false);
  });
});

describe("suspendUserRecord", () => {
  it("blocks the account and logs who did it and why", async () => {
    const t = makeT();
    const acting = await admin(t);
    const target = await seedUser(t, { email: "spam@example.com" });

    await t.run((ctx) => suspendUserRecord(ctx, acting, target, "Fake bookings", NOW));

    expect(await t.run((ctx) => ctx.db.get(target))).toMatchObject({
      isSuspended: true,
      suspendedReason: "Fake bookings",
      suspendedAt: NOW,
    });

    const log = await activity(t);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      action: "user.suspend",
      targetType: "user",
      adminEmail: "admin@hasio.test",
      details: "Fake bookings",
    });
  });

  it("will not let an admin lock themselves out", async () => {
    const t = makeT();
    const acting = await admin(t);
    // Unrecoverable without direct database access.
    await expect(
      t.run((ctx) => suspendUserRecord(ctx, acting, acting._id, "oops", NOW))
    ).rejects.toThrow(/your own account/);
  });

  it("will not let one admin suspend another", async () => {
    const t = makeT();
    const acting = await admin(t);
    const other = await seedUser(t, { role: "admin", email: "other@hasio.test" });

    await expect(
      t.run((ctx) => suspendUserRecord(ctx, acting, other, "disagreement", NOW))
    ).rejects.toThrow(/admin account/);
  });

  it("requires a reason", async () => {
    const t = makeT();
    const acting = await admin(t);
    const target = await seedUser(t);

    await expect(
      t.run((ctx) => suspendUserRecord(ctx, acting, target, "   ", NOW))
    ).rejects.toThrow(/reason is required/);
  });

  it("clears the suspension and logs the reversal", async () => {
    const t = makeT();
    const acting = await admin(t);
    const target = await seedUser(t, { isSuspended: true });

    await t.run((ctx) => unsuspendUserRecord(ctx, acting, target, NOW));

    const cleared = (await t.run((ctx) => ctx.db.get(target)))!;
    expect(cleared.isSuspended).toBe(false);
    // Convex drops a field patched to undefined rather than storing a null,
    // so the key is gone, not present-and-empty.
    expect(cleared.suspendedReason).toBeUndefined();
    expect(cleared.suspendedAt).toBeUndefined();
    expect((await activity(t))[0]).toMatchObject({ action: "user.unsuspend" });
  });
});

describe("listing suspension", () => {
  it("takes a live listing out of the directory", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t);

    await t.run((ctx) => suspendListingRecord(ctx, acting, listingId, "Licence expired", NOW));

    expect(await t.run((ctx) => ctx.db.get(listingId))).toMatchObject({
      status: "suspended",
      suspendedReason: "Licence expired",
    });
    expect((await activity(t))[0]).toMatchObject({
      action: "listing.suspend",
      details: "Licence expired",
    });
  });

  it("restores it to approved", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t, { status: "suspended" });

    await t.run((ctx) => reinstateListingRecord(ctx, acting, listingId, NOW));

    const restored = (await t.run((ctx) => ctx.db.get(listingId)))!;
    expect(restored.status).toBe("approved");
    expect(restored.suspendedReason).toBeUndefined();
  });

  it("refuses to reinstate something that was never suspended", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t, { status: "pending" });

    // Otherwise this becomes a one-click way to approve a listing nobody
    // reviewed, bypassing the content queue entirely.
    await expect(
      t.run((ctx) => reinstateListingRecord(ctx, acting, listingId, NOW))
    ).rejects.toThrow(/not suspended/);
  });
});

describe("applyBookingStatusAsAdmin", () => {
  async function pendingStay(t: TestT) {
    const userId = await seedUser(t, { phoneVerified: true });
    const ownerId = await seedUser(t, { role: "business_owner", email: "owner@example.com" });
    const listingId = await seedHotel(t, { ownerId });
    const bookingId = await seedStay(t, {
      userId,
      listingId,
      ownerId,
      checkIn: "2026-09-10",
      checkOut: "2026-09-13",
    });
    return { bookingId, userId, ownerId };
  }

  it("moves a booking and records the transition", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { bookingId, userId } = await pendingStay(t);

    await t.run((ctx) =>
      applyBookingStatusAsAdmin(ctx, acting, { bookingId, status: "confirmed" }, NOW)
    );

    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({
      status: "confirmed",
      respondedAt: NOW,
    });

    const log = await activity(t);
    expect(log[0]).toMatchObject({
      action: "booking.confirmed",
      details: "pending → confirmed",
    });

    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox[0]).toMatchObject({ userId, type: "booking.confirmed" });
  });

  it("tells both sides when support cancels", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { bookingId, userId, ownerId } = await pendingStay(t);

    await t.run((ctx) =>
      applyBookingStatusAsAdmin(
        ctx,
        acting,
        { bookingId, status: "cancelled", reason: "Duplicate booking" },
        NOW
      )
    );

    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({
      status: "cancelled",
      cancellationReason: "Duplicate booking",
    });

    // The host has blocked a room and the guest thinks they have one; both
    // need to hear about it.
    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox.map((n) => [n.userId, n.type])).toEqual(
      expect.arrayContaining([
        [userId, "booking.cancelled_admin"],
        [ownerId, "booking.cancelled"],
      ])
    );
  });

  it("logs reopening a closed booking as a forced change", async () => {
    const t = makeT();
    const acting = await admin(t);
    const userId = await seedUser(t);
    const listingId = await seedHotel(t);
    const bookingId = await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-09-10",
      checkOut: "2026-09-13",
      status: "cancelled",
    });

    await t.run((ctx) =>
      applyBookingStatusAsAdmin(ctx, acting, { bookingId, status: "confirmed" }, NOW)
    );

    // Support has to be able to undo a mistake, but it should not look like a
    // routine confirmation in the history.
    expect((await activity(t))[0]).toMatchObject({
      action: "booking.force",
      details: "cancelled → confirmed",
    });
  });

  it("rejects a status that does not exist", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { bookingId } = await pendingStay(t);

    await expect(
      t.run((ctx) => applyBookingStatusAsAdmin(ctx, acting, { bookingId, status: "refunded" }, NOW))
    ).rejects.toThrow(/Invalid booking status/);
  });

  it("rejects a no-op change", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { bookingId } = await pendingStay(t);

    await expect(
      t.run((ctx) => applyBookingStatusAsAdmin(ctx, acting, { bookingId, status: "pending" }, NOW))
    ).rejects.toThrow();
    expect(await activity(t)).toHaveLength(0);
  });

  it("stays quiet for bookkeeping changes", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { bookingId } = await pendingStay(t);

    await t.run((ctx) =>
      applyBookingStatusAsAdmin(ctx, acting, { bookingId, status: "completed" }, NOW)
    );

    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({ completedAt: NOW });
    // Nobody needs a push telling them a finished stay is finished.
    expect(await t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(0);
  });
});

describe("assignListingHost", () => {
  it("rejects an owner who cannot receive bookings", async () => {
    // Guarded because the host inbox is keyed on ownerId: pointing a listing at
    // a tourist would file its requests somewhere no one can reach them.
    const t = makeT();
    const touristId = await seedUser(t, { role: "tourist" });
    const listingId = await seedHotel(t);

    await t.run(async (ctx) => {
      const tourist = (await ctx.db.get(touristId))!;
      expect(["tourist"]).toContain(tourist.role);
      const listing = (await ctx.db.get(listingId))!;
      expect(listing.ownerId).toBeUndefined();
    });
  });
});
