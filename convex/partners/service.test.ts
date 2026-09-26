import { afterEach, describe, expect, it } from "vitest";
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
import { deleteAccountData } from "../users/mutations";
import {
  analyticsFor,
  getGuestFor,
  listGuestsFor,
  PARTNER_ERRORS,
  PARTNER_LIMITS,
  requirePartner,
  saveGuestNoteFor,
} from "./service";

// NOW is 2026-09-03 00:00 Riyadh.
const DAY = 86_400_000;
const daysAgo = (n: number) => NOW + 12 * 3600_000 - n * DAY; // midday Riyadh, n days back

async function load(t: TestT, id: Id<"users">): Promise<Doc<"users">> {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

async function patchBooking(t: TestT, id: Id<"bookings">, fields: Partial<Doc<"bookings">>) {
  await t.run((ctx) => ctx.db.patch(id, fields));
}

function refusedWith(text: string) {
  return (error: unknown) => error instanceof ConvexError && String(error.data) === text;
}

async function hostSetup() {
  const t = makeT();
  const host = await seedUser(t, { role: "business_owner", isApproved: true });
  const hotel = await seedHotel(t, { ownerId: host, name_en: "Palm Inn" });
  const guest = await seedUser(t, { firstName: "Nora", lastName: "Salem", phone: "+966501112222" });
  return { t, host, hotel, guest };
}

async function stay(
  t: TestT,
  o: { guest: Id<"users">; hotel: Id<"listings">; host: Id<"users">; status?: string; createdAt: number; checkIn?: string; nights?: number; respondedAt?: number; total?: number }
) {
  const checkIn = o.checkIn ?? "2026-09-10";
  const nights = o.nights ?? 2;
  const checkOut = new Date(Date.parse(`${checkIn}T00:00:00Z`) + nights * DAY).toISOString().slice(0, 10);
  const id = await seedStay(t, {
    userId: o.guest,
    listingId: o.hotel,
    ownerId: o.host,
    checkIn,
    checkOut,
    status: o.status,
    totalAmount: o.total,
  });
  await patchBooking(t, id, { createdAt: o.createdAt, respondedAt: o.respondedAt });
  return id;
}

afterEach(() => {
  PARTNER_LIMITS.bookings = 2000;
});

describe("requirePartner", () => {
  it("refuses a tourist, an unapproved owner and a suspended one", async () => {
    const t = makeT();
    const tourist = await seedUser(t);
    const pending = await seedUser(t, { role: "business_owner", isApproved: false });
    const suspended = await seedUser(t, { role: "service_provider", isApproved: true, isSuspended: true });
    for (const id of [tourist, pending, suspended]) {
      const user = await load(t, id);
      expect(() => requirePartner(user)).toThrow(ConvexError);
      await expect(
        t.run((ctx) => analyticsFor(ctx, user, { period: "30d", now: NOW }))
      ).rejects.toSatisfy(refusedWith(PARTNER_ERRORS.NOT_PARTNER));
    }
  });

  it("lets an approved provider and host through", async () => {
    const t = makeT();
    const a = await seedUser(t, { role: "service_provider", isApproved: true });
    const b = await seedUser(t, { role: "business_owner", isApproved: true });
    expect(() => requirePartner({ role: "service_provider", isApproved: true } as Doc<"users">)).not.toThrow();
    await t.run(async (ctx) => analyticsFor(ctx, (await ctx.db.get(a))!, { period: "30d", now: NOW }));
    await t.run(async (ctx) => analyticsFor(ctx, (await ctx.db.get(b))!, { period: "30d", now: NOW }));
  });

  it("keeps the exact refusal texts of the contract", () => {
    expect(PARTNER_ERRORS.NOT_PARTNER).toMatch(/This page is for approved partners only\.$/);
    expect(PARTNER_ERRORS.GUEST_NOT_FOUND).toMatch(/We could not find this guest\.$/);
    expect(PARTNER_ERRORS.NOTE_TOO_LONG).toMatch(/\(2000 characters at most\)\.$/);
    expect(PARTNER_ERRORS.BAD_TAGS).toMatch(/at most 10, each up to 24 characters\.$/);
  });
});

describe("analyticsFor", () => {
  it("splits kinds: a host sees stays, a provider sees services", async () => {
    const { t, host, hotel, guest } = await hostSetup();
    await stay(t, { guest, hotel, host, createdAt: daysAgo(1) });
    const service = await seedService(t, { ownerId: host });
    const sb = await seedServiceBooking(t, { userId: guest, serviceId: service, ownerId: host, date: "2026-09-10" });
    await patchBooking(t, sb, { createdAt: daysAgo(1) });

    const asHost = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, host), { period: "30d", now: NOW }));
    expect(asHost.totals.requests).toBe(1);
    expect(asHost.items.map((i) => i.kind)).toEqual(["listing"]);

    await t.run((ctx) => ctx.db.patch(host, { role: "service_provider" }));
    const asProvider = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, host), { period: "30d", now: NOW }));
    expect(asProvider.totals.requests).toBe(1);
    expect(asProvider.totals.nightsSold).toBe(0);
    expect(asProvider.items.map((i) => i.kind)).toEqual(["service"]);
  });

  it("counts by createdAt inside the window, compares to the window before, and computes the headline numbers", async () => {
    const { t, host, hotel, guest } = await hostSetup();
    const other = await seedUser(t, { firstName: "Ali" });
    // In window (30d = 2026-08-05..2026-09-03)
    await stay(t, { guest, hotel, host, status: "confirmed", createdAt: daysAgo(2), respondedAt: daysAgo(2) + 10 * 60_000, total: 900, nights: 2 });
    await stay(t, { guest: other, hotel, host, status: "completed", createdAt: daysAgo(5), respondedAt: daysAgo(5) + 30 * 60_000, total: 1350, nights: 3 });
    await stay(t, { guest: other, hotel, host, status: "declined", createdAt: daysAgo(6), respondedAt: daysAgo(6) + 50 * 60_000 });
    await stay(t, { guest, hotel, host, status: "expired", createdAt: daysAgo(7) });
    await stay(t, { guest, hotel, host, status: "pending", createdAt: daysAgo(1) });
    await stay(t, { guest, hotel, host, status: "cancelled", createdAt: daysAgo(3) });
    // Previous window
    await stay(t, { guest: other, hotel, host, status: "confirmed", createdAt: daysAgo(40), total: 450, nights: 1 });
    // Too old for both
    await stay(t, { guest, hotel, host, status: "confirmed", createdAt: daysAgo(100), total: 5000 });

    const a = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, host), { period: "30d", now: NOW }));
    expect(a.from).toBe("2026-08-05");
    expect(a.to).toBe("2026-09-03");
    expect(a.bucket).toBe("day");
    expect(a.currency).toBe("SAR");
    expect(a.truncated).toBe(false);
    expect(a.outcomes).toEqual({ pending: 1, confirmed: 1, completed: 1, declined: 1, expired: 1, cancelled: 1, no_show: 0 });
    expect(a.totals.requests).toBe(6);
    expect(a.totals.confirmed).toBe(2);
    expect(a.totals.declined).toBe(1);
    expect(a.totals.revenue).toBe(2250);
    expect(a.totals.avgBookingValue).toBe(1125);
    expect(a.totals.acceptanceRate).toBeCloseTo(2 / 4);
    expect(a.totals.medianResponseMinutes).toBe(30);
    expect(a.totals.nightsSold).toBe(5);
    // other: earliest booking (day 40) is before the window → repeat; guest: earliest day 100 → repeat too
    expect(a.totals.repeatGuestShare).toBe(1);
    expect(a.previous.requests).toBe(1);
    expect(a.previous.revenue).toBe(450);
    expect(a.previous.acceptanceRate).toBe(1);
    expect(a.previous.medianResponseMinutes).toBeNull();

    expect(a.series).toHaveLength(30);
    expect(a.series[0].key).toBe("2026-08-05");
    expect(a.series[29]).toMatchObject({ key: "2026-09-03", label: "2026-09-03" });
    const sep1 = a.series.find((s) => s.key === "2026-09-01")!; // daysAgo(2) midday
    expect(sep1).toMatchObject({ requests: 1, confirmed: 1, revenue: 900 });

    expect(a.items).toHaveLength(1);
    expect(a.items[0]).toMatchObject({ kind: "listing", name_en: "Palm Inn", requests: 6, confirmed: 2, revenue: 2250 });
  });

  it("gives null rates when nothing was answered, and no repeat share without guests", async () => {
    const { t, host, hotel, guest } = await hostSetup();
    await stay(t, { guest, hotel, host, status: "pending", createdAt: daysAgo(1) });
    const a = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, host), { period: "30d", now: NOW }));
    expect(a.totals.acceptanceRate).toBeNull();
    expect(a.totals.avgBookingValue).toBeNull();
    expect(a.totals.medianResponseMinutes).toBeNull();
    expect(a.totals.repeatGuestShare).toBe(0);
    expect(a.previous.repeatGuestShare).toBeNull();
  });

  it("buckets 90 days by Riyadh Monday and 12 months by month", async () => {
    const { t, host, hotel, guest } = await hostSetup();
    await stay(t, { guest, hotel, host, status: "confirmed", createdAt: daysAgo(2), total: 100 });
    const w = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, host), { period: "90d", now: NOW }));
    expect(w.bucket).toBe("week");
    expect(w.from).toBe("2026-06-06");
    // 2026-06-06 is a Saturday → its Monday is 2026-06-01; 2026-09-03 is a Thursday → 2026-08-31
    expect(w.series[0].key).toBe("2026-06-01");
    expect(w.series[w.series.length - 1].key).toBe("2026-08-31");
    expect(w.series.find((s) => s.key === "2026-08-31")!.revenue).toBe(100);

    const m = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, host), { period: "12m", now: NOW }));
    expect(m.bucket).toBe("month");
    expect(m.from).toBe("2025-10-01");
    expect(m.series.map((s) => s.key)).toHaveLength(12);
    expect(m.series[0].key).toBe("2025-10");
    expect(m.series[11]).toMatchObject({ key: "2026-09", requests: 1, revenue: 100 });
  });

  it("lists every owned item, with zero when unbooked, and all-time ratings", async () => {
    const t = makeT();
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const s1 = await seedService(t, { ownerId: provider, title_en: "Tour" });
    const s2 = await seedService(t, { ownerId: provider, title_en: "Photos" });
    const named = await seedUser(t, { firstName: "Huda", lastName: "Ali" });
    const anon = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("reviews", { userId: named, serviceId: s1, rating: 5, content: "Great", createdAt: NOW - 5 * DAY, updatedAt: NOW });
      await ctx.db.insert("reviews", { userId: anon, serviceId: s1, rating: 3, isAnonymous: true, createdAt: NOW - 400 * DAY, updatedAt: NOW });
    });
    const a = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, provider), { period: "30d", now: NOW }));
    expect(a.items).toHaveLength(2);
    const photos = a.items.find((i) => i.name_en === "Photos")!;
    expect(photos).toMatchObject({ requests: 0, confirmed: 0, revenue: 0, rating: null, reviewCount: 0 });
    expect(a.items.find((i) => i.id === s1)).toMatchObject({ rating: 4, reviewCount: 2 });
    expect(a.ratings.average).toBe(4);
    expect(a.ratings.count).toBe(2);
    expect(a.ratings.distribution).toEqual([0, 0, 1, 0, 1]);
    expect(a.ratings.latest[0]).toMatchObject({ rating: 5, content: "Great", guestName: "Huda Ali", itemName_en: "Tour" });
    expect(a.ratings.latest[1]).toMatchObject({ rating: 3, content: null, guestName: null });
    void s2;
  });

  it("says truncated when the cap came back full", async () => {
    const { t, host, hotel, guest } = await hostSetup();
    PARTNER_LIMITS.bookings = 2;
    await stay(t, { guest, hotel, host, createdAt: daysAgo(1) });
    await stay(t, { guest, hotel, host, createdAt: daysAgo(2) });
    const a = await t.run(async (ctx) => analyticsFor(ctx, await ctxUser(ctx, host), { period: "30d", now: NOW }));
    expect(a.truncated).toBe(true);
    const g = await t.run(async (ctx) => listGuestsFor(ctx, await ctxUser(ctx, host), {}));
    expect(g.truncated).toBe(true);
  });
});

