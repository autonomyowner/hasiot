import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import {
  makeT,
  NOW,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedSlot,
  seedStay,
  seedUser,
  TODAY,
} from "../test.utils";
import { BOOKING_ERRORS, PENDING_TTL_MS } from "./logic";
import { SERVICE_ERRORS } from "../services/logic";
import { riyadhDateTimeToTimestamp } from "../lib/dates";
import {
  cancelAsTourist,
  completeAsManager,
  confirmAsManager,
  createServiceForUser,
  createSlotForUser,
  createStayForUser,
  declineAsManager,
} from "./service";
import type { Doc, Id } from "../_generated/dataModel";
import type { TestT } from "../test.utils";

const IN = "2026-09-10";
const OUT = "2026-09-13";

async function guest(t: TestT, over: Parameters<typeof seedUser>[1] = {}) {
  const id = await seedUser(t, { phoneVerified: true, ...over });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

function book(
  t: TestT,
  user: Doc<"users">,
  listingId: Id<"listings">,
  over: Partial<{ checkIn: string; checkOut: string; guests: number; notes: string }> = {}
) {
  return t.run((ctx) =>
    createStayForUser(ctx, user, { listingId, checkIn: IN, checkOut: OUT, guests: 2, ...over }, NOW)
  );
}

describe("createStayForUser", () => {
  it("writes the booking the guest asked for, priced by the server", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t, { pricePerNight: 650 });

    const { bookingId, confirmationCode } = await book(t, user, listingId);
    const booking = (await t.run((ctx) => ctx.db.get(bookingId)))!;

    expect(booking).toMatchObject({
      kind: "stay",
      status: "pending",
      checkIn: IN,
      checkOut: OUT,
      nights: 3,
      guests: 2,
      pricePerNight: 650,
      totalAmount: 1950,
      currency: "SAR",
    });
    expect(confirmationCode).toMatch(/^HSO-[A-Z2-9]{5}$/);
    expect(booking.confirmationCode).toBe(confirmationCode);
  });

  it("mirrors date and time so the legacy indexes and admin grouping keep working", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t, { checkInTime: "14:00" });

    const { bookingId } = await book(t, user, listingId);
    const booking = (await t.run((ctx) => ctx.db.get(bookingId)))!;

    expect(booking.date).toBe(IN);
    expect(booking.time).toBe("14:00");
  });

  it("gives the host 48 hours to answer", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t);

    const { bookingId } = await book(t, user, listingId);
    const booking = (await t.run((ctx) => ctx.db.get(bookingId)))!;

    expect(booking.expiresAt).toBe(NOW + PENDING_TTL_MS);
  });

  it("denormalises the owner so their inbox is one index read", async () => {
    const t = makeT();
    const user = await guest(t);
    const ownerId = await seedUser(t, { role: "business_owner", isApproved: true });
    const listingId = await seedHotel(t, { ownerId });

    const { bookingId } = await book(t, user, listingId);
    const booking = (await t.run((ctx) => ctx.db.get(bookingId)))!;

    expect(booking.ownerId).toBe(ownerId);
  });

  it("notifies the host, and stays silent when the listing has no owner", async () => {
    const t = makeT();
    const user = await guest(t);
    const ownerId = await seedUser(t, { role: "business_owner", isApproved: true });

    await book(t, user, await seedHotel(t, { ownerId }));
    let inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ userId: ownerId, type: "booking.requested" });

    // Seeded Al-Ahsa listings have no owner. That is normal demo data, not a
    // reason to fail the booking.
    await book(t, user, await seedHotel(t, { name_en: "Ownerless" }), { checkIn: "2026-10-01", checkOut: "2026-10-03" });
    inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox).toHaveLength(1);
  });

  it("requires a verified phone", async () => {
    const t = makeT();
    const user = await guest(t, { phoneVerified: false });
    const listingId = await seedHotel(t);

    await expect(book(t, user, listingId)).rejects.toThrow(BOOKING_ERRORS.PHONE_REQUIRED);
  });

  it("will not let a host book their own place", async () => {
    const t = makeT();
    const owner = await guest(t, { role: "business_owner", isApproved: true });
    const listingId = await seedHotel(t, { ownerId: owner._id });

    await expect(book(t, owner, listingId)).rejects.toThrow(BOOKING_ERRORS.OWN_LISTING);
  });

  it("refuses listings that are not open for booking", async () => {
    const t = makeT();
    const user = await guest(t);

    for (const listing of [
      { pricePerNight: null },
      { status: "pending" },
      { status: "suspended" },
      { isActive: false },
      { type: "restaurant" },
    ] as const) {
      const listingId = await seedHotel(t, listing);
      await expect(book(t, user, listingId)).rejects.toThrow(BOOKING_ERRORS.NOT_BOOKABLE);
    }
  });

  it("rejects dates the quote refuses", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t);

    await expect(book(t, user, listingId, { checkIn: "2026-09-01" })).rejects.toThrow(
      BOOKING_ERRORS.PAST_CHECK_IN
    );
    await expect(book(t, user, listingId, { checkOut: IN })).rejects.toThrow(
      BOOKING_ERRORS.CHECKOUT_BEFORE_CHECKIN
    );
    await expect(book(t, user, listingId, { guests: 99 })).rejects.toThrow(
      BOOKING_ERRORS.TOO_MANY_GUESTS
    );
  });

  it("lets a booking start today in Riyadh", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t);

    // NOW is 21:00 UTC, which is already tomorrow's date in Riyadh — a naive
    // UTC comparison would call this a past booking.
    await expect(
      book(t, user, listingId, { checkIn: TODAY, checkOut: "2026-09-05" })
    ).resolves.toBeTruthy();
  });
});

