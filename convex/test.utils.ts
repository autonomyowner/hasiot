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