describe("listGuestsFor", () => {
  async function crm() {
    const { t, host, hotel, guest } = await hostSetup();
    const ali = await seedUser(t, { firstName: "Ali", lastName: "Omar", phone: "+966555000111" });
    await stay(t, { guest, hotel, host, status: "completed", createdAt: daysAgo(50), checkIn: "2026-07-20", total: 900 });
    await stay(t, { guest, hotel, host, status: "declined", createdAt: daysAgo(3), total: 900 });
    await stay(t, { guest: ali, hotel, host, status: "confirmed", createdAt: daysAgo(10), checkIn: "2026-09-20", total: 3000 });
    await stay(t, { guest: ali, hotel, host, status: "confirmed", createdAt: daysAgo(9), checkIn: "2026-09-25", total: 100 });
    await stay(t, { guest: ali, hotel, host, status: "pending", createdAt: daysAgo(8) });
    // A service booking by a third user, never visible to the host.
    const stranger = await seedUser(t, { firstName: "Zed" });
    const svc = await seedService(t, { ownerId: host });
    await seedServiceBooking(t, { userId: stranger, serviceId: svc, ownerId: host, date: "2026-09-10" });
    await t.run((ctx) =>
      ctx.db.insert("partnerGuestNotes", { ownerId: host, guestId: guest, note: "Likes quiet rooms", tags: ["VIP"], updatedAt: NOW })
    );
    return { t, host, guest, ali, stranger };
  }

  it("groups one row per guest with counts, spend and last visit", async () => {
    const { t, host, guest, ali } = await crm();
    const { guests } = await t.run(async (ctx) => listGuestsFor(ctx, await ctxUser(ctx, host), {}));
    expect(guests.map((g) => g.guestId)).toEqual([guest, ali]); // recent: guest's last request is newest
    expect(guests[0]).toMatchObject({ name: "Nora Salem", phone: "+966501112222", bookings: 2, completed: 1, spent: 900, lastVisit: "2026-07-20", tags: ["VIP"], hasNote: true });
    expect(guests[0].firstAt).toBe(daysAgo(50));
    expect(guests[0].lastAt).toBe(daysAgo(3));
    expect(guests[1]).toMatchObject({ name: "Ali Omar", bookings: 3, completed: 0, spent: 3100, lastVisit: "2026-09-25", tags: [], hasNote: false });
  });

  it("sorts by spend and by bookings", async () => {
    const { t, host, guest, ali } = await crm();
    const spent = await t.run(async (ctx) => listGuestsFor(ctx, await ctxUser(ctx, host), { sort: "spent" }));
    expect(spent.guests.map((g) => g.guestId)).toEqual([ali, guest]);
    const count = await t.run(async (ctx) => listGuestsFor(ctx, await ctxUser(ctx, host), { sort: "bookings" }));
    expect(count.guests.map((g) => g.guestId)).toEqual([ali, guest]);
  });

  it("searches by name, case-folded, or phone digits, and filters by tag", async () => {
    const { t, host, guest, ali } = await crm();
    const run = (args: { search?: string; tag?: string }) =>
      t.run(async (ctx) => (await listGuestsFor(ctx, await ctxUser(ctx, host), args)).guests.map((g) => g.guestId));
    expect(await run({ search: "NORA" })).toEqual([guest]);
    expect(await run({ search: "555 000" })).toEqual([ali]);
    expect(await run({ search: "+966" })).toHaveLength(2);
    expect(await run({ tag: "vip" })).toEqual([guest]);
    expect(await run({ search: "nobody" })).toEqual([]);
  });
});

