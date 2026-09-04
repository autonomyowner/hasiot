import { describe, expect, it } from "vitest";
import {
  BOOKING_ERRORS,
  canTransition,
  computeStayQuote,
  expiryFor,
  generateConfirmationCode,
  overlaps,
  PENDING_TTL_MS,
  reminderTargetDate,
} from "./logic";

const TODAY = "2026-09-03";
const HOTEL = { pricePerNight: 450, currency: "SAR", maxGuests: 4 };

function quote(over: Partial<{ checkIn: string; checkOut: string; guests: number }> = {}) {
  return computeStayQuote(
    HOTEL,
    { checkIn: "2026-09-10", checkOut: "2026-09-13", guests: 2, ...over },
    TODAY
  );
}

describe("computeStayQuote", () => {
  it("charges per night, with check-out exclusive", () => {
    const result = quote();
    expect(result).toEqual({
      ok: true,
      quote: {
        checkIn: "2026-09-10",
        checkOut: "2026-09-13",
        nights: 3,
        guests: 2,
        pricePerNight: 450,
        totalAmount: 1350,
        currency: "SAR",
      },
    });
  });

  it("allows a booking that starts today", () => {
    expect(quote({ checkIn: TODAY, checkOut: "2026-09-04" }).ok).toBe(true);
  });

  it("rejects a check-in in the past", () => {
    const result = quote({ checkIn: "2026-09-02", checkOut: "2026-09-05" });
    expect(result).toEqual({ ok: false, error: BOOKING_ERRORS.PAST_CHECK_IN });
  });

  it("rejects a zero-night or reversed range", () => {
    expect(quote({ checkOut: "2026-09-10" })).toEqual({
      ok: false,
      error: BOOKING_ERRORS.CHECKOUT_BEFORE_CHECKIN,
    });
    expect(quote({ checkIn: "2026-09-13", checkOut: "2026-09-10" })).toEqual({
      ok: false,
      error: BOOKING_ERRORS.CHECKOUT_BEFORE_CHECKIN,
    });
  });

  it("caps the length of a single stay", () => {
    // 10 Sep -> 11 Oct is 31 nights.
    expect(quote({ checkOut: "2026-10-11" })).toEqual({
      ok: false,
      error: BOOKING_ERRORS.TOO_MANY_NIGHTS,
    });
    // 30 nights exactly is still fine.
    expect(quote({ checkOut: "2026-10-10" }).ok).toBe(true);
  });

  it("rejects malformed dates", () => {
    expect(quote({ checkIn: "10/09/2026" })).toEqual({ ok: false, error: BOOKING_ERRORS.INVALID_DATES });
    expect(quote({ checkOut: "2026-02-30" })).toEqual({ ok: false, error: BOOKING_ERRORS.INVALID_DATES });
  });

  it("bounds the guest count", () => {
    expect(quote({ guests: 0 })).toEqual({ ok: false, error: BOOKING_ERRORS.INVALID_GUESTS });
    expect(quote({ guests: 2.5 })).toEqual({ ok: false, error: BOOKING_ERRORS.INVALID_GUESTS });
    expect(quote({ guests: 5 })).toEqual({ ok: false, error: BOOKING_ERRORS.TOO_MANY_GUESTS });
    expect(quote({ guests: 4 }).ok).toBe(true);
  });

  it("falls back to a default guest cap when the host set none", () => {
    const listing = { pricePerNight: 450 };
    const args = { checkIn: "2026-09-10", checkOut: "2026-09-11", guests: 5 };
    expect(computeStayQuote(listing, args, TODAY)).toEqual({
      ok: false,
      error: BOOKING_ERRORS.TOO_MANY_GUESTS,
    });
    expect(computeStayQuote(listing, { ...args, guests: 4 }, TODAY).ok).toBe(true);
  });

  it("refuses to quote a listing with no price", () => {
    const args = { checkIn: "2026-09-10", checkOut: "2026-09-11", guests: 2 };
    expect(computeStayQuote({}, args, TODAY)).toEqual({ ok: false, error: BOOKING_ERRORS.NO_PRICE });
    expect(computeStayQuote({ pricePerNight: 0 }, args, TODAY)).toEqual({
      ok: false,
      error: BOOKING_ERRORS.NO_PRICE,
    });
  });

  it("multiplies correctly across a month boundary", () => {
    const result = quote({ checkIn: "2026-09-28", checkOut: "2026-10-02" });
    expect(result.ok && result.quote).toMatchObject({ nights: 4, totalAmount: 1800 });
  });
});

