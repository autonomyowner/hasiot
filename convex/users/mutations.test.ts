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
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { recomputeReviewTarget } from "../reviews/service";
import {
  deleteAccountData,
  enforceUploadAllowance,
  saveBusinessDocForUser,
  setOwnRoleForUser,
} from "./mutations";

describe("setOwnRoleForUser", () => {
  it("keeps admin search finding the person by the name they just gave", async () => {
    // It wrote the names and left searchText as it was, so support searching
    // for the new host by name found nothing.
    const t = makeT();
    const id = await seedUser(t, { email: "966501112222@phone.hasio.xyz", phone: "+966501112222" });
    await t.run((ctx) => ctx.db.patch(id, { firstName: undefined, lastName: undefined, searchText: "old" }));

    await t.run(async (ctx) =>
      setOwnRoleForUser(
        ctx,
        (await ctx.db.get(id))!,
        { role: "business_owner", businessType: "hotel", firstName: "Nora", lastName: "Salem" },
        NOW
      )
    );

    expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
      role: "business_owner",
      businessType: "hotel",
      isApproved: false,
      firstName: "Nora",
      searchText: "966501112222@phone.hasio.xyz +966501112222 nora salem",
    });
  });
});

describe("enforceUploadAllowance", () => {
  async function upload(t: TestT, id: Id<"users">) {
    await t.run(async (ctx) => enforceUploadAllowance(ctx, (await ctx.db.get(id))!));
  }
  async function usedToday(t: TestT, id: Id<"users">, count: number) {
    await t.run((ctx) =>
      ctx.db.insert("rateLimits", { key: `upload:${id}`, windowStart: Date.now(), count })
    );
  }

  it("keeps everyone else to 50 a day", async () => {
    const t = makeT();
    const id = await seedUser(t, { role: "business_owner" });
    await usedToday(t, id, 49);

    await upload(t, id); // the 50th
    await expect(upload(t, id)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConvexError && /Daily upload limit reached/.test(String(error.data))
    );
  });

  it("gives an admin 500, enough to photograph a catalogue in a day", async () => {
    // Every hotel photo the panel uploads is one signed URL; at 50 an admin
    // filling in the seeded catalogue ran out before lunch.
    const t = makeT();
    const id = await seedUser(t, { role: "admin" });
    await usedToday(t, id, 50);

    await upload(t, id); // the 51st, which everyone else is refused
    await t.run(async (ctx) => {
      const row = (await ctx.db
        .query("rateLimits")
        .withIndex("by_key", (q) => q.eq("key", `upload:${id}`))
        .first())!;
      await ctx.db.patch(row._id, { count: 500 });
    });
    await expect(upload(t, id)).rejects.toThrow(ConvexError);
  });
});

async function load(t: TestT, id: Doc<"users">["_id"]): Promise<Doc<"users">> {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

describe("saveBusinessDocForUser", () => {
  it("stores the new document and puts a turned-down account back in the queue", async () => {
    // A rejected owner's fix is a new document. Keeping the old rejection on
    // the account would show the queue a verdict on a file nobody has seen.
    const t = makeT();
    const id = await seedUser(t, { role: "business_owner", isApproved: false });
    await t.run((ctx) =>
      ctx.db.patch(id, { accountRejectionReason: "Expired licence", accountRejectedAt: NOW - 1000 })
    );
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["new licence"])));

    await t.run(async (ctx) => saveBusinessDocForUser(ctx, (await ctx.db.get(id))!, fileId, NOW));

    const after = await load(t, id);
    expect(after.cvFileId).toBe(fileId);
    expect(after.accountRejectionReason).toBeUndefined();
    expect(after.accountRejectedAt).toBeUndefined();
    expect(after.isApproved).toBe(false);
  });

  it("refuses a tourist in words the app can show", async () => {
    const t = makeT();
    const id = await seedUser(t, { role: "tourist" });
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));

    await expect(
      t.run(async (ctx) => saveBusinessDocForUser(ctx, (await ctx.db.get(id))!, fileId, NOW))
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConvexError && /Only business accounts can upload documents/.test(String(error.data))
    );
  });
});