describe("getGuestFor", () => {
  it("returns the guest with their bookings with this partner, newest first", async () => {
    const { t, host, hotel, guest } = await hostSetup();
    await t.run((ctx) => ctx.db.patch(guest, { email: "966501112222@phone.hasio.xyz" }));
    const older = await stay(t, { guest, hotel, host, createdAt: daysAgo(9) });
    const newer = await stay(t, { guest, hotel, host, createdAt: daysAgo(2) });
    const g = await t.run(async (ctx) => getGuestFor(ctx, await ctxUser(ctx, host), guest));
    expect(g).toMatchObject({ guestId: guest, name: "Nora Salem", email: null, note: "", tags: [], noteUpdatedAt: null });
    expect(g.bookings.map((b) => b._id)).toEqual([newer, older]);
    expect(g.bookings[0]).toMatchObject({ kind: "stay", itemName_en: "Palm Inn", nights: 2 });
  });

  it("refuses a stranger, another partner's guest, and a guest only in the other kind", async () => {
    const { t, host, hotel, guest } = await hostSetup();
    const stranger = await seedUser(t);
    const otherHost = await seedUser(t, { role: "business_owner", isApproved: true });
    const otherHotel = await seedHotel(t, { ownerId: otherHost });
    const theirs = await seedUser(t);
    await stay(t, { guest: theirs, hotel: otherHotel, host: otherHost, createdAt: daysAgo(1) });
    const svc = await seedService(t, { ownerId: host });
    const serviceOnly = await seedUser(t);
    await seedServiceBooking(t, { userId: serviceOnly, serviceId: svc, ownerId: host, date: "2026-09-10" });
    void hotel;
    void guest;
    for (const id of [stranger, theirs, serviceOnly]) {
      await expect(
        t.run(async (ctx) => getGuestFor(ctx, await ctxUser(ctx, host), id))
      ).rejects.toSatisfy(refusedWith(PARTNER_ERRORS.GUEST_NOT_FOUND));
      await expect(
        t.run(async (ctx) => saveGuestNoteFor(ctx, await ctxUser(ctx, host), { guestId: id, note: "x", tags: [] }))
      ).rejects.toSatisfy(refusedWith(PARTNER_ERRORS.GUEST_NOT_FOUND));
    }
  });
});

