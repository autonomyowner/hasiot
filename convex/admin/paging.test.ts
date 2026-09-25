import { describe, expect, it } from "vitest";
import { makeT, NOW, seedHotel, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Id } from "../_generated/dataModel";
import { listActivityPage, listListingsPage, listUsersPage } from "./views";

/**
 * The paging bug (design 6 "Fixes" 3). These lists filtered each page *after*
 * .paginate(), so with 30 rows where only the last 5 match, the first page of
 * 10 came back empty while matches remained — and the panel said "no results".
 *
 * Every test here builds exactly that: the 5 matching rows are written first,
 * so newest-first they are the last 5, behind 25 that do not match.
 */

const firstPage = { numItems: 10, cursor: null };

async function listingsWhereOnlyTheOldestFiveMatch(
  t: TestT,
  match: { status?: string; city?: string; images?: boolean; hours?: boolean; type?: string }
): Promise<Id<"listings">[]> {
  const matching: Id<"listings">[] = [];
  for (let i = 0; i < 30; i++) {
    const isMatch = i < 5;
    const id = await seedHotel(t, {
      status: isMatch && match.status === "seed" ? "" : isMatch && match.status ? match.status : "approved",
      type: isMatch && match.type ? match.type : "hotel",
      name_en: `Listing ${i}`,
    });
    await t.run((ctx) =>
      ctx.db.patch(id, {
        city: isMatch && match.city ? match.city : "Dammam",
        images: isMatch && match.images ? ["https://img.example/1.webp"] : [],
        workingHours:
          isMatch && match.hours ? [{ day: "sunday", open: "09:00", close: "17:00" }] : undefined,
      })
    );
    if (isMatch) matching.push(id);
  }
  return matching;
}

describe("listListingsPage", () => {
  it("returns the five listings with photos on the first page", async () => {
    const t = makeT();
    const matching = await listingsWhereOnlyTheOldestFiveMatch(t, { images: true });

    const page = await t.run((ctx) => listListingsPage(ctx, { paginationOpts: firstPage, hasImages: true }));

    expect(page.page.map((l) => l._id).sort()).toEqual([...matching].sort());
    expect(page.isDone).toBe(true);
  });

  it("returns the five listings with no working hours when asked for those", async () => {
    const t = makeT();
    // The inverse: 25 with hours, 5 (the oldest) without.
    const without: Id<"listings">[] = [];
    for (let i = 0; i < 30; i++) {
      const id = await seedHotel(t, { name_en: `Listing ${i}` });
      if (i < 5) {
        without.push(id);
      } else {
        await t.run((ctx) =>
          ctx.db.patch(id, { workingHours: [{ day: "sunday", open: "09:00", close: "17:00" }] })
        );
      }
    }

    const page = await t.run((ctx) =>
      listListingsPage(ctx, { paginationOpts: firstPage, hasWorkingHours: false })
    );

    expect(page.page.map((l) => l._id).sort()).toEqual([...without].sort());
  });

  it("returns the five seed listings (no status) on the first page", async () => {
    const t = makeT();
    const matching = await listingsWhereOnlyTheOldestFiveMatch(t, { status: "seed" });

    const page = await t.run((ctx) => listListingsPage(ctx, { paginationOpts: firstPage, status: "seed" }));

    expect(page.page.map((l) => l._id).sort()).toEqual([...matching].sort());
  });

  it("returns the five listings of a city stored under its old sub-area", async () => {
    // Al Ahsa is also Hofuf; the index cannot answer that, so the filter must.
    const t = makeT();
    const matching = await listingsWhereOnlyTheOldestFiveMatch(t, { city: "Hofuf" });

    const page = await t.run((ctx) => listListingsPage(ctx, { paginationOpts: firstPage, city: "Al Ahsa" }));

    expect(page.page.map((l) => l._id).sort()).toEqual([...matching].sort());
  });

  it("combines a status index with a type filter", async () => {
    const t = makeT();
    const matching = await listingsWhereOnlyTheOldestFiveMatch(t, { type: "restaurant" });

    const page = await t.run((ctx) =>
      listListingsPage(ctx, { paginationOpts: firstPage, status: "approved", type: "restaurant" })
    );

    expect(page.page.map((l) => l._id).sort()).toEqual([...matching].sort());
  });
});

describe("listUsersPage", () => {
  it("returns the five suspended accounts on the first page, as table rows", async () => {
    const t = makeT();
    const suspended: Id<"users">[] = [];
    for (let i = 0; i < 30; i++) {
      const id = await seedUser(t, { isSuspended: i < 5 ? true : undefined, email: `u${i}@example.com` });
      if (i < 5) suspended.push(id);
    }

    const page = await t.run((ctx) => listUsersPage(ctx, { paginationOpts: firstPage, suspended: true }));

    expect(page.page.map((u) => u._id).sort()).toEqual([...suspended].sort());
    expect(page.page[0]).toMatchObject({ isSuspended: true, isPlaceholderEmail: false, role: "tourist" });
  });

  it("returns the five verified numbers on the first page", async () => {
    const t = makeT();
    const verified: Id<"users">[] = [];
    for (let i = 0; i < 30; i++) {
      const id = await seedUser(t, { phoneVerified: i < 5 ? true : undefined });
      if (i < 5) verified.push(id);
    }

    const page = await t.run((ctx) => listUsersPage(ctx, { paginationOpts: firstPage, phoneVerified: true }));
    expect(page.page.map((u) => u._id).sort()).toEqual([...verified].sort());

    // And the opposite filter counts "never verified" (undefined) as unverified.
    const unverified = await t.run((ctx) =>
      listUsersPage(ctx, { paginationOpts: { numItems: 50, cursor: null }, phoneVerified: false })
    );
    expect(unverified.page).toHaveLength(25);
  });
});

describe("listActivityPage", () => {
  it("returns the five rows about services on the first page", async () => {
    const t = makeT();
    const adminId = await seedUser(t, { role: "admin" });
    await t.run(async (ctx) => {
      for (let i = 0; i < 30; i++) {
        await ctx.db.insert("adminActivity", {
          adminId,
          adminEmail: "admin@hasio.test",
          action: i < 5 ? "service.approve" : "content.approve",
          targetType: i < 5 ? "service" : "listing",
          createdAt: NOW + i,
        });
      }
    });

    const page = await t.run((ctx) =>
      listActivityPage(ctx, { paginationOpts: firstPage, targetType: "service" })
    );

    expect(page.page).toHaveLength(5);
    expect(page.page.every((row) => row.targetType === "service")).toBe(true);
    // Still newest first.
    expect(page.page.map((row) => row.createdAt)).toEqual([4, 3, 2, 1, 0].map((i) => NOW + i));
  });
});
