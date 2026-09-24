import { describe, expect, it } from "vitest";
import { toLatinDigits } from "./digits";

describe("toLatinDigits", () => {
  it("turns Arabic-Indic digits into the ones Number() understands", () => {
    expect(toLatinDigits("٤٥٠")).toBe("450");
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });

  it("does the same for the Persian forms some keyboards type", () => {
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("reads the Arabic decimal and thousands separators", () => {
    expect(toLatinDigits("١٢٬٥٠٠")).toBe("12500");
    expect(toLatinDigits("٣٫٥")).toBe("3.5");
  });

  it("leaves everything else alone", () => {
    expect(toLatinDigits("15:00")).toBe("15:00");
    expect(toLatinDigits("١٥:٠٠")).toBe("15:00");
    expect(toLatinDigits("Room 12, فندق")).toBe("Room 12, فندق");
    expect(toLatinDigits("")).toBe("");
  });
});
