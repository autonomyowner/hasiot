import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedService, seedServiceBooking, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import {
  deleteServiceAsAdmin,
  reinstateServiceRecord,
  suspendServiceRecord,
  updateServiceAsAdmin,
} from "./service";
import { getServiceForAdmin, listServicesPage, searchServicesForAdmin } from "./views";

async function admin(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "admin", email: "admin@hasio.test" });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const activity = (t: TestT) => t.run((ctx) => ctx.db.query("adminActivity").collect());
const service = (t: TestT, id: Id<"services">) => t.run((ctx) => ctx.db.get(id));
const inboxOf = (t: TestT, userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
  );

function refusedWith(text: string | RegExp) {
  return (error: unknown) =>
    error instanceof ConvexError &&
    (typeof text === "string" ? String(error.data) === text : text.test(String(error.data)));
}

async function provider(t: TestT, over: Parameters<typeof seedUser>[1] = {}) {
  return await seedUser(t, { role: "service_provider", isApproved: true, ...over });
}

describe("listServicesPage", () => {
  it("returns each service with its owner, and hides a phone sign-up's fake address", async () => {
    const t = makeT();
    const owner = await provider(t, {
      firstName: "Huda",
      lastName: "A",
      phone: "+966501234567",
      email: "966501234567@phone.hasio.xyz",
    });
    const serviceId = await seedService(t, { ownerId: owner });

    const result = await t.run((ctx) =>
      listServicesPage(ctx, { paginationOpts: { numItems: 10, cursor: null } })
    );

    expect(result.isDone).toBe(true);
    expect(result.page).toHaveLength(1);
    expect(result.page[0]).toMatchObject({
      _id: serviceId,
      title_en: "Al Ahsa oasis tour",
      owner: {
        _id: owner,
        firstName: "Huda",
        lastName: "A",
        phone: "+966501234567",
        email: null,
        isSuspended: false,
      },
    });
  });

  it("filters by status, type and city before paging, so a page is never empty while matches remain", async () => {
    // 30 services, only the oldest 5 are suspended. A filter applied after
    // .paginate() answered the first page of 10 with nothing, and the panel
    // said "no results".
    const t = makeT();
    const owner = await provider(t);
    const suspended: Id<"services">[] = [];
    for (let i = 0; i < 30; i++) {
      const id = await seedService(t, {
        ownerId: owner,
        status: i < 5 ? "suspended" : "approved",
        title_en: `Service ${i}`,
      });
      if (i < 5) suspended.push(id);
    }

    const page = await t.run((ctx) =>
      listServicesPage(ctx, { paginationOpts: { numItems: 10, cursor: null }, status: "suspended" })
    );
    expect(page.page.map((s) => s._id).sort()).toEqual([...suspended].sort());

    const byType = await t.run((ctx) =>
      listServicesPage(ctx, {
        paginationOpts: { numItems: 10, cursor: null },
        status: "suspended",
        serviceType: "photographer",
      })
    );
    expect(byType.page).toHaveLength(0);
    expect(byType.isDone).toBe(true);
  });

  it("finds a service stored under an old sub-area when asked for its city", async () => {
    const t = makeT();
    const owner = await provider(t);
    const hofuf = await seedService(t, { ownerId: owner, city: "Hofuf" });
    const ahsa = await seedService(t, { ownerId: owner, city: "Al Ahsa" });
    await seedService(t, { ownerId: owner, city: "Dammam" });
    await seedService(t, { ownerId: owner, city: "Dhahran" });

    const result = await t.run((ctx) =>
      listServicesPage(ctx, { paginationOpts: { numItems: 10, cursor: null }, city: "Al Ahsa" })
    );
    expect(result.page.map((s) => s._id).sort()).toEqual([hofuf, ahsa].sort());

    const khobar = await t.run((ctx) =>
      listServicesPage(ctx, { paginationOpts: { numItems: 10, cursor: null }, city: "Al Khobar" })
    );
    expect(khobar.page.map((s) => s.city)).toEqual(["Dhahran"]);
  });
});

