import { v } from "convex/values";
import { isHHMM } from "../lib/dates";

/**
 * Nightly pricing on a listing.
 *
 * `priceRange` already existed, but it is a free-text display tier — hosts
 * have typed "400", "300-500 SAR" and "$$" into it — so nothing can multiply
 * it by a number of nights. These fields are what make a stay quotable, and a
 * listing without `pricePerNight` simply is not bookable.
 */

export const PRICING_ARGS = {
  pricePerNight: v.optional(v.number()),
  currency: v.optional(v.string()),
  maxGuests: v.optional(v.number()),
  unitCount: v.optional(v.number()),
  checkInTime: v.optional(v.string()),
  checkOutTime: v.optional(v.string()),
};

export type PricingArgs = {
  pricePerNight?: number;
  currency?: string;
  maxGuests?: number;
  unitCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
};

// A nightly rate above this is far likelier to be a typo (an extra zero, or a
// monthly figure) than a real price, and a guest should not be quoted it.
const MAX_PRICE_PER_NIGHT = 100_000;
const MAX_GUESTS = 20;
const MAX_UNITS = 500;

export function validatePricing(args: PricingArgs): void {
  if (args.pricePerNight !== undefined) {
    if (
      !Number.isFinite(args.pricePerNight) ||
      args.pricePerNight <= 0 ||
      args.pricePerNight > MAX_PRICE_PER_NIGHT
    ) {
      throw new Error(
        `أدخل سعرًا صحيحًا بين 1 و ${MAX_PRICE_PER_NIGHT} ريال. / Enter a valid nightly price between 1 and ${MAX_PRICE_PER_NIGHT} SAR.`
      );
    }
    if (!Number.isInteger(args.pricePerNight)) {
      throw new Error("السعر يجب أن يكون رقمًا صحيحًا. / The nightly price must be a whole number.");
    }
  }

  // Only SAR for now. Multi-currency is a display concern that needs a rate
  // source; accepting a currency we cannot convert would produce totals that
  // silently mean the wrong thing.
  if (args.currency !== undefined && args.currency !== "SAR") {
    throw new Error("العملة المدعومة حاليًا هي الريال السعودي فقط. / Only SAR is supported.");
  }

  if (args.maxGuests !== undefined) {
    if (!Number.isInteger(args.maxGuests) || args.maxGuests < 1 || args.maxGuests > MAX_GUESTS) {
      throw new Error(
        `الحد الأقصى للضيوف بين 1 و ${MAX_GUESTS}. / Max guests must be between 1 and ${MAX_GUESTS}.`
      );
    }
  }

  if (args.unitCount !== undefined) {
    if (!Number.isInteger(args.unitCount) || args.unitCount < 1 || args.unitCount > MAX_UNITS) {
      throw new Error(
        `عدد الوحدات بين 1 و ${MAX_UNITS}. / Unit count must be between 1 and ${MAX_UNITS}.`
      );
    }
  }

  for (const [label, value] of [
    ["وقت الوصول / Check-in time", args.checkInTime],
    ["وقت المغادرة / Check-out time", args.checkOutTime],
  ] as const) {
    if (value !== undefined && !isHHMM(value)) {
      throw new Error(`${label}: أدخل الوقت بصيغة HH:MM. / must be in HH:MM format.`);
    }
  }
}

/** Fill in the currency whenever a price is set, so the two never drift apart. */
export function withPricingDefaults<T extends PricingArgs>(args: T): T & { currency?: string } {
  if (args.pricePerNight !== undefined && args.currency === undefined) {
    return { ...args, currency: "SAR" };
  }
  return args;
}

type BookableListing = {
  type: string;
  pricePerNight?: number;
  isActive?: boolean;
  status?: string;
};

/**
 * Can a guest book a stay here?
 *
 * Stricter than `isPublicListing`: a listing can be perfectly visible in the
 * directory and still not take bookings, because the host has not set a rate.
 * The Book button keys off this, so it never opens a sheet that cannot quote.
 */
export function isBookableStay(listing: BookableListing): boolean {
  if (listing.type !== "hotel") return false;
  if (typeof listing.pricePerNight !== "number" || listing.pricePerNight <= 0) return false;
  if (listing.isActive === false) return false;
  // undefined means seed data, which predates the approval flow.
  if (listing.status !== undefined && listing.status !== "approved") return false;
  return true;
}
