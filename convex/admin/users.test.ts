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
import { setUserRoleRecord } from "./service";
import { getUserForAdmin } from "./views";

async function admin(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "admin", email: "admin@hasio.test" });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const activity = (t: TestT) => t.run((ctx) => ctx.db.query("adminActivity").collect());
const user = (t: TestT, id: Id<"users">) => t.run((ctx) => ctx.db.get(id));

function refusedWith(text: string) {
  return (error: unknown) => error instanceof ConvexError && String(error.data) === text;
}

describe("setUserRoleRecord", () => {
  it("makes a tourist a business owner who still has to be approved", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedUser(t, {
      role: "tourist",
      firstName: "Nora",
      lastName: "S",
      email: "nora@example.com",
      phone: "+966501112222",
    });

    await t.run((ctx) => setUserRoleRecord(ctx, acting, id, "business_owner", NOW));

    expect(await user(t, id)).toMatchObject({
      role: "business_owner",
      isApproved: false,
      // Kept right on every write to the row, so admin search still finds her.
      searchText: "nora@example.com +966501112222 nora s",
    });
    expect((await activity(t))[0]).toMatchObject({
      action: "user.role",
      targetType: "user",
      targetId: id,
      details: "tourist → business_owner",
    });
  });

  it("moves a provider back to tourist", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedUser(t, { role: "service_provider", isApproved: true });

    await t.run((ctx) => setUserRoleRecord(ctx, acting, id, "tourist", NOW));

    expect((await user(t, id))!.role).toBe("tourist");
    expect((await activity(t))[0]).toMatchObject({ details: "service_provider → tourist" });
  });

  it("refuses a role that does not exist", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedUser(t);

    await expect(
      t.run((ctx) => setUserRoleRecord(ctx, acting, id, "admin", NOW))
    ).rejects.toSatisfy(refusedWith("دور غير صالح. / Invalid role."));
    await expect(
      t.run((ctx) => setUserRoleRecord(ctx, acting, id, "superuser", NOW))
    ).rejects.toSatisfy(refusedWith("دور غير صالح. / Invalid role."));
  });

  it("will not touch an admin's role, the acting admin's included", async () => {
    // Demoting yourself locks you out of the panel with no way back but the
    // database; demoting another admin is a fight the panel should not host.
    const t = makeT();
    const acting = await admin(t);
    const other = await seedUser(t, { role: "admin", email: "other@hasio.test" });

    await expect(
      t.run((ctx) => setUserRoleRecord(ctx, acting, acting._id, "tourist", NOW))
    ).rejects.toSatisfy(refusedWith("لا يمكن تغيير دور هذا الحساب. / This account's role cannot be changed."));
    await expect(
      t.run((ctx) => setUserRoleRecord(ctx, acting, other, "tourist", NOW))
    ).rejects.toSatisfy(refusedWith("لا يمكن تغيير دور هذا الحساب. / This account's role cannot be changed."));
    expect((await user(t, other))!.role).toBe("admin");
  });

  it("does nothing, and logs nothing, when the role is already that", async () => {
    // Re-saving "business owner" must not quietly revoke an approval.
    const t = makeT();
    const acting = await admin(t);
    const id = await seedUser(t, { role: "business_owner", isApproved: true });

    await t.run((ctx) => setUserRoleRecord(ctx, acting, id, "business_owner", NOW));

    expect((await user(t, id))!.isApproved).toBe(true);
    expect(await activity(t)).toHaveLength(0);
  });

  it("says when the account is gone", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await seedUser(t);
    await t.run((ctx) => ctx.db.delete(id));

    await expect(
      t.run((ctx) => setUserRoleRecord(ctx, acting, id, "tourist", NOW))
    ).rejects.toSatisfy(refusedWith("المستخدم غير موجود. / User not found."));
  });
});

describe("getUserForAdmin", () => {
  it("brings the account with its bookings, places, services and the reports against them", async () => {
    const t = makeT();
    const id = await seedUser(t, {
      role: "business_owner",
      isApproved: false,
      firstName: "Omar",
      lastName: "H",
    });
    await t.run((ctx) => ctx.db.patch(id, { accountRejectionReason: "Expired licence" }));

    // Their own trips, as a guest.
    const host = await seedUser(t, { role: "business_owner", isApproved: true });
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const someoneElsesHotel = await seedHotel(t, { ownerId: host, name_en: "Elsewhere" });
    const someoneElsesService = await seedService(t, { ownerId: provider });
    await seedStay(t, {
      userId: id,
      listingId: someoneElsesHotel,
      ownerId: host,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
    });
    await seedServiceBooking(t, {
      userId: id,
      serviceId: someoneElsesService,
      ownerId: provider,
      date: "2026-09-15",
    });

    // What they own.
    const theirHotel = await seedHotel(t, { ownerId: id, name_en: "Omar's Inn" });
    const theirService = await seedService(t, { ownerId: id, title_en: "Omar's tour" });

    // Reports: two against their content, one against someone else's.
    const reporter = await seedUser(t);
    const reviewId = await t.run((ctx) =>
      ctx.db.insert("reviews", {
        userId: id,
        listingId: someoneElsesHotel,
        rating: 1,
        content: "Awful",
        createdAt: NOW,
        updatedAt: NOW,
      })
    );
    await t.run(async (ctx) => {
      const report = (targetType: string, targetId: string, createdAt: number) =>
        ctx.db.insert("contentReports", {
          reporterId: reporter,
          targetType,
          targetId,
          reason: "spam",
          status: "pending",
          createdAt,
        });
      await report("listing", theirHotel, NOW + 1);
      await report("review", reviewId, NOW + 2);
      await report("service", someoneElsesService, NOW + 3);
    });

    const detail = (await t.run((ctx) => getUserForAdmin(ctx, id)))!;

    expect(detail).toMatchObject({
      _id: id,
      firstName: "Omar",
      role: "business_owner",
      accountRejectionReason: "Expired licence",
    });
    expect(detail.bookings).toHaveLength(2);
    expect(detail.bookings.map((b) => b.kind).sort()).toEqual(["service", "stay"]);
    expect(detail.bookings.find((b) => b.kind === "stay")).toMatchObject({
      listing: { _id: someoneElsesHotel, name_en: "Elsewhere" },
      guest: { _id: id, name: "Omar H" },
    });
    expect(detail.listings.map((l) => l._id)).toEqual([theirHotel]);
    expect(detail.services.map((s) => s._id)).toEqual([theirService]);
    // Newest first, and only about what they published or wrote.
    expect(detail.reports.map((r) => [r.targetType, r.targetId])).toEqual([
      ["review", reviewId],
      ["listing", theirHotel],
    ]);
    expect(detail.reports[1]).toMatchObject({ targetTitle: "فندق تجريبي" });
  });

  it("answers null for an account that does not exist", async () => {
    const t = makeT();
    const id = await seedUser(t);
    await t.run((ctx) => ctx.db.delete(id));

    expect(await t.run((ctx) => getUserForAdmin(ctx, id))).toBeNull();
  });
});