describe("overlaps", () => {
  const stay = { checkIn: "2026-09-10", checkOut: "2026-09-13" };

  it("detects every kind of collision", () => {
    expect(overlaps(stay, { checkIn: "2026-09-10", checkOut: "2026-09-13" })).toBe(true); // identical
    expect(overlaps(stay, { checkIn: "2026-09-11", checkOut: "2026-09-12" })).toBe(true); // inside
    expect(overlaps(stay, { checkIn: "2026-09-09", checkOut: "2026-09-20" })).toBe(true); // surrounding
    expect(overlaps(stay, { checkIn: "2026-09-12", checkOut: "2026-09-15" })).toBe(true); // tail
    expect(overlaps(stay, { checkIn: "2026-09-08", checkOut: "2026-09-11" })).toBe(true); // head
  });

  it("treats a same-day turnover as free, not a clash", () => {
    // One guest leaves on the 13th, the next arrives on the 13th. Calling that
    // a collision would cost the host a night for nothing.
    expect(overlaps(stay, { checkIn: "2026-09-13", checkOut: "2026-09-16" })).toBe(false);
    expect(overlaps(stay, { checkIn: "2026-09-07", checkOut: "2026-09-10" })).toBe(false);
  });

  it("is symmetric", () => {
    const other = { checkIn: "2026-09-12", checkOut: "2026-09-15" };
    expect(overlaps(stay, other)).toBe(overlaps(other, stay));
  });
});

describe("generateConfirmationCode", () => {
  it("has the shape people will read over the phone", () => {
    expect(generateConfirmationCode(() => 0)).toBe("HSO-AAAAA");
    expect(generateConfirmationCode()).toMatch(/^HSO-[A-Z2-9]{5}$/);
  });

  it("omits the character pairs people mistype", () => {
    // Only the random part — the fixed "HSO-" prefix is brand, not payload.
    const codes = Array.from({ length: 200 }, () =>
      generateConfirmationCode().slice("HSO-".length)
    ).join("");
    expect(codes).not.toMatch(/[01OI]/);
  });
});

describe("canTransition", () => {
  it("lets a guest cancel their own booking", () => {
    expect(canTransition("pending", "cancelled", "tourist")).toEqual({ allowed: true });
    expect(canTransition("confirmed", "cancelled", "tourist")).toEqual({ allowed: true });
  });

  it("does not let a guest confirm or complete their own booking", () => {
    expect(canTransition("pending", "confirmed", "tourist").allowed).toBe(false);
    expect(canTransition("confirmed", "completed", "tourist").allowed).toBe(false);
  });

  it("lets a host answer a request and close out a stay", () => {
    expect(canTransition("pending", "confirmed", "owner")).toEqual({ allowed: true });
    expect(canTransition("pending", "declined", "owner")).toEqual({ allowed: true });
    expect(canTransition("confirmed", "completed", "owner")).toEqual({ allowed: true });
    expect(canTransition("confirmed", "no_show", "owner")).toEqual({ allowed: true });
  });

  it("does not let a host mark a no-show before the guest was ever confirmed", () => {
    expect(canTransition("pending", "no_show", "owner").allowed).toBe(false);
  });

  it("refuses to reopen a closed booking for guest or host", () => {
    for (const from of ["cancelled", "declined", "expired", "completed", "no_show"] as const) {
      expect(canTransition(from, "confirmed", "owner")).toEqual({
        allowed: false,
        reason: BOOKING_ERRORS.ALREADY_CLOSED,
      });
      expect(canTransition(from, "cancelled", "tourist").allowed).toBe(false);
    }
  });

  it("refuses a no-op transition", () => {
    expect(canTransition("confirmed", "confirmed", "owner").allowed).toBe(false);
    expect(canTransition("confirmed", "confirmed", "admin").allowed).toBe(false);
  });

  it("lets an admin do anything, flagging a reopen as forced", () => {
    expect(canTransition("pending", "confirmed", "admin")).toEqual({ allowed: true, forced: false });
    // Support must be able to fix a booking that reached a wrong state, but
    // the caller should log that it happened.
    expect(canTransition("cancelled", "confirmed", "admin")).toEqual({ allowed: true, forced: true });
  });

  it("still rejects a status that does not exist", () => {
    expect(canTransition("pending", "refunded" as never, "admin").allowed).toBe(false);
  });
});

describe("expiry and reminders", () => {
  it("gives a host two days to answer", () => {
    expect(expiryFor(1_000)).toBe(1_000 + PENDING_TTL_MS);
    expect(PENDING_TTL_MS).toBe(48 * 3600 * 1000);
  });

  it("reminds the day before arrival", () => {
    expect(reminderTargetDate("2026-09-30")).toBe("2026-10-01");
  });
});
