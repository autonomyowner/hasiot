import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedHotel, seedService, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { recomputeReviewTarget } from "../reviews/service";
import { removeReviewRecord } from "./service";

async function admin(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "admin", email: "admin@hasio.test" });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const activity = (t: TestT) => t.run((ctx) => ctx.db.query("adminActivity").collect());

async function review(
  t: TestT,
  target: { listingId?: Id<"listings">; serviceId?: Id<"services"> },
  rating: number,
  content?: string
): Promise<Id<"reviews">> {
  const author = await seedUser(t);
  const id = await t.run((ctx) =>
    ctx.db.insert("reviews", { userId: author, ...target, rating, content, createdAt: NOW, updatedAt: NOW })
  );
  await t.run(async (ctx) => recomputeReviewTarget(ctx, (await ctx.db.get(id))!));
  return id;
}

async function report(t: TestT, reviewId: Id<"reviews">, status = "pending"): Promise<Id<"contentReports">> {
  const reporter = await seedUser(t);
  return await t.run((ctx) =>
    ctx.db.insert("contentReports", {
      reporterId: reporter,
      targetType: "review",
      targetId: reviewId,
      reason: "offensive",
      status,
      createdAt: NOW,
    })
  );
}

describe("removeReviewRecord", () => {
  it("takes a reported review down, rescores the place and closes the report", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t);
    await review(t, { listingId }, 5);
    const abusive = await review(t, { listingId }, 1, "Insults");
    const reportId = await report(t, abusive);
    expect((await t.run((ctx) => ctx.db.get(listingId)))!.rating).toBe(3);

    await t.run((ctx) =>
      removeReviewRecord(ctx, acting, { reviewId: abusive, reason: " Abusive language ", reportId }, NOW)
    );

    expect(await t.run((ctx) => ctx.db.get(abusive))).toBeNull();
    // The one-star review no longer counts.
    expect(await t.run((ctx) => ctx.db.get(listingId))).toMatchObject({ rating: 5, reviewCount: 1 });
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
      status: "actioned",
      reviewedByAdminId: acting._id,
      reviewedAt: NOW,
    });
    expect((await activity(t))[0]).toMatchObject({
      action: "review.remove",
      targetType: "review",
      targetId: abusive,
      details: "Abusive language",
    });
  });

  it("clears a service's score when its only review goes", async () => {
    const t = makeT();
    const acting = await admin(t);
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const serviceId = await seedService(t, { ownerId: provider });
    const only = await review(t, { serviceId }, 2);

    await t.run((ctx) => removeReviewRecord(ctx, acting, { reviewId: only, reason: "Fake" }, NOW));

    const service = (await t.run((ctx) => ctx.db.get(serviceId)))!;
    expect(service.rating).toBeUndefined();
    expect(service.reviewCount).toBeUndefined();
  });

  it("closes every other open report about the same review", async () => {
    // The review is gone; reports about it left open would sit in the queue
    // pointing at nothing.
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t);
    const reviewId = await review(t, { listingId }, 1);
    const first = await report(t, reviewId);
    const second = await report(t, reviewId);
    const dismissed = await report(t, reviewId, "dismissed");

    await t.run((ctx) => removeReviewRecord(ctx, acting, { reviewId, reason: "Spam", reportId: first }, NOW));

    expect((await t.run((ctx) => ctx.db.get(second)))!.status).toBe("actioned");
    expect((await t.run((ctx) => ctx.db.get(dismissed)))!.status).toBe("dismissed");
  });

  it("says when the review is already gone, and changes nothing", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t);
    const reviewId = await review(t, { listingId }, 4);
    await t.run((ctx) => ctx.db.delete(reviewId));

    await expect(
      t.run((ctx) => removeReviewRecord(ctx, acting, { reviewId, reason: "x" }, NOW))
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConvexError && String(error.data) === "التقييم غير موجود. / Review not found."
    );
    expect(await activity(t)).toHaveLength(0);
  });

  it("refuses a report that is about something else, and keeps the review", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t);
    const kept = await review(t, { listingId }, 4);
    const other = await review(t, { listingId }, 1);
    const reportOnOther = await report(t, other);

    await expect(
      t.run((ctx) =>
        removeReviewRecord(ctx, acting, { reviewId: kept, reason: "x", reportId: reportOnOther }, NOW)
      )
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ConvexError && /not about this review/.test(String(error.data))
    );
    expect(await t.run((ctx) => ctx.db.get(kept))).not.toBeNull();
  });
});
