import { describe, expect, it } from "vitest";
import { makeT, seedHotel, seedUser } from "../test.utils";
import { api } from "../_generated/api";
import { withoutSuspendedOwners } from "./queries";

describe("withoutSuspendedOwners", () => {
  it("hides the places of a suspended host and keeps everyone else's", async () => {
    // Design D15: suspending an account hides what it published, without an
    // admin having to take down each listing one by one.
    const t = makeT();
    const active = await seedUser(t, { role: "business_owner", isApproved: true });
    const banned = await seedUser(t, { role: "business_owner", isApproved: true, isSuspended: true });
    const kept = await seedHotel(t, { ownerId: active, name_en: "Kept" });
    const hidden = await seedHotel(t, { ownerId: banned, name_en: "Hidden" });
    const seed = await seedHotel(t, { name_en: "Seed" }); // no owner: seed data stays public

    const visible = await t.run(async (ctx) => {
      const rows = await ctx.db.query("listings").collect();
      return (await withoutSuspendedOwners(ctx, rows)).map((l) => l._id);
    });

    expect(visible).toEqual(expect.arrayContaining([kept, seed]));
    expect(visible).not.toContain(hidden);
  });
});

describe("public listing queries", () => {
  it("do not return a suspended host's place to a traveller", async () => {
    const t = makeT();
    const banned = await seedUser(t, { role: "business_owner", isApproved: true, isSuspended: true });
    const active = await seedUser(t, { role: "business_owner", isApproved: true });
    const hidden = await seedHotel(t, { ownerId: banned, name_en: "Hidden Inn" });
    const kept = await seedHotel(t, { ownerId: active, name_en: "Kept Inn" });

    // Anonymous: getAuthenticatedAppUser answers null, as it does for a guest.
    expect(await t.query(api.listings.queries.getListing, { listingId: hidden })).toBeNull();
    expect(await t.query(api.listings.queries.getListing, { listingId: kept })).not.toBeNull();

    const listed = await t.query(api.listings.queries.listListings, {});
    expect(listed.map((l) => l._id)).toEqual([kept]);

    const page = await t.query(api.listings.queries.listListingsPaginated, {
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page.map((l) => l._id)).toEqual([kept]);

    const found = await t.query(api.listings.queries.searchListings, { searchQuery: "Inn" });
    expect(found.map((l) => l._id)).toEqual([kept]);

    const near = await t.query(api.listings.queries.getListingsNearLocation, {
      lat: 25.3854,
      lng: 49.5683,
    });
    expect(near.map((l) => l._id)).toEqual([kept]);

    // The directory's counts agree with what it lists.
    const cities = await t.query(api.listings.queries.getCities, {});
    expect(cities).toEqual([{ city: "Hofuf", count: 1 }]);
    const categories = await t.query(api.listings.queries.getCategories, {});
    expect(categories).toEqual([expect.objectContaining({ category: "luxury_hotel", count: 1 })]);
  });
});