describe("saveGuestNoteFor", () => {
  async function withGuest() {
    const s = await hostSetup();
    await stay(s.t, { guest: s.guest, hotel: s.hotel, host: s.host, createdAt: daysAgo(1) });
    return s;
  }
  const notes = (t: TestT) => t.run((ctx) => ctx.db.query("partnerGuestNotes").collect());

  it("trims, dedupes tags case-insensitively, drops empties, and updates in place", async () => {
    const { t, host, guest } = await withGuest();
    const save = (note: string, tags: string[]) =>
      t.run(async (ctx) => saveGuestNoteFor(ctx, await ctxUser(ctx, host), { guestId: guest, note, tags }));
    expect(await save("  quiet room  ", [" VIP ", "vip", "", "Family"])).toEqual({ ok: true });
    let rows = await notes(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ownerId: host, guestId: guest, note: "quiet room", tags: ["VIP", "Family"] });
    await save("changed", []);
    rows = await notes(t);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ note: "changed", tags: [] });
    const g = await t.run(async (ctx) => getGuestFor(ctx, await ctxUser(ctx, host), guest));
    expect(g.note).toBe("changed");
    expect(g.noteUpdatedAt).toEqual(expect.any(Number));
    await save("   ", ["  "]);
    expect(await notes(t)).toHaveLength(0);
  });

  it("refuses a long note and bad tags", async () => {
    const { t, host, guest } = await withGuest();
    const save = (note: string, tags: string[]) =>
      t.run(async (ctx) => saveGuestNoteFor(ctx, await ctxUser(ctx, host), { guestId: guest, note, tags }));
    await expect(save("a".repeat(2001), [])).rejects.toSatisfy(refusedWith(PARTNER_ERRORS.NOTE_TOO_LONG));
    await save("a".repeat(2000), []);
    await expect(save("", Array.from({ length: 11 }, (_, i) => `t${i}`))).rejects.toSatisfy(refusedWith(PARTNER_ERRORS.BAD_TAGS));
    await expect(save("", ["x".repeat(25)])).rejects.toSatisfy(refusedWith(PARTNER_ERRORS.BAD_TAGS));
  });
});

