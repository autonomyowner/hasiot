import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  makeT,
  NOW,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedStay,
  seedUser,
} from "../test.utils";
import { visibleToLegacyClients } from "./queries";
import { reviewablePlaceBookings } from "../reviews/queries";
import { recomputeReviewTarget } from "../reviews/service";
import { notifyBookingEvent, notifyUserEvent } from "../notifications/internal";
import { enforceRateLimit } from "../rateLimit";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * The compatibility rule (design 4.1): the iOS 1.0.2 and Android 1.0.0 apps
 * call the booking queries and cannot be updated, so a service booking must
 * never reach them — they would render its `listing: null` and crash.
 */

describe("visibleToLegacyClients", () => {
  it("drops service bookings and keeps every other kind", () => {
    const rows = [
      { _id: "a", kind: "stay" },
      { _id: "b", kind: "service" },
      { _id: "c", kind: undefined },
      { _id: "d", kind: "slot" },
    ] as unknown as Doc<"bookings">[];

    expect(visibleToLegacyClients(rows).map((r) => r._id)).toEqual(["a", "c", "d"]);
  });
});

describe("reviewablePlaceBookings", () => {
  it("skips service bookings and places already reviewed", () => {
    const rows = [
      { _id: "stay1", listingId: "L1" },
      { _id: "svc", listingId: undefined, serviceId: "S1" },
      { _id: "stay2", listingId: "L2" },
    ] as unknown as Doc<"bookings">[];

    const kept = reviewablePlaceBookings(rows, new Set(["L2"]));

    expect(kept.map((b) => b._id)).toEqual(["stay1"]);
  });
});

describe("notifyBookingEvent targets", () => {
  it("sends a service request to the provider's inbox, naming the service", async () => {
    const t = makeT();
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const tourist = await seedUser(t, { phoneVerified: true, firstName: "Sara", lastName: "Q" });
    const serviceId = await seedService(t, { ownerId: provider, title_en: "Oasis day tour" });
    const bookingId = await seedServiceBooking(t, {
      userId: tourist,
      serviceId,
      ownerId: provider,
      date: "2026-09-10",
    });

    await t.run(async (ctx) => {
      const booking = (await ctx.db.get(bookingId))!;
      await notifyBookingEvent(ctx, "booking.requested", booking, {}, NOW);
    });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", provider))
        .collect()
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data).toMatchObject({
      bookingId,
      serviceId,
      audience: "owner",
      target: "provider-inbox",
    });
    expect(rows[0].body_en).toContain("Oasis day tour");
    expect(rows[0].body_en).not.toContain("undefined");
  });

  it("sends the tourist's side of a service booking to the booking screen", async () => {
    const t = makeT();
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const tourist = await seedUser(t, { phoneVerified: true });
    const serviceId = await seedService(t, { ownerId: provider });
    const bookingId = await seedServiceBooking(t, {
      userId: tourist,
      serviceId,
      ownerId: provider,
      date: "2026-09-10",
      status: "confirmed",
    });

    await t.run(async (ctx) => {
      const booking = (await ctx.db.get(bookingId))!;
      await notifyBookingEvent(ctx, "booking.confirmed", booking, {}, NOW);
    });

    const [row] = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", tourist))
        .collect()
    );
    expect(row.data).toMatchObject({ bookingId, serviceId, audience: "tourist", target: "booking" });
  });

  it("keeps listing bookings on the host inbox", async () => {
    const t = makeT();
    const host = await seedUser(t, { role: "business_owner", isApproved: true });
    const tourist = await seedUser(t, { phoneVerified: true });
    const listingId = await seedHotel(t, { ownerId: host });
    const bookingId = await seedStay(t, {
      userId: tourist,
      listingId,
      ownerId: host,
      checkIn: "2026-09-10",
      checkOut: "2026-09-13",
    });

    await t.run(async (ctx) => {
      const booking = (await ctx.db.get(bookingId))!;
      await notifyBookingEvent(ctx, "booking.requested", booking, {}, NOW);
    });

    const [row] = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", host))
        .collect()
    );
    expect(row.data).toMatchObject({ listingId, audience: "owner", target: "host-inbox" });
  });
});

describe("notifyUserEvent", () => {
  it("sends each kind of notice where the owner can act on it", async () => {
    const t = makeT();
    const owner = await seedUser(t, { role: "service_provider", isApproved: true });
    const serviceId = await seedService(t, { ownerId: owner, title_en: "Corniche photo walk" });

    await t.run(async (ctx) => {
      await notifyUserEvent(
        ctx,
        "service.rejected",
        { userId: owner, name_en: "Corniche photo walk", name_ar: "جولة", reason: "Blurry photos", serviceId },
        NOW
      );
      await notifyUserEvent(ctx, "account.approved", { userId: owner }, NOW);
      await notifyUserEvent(ctx, "listing.approved", { userId: owner, name_en: "Al Koot", name_ar: "القوت" }, NOW);
    });

    const rows = await t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", owner))
        .collect()
    );
    const byType = Object.fromEntries(rows.map((r) => [r.type, r]));

    expect(byType["service.rejected"].data).toMatchObject({ serviceId, target: "my-services" });
    expect(byType["service.rejected"].body_en).toContain("Blurry photos");
    expect(byType["account.approved"].data).toMatchObject({ target: "verification" });
    expect(byType["listing.approved"].data).toMatchObject({ target: "my-listings" });
  });
});

describe("recomputeReviewTarget", () => {
  it("scores a service from its own reviews and clears the score at zero", async () => {
    const t = makeT();
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const author = await seedUser(t);
    const serviceId = await seedService(t, { ownerId: provider });

    const reviewId = await t.run((ctx) =>
      ctx.db.insert("reviews", {
        userId: author,
        serviceId,
        rating: 4,
        createdAt: NOW,
        updatedAt: NOW,
      })
    );

    await t.run(async (ctx) => {
      const review = (await ctx.db.get(reviewId))!;
      await recomputeReviewTarget(ctx, review);
    });
    let service = await t.run((ctx) => ctx.db.get(serviceId));
    expect(service).toMatchObject({ rating: 4, reviewCount: 1 });

    await t.run(async (ctx) => {
      const review = (await ctx.db.get(reviewId))!;
      await ctx.db.delete(reviewId);
      await recomputeReviewTarget(ctx, review);
    });
    service = await t.run((ctx) => ctx.db.get(serviceId));
    expect(service?.rating).toBeUndefined();
    expect(service?.reviewCount).toBeUndefined();
  });

  it("still scores a listing", async () => {
    const t = makeT();
    const author = await seedUser(t);
    const listingId = await seedHotel(t);
    const reviewId = await t.run((ctx) =>
      ctx.db.insert("reviews", { userId: author, listingId, rating: 5, createdAt: NOW, updatedAt: NOW })
    );

    await t.run(async (ctx) => {
      const review = (await ctx.db.get(reviewId))!;
      await recomputeReviewTarget(ctx, review);
    });

    const listing = await t.run((ctx) => ctx.db.get(listingId as Id<"listings">));
    expect(listing).toMatchObject({ rating: 5, reviewCount: 1 });
  });
});

describe("enforceRateLimit", () => {
  it("refuses with a ConvexError, so production shows the text instead of 'Server Error'", async () => {
    const t = makeT();
    await t.run((ctx) => enforceRateLimit(ctx, "test:key", 1));

    await expect(t.run((ctx) => enforceRateLimit(ctx, "test:key", 1))).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConvexError && /Daily limit reached/.test(String(error.data))
    );
  });
});
