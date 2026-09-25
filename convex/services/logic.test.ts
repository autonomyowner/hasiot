import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { NOW, TODAY } from "../test.utils";
import { BOOKING_ERRORS } from "../bookings/logic";
import {
  computeServiceQuote,
  DEFAULT_MAX_GROUP,
  isBookableService,
  isPublicService,
  SERVICE_ERRORS,
  validateServiceInput,
} from "./logic";

// NOW is 2026-09-03T00:00 Riyadh; 10:10 Riyadh that day is NOW + 10h10m.
const AT_1010 = NOW + (10 * 60 + 10) * 60_000;
const TOMORROW = "2026-09-04";

const hourly = { price: 150, priceUnit: "per_hour" };

describe("computeServiceQuote", () => {
  it("prices hours as rate times hours, one day long", () => {
    const r = computeServiceQuote(hourly, { date: TOMORROW, time: "09:00", quantity: 3, partySize: 2 }, TODAY, NOW);
    expect(r).toEqual({
      ok: true,
      quote: {
        date: TOMORROW,
        time: "09:00",
        quantity: 3,
        priceUnit: "per_hour",
        unitPrice: 150,
        totalAmount: 450,
        currency: "SAR",
        partySize: 2,
        checkIn: TOMORROW,
        checkOut: "2026-09-05",
      },
    });
  });

  it("prices days and spans the checkOut across them", () => {
    const r = computeServiceQuote({ price: 900, priceUnit: "per_day" }, { date: TOMORROW, time: "08:00", quantity: 2 }, TODAY, NOW);
    expect(r.ok && r.quote).toMatchObject({ totalAmount: 1800, quantity: 2, checkOut: "2026-09-06" });
  });

  it("charges a fixed or per-event price once, whatever quantity is sent", () => {
    for (const priceUnit of ["fixed", "per_event"]) {
      const r = computeServiceQuote({ price: 700, priceUnit }, { date: TOMORROW, time: "17:00", quantity: 5 }, TODAY, NOW);
      expect(r.ok && r.quote).toMatchObject({ quantity: 1, totalAmount: 700, priceUnit, checkOut: "2026-09-05" });
    }
  });

  it("treats a missing or unknown unit as a fixed price", () => {
    const r1 = computeServiceQuote({ price: 300 }, { date: TOMORROW, time: "10:00", quantity: 4 }, TODAY, NOW);
    const r2 = computeServiceQuote({ price: 300, priceUnit: "per_moon" }, { date: TOMORROW, time: "10:00" }, TODAY, NOW);
    expect(r1.ok && r1.quote).toMatchObject({ priceUnit: "fixed", quantity: 1, totalAmount: 300 });
    expect(r2.ok && r2.quote).toMatchObject({ priceUnit: "fixed", totalAmount: 300 });
  });

  it("defaults the quantity and the party to one", () => {
    const r = computeServiceQuote(hourly, { date: TOMORROW, time: "09:00" }, TODAY, NOW);
    expect(r.ok && r.quote).toMatchObject({ quantity: 1, partySize: 1, totalAmount: 150 });
  });

  it("refuses in the documented order", () => {
    const q = (args: Parameters<typeof computeServiceQuote>[1], service: Parameters<typeof computeServiceQuote>[0] = hourly, now = NOW) =>
      computeServiceQuote(service, args, TODAY, now);

    expect(q({ date: "2026-02-30", time: "09:00" })).toEqual({ ok: false, error: SERVICE_ERRORS.INVALID_DATE });
    expect(q({ date: "2026-09-02", time: "09:00" })).toEqual({ ok: false, error: SERVICE_ERRORS.PAST_DATE });
    expect(q({ date: TOMORROW, time: "9am" })).toEqual({ ok: false, error: SERVICE_ERRORS.INVALID_TIME });
    expect(q({ date: TODAY, time: "10:00" }, hourly, AT_1010)).toEqual({ ok: false, error: SERVICE_ERRORS.PAST_TIME });
    expect(q({ date: TOMORROW, time: "09:00" }, { priceUnit: "per_hour" })).toEqual({ ok: false, error: SERVICE_ERRORS.NO_PRICE });
    expect(q({ date: TOMORROW, time: "09:00" }, { price: 0, priceUnit: "per_hour" })).toEqual({ ok: false, error: SERVICE_ERRORS.NO_PRICE });
    expect(q({ date: TOMORROW, time: "09:00", quantity: 13 })).toEqual({ ok: false, error: SERVICE_ERRORS.INVALID_HOURS });
    expect(q({ date: TOMORROW, time: "09:00", quantity: 1.5 })).toEqual({ ok: false, error: SERVICE_ERRORS.INVALID_HOURS });
    expect(q({ date: TOMORROW, time: "09:00", quantity: 15 }, { price: 1, priceUnit: "per_day" })).toEqual({ ok: false, error: SERVICE_ERRORS.INVALID_DAYS });
    expect(q({ date: TOMORROW, time: "09:00", partySize: 0 })).toEqual({ ok: false, error: SERVICE_ERRORS.INVALID_PARTY });
    expect(q({ date: TOMORROW, time: "09:00", partySize: DEFAULT_MAX_GROUP + 1 })).toEqual({ ok: false, error: SERVICE_ERRORS.TOO_MANY_PEOPLE });
    expect(q({ date: TOMORROW, time: "09:00", partySize: 5 }, { ...hourly, maxGroupSize: 4 })).toEqual({ ok: false, error: SERVICE_ERRORS.TOO_MANY_PEOPLE });
  });

  it("accepts a start later today, in Riyadh time", () => {
    const r = computeServiceQuote(hourly, { date: TODAY, time: "11:30" }, TODAY, AT_1010);
    expect(r.ok).toBe(true);
  });

  it("allows up to twenty people when the provider set no limit", () => {
    const r = computeServiceQuote(hourly, { date: TOMORROW, time: "09:00", partySize: DEFAULT_MAX_GROUP }, TODAY, NOW);
    expect(r.ok).toBe(true);
  });
});