describe("searchServicesForAdmin", () => {
  it("searches the English and the Arabic title and lists each service once", async () => {
    const t = makeT();
    const owner = await provider(t);
    const both = await seedService(t, {
      ownerId: owner,
      title_en: "Desert photography",
      title_ar: "تصوير الصحراء",
    });
    const arabicOnly = await seedService(t, {
      ownerId: owner,
      title_en: "Dune trip",
      title_ar: "رحلة الصحراء",
    });

    const english = await t.run((ctx) => searchServicesForAdmin(ctx, { search: "Desert" }));
    expect(english.map((s) => s._id)).toEqual([both]);

    const arabic = await t.run((ctx) => searchServicesForAdmin(ctx, { search: "الصحراء" }));
    expect(arabic.map((s) => s._id).sort()).toEqual([both, arabicOnly].sort());
    expect(arabic[0].owner).toMatchObject({ _id: owner });
  });

  it("applies the status, type and city filters, and ignores a blank search", async () => {
    const t = makeT();
    const owner = await provider(t);
    await seedService(t, { ownerId: owner, title_en: "Night tour", status: "pending", city: "Dammam" });
    const live = await seedService(t, { ownerId: owner, title_en: "Night walk", city: "Hofuf" });

    const found = await t.run((ctx) =>
      searchServicesForAdmin(ctx, { search: "Night", status: "approved", city: "Al Ahsa" })
    );
    expect(found.map((s) => s._id)).toEqual([live]);
    expect(await t.run((ctx) => searchServicesForAdmin(ctx, { search: "  " }))).toEqual([]);
  });
});

describe("getServiceForAdmin", () => {
  it("brings the owner, the last ten bookings with guest names, and the open reports", async () => {
    const t = makeT();
    const owner = await provider(t, { firstName: "Faisal", lastName: "K" });
    const serviceId = await seedService(t, { ownerId: owner });
    const guest = await seedUser(t, { firstName: "Sara", lastName: "Q", phoneVerified: true });
    for (let day = 10; day < 22; day++) {
      await seedServiceBooking(t, {
        userId: guest,
        serviceId,
        ownerId: owner,
        date: `2026-09-${day}`,
        status: day % 2 ? "pending" : "completed",
      });
    }
    const reporter = await seedUser(t);
    await t.run(async (ctx) => {
      for (const status of ["pending", "pending", "dismissed"]) {
        await ctx.db.insert("contentReports", {
          reporterId: reporter,
          targetType: "service",
          targetId: serviceId,
          reason: "fraud",
          status,
          createdAt: NOW,
        });
      }
    });

    const detail = (await t.run((ctx) => getServiceForAdmin(ctx, serviceId)))!;

    expect(detail).toMatchObject({ _id: serviceId, owner: { _id: owner, firstName: "Faisal" } });
    expect(detail.recentBookings).toHaveLength(10);
    // Newest first: the last one written is the 21st.
    expect(detail.recentBookings[0]).toMatchObject({
      date: "2026-09-21",
      status: "pending",
      guest: { _id: guest, name: "Sara Q" },
    });
    expect(detail.openReports).toBe(2);
  });

  it("answers null for a service that does not exist", async () => {
    const t = makeT();
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner });
    await t.run((ctx) => ctx.db.delete(serviceId));

    expect(await t.run((ctx) => getServiceForAdmin(ctx, serviceId))).toBeNull();
  });
});

describe("updateServiceAsAdmin", () => {
  it("edits a live service without sending it back to the queue", async () => {
    // An admin correcting a typo on a live service must not take it off the
    // app until another admin re-approves it.
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner });

    await t.run((ctx) =>
      updateServiceAsAdmin(
        ctx,
        acting,
        {
          serviceId,
          title_en: "  Oasis heritage walk  ",
          city: "Hofuf",
          price: 200,
          priceUnit: "per_event",
          maxGroupSize: 12,
          contactPhone: "+966500000000",
        },
        NOW
      )
    );

    expect(await service(t, serviceId)).toMatchObject({
      status: "approved",
      title_en: "Oasis heritage walk",
      city: "Al Ahsa",
      price: 200,
      priceUnit: "per_event",
      maxGroupSize: 12,
      contactPhone: "+966500000000",
    });
    expect((await activity(t))[0]).toMatchObject({ action: "service.update", targetId: serviceId });
  });

  it("clears the price and the group size when sent null", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner, price: 150, maxGroupSize: 8 });

    await t.run((ctx) =>
      updateServiceAsAdmin(ctx, acting, { serviceId, price: null, maxGroupSize: null }, NOW)
    );

    const after = (await service(t, serviceId))!;
    expect(after.price).toBeUndefined();
    expect(after.maxGroupSize).toBeUndefined();
  });

  it("refuses what the provider could not submit either, and changes nothing", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner });

    await expect(
      t.run((ctx) =>
        updateServiceAsAdmin(ctx, acting, { serviceId, title_en: "New", price: 0 }, NOW)
      )
    ).rejects.toSatisfy(refusedWith(/Enter a valid price/));
    await expect(
      t.run((ctx) => updateServiceAsAdmin(ctx, acting, { serviceId, city: "Riyadh" }, NOW))
    ).rejects.toSatisfy(refusedWith(/Choose a city from the list/));

    expect((await service(t, serviceId))!.title_en).toBe("Al Ahsa oasis tour");
    expect(await activity(t)).toHaveLength(0);
  });

  it("says when the service is gone", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner });
    await t.run((ctx) => ctx.db.delete(serviceId));

    await expect(
      t.run((ctx) => updateServiceAsAdmin(ctx, acting, { serviceId, title_en: "x" }, NOW))
    ).rejects.toSatisfy(refusedWith("الخدمة غير موجودة. / Service not found."));
  });
});

