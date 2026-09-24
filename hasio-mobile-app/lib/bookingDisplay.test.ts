import { describe, expect, it } from "vitest";
import { translations } from "@/constants/translations";
import { formatPrice } from "./currency";
import {
  countLabel,
  displayTotalSar,
  hostActionsFor,
  nightsLabel,
  partitionGuestBookings,
  partitionHostBookings,
  pluralForm,
  quoteFooterState,
  telUrl,
  type CountKey,
} from "./bookingDisplay";

// The real copy, not an identity translator: what is under test is that the
// words a count is shown in are the right ones, in both languages.
const en = (key: CountKey) => translations.en[key];
const ar = (key: CountKey) => translations.ar[key];

describe("pluralForm", () => {
  it("follows the forms Arabic counts in", () => {
    expect(pluralForm(1)).toBe("One");
    expect(pluralForm(2)).toBe("Two");
    for (const n of [3, 7, 10]) expect(pluralForm(n)).toBe("Few");
    for (const n of [0, 11, 30, 100]) expect(pluralForm(n)).toBe("Many");
  });
});

describe("countLabel", () => {
  it("counts in English", () => {
    expect(countLabel(1, "nights", en)).toBe("1 night");
    expect(countLabel(2, "nights", en)).toBe("2 nights");
    expect(countLabel(11, "nights", en)).toBe("11 nights");
    expect(countLabel(1, "guests", en)).toBe("1 guest");
    expect(countLabel(4, "guests", en)).toBe("4 guests");
    expect(countLabel(1, "reviews", en)).toBe("1 review");
    expect(countLabel(12, "reviews", en)).toBe("12 reviews");
    expect(countLabel(1, "stars", en)).toBe("1 star");
    expect(countLabel(5, "stars", en)).toBe("5 stars");
  });

  it("takes the singular, dual, plural and counted-singular forms in Arabic", () => {
    // "2 guests" used to read "2 الضيوف" — "2 the guests" — and every stay was
    // "ليالٍ", the 3–10 plural, even for one night.
    expect(countLabel(1, "nights", ar)).toBe("ليلة واحدة");
    expect(countLabel(2, "nights", ar)).toBe("ليلتان");
    expect(countLabel(3, "nights", ar)).toBe("3 ليالٍ");
    expect(countLabel(10, "nights", ar)).toBe("10 ليالٍ");
    expect(countLabel(11, "nights", ar)).toBe("11 ليلة");
    expect(countLabel(30, "nights", ar)).toBe("30 ليلة");

    expect(countLabel(1, "guests", ar)).toBe("ضيف واحد");
    expect(countLabel(2, "guests", ar)).toBe("ضيفان");
    expect(countLabel(3, "guests", ar)).toBe("3 ضيوف");
    expect(countLabel(11, "guests", ar)).toBe("11 ضيفًا");

    expect(countLabel(1, "reviews", ar)).toBe("تقييم واحد");
    expect(countLabel(2, "reviews", ar)).toBe("تقييمان");
    expect(countLabel(7, "reviews", ar)).toBe("7 تقييمات");
    expect(countLabel(12, "reviews", ar)).toBe("12 تقييمًا");

    expect(countLabel(1, "stars", ar)).toBe("نجمة واحدة");
    expect(countLabel(2, "stars", ar)).toBe("نجمتان");
    expect(countLabel(5, "stars", ar)).toBe("5 نجوم");
  });

  it("keeps Latin digits in Arabic, like every other number in the app", () => {
    expect(countLabel(4, "guests", ar)).not.toMatch(/[٠-٩]/);
    expect(countLabel(14, "nights", ar)).toBe("14 ليلة");
  });
});

describe("nightsLabel", () => {
  it("appends guests when given", () => {
    expect(nightsLabel(2, en, 4)).toBe("2 nights · 4 guests");
    expect(nightsLabel(1, ar, 2)).toBe("ليلة واحدة · ضيفان");
  });
  it("omits guests when zero or undefined", () => {
    expect(nightsLabel(3, en, 0)).toBe("3 nights");
    expect(nightsLabel(3, en, undefined)).toBe("3 nights");
  });
});