describe("isPublicService / isBookableService", () => {
  const provider = { role: "service_provider", isApproved: true, isSuspended: false };

  it("shows approved services whose owner is not suspended", () => {
    expect(isPublicService({ status: "approved" }, provider)).toBe(true);
    expect(isPublicService({ status: "pending" }, provider)).toBe(false);
    expect(isPublicService({ status: "suspended" }, provider)).toBe(false);
    expect(isPublicService({ status: "approved" }, { ...provider, isSuspended: true })).toBe(false);
    expect(isPublicService({ status: "approved" }, null)).toBe(false);
  });

  it("books only priced services of approved providers", () => {
    expect(isBookableService({ status: "approved", price: 150 }, provider)).toBe(true);
    expect(isBookableService({ status: "approved" }, provider)).toBe(false);
    expect(isBookableService({ status: "approved", price: 150 }, { ...provider, isApproved: false })).toBe(false);
    expect(isBookableService({ status: "approved", price: 150 }, { ...provider, role: "tourist" })).toBe(false);
    expect(isBookableService({ status: "pending", price: 150 }, provider)).toBe(false);
  });
});

describe("validateServiceInput", () => {
  const base = { serviceType: "tour_guide", title_en: "Oasis tour", title_ar: "جولة الواحة" };
  const refuses = (fn: () => unknown, message: string) => {
    try {
      fn();
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      expect((error as ConvexError<string>).data).toBe(message);
      return;
    }
    throw new Error(`expected a refusal: ${message}`);
  };

  it("requires the type and both titles when creating", () => {
    refuses(() => validateServiceInput({ ...base, serviceType: "juggler" }, "create"), SERVICE_ERRORS.INVALID_TYPE);
    refuses(() => validateServiceInput({ ...base, serviceType: undefined }, "create"), SERVICE_ERRORS.INVALID_TYPE);
    refuses(() => validateServiceInput({ ...base, title_ar: "   " }, "create"), SERVICE_ERRORS.TITLE_REQUIRED);
    refuses(() => validateServiceInput({ ...base, title_en: undefined }, "create"), SERVICE_ERRORS.TITLE_REQUIRED);
  });

  it("checks lengths, unit, price, group, images and city", () => {
    refuses(() => validateServiceInput({ ...base, title_en: "x".repeat(101) }, "create"), SERVICE_ERRORS.TITLE_TOO_LONG);
    refuses(() => validateServiceInput({ ...base, description_ar: "x".repeat(2001) }, "create"), SERVICE_ERRORS.DESCRIPTION_TOO_LONG);
    refuses(() => validateServiceInput({ ...base, priceUnit: "per_moon" }, "create"), SERVICE_ERRORS.INVALID_UNIT);
    refuses(() => validateServiceInput({ ...base, price: 0 }, "create"), SERVICE_ERRORS.INVALID_PRICE);
    refuses(() => validateServiceInput({ ...base, price: 100_001 }, "create"), SERVICE_ERRORS.INVALID_PRICE);
    refuses(() => validateServiceInput({ ...base, price: 99.5 }, "create"), SERVICE_ERRORS.PRICE_NOT_WHOLE);
    refuses(() => validateServiceInput({ ...base, maxGroupSize: 0 }, "create"), SERVICE_ERRORS.INVALID_GROUP);
    refuses(() => validateServiceInput({ ...base, maxGroupSize: 101 }, "create"), SERVICE_ERRORS.INVALID_GROUP);
    refuses(() => validateServiceInput({ ...base, images: ["a", "b", "c", "d", "e", "f"] }, "create"), SERVICE_ERRORS.TOO_MANY_IMAGES);
    refuses(() => validateServiceInput({ ...base, city: "Riyadh" }, "create"), SERVICE_ERRORS.INVALID_CITY);
  });

  it("trims text, folds the city, and returns only what was given", () => {
    const out = validateServiceInput(
      { ...base, title_en: "  Oasis tour ", description_en: "  Good  ", city: "Hofuf", price: 150, priceUnit: "per_hour" },
      "create"
    );
    // Strict: a field that was not sent must not appear as `undefined`, which a
    // patch would read as "clear it".
    expect(out).toStrictEqual({
      serviceType: "tour_guide",
      title_en: "Oasis tour",
      title_ar: "جولة الواحة",
      description_en: "Good",
      city: "Al Ahsa",
      price: 150,
      priceUnit: "per_hour",
    });
  });

  it("lets an update send only what changed, and clear price and group size with null", () => {
    const cleared = validateServiceInput({ price: null, maxGroupSize: null }, "update");
    expect(Object.keys(cleared).sort()).toEqual(["maxGroupSize", "price"]);
    expect(cleared.price).toBeUndefined();
    expect(cleared.maxGroupSize).toBeUndefined();

    expect(validateServiceInput({ title_en: "New name" }, "update")).toStrictEqual({ title_en: "New name" });
  });

  it("clears an emptied description on update rather than storing blanks", () => {
    const out = validateServiceInput({ description_en: "   " }, "update");
    expect(Object.keys(out)).toEqual(["description_en"]);
    expect(out.description_en).toBeUndefined();
  });

  it("does not let an update blank a title", () => {
    refuses(() => validateServiceInput({ title_ar: "" }, "update"), SERVICE_ERRORS.TITLE_REQUIRED);
  });
});

describe("SERVICE_ERRORS", () => {
  it("shares the reschedule refusal with the booking errors", () => {
    expect(SERVICE_ERRORS.NO_RESCHEDULE).toBe(BOOKING_ERRORS.SERVICE_NO_RESCHEDULE);
  });

  it("keeps the house format: Arabic, then ' / ', then English", () => {
    for (const message of Object.values(SERVICE_ERRORS)) {
      const [arabic, english] = message.split(" / ");
      expect(arabic).toMatch(/[؀-ۿ]/);
      expect(english).toMatch(/^[A-Z]/);
    }
  });
});