describe("suspendServiceRecord and reinstateServiceRecord", () => {
  it("takes a live service down, logs why and tells the provider", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner, title_en: "Oasis tour" });

    await t.run((ctx) => suspendServiceRecord(ctx, acting, serviceId, " Reported as fraud ", NOW));

    expect(await service(t, serviceId)).toMatchObject({
      status: "suspended",
      suspendedReason: "Reported as fraud",
    });
    expect((await activity(t))[0]).toMatchObject({
      action: "service.suspend",
      details: "Reported as fraud",
    });
    const [notice] = await inboxOf(t, owner);
    expect(notice).toMatchObject({
      type: "service.suspended",
      data: { serviceId, target: "my-services" },
    });
    expect(notice.body_en).toContain("Reason: Reported as fraud");
  });

  it("requires a reason", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner });

    await expect(
      t.run((ctx) => suspendServiceRecord(ctx, acting, serviceId, "   ", NOW))
    ).rejects.toSatisfy(refusedWith("سبب الإيقاف مطلوب. / A suspension reason is required."));
    expect((await service(t, serviceId))!.status).toBe("approved");
  });

  it("will not suspend a service that is not live, so reinstating cannot skip review", async () => {
    // Suspend then reinstate used to publish a pending service nobody had
    // reviewed: reinstating sets "approved". A submission is rejected instead.
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    for (const status of ["pending", "rejected"]) {
      const serviceId = await seedService(t, { ownerId: owner, status });
      await expect(
        t.run((ctx) => suspendServiceRecord(ctx, acting, serviceId, "Reported", NOW))
      ).rejects.toSatisfy(refusedWith(/Only a live service can be suspended/));
      expect((await service(t, serviceId))!.status).toBe(status);
    }
  });

  it("puts a suspended service back live and clears the reason", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner, status: "suspended" });
    await t.run((ctx) => ctx.db.patch(serviceId, { suspendedReason: "Reported" }));

    await t.run((ctx) => reinstateServiceRecord(ctx, acting, serviceId, NOW));

    const after = (await service(t, serviceId))!;
    expect(after.status).toBe("approved");
    expect(after.suspendedReason).toBeUndefined();
    expect((await activity(t))[0]).toMatchObject({ action: "service.reinstate" });
  });

  it("refuses to reinstate a service that was never suspended", async () => {
    // Otherwise it is a one-click way past the approval queue.
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const serviceId = await seedService(t, { ownerId: owner, status: "pending" });

    await expect(
      t.run((ctx) => reinstateServiceRecord(ctx, acting, serviceId, NOW))
    ).rejects.toSatisfy(refusedWith("هذه الخدمة ليست موقوفة. / This service is not suspended."));
    expect((await service(t, serviceId))!.status).toBe("pending");
  });
});

describe("deleteServiceAsAdmin", () => {
  it("refuses while a traveller still has an open booking", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const guest = await seedUser(t, { phoneVerified: true });
    const serviceId = await seedService(t, { ownerId: owner });
    await seedServiceBooking(t, {
      userId: guest,
      serviceId,
      ownerId: owner,
      date: "2026-09-10",
      status: "confirmed",
    });

    await expect(
      t.run((ctx) => deleteServiceAsAdmin(ctx, acting, serviceId))
    ).rejects.toSatisfy(
      refusedWith("لا يمكن حذف خدمة لديها حجوزات قائمة. / A service with open bookings cannot be deleted.")
    );
    expect(await service(t, serviceId)).not.toBeNull();
  });

  it("deletes once the bookings are closed, and logs it", async () => {
    const t = makeT();
    const acting = await admin(t);
    const owner = await provider(t);
    const guest = await seedUser(t, { phoneVerified: true });
    const serviceId = await seedService(t, { ownerId: owner });
    await seedServiceBooking(t, {
      userId: guest,
      serviceId,
      ownerId: owner,
      date: "2026-09-01",
      status: "completed",
    });

    await t.run((ctx) => deleteServiceAsAdmin(ctx, acting, serviceId));

    expect(await service(t, serviceId)).toBeNull();
    expect((await activity(t))[0]).toMatchObject({
      action: "service.delete",
      targetId: serviceId,
      summary: "جولة واحة الأحساء",
    });
  });
});
