import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import {
  makeT,
  NOW,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedStay,
  seedUser,
  TODAY,
} from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { SERVICE_ERRORS } from "../services/logic";
import {
  bookingForViewer,
  computeProviderStats,
  providerBookingsForUser,
  providerContact,
  providerStatsForUser,
  providerStatsWindow,
  quoteServiceFor,
  serviceSummary,
  userBookingsForUser,
} from "./queries";

const DAY = "2026-09-10";

async function userDoc(t: TestT, id: Id<"users">): Promise<Doc<"users">> {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

/** A provider with one bookable service, and a traveller with a phone sign-up. */
async function scene(t: TestT, service: Omit<Parameters<typeof seedService>[1], "ownerId"> = {}) {
  const providerId = await seedUser(t, {
    role: "service_provider",
    isApproved: true,
    firstName: "Huda",
    lastName: "N",
    phone: "+966500000001",
  });
  const touristId = await seedUser(t, {
    phoneVerified: true,
    firstName: "Sara",
    lastName: "Q",
    phone: "+966500000002",
    // A phone sign-up's synthesised address, which no one should be shown.
    email: "966500000002@phone.hasio.xyz",
  });
  const serviceId = await seedService(t, { ownerId: providerId, title_en: "Oasis day tour", ...service });
  return { providerId, touristId, serviceId };
}

describe("serviceSummary", () => {
  it("carries what a booking card shows, with one image", () => {
    const service = {
      _id: "s1",
      title_en: "Oasis day tour",
      title_ar: "جولة",
      serviceType: "tour_guide",
      city: "Al Ahsa",
      images: ["a.jpg", "b.jpg", "c.jpg"],
      priceUnit: "per_hour",
      contactPhone: "+966500000009",
      description_en: "Long text that a list row has no use for",
    } as unknown as Doc<"services">;

    expect(serviceSummary(service)).toEqual({
      _id: "s1",
      title_en: "Oasis day tour",
      title_ar: "جولة",
      serviceType: "tour_guide",
      city: "Al Ahsa",
      images: ["a.jpg"],
      priceUnit: "per_hour",
      contactPhone: "+966500000009",
    });
  });

  it("is null for a listing booking, or a service that was deleted", () => {
    expect(serviceSummary(null)).toBeNull();
  });
});

describe("providerContact", () => {
  const owner = { firstName: "Huda", lastName: "N", phone: "+966500000001" } as Doc<"users">;

  it("shows the service's own contact number at any status", () => {
    const service = { contactPhone: "+966500000009" } as Doc<"services">;
    expect(providerContact(service, owner, "pending")).toEqual({
      firstName: "Huda",
      lastName: "N",
      phone: "+966500000009",
    });
  });

  it("shows the provider's personal number only once the booking is confirmed", () => {
    const service = { contactPhone: undefined } as Doc<"services">;
    expect(providerContact(service, owner, "pending")?.phone).toBeUndefined();
    expect(providerContact(service, owner, "declined")?.phone).toBeUndefined();
    expect(providerContact(service, owner, "confirmed")?.phone).toBe("+966500000001");
    expect(providerContact(service, owner, "completed")?.phone).toBe("+966500000001");
    // A contact number cleared to "" by the 1.0.2 form is no number.
    expect(providerContact({ contactPhone: "  " } as Doc<"services">, owner, "confirmed")?.phone).toBe("+966500000001");
    // The service is gone, but the booking still has a provider to call.
    expect(providerContact(null, owner, "confirmed")?.phone).toBe("+966500000001");
  });

  it("is null when there is no provider to show", () => {
    expect(providerContact({ contactPhone: "+966500000009" } as Doc<"services">, null, "confirmed")).toBeNull();
  });
});

describe("quoteServiceFor", () => {
  const owner = { role: "service_provider", isApproved: true, isSuspended: false };
  const service = { status: "approved", price: 150, priceUnit: "per_hour" } as Doc<"services">;
  const args = { date: "2026-09-04", time: "09:00", quantity: 2 };

  it("prices a bookable service the way the booking will", () => {
    expect(quoteServiceFor(service, owner, args, TODAY, NOW)).toMatchObject({
      ok: true,
      quote: { quantity: 2, totalAmount: 300, currency: "SAR", checkOut: "2026-09-05" },
    });
  });

  it("answers rather than throws when the service cannot be booked", () => {
    expect(quoteServiceFor(null, null, args, TODAY, NOW)).toEqual({
      ok: false,
      error: SERVICE_ERRORS.SERVICE_UNAVAILABLE,
    });
    expect(quoteServiceFor({ ...service, status: "pending" }, owner, args, TODAY, NOW)).toEqual({
      ok: false,
      error: SERVICE_ERRORS.SERVICE_UNAVAILABLE,
    });
    expect(quoteServiceFor(service, { ...owner, isSuspended: true }, args, TODAY, NOW)).toEqual({
      ok: false,
      error: SERVICE_ERRORS.SERVICE_UNAVAILABLE,
    });
    expect(quoteServiceFor({ ...service, price: undefined }, owner, args, TODAY, NOW)).toEqual({
      ok: false,
      error: SERVICE_ERRORS.NOT_BOOKABLE,
    });
    expect(quoteServiceFor(service, owner, { ...args, date: "2026-09-01" }, TODAY, NOW)).toEqual({
      ok: false,
      error: SERVICE_ERRORS.PAST_DATE,
    });
  });
});

describe("quoteService", () => {
  it("is public, and never throws for a service it cannot quote", async () => {
    const t = makeT();
    const { serviceId } = await scene(t);
    // Far enough ahead that the real clock cannot make it the past.
    const args = { serviceId, date: "2030-01-15", time: "09:00", quantity: 3, partySize: 2 };

    expect(await t.query(api.bookings.queries.quoteService, args)).toMatchObject({
      ok: true,
      quote: { totalAmount: 450, quantity: 3, partySize: 2, checkIn: "2030-01-15", checkOut: "2030-01-16" },
    });

    await t.run((ctx) => ctx.db.patch(serviceId, { status: "suspended" }));
    expect(await t.query(api.bookings.queries.quoteService, args)).toEqual({
      ok: false,
      error: SERVICE_ERRORS.SERVICE_UNAVAILABLE,
    });

    await t.run((ctx) => ctx.db.delete(serviceId));
    expect(await t.query(api.bookings.queries.quoteService, args)).toEqual({
      ok: false,
      error: SERVICE_ERRORS.SERVICE_UNAVAILABLE,
    });
  });
});

describe("userBookingsForUser", () => {
  async function both(t: TestT) {
    const s = await scene(t);
    const listingId = await seedHotel(t);
    const stayId = await seedStay(t, { userId: s.touristId, listingId, checkIn: DAY, checkOut: "2026-09-12" });
    const serviceBookingId = await seedServiceBooking(t, {
      userId: s.touristId,
      serviceId: s.serviceId,
      ownerId: s.providerId,
      date: DAY,
    });
    return { ...s, listingId, stayId, serviceBookingId };
  }

  it("shows a client that predates services only its stays, in the shape it knows", async () => {
    const t = makeT();
    const { touristId, stayId } = await both(t);
    const me = await userDoc(t, touristId);

    const rows = await t.run((ctx) => userBookingsForUser(ctx, me, {}));

    expect(rows.map((r) => r._id)).toEqual([stayId]);
    expect(rows[0].listing).toMatchObject({ name_en: "Test Hotel" });
    // No new key at all: the 1.0.2 app gets exactly what it got before.
    expect(Object.keys(rows[0])).not.toContain("service");
  });

  it("shows 1.1.0 both kinds, each row with its service or null", async () => {
    const t = makeT();
    const { touristId, stayId, serviceBookingId, serviceId } = await both(t);
    await t.run((ctx) => ctx.db.patch(serviceId, { images: ["a.jpg", "b.jpg"] }));
    const me = await userDoc(t, touristId);

    const rows = await t.run((ctx) => userBookingsForUser(ctx, me, { includeServices: true }));
    const byId = Object.fromEntries(rows.map((r) => [r._id, r]));

    expect(byId[serviceBookingId]).toMatchObject({
      kind: "service",
      listing: null,
      service: { _id: serviceId, title_en: "Oasis day tour", images: ["a.jpg"], priceUnit: "per_hour" },
    });
    expect(byId[stayId]).toMatchObject({ kind: "stay", service: null });
  });

  it("does not assume a service booking still has its service", async () => {
    const t = makeT();
    const { touristId, serviceBookingId, serviceId } = await both(t);
    await t.run((ctx) => ctx.db.delete(serviceId));
    const me = await userDoc(t, touristId);

    const rows = await t.run((ctx) => userBookingsForUser(ctx, me, { includeServices: true }));

    expect(rows.find((r) => r._id === serviceBookingId)).toMatchObject({ service: null, listing: null });
  });
});

describe("bookingForViewer", () => {
  async function serviceBooking(t: TestT, status = "pending", service: Parameters<typeof scene>[1] = {}) {
    const s = await scene(t, service);
    const bookingId = await seedServiceBooking(t, {
      userId: s.touristId,
      serviceId: s.serviceId,
      ownerId: s.providerId,
      date: DAY,
      status,
    });
    return { ...s, bookingId };
  }

  it("is not found for a client that predates services", async () => {
    const t = makeT();
    const { touristId, bookingId } = await serviceBooking(t);
    const me = await userDoc(t, touristId);

    expect(await t.run((ctx) => bookingForViewer(ctx, me, { bookingId }))).toBeNull();
  });

  it("gives the traveller the service and the provider, with the personal number only once confirmed", async () => {
    const t = makeT();
    const { touristId, bookingId, serviceId } = await serviceBooking(t, "pending");
    const me = await userDoc(t, touristId);

    const pending = await t.run((ctx) => bookingForViewer(ctx, me, { bookingId, includeServices: true }));
    expect(pending).toMatchObject({
      _id: bookingId,
      listing: null,
      guest: null,
      viewerRole: "guest",
      service: { _id: serviceId, title_en: "Oasis day tour" },
      provider: { firstName: "Huda", lastName: "N" },
    });
    expect(pending?.provider?.phone).toBeUndefined();

    await t.run((ctx) => ctx.db.patch(bookingId, { status: "confirmed" }));
    const confirmed = await t.run((ctx) => bookingForViewer(ctx, me, { bookingId, includeServices: true }));
    expect(confirmed?.provider?.phone).toBe("+966500000001");
  });

  it("shows the provider their booking as the provider, with the traveller to call", async () => {
    const t = makeT();
    const { providerId, bookingId } = await serviceBooking(t);
    const provider = await userDoc(t, providerId);

    const detail = await t.run((ctx) => bookingForViewer(ctx, provider, { bookingId, includeServices: true }));

    expect(detail).toMatchObject({
      viewerRole: "provider",
      // Placeholder address hidden, phone shown.
      guest: { firstName: "Sara", lastName: "Q", phone: "+966500000002", email: null },
    });
  });

  it("shows it to an admin, and to nobody else", async () => {
    const t = makeT();
    const { bookingId } = await serviceBooking(t);
    const admin = await userDoc(t, await seedUser(t, { role: "admin" }));
    const stranger = await userDoc(t, await seedUser(t, { role: "service_provider", isApproved: true }));

    expect(
      (await t.run((ctx) => bookingForViewer(ctx, admin, { bookingId, includeServices: true })))?.viewerRole
    ).toBe("admin");
    expect(await t.run((ctx) => bookingForViewer(ctx, stranger, { bookingId, includeServices: true }))).toBeNull();
  });

  it("still names the provider when the service was deleted", async () => {
    const t = makeT();
    const { touristId, providerId, bookingId, serviceId } = await serviceBooking(t, "completed");
    await t.run((ctx) => ctx.db.delete(serviceId));
    const me = await userDoc(t, touristId);
    const provider = await userDoc(t, providerId);

    expect(await t.run((ctx) => bookingForViewer(ctx, me, { bookingId, includeServices: true }))).toMatchObject({
      service: null,
      provider: { firstName: "Huda", phone: "+966500000001" },
    });
    // Ownership falls back to the booking's own record of it.
    expect(
      (await t.run((ctx) => bookingForViewer(ctx, provider, { bookingId, includeServices: true })))?.viewerRole
    ).toBe("provider");
  });

  it("keeps a listing booking exactly as it was, with or without the new argument", async () => {
    const t = makeT();
    const hostId = await seedUser(t, { role: "business_owner", isApproved: true });
    const touristId = await seedUser(t, { phoneVerified: true });
    const listingId = await seedHotel(t, { ownerId: hostId });
    const bookingId = await seedStay(t, { userId: touristId, listingId, checkIn: DAY, checkOut: "2026-09-12" });
    const host = await userDoc(t, hostId);

    const legacy = await t.run((ctx) => bookingForViewer(ctx, host, { bookingId }));
    expect(legacy).toMatchObject({ viewerRole: "host", listing: { _id: listingId } });
    expect(Object.keys(legacy!)).not.toContain("service");
    expect(Object.keys(legacy!)).not.toContain("provider");

    const current = await t.run((ctx) => bookingForViewer(ctx, host, { bookingId, includeServices: true }));
    expect(current).toMatchObject({ viewerRole: "host", service: null, provider: null });
  });
});

describe("providerBookingsForUser", () => {
  it("lists a provider's service bookings, newest first, with the service and the traveller", async () => {
    const t = makeT();
    const { providerId, touristId, serviceId } = await scene(t);
    const older = await seedServiceBooking(t, { userId: touristId, serviceId, ownerId: providerId, date: DAY });
    const newer = await seedServiceBooking(t, {
      userId: touristId,
      serviceId,
      ownerId: providerId,
      date: "2026-09-11",
      status: "confirmed",
    });
    const provider = await userDoc(t, providerId);

    const rows = await t.run((ctx) => providerBookingsForUser(ctx, provider, {}));

    expect(rows.map((r) => r._id)).toEqual([newer, older]);
    expect(rows[0]).toMatchObject({
      service: { _id: serviceId, title_en: "Oasis day tour" },
      tourist: { _id: touristId, firstName: "Sara", phone: "+966500000002", phoneVerified: true, email: null },
    });

    const confirmed = await t.run((ctx) => providerBookingsForUser(ctx, provider, { status: "confirmed" }));
    expect(confirmed.map((r) => r._id)).toEqual([newer]);
  });

  it("leaves out anything that is not a service booking", async () => {
    const t = makeT();
    const { providerId, touristId, serviceId } = await scene(t);
    // A provider an admin also made the host of a place.
    const listingId = await seedHotel(t, { ownerId: providerId });
    await seedStay(t, { userId: touristId, listingId, ownerId: providerId, checkIn: DAY, checkOut: "2026-09-12" });
    const serviceBookingId = await seedServiceBooking(t, { userId: touristId, serviceId, ownerId: providerId, date: DAY });
    const provider = await userDoc(t, providerId);

    const rows = await t.run((ctx) => providerBookingsForUser(ctx, provider, {}));

    expect(rows.map((r) => r._id)).toEqual([serviceBookingId]);
  });

  it("is empty for anyone who is not a service provider", async () => {
    const t = makeT();
    const { touristId } = await scene(t);
    const tourist = await userDoc(t, touristId);

    expect(await t.run((ctx) => providerBookingsForUser(ctx, tourist, {}))).toEqual([]);
  });
});

describe("computeProviderStats", () => {
  const row = (over: Partial<Doc<"bookings">>) => ({ date: DAY, ...over }) as Doc<"bookings">;

  it("counts this Riyadh month's work and what is still ahead", () => {
    const stats = computeProviderStats(
      {
        pending: [row({}), row({})],
        confirmed: [
          row({ checkIn: "2026-09-03", checkOut: "2026-09-04", totalAmount: 300 }),
          // Its checkOut is today: counted until the morning job completes it.
          row({ checkIn: "2026-09-02", checkOut: "2026-09-03", totalAmount: 200 }),
          row({ checkIn: "2026-09-01", checkOut: "2026-09-02", totalAmount: 100 }),
          row({ checkIn: "2026-10-01", checkOut: "2026-10-02", totalAmount: 900 }),
        ],
        completed: [
          row({ checkIn: "2026-09-01", checkOut: "2026-09-02", totalAmount: 450 }),
          row({ checkIn: "2026-08-31", checkOut: "2026-09-01", totalAmount: 1000 }),
        ],
      },
      4,
      "2026-09-03",
      "2026-09"
    );

    expect(stats).toEqual({
      pending: 2,
      upcoming: 3,
      completedMonth: 1,
      // Confirmed and completed both count, as for hosts: the money is owed
      // either way. August's and October's do not.
      revenueMonth: 300 + 200 + 100 + 450,
      services: 4,
      currency: "SAR",
    });
  });

  it("reads the month and today on the Riyadh clock", () => {
    // 23:59 on 31 August in Riyadh is 20:59 UTC; a minute later it is September.
    expect(providerStatsWindow(Date.UTC(2026, 7, 31, 20, 59))).toEqual({ today: "2026-08-31", month: "2026-08" });
    expect(providerStatsWindow(Date.UTC(2026, 7, 31, 21, 0))).toEqual({ today: "2026-09-01", month: "2026-09" });
  });
});

describe("providerStatsForUser", () => {
  it("adds up the provider's service bookings and services", async () => {
    const t = makeT();
    const { providerId, touristId, serviceId } = await scene(t);
    await seedService(t, { ownerId: providerId, status: "pending" });
    await seedServiceBooking(t, { userId: touristId, serviceId, ownerId: providerId, date: DAY });
    await seedServiceBooking(t, { userId: touristId, serviceId, ownerId: providerId, date: DAY, status: "confirmed" });
    await seedServiceBooking(t, {
      userId: touristId,
      serviceId,
      ownerId: providerId,
      date: "2026-09-01",
      status: "completed",
    });
    const provider = await userDoc(t, providerId);

    // Two hours at 150 each, in September: 300 confirmed + 300 completed.
    expect(await t.run((ctx) => providerStatsForUser(ctx, provider, NOW))).toEqual({
      pending: 1,
      upcoming: 1,
      completedMonth: 1,
      revenueMonth: 600,
      services: 2,
      currency: "SAR",
    });
  });

  it("leaves a host's stays out of a provider's numbers", async () => {
    const t = makeT();
    const { providerId, touristId } = await scene(t);
    const listingId = await seedHotel(t, { ownerId: providerId });
    await seedStay(t, { userId: touristId, listingId, ownerId: providerId, checkIn: DAY, checkOut: "2026-09-12" });
    const provider = await userDoc(t, providerId);

    expect(await t.run((ctx) => providerStatsForUser(ctx, provider, NOW))).toMatchObject({ pending: 0 });
  });

  it("is null for anyone who is not a service provider", async () => {
    const t = makeT();
    const hostId = await seedUser(t, { role: "business_owner", isApproved: true });
    const host = await userDoc(t, hostId);

    expect(await t.run((ctx) => providerStatsForUser(ctx, host, NOW))).toBeNull();
  });
});
