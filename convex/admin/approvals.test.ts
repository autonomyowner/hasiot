import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedHotel, seedService, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import {
  approveListingRecord,
  approveServiceRecord,
  rejectListingRecord,
  rejectServiceRecord,
  suspendListingRecord,
} from "./service";

/**
 * Every approval, rejection and takedown tells the owner (design 4.4 and
 * 6 "New" 7). Until now an owner learned their place was live, or turned
 * down, only by opening the app and looking.
 */

async function admin(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "admin", email: "admin@hasio.test" });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const activity = (t: TestT) => t.run((ctx) => ctx.db.query("adminActivity").collect());
const inboxOf = (t: TestT, userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
  );

async function pendingListing(t: TestT) {
  const owner = await seedUser(t, { role: "business_owner", isApproved: true });
  const listingId = await seedHotel(t, { ownerId: owner, status: "pending", name_en: "Oasis Inn" });
  return { owner, listingId };
}

async function pendingService(t: TestT) {
  const owner = await seedUser(t, { role: "service_provider", isApproved: true });
  const serviceId = await seedService(t, {
    ownerId: owner,
    status: "pending",
    title_en: "Corniche photo walk",
    title_ar: "جولة تصوير على الكورنيش",
  });
  return { owner, serviceId };
}

describe("listing approvals", () => {
  it("approving publishes the place and tells the owner it is live", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { owner, listingId } = await pendingListing(t);
    await t.run((ctx) => ctx.db.patch(listingId, { rejectionReason: "old note" }));

    await t.run((ctx) => approveListingRecord(ctx, acting, listingId, {}, NOW));

    const listing = (await t.run((ctx) => ctx.db.get(listingId)))!;
    expect(listing.status).toBe("approved");
    expect(listing.rejectionReason).toBeUndefined();
    expect((await activity(t))[0]).toMatchObject({ action: "content.approve", targetId: listingId });

    const [notice] = await inboxOf(t, owner);
    expect(notice).toMatchObject({
      type: "listing.approved",
      title_en: "Your place is live",
      data: { listingId, target: "my-listings" },
    });
    expect(notice.body_en).toContain("Oasis Inn");
  });

  it("rejecting records the reason and sends it to the owner", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { owner, listingId } = await pendingListing(t);

    await t.run((ctx) => rejectListingRecord(ctx, acting, listingId, "  Blurry photos  ", {}, NOW));

    expect(await t.run((ctx) => ctx.db.get(listingId))).toMatchObject({
      status: "rejected",
      rejectionReason: "Blurry photos",
    });
    expect((await activity(t))[0]).toMatchObject({ action: "content.reject", details: "Blurry photos" });

    const [notice] = await inboxOf(t, owner);
    expect(notice).toMatchObject({ type: "listing.rejected", data: { listingId, target: "my-listings" } });
    expect(notice.body_en).toContain("Reason: Blurry photos");
    expect(notice.body_ar).toContain("السبب: Blurry photos");
  });

  it("marks a batch decision as one in the log", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { listingId } = await pendingListing(t);

    await t.run((ctx) => approveListingRecord(ctx, acting, listingId, { bulk: true }, NOW));

    expect((await activity(t))[0]).toMatchObject({ details: "ضمن إجراء جماعي" });
  });

  it("approves a seed listing without trying to notify an owner it does not have", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t, { status: "pending" });

    await t.run((ctx) => approveListingRecord(ctx, acting, listingId, {}, NOW));

    expect((await t.run((ctx) => ctx.db.get(listingId)))!.status).toBe("approved");
    expect(await t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(0);
  });

  it("says in both languages when the listing is gone", async () => {
    const t = makeT();
    const acting = await admin(t);
    const listingId = await seedHotel(t);
    await t.run((ctx) => ctx.db.delete(listingId));

    await expect(
      t.run((ctx) => approveListingRecord(ctx, acting, listingId, {}, NOW))
    ).rejects.toSatisfy(
      (error: unknown) => error instanceof ConvexError && /Listing not found/.test(String(error.data))
    );
  });

  it("suspending a live place tells the owner why it was taken down", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await seedUser(t, { role: "business_owner", isApproved: true });
    const listingId = await seedHotel(t, { ownerId: owner, name_en: "Oasis Inn" });

    await t.run((ctx) => suspendListingRecord(ctx, acting, listingId, "Licence expired", NOW));

    const [notice] = await inboxOf(t, owner);
    expect(notice).toMatchObject({
      type: "listing.suspended",
      title_en: "Your place was taken down",
      data: { listingId, target: "my-listings" },
    });
    expect(notice.body_en).toContain("Reason: Licence expired");
    expect((await activity(t))[0]).toMatchObject({ action: "listing.suspend" });
  });
});

describe("service approvals", () => {
  it("approving tells the provider travellers can now book it", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { owner, serviceId } = await pendingService(t);

    await t.run((ctx) => approveServiceRecord(ctx, acting, serviceId, {}, NOW));

    expect((await t.run((ctx) => ctx.db.get(serviceId)))!.status).toBe("approved");
    expect((await activity(t))[0]).toMatchObject({ action: "service.approve", targetId: serviceId });

    const [notice] = await inboxOf(t, owner);
    expect(notice).toMatchObject({
      type: "service.approved",
      title_en: "Your service is live",
      data: { serviceId, target: "my-services" },
    });
    expect(notice.body_ar).toContain("جولة تصوير على الكورنيش");
  });

  it("rejecting records the reason and sends it to the provider", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { owner, serviceId } = await pendingService(t);

    await t.run((ctx) => rejectServiceRecord(ctx, acting, serviceId, "Add a price", { bulk: true }, NOW));

    expect(await t.run((ctx) => ctx.db.get(serviceId))).toMatchObject({
      status: "rejected",
      rejectionReason: "Add a price",
    });
    expect((await activity(t))[0]).toMatchObject({ action: "service.reject", details: "Add a price" });

    const [notice] = await inboxOf(t, owner);
    expect(notice).toMatchObject({ type: "service.rejected", data: { serviceId, target: "my-services" } });
    expect(notice.body_en).toContain("Reason: Add a price");
  });

  it("says in both languages when the service is gone", async () => {
    const t = makeT();
    const acting = await admin(t);
    const { serviceId } = await pendingService(t);
    await t.run((ctx) => ctx.db.delete(serviceId));

    await expect(
      t.run((ctx) => rejectServiceRecord(ctx, acting, serviceId, undefined, {}, NOW))
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConvexError && String(error.data) === "الخدمة غير موجودة. / Service not found."
    );
  });
});
