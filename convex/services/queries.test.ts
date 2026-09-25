import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { makeT, NOW, seedService, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import {
  countServiceCities,
  mergeSearchHits,
  publicServiceDetail,
  publicServiceRows,
  type ServiceOwner,
} from "./queries";

/**
 * What a traveller may see of the services directory.
 *
 * The pure helpers carry every rule; the query tests below call the real
 * handlers as a signed-out visitor, which convex-test can do because
 * getAuthenticatedAppUser answers null when there is no session.
 */

const LIVE: ServiceOwner = {
  role: "service_provider",
  isApproved: true,
  isSuspended: false,
  firstName: "Huda",
  lastName: "Al-Nasser",
  createdAt: NOW,
};

type RowFields = Omit<Partial<Doc<"services">>, "_id" | "ownerId"> & { _id: string; ownerId: string };

function row(over: RowFields): Doc<"services"> {
  return {
    _creationTime: NOW,
    serviceType: "tour_guide",
    title_en: "Walk",
    title_ar: "جولة",
    status: "approved",
    price: 150,
    priceUnit: "per_hour",
    city: "Al Ahsa",
    createdAt: NOW,
    updatedAt: NOW,
    ...over,
  } as unknown as Doc<"services">;
}

describe("publicServiceRows", () => {
  const owners = new Map<string, ServiceOwner | null>([
    ["live", LIVE],
    ["suspended", { ...LIVE, isSuspended: true }],
    ["unapproved", { ...LIVE, isApproved: false }],
    ["host", { ...LIVE, role: "business_owner" }],
    ["gone", null],
  ]);

  it("shows approved services of owners who are still in good standing", () => {
    const rows = [
      row({ _id: "ok", ownerId: "live" }),
      row({ _id: "pending", ownerId: "live", status: "pending" }),
      row({ _id: "rejected", ownerId: "live", status: "rejected" }),
      row({ _id: "taken-down", ownerId: "live", status: "suspended" }),
      // Suspending an account hides everything it published (design D15).
      row({ _id: "owner-suspended", ownerId: "suspended" }),
      row({ _id: "owner-gone", ownerId: "gone" }),
      row({ _id: "owner-unknown", ownerId: "nobody" }),
    ];

    expect(publicServiceRows(rows, owners).map((s) => s._id)).toEqual(["ok"]);
  });

  it("hides the services of owners the viewer blocked", () => {
    const rows = [row({ _id: "a", ownerId: "live" }), row({ _id: "b", ownerId: "unapproved" })];

    const visible = publicServiceRows(rows, owners, { blockedIds: new Set(["live"]) });

    expect(visible.map((s) => s._id)).toEqual(["b"]);
  });

  it("matches a city through the sub-areas that fold into it", () => {
    const rows = [
      row({ _id: "hofuf", ownerId: "live", city: "Hofuf" }),
      row({ _id: "ahsa", ownerId: "live", city: "Al Ahsa" }),
      row({ _id: "dammam", ownerId: "live", city: "Dammam" }),
      row({ _id: "nowhere", ownerId: "live", city: undefined }),
    ];

    expect(publicServiceRows(rows, owners, { city: "Al Ahsa" }).map((s) => s._id)).toEqual(["hofuf", "ahsa"]);
    // An old link that asks for the village still finds the city's services.
    expect(publicServiceRows(rows, owners, { city: "Hofuf" }).map((s) => s._id)).toEqual(["hofuf", "ahsa"]);
    expect(publicServiceRows(rows, owners, { city: "Dammam" }).map((s) => s._id)).toEqual(["dammam"]);
  });

  it("marks which services can be booked and which show Contact", () => {
    const rows = [
      row({ _id: "priced", ownerId: "live" }),
      // Posted before 1.1.0, with a free-text price only (design D16).
      row({ _id: "unpriced", ownerId: "live", price: undefined, priceRange: "100-200 SAR" }),
      row({ _id: "unapproved-owner", ownerId: "unapproved" }),
      row({ _id: "host-owner", ownerId: "host" }),
    ];

    const flags = Object.fromEntries(publicServiceRows(rows, owners).map((s) => [s._id, s.bookable]));

    expect(flags).toEqual({
      priced: true,
      unpriced: false,
      "unapproved-owner": false,
      "host-owner": false,
    });
  });
});

describe("publicServiceDetail", () => {
  it("adds the provider a traveller is booking, and nothing private about them", () => {
    const detail = publicServiceDetail(row({ _id: "s", ownerId: "live" }), LIVE, new Set());

    expect(detail).toMatchObject({
      _id: "s",
      bookable: true,
      provider: { firstName: "Huda", lastName: "Al-Nasser", memberSince: NOW },
    });
    expect(Object.keys(detail!.provider!).sort()).toEqual(["firstName", "lastName", "memberSince"]);
  });

  it("is null for a service a traveller may not see", () => {
    expect(publicServiceDetail(null, LIVE, new Set())).toBeNull();
    expect(publicServiceDetail(row({ _id: "s", ownerId: "live", status: "pending" }), LIVE, new Set())).toBeNull();
    expect(publicServiceDetail(row({ _id: "s", ownerId: "live" }), { ...LIVE, isSuspended: true }, new Set())).toBeNull();
    expect(publicServiceDetail(row({ _id: "s", ownerId: "live" }), null, new Set())).toBeNull();
    // The check getService used to lack.
    expect(publicServiceDetail(row({ _id: "s", ownerId: "live" }), LIVE, new Set(["live"]))).toBeNull();
  });
});

describe("mergeSearchHits", () => {
  it("keeps each service once, in the order first found", () => {
    const a = { _id: "a" };
    const b = { _id: "b" };
    const c = { _id: "c" };

    expect(mergeSearchHits([a, b], [b, c, a]).map((s) => s._id)).toEqual(["a", "b", "c"]);
  });
});

describe("countServiceCities", () => {
  it("counts public services under their canonical city", () => {
    const owners = new Map<string, ServiceOwner | null>([
      ["live", LIVE],
      ["suspended", { ...LIVE, isSuspended: true }],
    ]);
    const rows = [
      row({ _id: "1", ownerId: "live", city: "Hofuf" }),
      row({ _id: "2", ownerId: "live", city: "Al Ahsa" }),
      row({ _id: "3", ownerId: "live", city: "Dammam" }),
      row({ _id: "4", ownerId: "live", city: undefined }),
      row({ _id: "5", ownerId: "live", city: "Dammam", status: "pending" }),
      row({ _id: "6", ownerId: "suspended", city: "Dammam" }),
    ];

    expect(countServiceCities(rows, owners)).toEqual([
      { city: "Al Ahsa", count: 2 },
      { city: "Dammam", count: 1 },
    ]);
  });
});

async function provider(t: TestT, over: Parameters<typeof seedUser>[1] = {}): Promise<Id<"users">> {
  return seedUser(t, { role: "service_provider", isApproved: true, firstName: "Huda", ...over });
}

describe("the public service queries, as a signed-out visitor", () => {
  it("listServices returns public services with the bookable flag, by type and city", async () => {
    const t = makeT();
    const owner = await provider(t);
    const suspended = await provider(t, { isSuspended: true });
    const guide = await seedService(t, { ownerId: owner, city: "Hofuf" });
    const photographer = await seedService(t, { ownerId: owner, serviceType: "photographer", city: "Dammam", price: null });
    await seedService(t, { ownerId: owner, status: "pending" });
    await seedService(t, { ownerId: suspended });

    const all = await t.query(api.services.queries.listServices, {});
    expect(all.map((s) => [s._id, s.bookable])).toEqual([
      [guide, true],
      [photographer, false],
    ]);

    const byType = await t.query(api.services.queries.listServices, { serviceType: "photographer" });
    expect(byType.map((s) => s._id)).toEqual([photographer]);

    const byCity = await t.query(api.services.queries.listServices, { city: "Al Ahsa" });
    expect(byCity.map((s) => s._id)).toEqual([guide]);
  });

  it("listServicesPaginated fills a page with approved services, however many are waiting for review", async () => {
    const t = makeT();
    const owner = await provider(t);
    for (let i = 0; i < 25; i++) await seedService(t, { ownerId: owner, status: "pending" });
    const approved: Id<"services">[] = [];
    for (let i = 0; i < 5; i++) approved.push(await seedService(t, { ownerId: owner }));

    const first = await t.query(api.services.queries.listServicesPaginated, {
      paginationOpts: { numItems: 5, cursor: null },
    });

    expect(first.page.map((s) => s._id).sort()).toEqual([...approved].sort());
    expect(first.page.every((s) => s.bookable)).toBe(true);
  });

  it("listServicesPaginated filters by type and by a city without sub-areas inside the query", async () => {
    const t = makeT();
    const owner = await provider(t);
    for (let i = 0; i < 12; i++) await seedService(t, { ownerId: owner, serviceType: "driver", city: "Dammam" });
    const jubail = await seedService(t, { ownerId: owner, serviceType: "driver", city: "Jubail" });
    await seedService(t, { ownerId: owner, serviceType: "photographer", city: "Jubail" });

    const page = await t.query(api.services.queries.listServicesPaginated, {
      paginationOpts: { numItems: 5, cursor: null },
      serviceType: "driver",
      city: "Jubail",
    });

    expect(page.page.map((s) => s._id)).toEqual([jubail]);
  });

  it("searchServices finds a service by its English or its Arabic title, once", async () => {
    const t = makeT();
    const owner = await provider(t);
    const english = await seedService(t, { ownerId: owner, title_en: "Desert photography", title_ar: "تصوير" });
    const arabic = await seedService(t, { ownerId: owner, title_en: "Heritage walk", title_ar: "جولة تراثية" });
    // Matches both indexes; it must come back once.
    const both = await seedService(t, { ownerId: owner, title_en: "Qarah caves", title_ar: "Qarah الكهوف" });

    const byEnglish = await t.query(api.services.queries.searchServices, { searchQuery: "desert" });
    expect(byEnglish.map((s) => s._id)).toEqual([english]);

    const byArabic = await t.query(api.services.queries.searchServices, { searchQuery: "جولة" });
    expect(byArabic.map((s) => s._id)).toEqual([arabic]);

    const twice = await t.query(api.services.queries.searchServices, { searchQuery: "qarah" });
    expect(twice.map((s) => s._id)).toEqual([both]);
    expect(twice[0].bookable).toBe(true);
  });

  it("searchServices filters the city after the search, so a service stored as Hofuf is found under Al Ahsa", async () => {
    const t = makeT();
    const owner = await provider(t);
    const hidden = await provider(t, { isSuspended: true });
    const hofuf = await seedService(t, { ownerId: owner, title_en: "Palm grove tour", city: "Hofuf" });
    await seedService(t, { ownerId: owner, title_en: "Palm beach tour", city: "Al Khobar" });
    await seedService(t, { ownerId: owner, title_en: "Palm market tour", status: "pending" });
    await seedService(t, { ownerId: hidden, title_en: "Palm dates tour" });

    const found = await t.query(api.services.queries.searchServices, { searchQuery: "palm", city: "Al Ahsa" });

    expect(found.map((s) => s._id)).toEqual([hofuf]);
  });

  it("getService shows a public service with its provider, and nothing else", async () => {
    const t = makeT();
    const owner = await provider(t, { lastName: "Al-Nasser" });
    const suspendedOwner = await provider(t, { isSuspended: true });
    const live = await seedService(t, { ownerId: owner });
    const pending = await seedService(t, { ownerId: owner, status: "pending" });
    const takenDown = await seedService(t, { ownerId: owner, status: "suspended" });
    const hidden = await seedService(t, { ownerId: suspendedOwner });

    expect(await t.query(api.services.queries.getService, { serviceId: live })).toMatchObject({
      _id: live,
      bookable: true,
      provider: { firstName: "Huda", lastName: "Al-Nasser", memberSince: NOW },
    });
    for (const serviceId of [pending, takenDown, hidden]) {
      expect(await t.query(api.services.queries.getService, { serviceId })).toBeNull();
    }
  });

  it("getServiceCities counts public services by canonical city", async () => {
    const t = makeT();
    const owner = await provider(t);
    await seedService(t, { ownerId: owner, city: "Hofuf" });
    await seedService(t, { ownerId: owner, city: "Al Ahsa" });
    await seedService(t, { ownerId: owner, city: "Qatif", status: "suspended" });

    expect(await t.query(api.services.queries.getServiceCities, {})).toEqual([{ city: "Al Ahsa", count: 2 }]);
  });
});
