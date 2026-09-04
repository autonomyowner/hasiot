import { describe, expect, it } from "vitest";
import { addDays, datesBetween, formatDateRange, nightsBetween, relativeTime, todayRiyadhISO } from "./dates";

describe("todayRiyadhISO", () => {
  it("matches what the server calls today", () => {
    // 21:00 UTC is already tomorrow in Riyadh. If the app disagreed, the
    // calendar would offer a day the server then rejects as being in the past.
    expect(todayRiyadhISO(Date.UTC(2026, 8, 2, 20, 59))).toBe("2026-09-02");
    expect(todayRiyadhISO(Date.UTC(2026, 8, 2, 21, 0))).toBe("2026-09-03");
  });
});

describe("addDays and nightsBetween", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-09-10", 365)).toBe("2027-09-10");
  });

  it("counts nights with an exclusive check-out", () => {
    expect(nightsBetween("2026-09-10", "2026-09-13")).toBe(3);
    expect(nightsBetween("2026-09-10", "2026-09-10")).toBe(0);
  });
});

describe("datesBetween", () => {
  it("returns the nights slept, not the days touched", () => {
    // Three nights means three marked cells plus the check-out day drawn as
    // the end cap — the calendar needs exactly this set.
    expect(datesBetween("2026-09-10", "2026-09-13")).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
    ]);
  });

  it("is empty for a zero-night range", () => {
    expect(datesBetween("2026-09-10", "2026-09-10")).toEqual([]);
  });
});

describe("formatDateRange", () => {
  it("does not slip a day across the timezone boundary", () => {
    // Parsed as UTC midnight and formatted in UTC, so the 10th stays the 10th.
    expect(formatDateRange("2026-09-10", "2026-09-13", "en")).toContain("10");
    expect(formatDateRange("2026-09-10", "2026-09-13", "en")).toContain("13");
  });

  it("keeps Latin digits in Arabic", () => {
    // The app puts dates next to prices and confirmation codes, which are
    // Latin; Arabic-Indic numerals mid-line read as a different alphabet.
    const formatted = formatDateRange("2026-09-10", "2026-09-13", "ar");
    expect(formatted).toMatch(/10/);
    expect(formatted).not.toMatch(/[٠-٩]/);
  });
});

describe("relativeTime", () => {
  const now = Date.UTC(2026, 8, 3, 12, 0);

  it("gets shorter as things get closer", () => {
    expect(relativeTime(now - 30_000, "en", now)).toBe("now");
    expect(relativeTime(now - 5 * 60_000, "en", now)).toBe("5m");
    expect(relativeTime(now - 3 * 3600_000, "en", now)).toBe("3h");
    expect(relativeTime(now - 2 * 86_400_000, "en", now)).toBe("2d");
  });

  it("falls back to a date past a month", () => {
    expect(relativeTime(now - 60 * 86_400_000, "en", now)).toMatch(/Jul/);
  });

  it("has an Arabic form", () => {
    expect(relativeTime(now - 30_000, "ar", now)).toBe("الآن");
    expect(relativeTime(now - 3 * 3600_000, "ar", now)).toBe("قبل 3 س");
  });

  it("never reports a negative age for a clock that is slightly ahead", () => {
    expect(relativeTime(now + 5000, "en", now)).toBe("now");
  });
});