describe("deleteAccountData", () => {
  const HOST_CLOSED = "أُغلق حساب المضيف / The host closed their account";

  const inboxOf = (t: TestT, userId: Id<"users">) =>
    t.run((ctx) =>
      ctx.db
        .query("notifications")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect()
    );

  async function erase(t: TestT, id: Id<"users">) {
    await t.run(async (ctx) => deleteAccountData(ctx, (await ctx.db.get(id))!, NOW));
  }

  it("cancels the open bookings on a closing host's places and services, and tells each guest", async () => {
    // Deleting the listing used to leave the guest holding a confirmed stay at
    // a place that no longer existed, with nobody telling them.
    const t = makeT();
    const host = await seedUser(t, { role: "business_owner", isApproved: true });
    const guest = await seedUser(t, { phoneVerified: true, firstName: "Sara" });
    const listingId = await seedHotel(t, { ownerId: host, name_en: "Oasis Inn" });
    const serviceId = await seedService(t, { ownerId: host, title_en: "Oasis tour" });
    const stay = (status: string) =>
      seedStay(t, { userId: guest, listingId, ownerId: host, checkIn: "2026-09-10", checkOut: "2026-09-12", status });
    const pending = await stay("pending");
    const confirmed = await stay("confirmed");
    const completed = await stay("completed");
    const serviceBooking = await seedServiceBooking(t, {
      userId: guest,
      serviceId,
      ownerId: host,
      date: "2026-09-15",
      status: "confirmed",
    });

    await erase(t, host);

    for (const id of [pending, confirmed, serviceBooking]) {
      expect(await t.run((ctx) => ctx.db.get(id))).toMatchObject({
        status: "cancelled",
        cancellationReason: HOST_CLOSED,
      });
    }
    // History stays as it was.
    expect((await t.run((ctx) => ctx.db.get(completed)))!.status).toBe("completed");

    const inbox = await inboxOf(t, guest);
    expect(inbox).toHaveLength(3);
    expect(inbox.every((n) => n.type === "booking.cancelled_admin")).toBe(true);
    expect(inbox.map((n) => n.data?.bookingId).sort()).toEqual([pending, confirmed, serviceBooking].sort());
    expect(inbox.find((n) => n.data?.serviceId === serviceId)!.body_en).toContain("Oasis tour");
    expect(inbox[0].body_en).toContain("The host closed their account");

    // And the host's own places and services are gone, as before.
    expect(await t.run((ctx) => ctx.db.get(listingId))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(serviceId))).toBeNull();
  });

  it("cancels a closing guest's open bookings and tells each host", async () => {
    const t = makeT();
    const host = await seedUser(t, { role: "business_owner", isApproved: true });
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const guest = await seedUser(t, { phoneVerified: true, firstName: "Sara", lastName: "Q" });
    const listingId = await seedHotel(t, { ownerId: host });
    const serviceId = await seedService(t, { ownerId: provider });
    const stay = await seedStay(t, {
      userId: guest,
      listingId,
      ownerId: host,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      status: "confirmed",
    });
    await seedServiceBooking(t, { userId: guest, serviceId, ownerId: provider, date: "2026-09-15" });
    await seedStay(t, {
      userId: guest,
      listingId,
      ownerId: host,
      checkIn: "2026-08-01",
      checkOut: "2026-08-02",
      status: "completed",
    });

    await erase(t, guest);

    const hostInbox = await inboxOf(t, host);
    expect(hostInbox).toHaveLength(1);
    expect(hostInbox[0]).toMatchObject({ type: "booking.cancelled", data: { bookingId: stay } });
    expect(hostInbox[0].body_en).toContain("Sara Q cancelled");
    const providerInbox = await inboxOf(t, provider);
    expect(providerInbox).toHaveLength(1);
    expect(providerInbox[0]).toMatchObject({ type: "booking.cancelled", data: { serviceId } });

    // The guest's bookings go with the account, as they always did.
    const left = await t.run((ctx) =>
      ctx.db
        .query("bookings")
        .withIndex("by_userId", (q) => q.eq("userId", guest))
        .collect()
    );
    expect(left).toHaveLength(0);
  });

  it("rescores what the account had rated", async () => {
    const t = makeT();
    const leaving = await seedUser(t);
    const staying = await seedUser(t);
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const listingId = await seedHotel(t);
    const serviceId = await seedService(t, { ownerId: provider });
    const review = async (userId: Id<"users">, target: object, rating: number) => {
      const id = await t.run((ctx) =>
        ctx.db.insert("reviews", { userId, ...target, rating, createdAt: NOW, updatedAt: NOW })
      );
      await t.run(async (ctx) => recomputeReviewTarget(ctx, (await ctx.db.get(id))!));
    };
    await review(leaving, { listingId }, 1);
    await review(staying, { listingId }, 5);
    await review(leaving, { serviceId }, 2);

    await erase(t, leaving);

    // The one-star review no longer drags the place down, and the service's
    // only review is gone with its score.
    expect(await t.run((ctx) => ctx.db.get(listingId))).toMatchObject({ rating: 5, reviewCount: 1 });
    const service = (await t.run((ctx) => ctx.db.get(serviceId)))!;
    expect(service.rating).toBeUndefined();
    expect(service.reviewCount).toBeUndefined();
  });

  it("removes the rest of what the account left behind, and nobody else's", async () => {
    const t = makeT();
    const leaving = await seedUser(t, { role: "business_owner", isApproved: false });
    const other = await seedUser(t);
    const cvFileId = await t.run((ctx) => ctx.storage.store(new Blob(["licence"])));
    const momentFile = await t.run((ctx) => ctx.storage.store(new Blob(["photo"])));
    await t.run(async (ctx) => {
      await ctx.db.patch(leaving, { cvFileId });
      await ctx.db.insert("moments", { userId: leaving, storageId: momentFile, createdAt: NOW });
      for (const userId of [leaving, other]) {
        await ctx.db.insert("pushTokens", {
          token: `ExponentPushToken[${userId}]`,
          userId,
          createdAt: NOW,
          updatedAt: NOW,
        });
        await ctx.db.insert("notifications", {
          userId,
          type: "account.approved",
          title_en: "t",
          title_ar: "t",
          body_en: "b",
          body_ar: "b",
          createdAt: NOW,
        });
        await ctx.db.insert("contentReports", {
          reporterId: userId,
          targetType: "listing",
          targetId: "x",
          reason: "spam",
          status: "pending",
          createdAt: NOW,
        });
      }
      // Blocks in both directions, and one between two other people.
      const third = await ctx.db.insert("users", { email: "c@example.com", createdAt: NOW, updatedAt: NOW });
      await ctx.db.insert("userBlocks", { blockerId: leaving, blockedUserId: other, createdAt: NOW });
      await ctx.db.insert("userBlocks", { blockerId: other, blockedUserId: leaving, createdAt: NOW });
      await ctx.db.insert("userBlocks", { blockerId: other, blockedUserId: third, createdAt: NOW });
    });

    await erase(t, leaving);

    const remaining = await t.run(async (ctx) => ({
      tokens: await ctx.db.query("pushTokens").collect(),
      notifications: await ctx.db.query("notifications").collect(),
      reports: await ctx.db.query("contentReports").collect(),
      blocks: await ctx.db.query("userBlocks").collect(),
      moments: await ctx.db.query("moments").collect(),
      cvUrl: await ctx.storage.getUrl(cvFileId),
      momentUrl: await ctx.storage.getUrl(momentFile),
    }));

    expect(remaining.tokens.map((r) => r.userId)).toEqual([other]);
    expect(remaining.notifications.map((r) => r.userId)).toEqual([other]);
    expect(remaining.reports.map((r) => r.reporterId)).toEqual([other]);
    expect(remaining.blocks).toHaveLength(1);
    expect(remaining.blocks[0].blockerId).toBe(other);
    expect(remaining.blocks[0].blockedUserId).not.toBe(leaving);
    expect(remaining.moments).toHaveLength(0);
    expect(remaining.cvUrl).toBeNull();
    expect(remaining.momentUrl).toBeNull();
    // The row itself is deleted by the mutation, after Better Auth's own
    // deletion, as before.
    expect(await t.run((ctx) => ctx.db.get(leaving))).not.toBeNull();
  });
});
