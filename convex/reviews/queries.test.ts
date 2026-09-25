import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { makeT, NOW, seedHotel, seedService, seedServiceBooking, seedStay, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { myServiceReview, reviewableServiceBookings, reviewableServicesForUser } from "./queries";

async function scene(t: TestT) {
  const guestId = await seedUser(t, { firstName: "Sara", lastName: "Q" });
  const providerId = await seedUser(t, { role: "service_provider", isApproved: true });
  const serviceId = await seedService(t, { ownerId: providerId, title_en: "Oasis day tour", title_ar: "جولة الواحة" });
  return { guestId, providerId, serviceId };
}

function insertReview(
  t: TestT,
  review: { userId: Id<"users">; serviceId: Id<"services">; rating: number; isAnonymous?: boolean; createdAt?: number }
) {
  return t.run((ctx) =>
    ctx.db.insert("reviews", {
      createdAt: NOW,
      updatedAt: NOW,
      ...review,
    })
  );
}

describe("reviewableServiceBookings", () => {
  it("keeps service bookings whose service has not been reviewed, once per service", () => {
    const rows = [
      { _id: "newest", serviceId: "S1" },
      { _id: "stay", serviceId: undefined, listingId: "L1" },
      { _id: "reviewed", serviceId: "S2" },
      // An older booking of a service already offered above: one prompt is enough.
      { _id: "older", serviceId: "S1" },
      { _id: "other", serviceId: "S3" },
    ] as unknown as Doc<"bookings">[];

    const kept = reviewableServiceBookings(rows, new Set(["S2"]));

    expect(kept.map((b) => b._id)).toEqual(["newest", "other"]);
  });
});

describe("reviewableServicesForUser", () => {
  it("offers completed service bookings not yet reviewed, with what the prompt shows", async () => {
    const t = makeT();
    const { guestId, providerId, serviceId } = await scene(t);
    await t.run((ctx) => ctx.db.patch(serviceId, { images: ["tour.jpg", "second.jpg"] }));
    const bookingId = await seedServiceBooking(t, {
      userId: guestId,
      serviceId,
      ownerId: providerId,
      date: "2026-08-20",
      status: "completed",
    });
    // Not finished, so not yet something to rate.
    await seedServiceBooking(t, { userId: guestId, serviceId, ownerId: providerId, date: "2026-09-20" });
    // A completed stay belongs to listMyReviewablePlaces, not here.
    const listingId = await seedHotel(t);
    await seedStay(t, { userId: guestId, listingId, checkIn: "2026-08-01", checkOut: "2026-08-03", status: "completed" });
    const me = (await t.run((ctx) => ctx.db.get(guestId)))!;

    expect(await t.run((ctx) => reviewableServicesForUser(ctx, me))).toEqual([
      {
        bookingId,
        serviceId,
        date: "2026-08-20",
        title_en: "Oasis day tour",
        title_ar: "جولة الواحة",
        image: "tour.jpg",
      },
    ]);
  });

  it("drops a service once it is reviewed, and one that no longer exists", async () => {
    const t = makeT();
    const { guestId, providerId, serviceId } = await scene(t);
    const gone = await seedService(t, { ownerId: providerId, title_en: "Closed down" });
    await seedServiceBooking(t, { userId: guestId, serviceId, ownerId: providerId, date: "2026-08-20", status: "completed" });
    await seedServiceBooking(t, { userId: guestId, serviceId: gone, ownerId: providerId, date: "2026-08-21", status: "completed" });
    await insertReview(t, { userId: guestId, serviceId, rating: 5 });
    await t.run((ctx) => ctx.db.delete(gone));
    const me = (await t.run((ctx) => ctx.db.get(guestId)))!;

    // Nothing is left that could be reviewed: a deleted service refuses one.
    expect(await t.run((ctx) => reviewableServicesForUser(ctx, me))).toEqual([]);
  });
});

describe("listForService", () => {
  it("shows a service's reviews newest first, and never an anonymous author's id", async () => {
    const t = makeT();
    const { guestId, providerId, serviceId } = await scene(t);
    const otherId = await seedUser(t, { firstName: "Omar" });
    const named = await insertReview(t, { userId: guestId, serviceId, rating: 5, createdAt: NOW });
    const hidden = await insertReview(t, { userId: otherId, serviceId, rating: 3, isAnonymous: true, createdAt: NOW + 1 });
    // Another service's review stays on its own page.
    const elsewhere = await seedService(t, { ownerId: providerId });
    await insertReview(t, { userId: guestId, serviceId: elsewhere, rating: 1 });

    const reviews = await t.query(api.reviews.queries.listForService, { serviceId });

    expect(reviews.map((r) => r._id)).toEqual([hidden, named]);
    expect(reviews[0].user).toBeNull();
    expect("userId" in reviews[0]).toBe(false);
    expect(reviews[1].user).toEqual({ firstName: "Sara", lastName: "Q" });

    expect(await t.query(api.reviews.queries.listForService, { serviceId, limit: 1 })).toHaveLength(1);
  });
});

describe("getServiceSummary", () => {
  it("summarises a service's ratings like a place's", async () => {
    const t = makeT();
    const { guestId, serviceId } = await scene(t);
    const otherId = await seedUser(t);
    await insertReview(t, { userId: guestId, serviceId, rating: 5 });
    await insertReview(t, { userId: otherId, serviceId, rating: 4 });

    expect(await t.query(api.reviews.queries.getServiceSummary, { serviceId })).toEqual({
      average: 4.5,
      count: 2,
      histogram: [0, 0, 0, 1, 1],
    });
  });
});

describe("myServiceReview", () => {
  it("finds the traveller's own review of a service, or nothing", async () => {
    const t = makeT();
    const { guestId, providerId, serviceId } = await scene(t);
    const otherId = await seedUser(t);
    const mine = await insertReview(t, { userId: guestId, serviceId, rating: 4 });
    await insertReview(t, { userId: otherId, serviceId, rating: 2 });
    const other = await seedService(t, { ownerId: providerId });

    expect((await t.run((ctx) => myServiceReview(ctx, guestId, serviceId)))?._id).toBe(mine);
    expect(await t.run((ctx) => myServiceReview(ctx, guestId, other))).toBeNull();
  });
});