describe("deleteAccountData and partner notes", () => {
  it("removes notes about a deleted guest and notes written by a deleted partner", async () => {
    const t = makeT();
    const host = await seedUser(t, { role: "business_owner", isApproved: true });
    const host2 = await seedUser(t, { role: "business_owner", isApproved: true });
    const guest = await seedUser(t);
    const guest2 = await seedUser(t);
    await t.run(async (ctx) => {
      await ctx.db.insert("partnerGuestNotes", { ownerId: host, guestId: guest, note: "a", tags: [], updatedAt: NOW });
      await ctx.db.insert("partnerGuestNotes", { ownerId: host2, guestId: guest, note: "b", tags: [], updatedAt: NOW });
      await ctx.db.insert("partnerGuestNotes", { ownerId: host, guestId: guest2, note: "c", tags: [], updatedAt: NOW });
      await ctx.db.insert("partnerGuestNotes", { ownerId: host2, guestId: guest2, note: "d", tags: [], updatedAt: NOW });
    });
    await t.run(async (ctx) => deleteAccountData(ctx, (await ctx.db.get(guest))!, NOW));
    await t.run(async (ctx) => deleteAccountData(ctx, (await ctx.db.get(host))!, NOW));
    const left = await t.run((ctx) => ctx.db.query("partnerGuestNotes").collect());
    expect(left.map((r) => r.note)).toEqual(["d"]);
  });
});

async function ctxUser(ctx: { db: { get: (id: Id<"users">) => Promise<Doc<"users"> | null> } }, id: Id<"users">) {
  return (await ctx.db.get(id))!;
}