describe("telUrl", () => {
  it("keeps only what a dialer reads", () => {
    expect(telUrl("+966 50 123 4567")).toBe("tel:+966501234567");
    expect(telUrl("050-123-4567")).toBe("tel:0501234567");
    expect(telUrl("(013) 587 1234")).toBe("tel:0135871234");
  });

  it("reads a number typed on an Arabic keypad", () => {
    expect(telUrl("٠٥٠١٢٣٤٥٦٧")).toBe("tel:0501234567");
  });
});

describe("displayTotalSar", () => {
  const unit = { sar: "SAR", usd: "USD" };
  const quote = { nights: 3, pricePerNight: 475, totalAmount: 1425 };

  it("leaves a riyal total exactly as stored", () => {
    expect(displayTotalSar(quote, "SAR")).toBe(1425);
    expect(formatPrice(displayTotalSar(quote, "SAR"), "SAR", unit)).toBe("1,425 SAR");
  });

  it("makes a dollar total agree with nights × the dollar rate shown", () => {
    // 1,425 SAR is $380 on its own, but the rate shows as $127 and the
    // footer reads "3 × $127" — so the total has to be $381.
    expect(formatPrice(quote.pricePerNight, "USD", unit)).toBe("$127");
    expect(formatPrice(displayTotalSar(quote, "USD"), "USD", unit)).toBe("$381");
  });

  it("falls back to the stored total when the rate is not known", () => {
    expect(displayTotalSar({ totalAmount: 1425 }, "USD")).toBe(1425);
    expect(displayTotalSar({ totalAmount: 1425, nights: 3 }, "USD")).toBe(1425);
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

// A stay booking as the lists see it.
const stay = (id: string, status: string, checkIn: string, checkOut: string) => ({
  _id: id,
  status,
  date: checkIn,
  checkIn,
  checkOut,
});
const ids = (rows: { _id: string }[]) => rows.map((row) => row._id);

describe("partitionGuestBookings", () => {
  const today = "2026-09-10";

  it("lists open stays not yet checked out of under upcoming, soonest first", () => {
    const { upcoming, past } = partitionGuestBookings(
      [
        stay("next-year", "confirmed", "2027-01-05", "2027-01-08"),
        stay("tomorrow", "pending", "2026-09-11", "2026-09-13"),
        stay("mid-stay", "confirmed", "2026-09-09", "2026-09-11"),
      ],
      today
    );
    expect(ids(upcoming)).toEqual(["mid-stay", "tomorrow", "next-year"]);
    expect(past).toEqual([]);
  });

  it("lists finished, cancelled and declined stays under past, most recent first", () => {
    const { upcoming, past } = partitionGuestBookings(
      [
        stay("may", "completed", "2026-05-01", "2026-05-03"),
        stay("cancelled", "cancelled", "2026-10-01", "2026-10-02"),
        stay("august", "completed", "2026-08-20", "2026-08-22"),
      ],
      today
    );
    expect(upcoming).toEqual([]);
    expect(ids(past)).toEqual(["cancelled", "august", "may"]);
  });
});

describe("partitionHostBookings", () => {
  const today = "2026-09-10";

  it("puts the nearest arrival first in requests and upcoming", () => {
    const { requests, upcoming } = partitionHostBookings(
      [
        stay("spring", "pending", "2027-03-01", "2027-03-03"),
        stay("tomorrow", "pending", "2026-09-11", "2026-09-12"),
        stay("later", "confirmed", "2026-10-01", "2026-10-04"),
        stay("soon", "confirmed", "2026-09-15", "2026-09-16"),
      ],
      today
    );
    expect(ids(requests)).toEqual(["tomorrow", "spring"]);
    expect(ids(upcoming)).toEqual(["soon", "later"]);
  });

  it("keeps a stay under upcoming until the guest checks out", () => {
    const { upcoming } = partitionHostBookings(
      [stay("checking-out-today", "confirmed", "2026-09-08", "2026-09-10")],
      today
    );
    expect(ids(upcoming)).toEqual(["checking-out-today"]);
  });

  it("puts everything closed or over under past, most recent first", () => {
    const { requests, upcoming, past } = partitionHostBookings(
      [
        stay("old", "completed", "2026-05-01", "2026-05-02"),
        stay("over", "confirmed", "2026-09-01", "2026-09-03"),
        stay("declined", "declined", "2026-09-20", "2026-09-21"),
      ],
      today
    );
    expect(requests).toEqual([]);
    expect(upcoming).toEqual([]);
    expect(ids(past)).toEqual(["declined", "over", "old"]);
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