describe("availability", () => {
  it("stops the last unit being sold twice", async () => {
    const t = makeT();
    const first = await guest(t, { email: "a@example.com" });
    const second = await guest(t, { email: "b@example.com" });
    const listingId = await seedHotel(t, { unitCount: 1 });

    await book(t, first, listingId);
    await expect(book(t, second, listingId, { checkIn: "2026-09-11", checkOut: "2026-09-12" })).rejects.toThrow(
      BOOKING_ERRORS.NO_AVAILABILITY
    );
  });

  it("sells every unit before refusing", async () => {
    const t = makeT();
    const listingId = await seedHotel(t, { unitCount: 2 });
    const a = await guest(t, { email: "a@example.com" });
    const b = await guest(t, { email: "b@example.com" });
    const c = await guest(t, { email: "c@example.com" });

    await book(t, a, listingId);
    await book(t, b, listingId);
    await expect(book(t, c, listingId)).rejects.toThrow(BOOKING_ERRORS.NO_AVAILABILITY);
  });

  it("allows a same-day turnover", async () => {
    const t = makeT();
    const listingId = await seedHotel(t, { unitCount: 1 });
    const a = await guest(t, { email: "a@example.com" });
    const b = await guest(t, { email: "b@example.com" });

    await book(t, a, listingId);
    // One guest leaves on the 13th, the next arrives on the 13th.
    await expect(book(t, b, listingId, { checkIn: OUT, checkOut: "2026-09-16" })).resolves.toBeTruthy();
  });

  it("frees the unit once a booking is declined, cancelled or expired", async () => {
    const t = makeT();
    const owner = await seedUser(t, { role: "business_owner" });
    const listingId = await seedHotel(t, { unitCount: 1, ownerId: owner });
    const a = await guest(t, { email: "a@example.com" });
    const b = await guest(t, { email: "b@example.com" });

    const { bookingId } = await book(t, a, listingId);
    const booking = (await t.run((ctx) => ctx.db.get(bookingId)))!;
    await t.run((ctx) => declineAsManager(ctx, booking, "Fully booked", NOW));

    await expect(book(t, b, listingId)).resolves.toBeTruthy();
  });

  it("treats an unlimited listing as always available", async () => {
    const t = makeT();
    const listingId = await t.run((ctx) =>
      ctx.db.insert("listings", {
        type: "hotel",
        name_en: "Unlimited",
        name_ar: "بلا حد",
        category: "hotel",
        address: "Hofuf",
        city: "Hofuf",
        coordinates: { lat: 25.3854, lng: 49.5683 },
        pricePerNight: 300,
        currency: "SAR",
        status: "approved",
        isActive: true,
        createdAt: NOW,
        updatedAt: NOW,
      })
    );
    const a = await guest(t, { email: "a@example.com" });
    const b = await guest(t, { email: "b@example.com" });

    await book(t, a, listingId);
    await expect(book(t, b, listingId)).resolves.toBeTruthy();
  });

  it("tells a guest re-submitting the same dates that they already booked", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t, { unitCount: 5 });

    await book(t, user, listingId);
    // "No availability" would be a lie — there are four units left.
    await expect(book(t, user, listingId)).rejects.toThrow(BOOKING_ERRORS.DUPLICATE);
  });

  it("ignores slot bookings when counting stay availability", async () => {
    const t = makeT();
    const user = await guest(t);
    const other = await seedUser(t);
    const listingId = await seedHotel(t, { unitCount: 1 });

    await seedSlot(t, { userId: other, listingId, date: IN });
    await expect(book(t, user, listingId)).resolves.toBeTruthy();
  });
});

