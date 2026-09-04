import { describe, expect, it } from "vitest";
import {
  addDays,
  isHHMM,
  isISODate,
  nightsBetween,
  riyadhDateTimeToTimestamp,
  riyadhMonthKey,
  todayRiyadhISO,
  toRiyadhISODate,
} from "./dates";
import { isPlaceholderEmail, tempEmailForPhone } from "./contact";

describe("toRiyadhISODate", () => {
  it("rolls over three hours before UTC does", () => {
    // 20:59 UTC is still the 2nd in Riyadh; 21:00 UTC is already the 3rd.
    expect(toRiyadhISODate(Date.UTC(2026, 8, 2, 20, 59))).toBe("2026-09-02");
    expect(toRiyadhISODate(Date.UTC(2026, 8, 2, 21, 0))).toBe("2026-09-03");
  });

  it("does not roll over at UTC midnight", () => {
    expect(toRiyadhISODate(Date.UTC(2026, 8, 3, 0, 0))).toBe("2026-09-03");
  });

  it("todayRiyadhISO takes an injectable clock", () => {
    expect(todayRiyadhISO(Date.UTC(2026, 8, 2, 22, 0))).toBe("2026-09-03");
  });
});

describe("isISODate", () => {
  it("accepts real dates", () => {
    expect(isISODate("2026-09-03")).toBe(true);
    expect(isISODate("2028-02-29")).toBe(true); // leap year
  });

  it("rejects malformed and non-existent dates", () => {
    expect(isISODate("2026-2-3")).toBe(false);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2026-13-01")).toBe(false);
    expect(isISODate("2027-02-29")).toBe(false); // not a leap year
    expect(isISODate("")).toBe(false);
    expect(isISODate(undefined)).toBe(false);
    expect(isISODate(20260903)).toBe(false);
  });
});

describe("isHHMM", () => {
  it("accepts a 24-hour clock only", () => {
    expect(isHHMM("00:00")).toBe(true);
    expect(isHHMM("15:00")).toBe(true);
    expect(isHHMM("23:59")).toBe(true);
    expect(isHHMM("24:00")).toBe(false);
    expect(isHHMM("3:00")).toBe(false);
    expect(isHHMM("15:60")).toBe(false);
  });
});

describe("addDays", () => {
  it("crosses months and years", () => {
    expect(addDays("2026-09-03", 1)).toBe("2026-09-04");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("nightsBetween", () => {
  it("counts nights, not days — check-out is exclusive", () => {
    expect(nightsBetween("2026-09-10", "2026-09-13")).toBe(3);
    expect(nightsBetween("2026-09-10", "2026-09-11")).toBe(1);
  });

  it("returns zero or negative for degenerate ranges so callers can reject them", () => {
    expect(nightsBetween("2026-09-10", "2026-09-10")).toBe(0);
    expect(nightsBetween("2026-09-13", "2026-09-10")).toBe(-3);
  });

  it("is unaffected by month boundaries", () => {
    expect(nightsBetween("2026-09-28", "2026-10-02")).toBe(4);
  });
});

describe("riyadhDateTimeToTimestamp", () => {
  it("treats the wall clock as Riyadh time", () => {
    // 15:00 in Riyadh is 12:00 UTC.
    expect(riyadhDateTimeToTimestamp("2026-09-03", "15:00")).toBe(Date.UTC(2026, 8, 3, 12, 0));
  });

  it("round-trips through toRiyadhISODate", () => {
    const ts = riyadhDateTimeToTimestamp("2026-09-03", "00:30");
    expect(toRiyadhISODate(ts)).toBe("2026-09-03");
  });
});

describe("riyadhMonthKey", () => {
  it("buckets by the Riyadh month", () => {
    expect(riyadhMonthKey(Date.UTC(2026, 8, 15, 9, 0))).toBe("2026-09");
    // 30 Sep 21:00 UTC is already 1 Oct in Riyadh.
    expect(riyadhMonthKey(Date.UTC(2026, 8, 30, 21, 0))).toBe("2026-10");
  });
});

describe("placeholder emails", () => {
  it("builds one from a phone number", () => {
    expect(tempEmailForPhone("+966501234567")).toBe("966501234567@phone.hasio.xyz");
  });

  it("recognises its own output and leaves real addresses alone", () => {
    expect(isPlaceholderEmail(tempEmailForPhone("+966501234567"))).toBe(true);
    expect(isPlaceholderEmail("966501234567@PHONE.HASIO.XYZ")).toBe(true);
    expect(isPlaceholderEmail("guest@gmail.com")).toBe(false);
    expect(isPlaceholderEmail("someone@hasio.xyz")).toBe(false);
    expect(isPlaceholderEmail(undefined)).toBe(false);
    expect(isPlaceholderEmail(null)).toBe(false);
  });
});
