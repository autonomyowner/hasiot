import { ConvexError, v } from "convex/values";
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

/**
 * PRICING_ARGS for an edit, where `null` clears a field. `undefined` still
 * means "not sent, leave it alone" — the only way a form can say "remove the
 * nightly rate" without also saying "set it to something".
 */
export const CLEARABLE_PRICING_ARGS = {
  pricePerNight: v.optional(v.union(v.number(), v.null())),
  currency: v.optional(v.string()),
  maxGuests: v.optional(v.union(v.number(), v.null())),
  unitCount: v.optional(v.union(v.number(), v.null())),
  checkInTime: v.optional(v.union(v.string(), v.null())),
  checkOutTime: v.optional(v.union(v.string(), v.null())),
};

type Clearable<T> = { [K in keyof T]?: T[K] | null };

/** The values an edit asks to set, for validatePricing: a `null` has nothing to check. */
export function pricingToValidate(args: Clearable<PricingArgs>): PricingArgs {
  return {
    pricePerNight: args.pricePerNight ?? undefined,
    currency: args.currency ?? undefined,
    maxGuests: args.maxGuests ?? undefined,
    unitCount: args.unitCount ?? undefined,
    checkInTime: args.checkInTime ?? undefined,
    checkOutTime: args.checkOutTime ?? undefined,
  };
}

/**
 * The patch a listing edit writes.
 *
 * A field that was not sent is left out, so an edit never blanks what it did
 * not mention; `null` becomes `undefined`, which a Convex patch treats as
 * "remove the field". The currency follows the price both ways — attached
 * when a price is set, removed when it is cleared — so a listing never shows
 * a currency with no rate, or a rate with no currency.
 */
export function listingEditPatch(updates: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) continue;
    patch[key] = value === null ? undefined : value;
  }
  if (updates.pricePerNight === null) {
    patch.currency = undefined;
  } else if (updates.pricePerNight !== undefined && updates.currency === undefined) {
    patch.currency = "SAR";
  }
  return patch;
}

// A nightly rate above this is far likelier to be a typo (an extra zero, or a
// monthly figure) than a real price, and a guest should not be quoted it.
const MAX_PRICE_PER_NIGHT = 100_000;
const MAX_GUESTS = 20;
const MAX_UNITS = 500;

/**
 * Check the pricing fields that were sent. Absent fields are not checked, so
 * an update may send any subset.
 *
 * Refuses with a ConvexError: production redacts a plain Error's text to
 * "Server Error", and the host's form and the admin panel both need to say
 * which field is wrong.
 */
export function validatePricing(args: PricingArgs): void {
  if (args.pricePerNight !== undefined) {
    if (
      !Number.isFinite(args.pricePerNight) ||
      args.pricePerNight <= 0 ||
      args.pricePerNight > MAX_PRICE_PER_NIGHT
    ) {
      throw new ConvexError(
        `أدخل سعرًا صحيحًا بين 1 و ${MAX_PRICE_PER_NIGHT} ريال. / Enter a valid nightly price between 1 and ${MAX_PRICE_PER_NIGHT} SAR.`
      );
    }
    if (!Number.isInteger(args.pricePerNight)) {
      throw new ConvexError("السعر يجب أن يكون رقمًا صحيحًا. / The nightly price must be a whole number.");
    }
  }

  // Only SAR for now. Multi-currency is a display concern that needs a rate
  // source; accepting a currency we cannot convert would produce totals that
  // silently mean the wrong thing.
  if (args.currency !== undefined && args.currency !== "SAR") {
    throw new ConvexError("العملة المدعومة حاليًا هي الريال السعودي فقط. / Only SAR is supported.");
  }

  if (args.maxGuests !== undefined) {
    if (!Number.isInteger(args.maxGuests) || args.maxGuests < 1 || args.maxGuests > MAX_GUESTS) {
      throw new ConvexError(
        `الحد الأقصى للضيوف بين 1 و ${MAX_GUESTS}. / Max guests must be between 1 and ${MAX_GUESTS}.`
      );
    }
  }

  if (args.unitCount !== undefined) {
    if (!Number.isInteger(args.unitCount) || args.unitCount < 1 || args.unitCount > MAX_UNITS) {
      throw new ConvexError(
        `عدد الوحدات بين 1 و ${MAX_UNITS}. / Unit count must be between 1 and ${MAX_UNITS}.`
      );
    }
  }

  for (const [label, value] of [
    ["وقت الوصول / Check-in time", args.checkInTime],
    ["وقت المغادرة / Check-out time", args.checkOutTime],
  ] as const) {
    if (value !== undefined && !isHHMM(value)) {
      throw new ConvexError(`${label}: أدخل الوقت بصيغة HH:MM. / must be in HH:MM format.`);
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