describe("host responses", () => {
  async function pendingStay(t: TestT) {
    const user = await guest(t);
    const ownerId = await seedUser(t, { role: "business_owner", email: "owner@example.com" });
    const listingId = await seedHotel(t, { ownerId });
    const { bookingId } = await book(t, user, listingId);
    return { bookingId, userId: user._id, ownerId };
  }

  const load = (t: TestT, id: Id<"bookings">) => t.run((ctx) => ctx.db.get(id))!;

  it("confirms a pending request and tells the guest", async () => {
    const t = makeT();
    const { bookingId, userId } = await pendingStay(t);

    await t.run(async (ctx) => confirmAsManager(ctx, (await ctx.db.get(bookingId))!, NOW));

    const booking = await load(t, bookingId);
    expect(booking).toMatchObject({ status: "confirmed", respondedAt: NOW });

    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox[inbox.length - 1]).toMatchObject({ userId, type: "booking.confirmed" });
  });

  it("declines with a reason the guest can read", async () => {
    const t = makeT();
    const { bookingId, userId } = await pendingStay(t);

    await t.run(async (ctx) =>
      declineAsManager(ctx, (await ctx.db.get(bookingId))!, "  Renovation until October  ", NOW)
    );

    const booking = await load(t, bookingId);
    expect(booking).toMatchObject({
      status: "declined",
      declineReason: "Renovation until October",
      respondedAt: NOW,
    });

    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox[inbox.length - 1]).toMatchObject({ userId, type: "booking.declined" });
  });

  it("answers a request only once", async () => {
    const t = makeT();
    const { bookingId } = await pendingStay(t);

    await t.run(async (ctx) => confirmAsManager(ctx, (await ctx.db.get(bookingId))!, NOW));

    // A second tap on Confirm, or a Decline after a Confirm, must not reopen it.
    await expect(
      t.run(async (ctx) => confirmAsManager(ctx, (await ctx.db.get(bookingId))!, NOW))
    ).rejects.toThrow(BOOKING_ERRORS.NOT_PENDING);
    await expect(
      t.run(async (ctx) => declineAsManager(ctx, (await ctx.db.get(bookingId))!, undefined, NOW))
    ).rejects.toThrow(BOOKING_ERRORS.NOT_PENDING);
  });

  it("completes a stay and refuses to complete a closed one", async () => {
    const t = makeT();
    const { bookingId } = await pendingStay(t);

    await t.run(async (ctx) => completeAsManager(ctx, (await ctx.db.get(bookingId))!, "Left early", NOW));
    expect(await load(t, bookingId)).toMatchObject({
      status: "completed",
      completedAt: NOW,
      notes: "Left early",
    });

    await expect(
      t.run(async (ctx) => completeAsManager(ctx, (await ctx.db.get(bookingId))!, undefined, NOW))
    ).rejects.toThrow(BOOKING_ERRORS.ALREADY_CLOSED);
  });
});

