import { convexTest } from "convex-test";
import schema from "./schema";
import { modules } from "./test.setup";
import type { Id } from "./_generated/dataModel";

/**
 * Shared fixtures for the backend tests.
 *
 * These seed rows directly through `t.run` rather than through the public
 * mutations on purpose: convex-test cannot resolve the Better Auth component,
 * so anything that goes through `getAuthenticatedAppUser` is untestable here.
 * The tests exercise the service seams (`bookings/service.ts`, `users/sync.ts`,
 * `admin/service.ts`) which take an already-resolved user, and the auth path
 * itself is verified by hand against the dev deployment.
 */
export function makeT() {
  return convexTest(schema, modules);
}

export type TestT = ReturnType<typeof makeT>;

/** A fixed "today" in Riyadh so date assertions never depend on the clock. */
export const TODAY = "2026-09-03";
/** 2026-09-03T00:00 Riyadh == 2026-09-02T21:00Z. */
export const NOW = Date.UTC(2026, 8, 2, 21, 0, 0);

export async function seedUser(
  t: TestT,
  opts: {
    email?: string;
    phone?: string;
    phoneVerified?: boolean;
    role?: string;
    isApproved?: boolean;
    firstName?: string;
    lastName?: string;
    authId?: string;
    isSuspended?: boolean;
  } = {}
): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: opts.email ?? `user${Math.random().toString(36).slice(2, 8)}@example.com`,
      firstName: opts.firstName ?? "Test",
      lastName: opts.lastName ?? "User",
      phone: opts.phone,
      phoneVerified: opts.phoneVerified,
      role: opts.role ?? "tourist",
      isApproved: opts.isApproved,
      authId: opts.authId,
      isSuspended: opts.isSuspended,
      preferredLanguage: "ar",
      favoriteListingIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

export async function seedHotel(
  t: TestT,
  opts: {
    ownerId?: Id<"users">;
    pricePerNight?: number | null;
    maxGuests?: number;
    unitCount?: number;
    checkInTime?: string;
    checkOutTime?: string;
    status?: string;
    isActive?: boolean;
    type?: string;
    name_en?: string;
  } = {}
): Promise<Id<"listings">> {
  const price = opts.pricePerNight === null ? undefined : (opts.pricePerNight ?? 450);
  return await t.run(async (ctx) =>
    ctx.db.insert("listings", {
      type: opts.type ?? "hotel",
      name_en: opts.name_en ?? "Test Hotel",
      name_ar: "فندق تجريبي",
      category: "luxury_hotel",
      address: "Hofuf",
      city: "Hofuf",
      coordinates: { lat: 25.3854, lng: 49.5683 },
      ownerId: opts.ownerId,
      pricePerNight: price,
      currency: price === undefined ? undefined : "SAR",
      maxGuests: opts.maxGuests ?? 4,
      unitCount: opts.unitCount ?? 2,
      checkInTime: opts.checkInTime ?? "15:00",
      checkOutTime: opts.checkOutTime ?? "12:00",
      status: opts.status === undefined ? "approved" : opts.status || undefined,
      isActive: opts.isActive ?? true,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

export async function seedStay(
  t: TestT,
  opts: {
    userId: Id<"users">;
    listingId: Id<"listings">;
    ownerId?: Id<"users">;
    checkIn: string;
    checkOut: string;
    status?: string;
    guests?: number;
    pricePerNight?: number;
    totalAmount?: number;
    expiresAt?: number;
    confirmationCode?: string;
  }
): Promise<Id<"bookings">> {
  const nights = Math.round(
    (Date.parse(`${opts.checkOut}T00:00:00Z`) - Date.parse(`${opts.checkIn}T00:00:00Z`)) / 86_400_000
  );
  const rate = opts.pricePerNight ?? 450;
  return await t.run(async (ctx) =>
    ctx.db.insert("bookings", {
      userId: opts.userId,
      listingId: opts.listingId,
      ownerId: opts.ownerId,
      kind: "stay",
      type: "stay",
      date: opts.checkIn,
      time: "15:00",
      checkIn: opts.checkIn,
      checkOut: opts.checkOut,
      nights,
      guests: opts.guests ?? 2,
      partySize: opts.guests ?? 2,
      pricePerNight: rate,
      totalAmount: opts.totalAmount ?? nights * rate,
      currency: "SAR",
      confirmationCode: opts.confirmationCode ?? `HSO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      status: opts.status ?? "pending",
      expiresAt: opts.expiresAt,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

/**
 * A bookable service: an approved tour guide in Al Ahsa at 150 SAR an hour,
 * unless told otherwise. Pass `price: null` for a service that shows Contact.
 */
export async function seedService(
  t: TestT,
  opts: {
    ownerId: Id<"users">;
    status?: string;
    price?: number | null;
    priceUnit?: string;
    maxGroupSize?: number;
    city?: string;
    title_en?: string;
    title_ar?: string;
    serviceType?: string;
    contactPhone?: string;
  }
): Promise<Id<"services">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("services", {
      ownerId: opts.ownerId,
      serviceType: opts.serviceType ?? "tour_guide",
      title_en: opts.title_en ?? "Al Ahsa oasis tour",
      title_ar: opts.title_ar ?? "جولة واحة الأحساء",
      price: opts.price === null ? undefined : (opts.price ?? 150),
      priceUnit: opts.priceUnit ?? "per_hour",
      maxGroupSize: opts.maxGroupSize,
      city: opts.city ?? "Al Ahsa",
      contactPhone: opts.contactPhone,
      status: opts.status ?? "approved",
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

/**
 * A service booking as createServiceForUser writes it: date/time for the
 * legacy readers, checkIn/checkOut mirrored so the crons see it.
 */
export async function seedServiceBooking(
  t: TestT,
  opts: {
    userId: Id<"users">;
    serviceId: Id<"services">;
    ownerId: Id<"users">;
    date: string;
    time?: string;
    status?: string;
    quantity?: number;
    unitPrice?: number;
    priceUnit?: string;
    expiresAt?: number;
    partySize?: number;
    confirmationCode?: string;
  }
): Promise<Id<"bookings">> {
  const priceUnit = opts.priceUnit ?? "per_hour";
  const quantity = opts.quantity ?? 2;
  const unitPrice = opts.unitPrice ?? 150;
  const span = priceUnit === "per_day" ? quantity : 1;
  const checkOut = new Date(Date.parse(`${opts.date}T00:00:00Z`) + span * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return await t.run(async (ctx) =>
    ctx.db.insert("bookings", {
      userId: opts.userId,
      serviceId: opts.serviceId,
      ownerId: opts.ownerId,
      kind: "service",
      type: "service",
      date: opts.date,
      time: opts.time ?? "09:00",
      checkIn: opts.date,
      checkOut,
      quantity,
      unitPrice,
      priceUnit,
      totalAmount: unitPrice * (priceUnit === "per_hour" || priceUnit === "per_day" ? quantity : 1),
      currency: "SAR",
      guests: opts.partySize ?? 2,
      partySize: opts.partySize ?? 2,
      confirmationCode:
        opts.confirmationCode ?? `HSO-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      status: opts.status ?? "pending",
      expiresAt: opts.expiresAt,
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}

/** A legacy restaurant-style slot booking, for regression coverage. */
export async function seedSlot(
  t: TestT,
  opts: { userId: Id<"users">; listingId: Id<"listings">; date: string; time?: string; status?: string }
): Promise<Id<"bookings">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("bookings", {
      userId: opts.userId,
      listingId: opts.listingId,
      date: opts.date,
      time: opts.time ?? "19:00",
      status: opts.status ?? "pending",
      type: "reservation",
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}
