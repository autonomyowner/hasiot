import { describe, expect, it } from "vitest";
import {
  makeT,
  NOW,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedSlot,
  seedStay,
  seedUser,
} from "../test.utils";
import type { TestT } from "../test.utils";
import type { Id } from "../_generated/dataModel";
import { computeDashboardStats } from "./views";

async function account(t: TestT, opts: { document?: boolean; rejected?: boolean }): Promise<Id<"users">> {
  const id = await seedUser(t, { role: "business_owner", isApproved: false });
  if (opts.document) {
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["licence"])));
    await t.run((ctx) => ctx.db.patch(id, { cvFileId: fileId }));
  }
  if (opts.rejected) {
    await t.run((ctx) => ctx.db.patch(id, { accountRejectionReason: "Expired", accountRejectedAt: NOW }));
  }
  return id;
}

async function report(t: TestT, reporterId: Id<"users">) {
  await t.run((ctx) =>
    ctx.db.insert("contentReports", {
      reporterId,
      targetType: "listing",
      targetId: "x",
      reason: "spam",
      status: "pending",
      createdAt: NOW,
    })
  );
}

describe("computeDashboardStats", () => {
  it("counts every piece of waiting work in exactly one queue", async () => {
    // The panel listed "stay requests waiting on the host" and "bookings
    // waiting for confirmation" side by side, and the second one counted the
    // first one's stays again, so the "needs action" total was inflated.
    const t = makeT();
    const host = await seedUser(t, { role: "business_owner", isApproved: true });
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const guest = await seedUser(t, { phoneVerified: true });
    const hotel = await seedHotel(t, { ownerId: host });
    const service = await seedService(t, { ownerId: provider });
    await seedHotel(t, { status: "pending" });
    await seedService(t, { ownerId: provider, status: "pending" });

    const stay = (status: string) =>
      seedStay(t, { userId: guest, listingId: hotel, ownerId: host, checkIn: "2026-09-10", checkOut: "2026-09-11", status });
    await stay("pending");
    await stay("pending");
    await stay("confirmed");
    await seedServiceBooking(t, { userId: guest, serviceId: service, ownerId: provider, date: "2026-09-12" });
    await seedSlot(t, { userId: guest, listingId: hotel, date: "2026-09-13" });

    await account(t, { document: true }); // the one an admin can act on
    await account(t, {}); // waiting on its owner to upload
    await account(t, { document: true, rejected: true }); // waiting on a new document
    await report(t, guest);

    const stats = await t.run((ctx) => computeDashboardStats(ctx, NOW));

    expect(stats.queues).toEqual({
      content: 1,
      services: 1,
      accounts: 1,
      reports: 1,
      stayRequests: 2,
      serviceRequests: 1,
      slotBookings: 1,
    });
    expect(stats.queueTotal).toBe(8);
    expect(stats).toMatchObject({
      awaitingOwner: 2,
      awaitingProvider: 1,
      pendingSlotBookings: 1,
      accountsAwaitingReview: 1,
      capped: false,
    });

    // Additive: the fields the panel on production reads keep their meaning.
    expect(stats).toMatchObject({
      pendingBookings: 4,
      pendingContent: 1,
      pendingServices: 1,
      pendingBusinesses: 3,
      pendingReports: 1,
      totalBookings: 5,
      truncated: false,
      statsCap: 5000,
    });
  });

  it("says when a count stopped at its read cap", async () => {
    // Past the cap the number is a floor, not a count; the panel says so
    // (الأرقام تقريبية) rather than showing a wrong figure as exact.
    const t = makeT();
    const reporter = await seedUser(t);
    await t.run(async (ctx) => {
      for (let i = 0; i < 200; i++) {
        await ctx.db.insert("contentReports", {
          reporterId: reporter,
          targetType: "listing",
          targetId: `x${i}`,
          reason: "spam",
          status: "pending",
          createdAt: NOW,
        });
      }
    });

    const stats = await t.run((ctx) => computeDashboardStats(ctx, NOW));

    expect(stats.capped).toBe(true);
    expect(stats.pendingReports).toBe(200);
  });
});