describe("guest cancellation", () => {
  it("cancels before arrival and tells the host", async () => {
    const t = makeT();
    const user = await guest(t);
    const ownerId = await seedUser(t, { role: "business_owner", email: "owner@example.com" });
    const listingId = await seedHotel(t, { ownerId });
    const { bookingId } = await book(t, user, listingId);

    await t.run(async (ctx) =>
      cancelAsTourist(ctx, (await ctx.db.get(bookingId))!, "Change of plans", NOW)
    );

    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({
      status: "cancelled",
      cancellationReason: "Change of plans",
    });

    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox[inbox.length - 1]).toMatchObject({ userId: ownerId, type: "booking.cancelled" });
  });

  it("refuses once the stay has started", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t);
    // Check-in was yesterday: the room was held and the night may be owed, so
    // this is a conversation with the host, not a button.
    const bookingId = await seedStay(t, {
      userId: user._id,
      listingId,
      checkIn: "2026-09-02",
      checkOut: "2026-09-05",
      status: "confirmed",
    });

    await expect(
      t.run(async (ctx) => cancelAsTourist(ctx, (await ctx.db.get(bookingId))!, undefined, NOW))
    ).rejects.toThrow(BOOKING_ERRORS.STAY_STARTED);
  });

  it("refuses to cancel an already closed booking", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t);
    const bookingId = await seedStay(t, {
      userId: user._id,
      listingId,
      checkIn: IN,
      checkOut: OUT,
      status: "declined",
    });

    await expect(
      t.run(async (ctx) => cancelAsTourist(ctx, (await ctx.db.get(bookingId))!, undefined, NOW))
    ).rejects.toThrow(BOOKING_ERRORS.ALREADY_CLOSED);
  });

  it("does not notify anyone about a cancelled slot booking", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t, { type: "restaurant", pricePerNight: null });
    const bookingId = await seedSlot(t, { userId: user._id, listingId, date: "2026-09-20" });

    await t.run(async (ctx) => cancelAsTourist(ctx, (await ctx.db.get(bookingId))!, undefined, NOW));

    expect(await t.run((ctx) => ctx.db.query("notifications").collect())).toHaveLength(0);
  });
});

describe("createSlotForUser", () => {
  it("books a restaurant table", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t, { type: "restaurant", pricePerNight: null });

    const { bookingId, confirmationCode } = await t.run((ctx) =>
      createSlotForUser(ctx, user, { listingId, date: "2026-09-20", time: "19:00" }, NOW)
    );

    expect(confirmationCode).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(bookingId))).toMatchObject({
      kind: "slot",
      date: "2026-09-20",
      time: "19:00",
      status: "pending",
    });
  });

  it("refuses a listing that is not publicly visible", async () => {
    const t = makeT();
    const user = await guest(t);
    // Previously this checked only isActive, so a pending or rejected listing
    // could be booked by anyone who knew its id.
    const listingId = await seedHotel(t, { type: "restaurant", pricePerNight: null, status: "pending" });

    await expect(
      t.run((ctx) => createSlotForUser(ctx, user, { listingId, date: "2026-09-20", time: "19:00" }, NOW))
    ).rejects.toThrow(BOOKING_ERRORS.LISTING_UNAVAILABLE);
  });

  it("refuses a slot that has already passed in Riyadh", async () => {
    const t = makeT();
    const user = await guest(t);
    const listingId = await seedHotel(t, { type: "restaurant", pricePerNight: null });

    await expect(
      t.run((ctx) => createSlotForUser(ctx, user, { listingId, date: "2026-09-01", time: "19:00" }, NOW))
    ).rejects.toThrow(BOOKING_ERRORS.PAST_CHECK_IN);
  });

  it("does not double-book one table", async () => {
    const t = makeT();
    const user = await guest(t);
    const other = await seedUser(t);
    const listingId = await seedHotel(t, { type: "restaurant", pricePerNight: null });

    await seedSlot(t, { userId: other, listingId, date: "2026-09-20", time: "19:00" });
    await expect(
      t.run((ctx) => createSlotForUser(ctx, user, { listingId, date: "2026-09-20", time: "19:00" }, NOW))
    ).rejects.toThrow(/no longer available/);
  });
});

// --- service bookings (1.1.0) ---------------------------------------------

/** A day comfortably after TODAY, so the 48-hour window decides the expiry. */
const SERVICE_DAY = "2026-09-10";

async function refusalOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    // A person caused it and can fix it, so it must reach them as text:
    // production redacts anything that is not a ConvexError.
    expect(error).toBeInstanceOf(ConvexError);
    return String((error as ConvexError<string>).data);
  }
  throw new Error("expected a refusal");
}

