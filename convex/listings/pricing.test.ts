import { describe, expect, it } from "vitest";
import { isBookableStay, validatePricing, withPricingDefaults } from "./pricing";

describe("validatePricing", () => {
  it("accepts a complete, sane set of values", () => {
    expect(() =>
      validatePricing({
        pricePerNight: 450,
        currency: "SAR",
        maxGuests: 4,
        unitCount: 10,
        checkInTime: "15:00",
        checkOutTime: "12:00",
      })
    ).not.toThrow();
  });

  it("accepts an empty object — every field is optional", () => {
    expect(() => validatePricing({})).not.toThrow();
  });

  it("rejects prices that are not a positive whole number of riyals", () => {
    expect(() => validatePricing({ pricePerNight: 0 })).toThrow(/valid nightly price/);
    expect(() => validatePricing({ pricePerNight: -100 })).toThrow(/valid nightly price/);
    expect(() => validatePricing({ pricePerNight: 450.5 })).toThrow(/whole number/);
    expect(() => validatePricing({ pricePerNight: Number.NaN })).toThrow(/valid nightly price/);
  });

  it("rejects a price that looks like a typo", () => {
    // 450000/night is an extra zero or a monthly figure, not a room rate.
    expect(() => validatePricing({ pricePerNight: 450_000 })).toThrow(/valid nightly price/);
  });

  it("rejects a currency it cannot convert", () => {
    expect(() => validatePricing({ currency: "USD" })).toThrow(/Only SAR/);
  });

  it("bounds guests and units", () => {
    expect(() => validatePricing({ maxGuests: 0 })).toThrow(/Max guests/);
    expect(() => validatePricing({ maxGuests: 21 })).toThrow(/Max guests/);
    expect(() => validatePricing({ maxGuests: 2.5 })).toThrow(/Max guests/);
    expect(() => validatePricing({ unitCount: 0 })).toThrow(/Unit count/);
    expect(() => validatePricing({ unitCount: 501 })).toThrow(/Unit count/);
  });

  it("requires HH:MM times", () => {
    expect(() => validatePricing({ checkInTime: "3pm" })).toThrow(/HH:MM/);
    expect(() => validatePricing({ checkOutTime: "24:00" })).toThrow(/HH:MM/);
    expect(() => validatePricing({ checkInTime: "15:00", checkOutTime: "12:00" })).not.toThrow();
  });
});

describe("withPricingDefaults", () => {
  it("attaches SAR whenever a price is set", () => {
    expect(withPricingDefaults({ pricePerNight: 450 }).currency).toBe("SAR");
  });

  it("leaves an unpriced listing alone", () => {
    expect(withPricingDefaults({ maxGuests: 2 }).currency).toBeUndefined();
  });
});

describe("isBookableStay", () => {
  const bookable = { type: "hotel", pricePerNight: 450, isActive: true, status: "approved" };

  it("accepts an approved, priced hotel", () => {
    expect(isBookableStay(bookable)).toBe(true);
  });

  it("accepts seed data, which has no status", () => {
    expect(isBookableStay({ type: "hotel", pricePerNight: 450 })).toBe(true);
  });

  it("rejects a listing with no nightly rate — nothing could be quoted", () => {
    expect(isBookableStay({ ...bookable, pricePerNight: undefined })).toBe(false);
    expect(isBookableStay({ ...bookable, pricePerNight: 0 })).toBe(false);
  });

  it("rejects anything that is not a stay", () => {
    expect(isBookableStay({ ...bookable, type: "restaurant" })).toBe(false);
    expect(isBookableStay({ ...bookable, type: "event" })).toBe(false);
  });

  it("rejects listings that are not live", () => {
    expect(isBookableStay({ ...bookable, isActive: false })).toBe(false);
    expect(isBookableStay({ ...bookable, status: "pending" })).toBe(false);
    expect(isBookableStay({ ...bookable, status: "rejected" })).toBe(false);
    expect(isBookableStay({ ...bookable, status: "suspended" })).toBe(false);
  });
});
