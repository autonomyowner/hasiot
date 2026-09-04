import { describe, expect, it } from "vitest";
import { hostActionsFor, nightsLabel, quoteFooterState } from "./bookingDisplay";

const t = (key: string) => key; // identity translator: assertions read as keys

describe("nightsLabel", () => {
  it("singular for one night", () => {
    expect(nightsLabel(1, t)).toBe("1 night");
  });
  it("plural otherwise", () => {
    expect(nightsLabel(3, t)).toBe("3 nights");
  });
  it("appends guests when given", () => {
    expect(nightsLabel(2, t, 4)).toBe("2 nights · 4 guests");
  });
  it("omits guests when zero or undefined", () => {
    expect(nightsLabel(2, t, 0)).toBe("2 nights");
    expect(nightsLabel(2, t, undefined)).toBe("2 nights");
  });
});

describe("quoteFooterState", () => {
  it("is idle before both dates are chosen", () => {
    expect(quoteFooterState({ checkIn: null, checkOut: null, quote: undefined, lastGood: null })).toEqual({
      kind: "idle",
    });
  });
  it("is loading while the first quote is in flight", () => {
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote: undefined, lastGood: null })
    ).toEqual({ kind: "loading" });
  });
  it("keeps showing the last good total while a refetch is in flight", () => {
    const lastGood = { nights: 2, pricePerNight: 400, totalAmount: 800 };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote: undefined, lastGood })
    ).toEqual({ kind: "total", stale: true, ...lastGood });
  });
  it("shows the total when the quote is available", () => {
    const quote = { ok: true as const, available: true, quote: { nights: 2, pricePerNight: 400, totalAmount: 800 } };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote, lastGood: null })
    ).toEqual({ kind: "total", stale: false, nights: 2, pricePerNight: 400, totalAmount: 800 });
  });
  it("reports no availability", () => {
    const quote = { ok: true as const, available: false, quote: { nights: 2, pricePerNight: 400, totalAmount: 800 } };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote, lastGood: null })
    ).toEqual({ kind: "unavailable" });
  });
  it("surfaces a server error message", () => {
    const quote = { ok: false as const, error: "Maximum stay is 30 nights" };
    expect(
      quoteFooterState({ checkIn: "2026-09-10", checkOut: "2026-09-12", quote, lastGood: null })
    ).toEqual({ kind: "error", message: "Maximum stay is 30 nights" });
  });
});

describe("hostActionsFor", () => {
  const today = "2026-09-10";
  it("pending → confirm / decline", () => {
    expect(hostActionsFor({ status: "pending", checkIn: "2026-09-20" }, today)).toBe("decide");
  });
  it("confirmed and not yet arrived → nothing", () => {
    expect(hostActionsFor({ status: "confirmed", checkIn: "2026-09-20" }, today)).toBe("none");
  });
  it("confirmed and arrival day reached → no-show / complete", () => {
    expect(hostActionsFor({ status: "confirmed", checkIn: "2026-09-10" }, today)).toBe("close");
    expect(hostActionsFor({ status: "confirmed", checkIn: "2026-09-01" }, today)).toBe("close");
  });
  it("falls back to date for slot bookings", () => {
    expect(hostActionsFor({ status: "confirmed", date: "2026-09-09" }, today)).toBe("close");
  });
  it("terminal statuses → nothing", () => {
    for (const status of ["completed", "cancelled", "declined", "expired", "no_show"]) {
      expect(hostActionsFor({ status, checkIn: "2026-09-01" }, today)).toBe("none");
    }
  });
});