async function offering(
  t: TestT,
  service: Omit<Parameters<typeof seedService>[1], "ownerId"> = {},
  owner: Parameters<typeof seedUser>[1] = {}
) {
  const ownerId = await seedUser(t, {
    role: "service_provider",
    isApproved: true,
    phoneVerified: true,
    firstName: "Huda",
    ...owner,
  });
  const serviceId = await seedService(t, { ownerId, ...service });
  return { ownerId, serviceId };
}

function bookService(
  t: TestT,
  user: Doc<"users">,
  serviceId: Id<"services">,
  over: Partial<{ date: string; time: string; quantity: number; partySize: number; notes: string }> = {},
  now: number = NOW
) {
  return t.run((ctx) =>
    createServiceForUser(
      ctx,
      user,
      { serviceId, date: SERVICE_DAY, time: "09:00", quantity: 3, partySize: 2, ...over },
      now
    )
  );
}

describe("createServiceForUser", () => {
  it("writes the request the traveller asked for, priced by the server", async () => {
    const t = makeT();
    const user = await guest(t);
    const { ownerId, serviceId } = await offering(t);

    const { bookingId, confirmationCode } = await bookService(t, user, serviceId, {
      notes: "  Pick us up at the hotel  ",
    });
    const booking = (await t.run((ctx) => ctx.db.get(bookingId)))!;

    expect(booking).toMatchObject({
      kind: "service",
      type: "service",
      serviceId,
      ownerId,
      userId: user._id,
      // date/time for the legacy readers, checkIn/checkOut for the crons.
      date: SERVICE_DAY,
      time: "09:00",
      checkIn: SERVICE_DAY,
      checkOut: "2026-09-11",
      quantity: 3,
      unitPrice: 150,
      priceUnit: "per_hour",
      totalAmount: 450,
      currency: "SAR",
      guests: 2,
      partySize: 2,
      notes: "Pick us up at the hotel",
      status: "pending",
      confirmationCode,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(booking.listingId).toBeUndefined();
    expect(confirmationCode).toMatch(/^HSO-[A-Z2-9]{5}$/);
  });

  it("spans a daily booking across its days, and charges a fixed price once", async () => {
    const t = makeT();
    const user = await guest(t);
    const daily = await offering(t, { price: 900, priceUnit: "per_day" });
    const fixed = await offering(t, { price: 700, priceUnit: "fixed" }, { email: "fixed@example.com" });

    const { bookingId: dailyId } = await bookService(t, user, daily.serviceId, { quantity: 3 });
    const { bookingId: fixedId } = await bookService(t, user, fixed.serviceId, { quantity: 5 });

    expect(await t.run((ctx) => ctx.db.get(dailyId))).toMatchObject({
      quantity: 3,
      totalAmount: 2700,
      checkIn: SERVICE_DAY,
      checkOut: "2026-09-13",
    });
    // Whatever quantity is sent, a fixed price is one price.
    expect(await t.run((ctx) => ctx.db.get(fixedId))).toMatchObject({
      quantity: 1,
      totalAmount: 700,
      priceUnit: "fixed",
      checkOut: "2026-09-11",
    });
  });

  it("keeps at most 500 characters of notes, and none that are blank", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t);

    const long = await bookService(t, user, serviceId, { notes: "x".repeat(600) });
    const blank = await bookService(t, user, serviceId, { notes: "   ", date: "2026-09-11" });

    expect((await t.run((ctx) => ctx.db.get(long.bookingId)))?.notes).toHaveLength(500);
    expect((await t.run((ctx) => ctx.db.get(blank.bookingId)))?.notes).toBeUndefined();
  });

  it("gives the provider 48 hours to answer a request for a later day", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t);

    const { bookingId } = await bookService(t, user, serviceId, { date: "2026-09-20" });

    expect((await t.run((ctx) => ctx.db.get(bookingId)))?.expiresAt).toBe(NOW + PENDING_TTL_MS);
  });

  it("closes an unanswered request when the service would have started, if that comes first", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t);

    // Today at 10:00 Riyadh is ten hours after NOW: a request still pending
    // then is one the provider never answered, and it must not sit there
    // looking alive for another day and a half.
    const { bookingId } = await bookService(t, user, serviceId, { date: TODAY, time: "10:00" });

    const start = riyadhDateTimeToTimestamp(TODAY, "10:00");
    expect(start).toBeLessThan(NOW + PENDING_TTL_MS);
    expect((await t.run((ctx) => ctx.db.get(bookingId)))?.expiresAt).toBe(start);
  });

  it("tells the provider, in their inbox, and nobody else", async () => {
    const t = makeT();
    const user = await guest(t, { firstName: "Sara", lastName: "Q" });
    const { ownerId, serviceId } = await offering(t, { title_en: "Oasis day tour" });

    const { bookingId } = await bookService(t, user, serviceId);

    const inbox = await t.run((ctx) => ctx.db.query("notifications").collect());
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ userId: ownerId, type: "booking.requested" });
    expect(inbox[0].data).toMatchObject({ bookingId, serviceId, audience: "owner", target: "provider-inbox" });
    expect(inbox[0].body_en).toContain("Oasis day tour");
    expect(inbox[0].body_en).toContain("Sara Q");
  });

  it("requires a verified phone before anything else", async () => {
    const t = makeT();
    const user = await guest(t, { phoneVerified: false });
    const { serviceId } = await offering(t);
    await t.run((ctx) => ctx.db.delete(serviceId));

    // The service is gone too, but the phone is what the traveller can fix.
    expect(await refusalOf(bookService(t, user, serviceId))).toBe(BOOKING_ERRORS.PHONE_REQUIRED);
  });

  it("shares the daily booking limit with stays, checked before the service", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t, { status: "suspended" });
    await t.run((ctx) =>
      ctx.db.insert("rateLimits", { key: `booking:${user._id}`, windowStart: Date.now(), count: 30 })
    );

    expect(await refusalOf(bookService(t, user, serviceId))).toMatch(/today's booking limit/);
  });

  it("refuses a service travellers cannot see", async () => {
    const t = makeT();
    const user = await guest(t);

    for (const status of ["pending", "rejected", "suspended"]) {
      const { serviceId } = await offering(t, { status }, { email: `${status}@example.com` });
      expect(await refusalOf(bookService(t, user, serviceId))).toBe(SERVICE_ERRORS.SERVICE_UNAVAILABLE);
    }

    // An account taken down takes its services with it.
    const { serviceId: ofSuspended } = await offering(t, {}, { isSuspended: true, email: "s@example.com" });
    expect(await refusalOf(bookService(t, user, ofSuspended))).toBe(SERVICE_ERRORS.SERVICE_UNAVAILABLE);

    const { serviceId: gone } = await offering(t, {}, { email: "gone@example.com" });
    await t.run((ctx) => ctx.db.delete(gone));
    expect(await refusalOf(bookService(t, user, gone))).toBe(SERVICE_ERRORS.SERVICE_UNAVAILABLE);
  });

  it("says the price is missing when that is all that is missing", async () => {
    const t = makeT();
    const user = await guest(t);

    const unpriced = await offering(t, { price: null });
    expect(await refusalOf(bookService(t, user, unpriced.serviceId))).toBe(SERVICE_ERRORS.NO_PRICE);

    // Priced, but the provider is not an approved provider: pricing it would
    // not help, so the price is not what the traveller is told about.
    const unapproved = await offering(t, {}, { isApproved: false, email: "u@example.com" });
    expect(await refusalOf(bookService(t, user, unapproved.serviceId))).toBe(SERVICE_ERRORS.NOT_BOOKABLE);

    const host = await offering(t, {}, { role: "business_owner", email: "h@example.com" });
    expect(await refusalOf(bookService(t, user, host.serviceId))).toBe(SERVICE_ERRORS.NOT_BOOKABLE);

    const both = await offering(t, { price: null }, { isApproved: false, email: "b@example.com" });
    expect(await refusalOf(bookService(t, user, both.serviceId))).toBe(SERVICE_ERRORS.NOT_BOOKABLE);
  });

  it("will not let a provider book their own service, after the bookability check", async () => {
    const t = makeT();
    const priced = await offering(t);
    const owner = (await t.run((ctx) => ctx.db.get(priced.ownerId)))!;

    expect(await refusalOf(bookService(t, owner, priced.serviceId))).toBe(SERVICE_ERRORS.OWN_SERVICE);
    // Before the quote: a past date on your own service is still your own service.
    expect(await refusalOf(bookService(t, owner, priced.serviceId, { date: "2026-09-01" }))).toBe(
      SERVICE_ERRORS.OWN_SERVICE
    );

    const unpriced = await seedService(t, { ownerId: priced.ownerId, price: null });
    expect(await refusalOf(bookService(t, owner, unpriced))).toBe(SERVICE_ERRORS.NO_PRICE);
  });

  it("refuses what the quote refuses, with the quote's words", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t, { maxGroupSize: 4 });
    const at1010 = NOW + (10 * 60 + 10) * 60_000;

    expect(await refusalOf(bookService(t, user, serviceId, { date: "2026-09-01" }))).toBe(SERVICE_ERRORS.PAST_DATE);
    expect(await refusalOf(bookService(t, user, serviceId, { time: "9am" }))).toBe(SERVICE_ERRORS.INVALID_TIME);
    expect(
      await refusalOf(bookService(t, user, serviceId, { date: TODAY, time: "10:00" }, at1010))
    ).toBe(SERVICE_ERRORS.PAST_TIME);
    expect(await refusalOf(bookService(t, user, serviceId, { quantity: 13 }))).toBe(SERVICE_ERRORS.INVALID_HOURS);
    expect(await refusalOf(bookService(t, user, serviceId, { partySize: 5 }))).toBe(SERVICE_ERRORS.TOO_MANY_PEOPLE);

    expect(await t.run((ctx) => ctx.db.query("bookings").collect())).toHaveLength(0);
  });

  it("checks the quote before the duplicate", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t);
    await bookService(t, user, serviceId);

    expect(await refusalOf(bookService(t, user, serviceId, { quantity: 13 }))).toBe(SERVICE_ERRORS.INVALID_HOURS);
  });
});

describe("one active request per service per day", () => {
  it("refuses a second request for the same day while the first is pending or confirmed", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t);

    const { bookingId } = await bookService(t, user, serviceId);
    // A double tap, or a retry after a dropped connection.
    expect(await refusalOf(bookService(t, user, serviceId, { time: "15:00" }))).toBe(SERVICE_ERRORS.DUPLICATE);

    await t.run((ctx) => ctx.db.patch(bookingId, { status: "confirmed" }));
    expect(await refusalOf(bookService(t, user, serviceId))).toBe(SERVICE_ERRORS.DUPLICATE);
  });

  it("lets the traveller ask again once the earlier request is closed", async () => {
    const t = makeT();
    const user = await guest(t);
    const { serviceId } = await offering(t);

    for (const status of ["cancelled", "declined", "expired"]) {
      const { bookingId } = await bookService(t, user, serviceId);
      await t.run((ctx) => ctx.db.patch(bookingId, { status }));
    }

    await expect(bookService(t, user, serviceId)).resolves.toBeTruthy();
  });

  it("allows another day, another service, and another traveller on the same day", async () => {
    const t = makeT();
    const user = await guest(t);
    const friend = await guest(t, { email: "friend@example.com" });
    const { ownerId, serviceId } = await offering(t);
    const other = await seedService(t, { ownerId, title_en: "Sunset photos" });

    await bookService(t, user, serviceId);
    await expect(bookService(t, user, serviceId, { date: "2026-09-11" })).resolves.toBeTruthy();
    await expect(bookService(t, user, other)).resolves.toBeTruthy();
    // No availability calendar (design D10): the provider declines if busy,
    // and two groups on one tour is normal.
    await expect(bookService(t, friend, serviceId)).resolves.toBeTruthy();
  });

  it("finds the earlier request among the traveller's own bookings, whatever the service's history", async () => {
    const t = makeT();
    const user = await guest(t);
    const { ownerId, serviceId } = await offering(t);
    const others = await guest(t, { email: "others@example.com" });
    for (let i = 0; i < 5; i++) {
      await seedServiceBooking(t, { userId: others._id, serviceId, ownerId, date: SERVICE_DAY, status: "completed" });
    }
    await seedServiceBooking(t, { userId: user._id, serviceId, ownerId, date: SERVICE_DAY, status: "pending" });

    expect(await refusalOf(bookService(t, user, serviceId))).toBe(SERVICE_ERRORS.DUPLICATE);
  });
});
