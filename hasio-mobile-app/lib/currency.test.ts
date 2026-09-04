import { describe, expect, it } from "vitest";
import { SAR_PER_USD, convertFromSar, formatPrice } from "./currency";

const unit = { sar: "SAR", usd: "USD" };

describe("convertFromSar", () => {
  it("leaves riyals alone", () => {
    expect(convertFromSar(450, "SAR")).toBe(450);
  });

  it("divides by the fixed peg and rounds to a whole dollar", () => {
    expect(SAR_PER_USD).toBe(3.75);
    expect(convertFromSar(450, "USD")).toBe(120);
    expect(convertFromSar(449, "USD")).toBe(120);
    expect(convertFromSar(0, "USD")).toBe(0);
  });
});

describe("formatPrice", () => {
  it("suffixes the localised riyal label", () => {
    expect(formatPrice(450, "SAR", unit)).toBe("450 SAR");
    expect(formatPrice(450, "SAR", { sar: "ر.س", usd: "دولار" })).toBe("450 ر.س");
  });

  it("prefixes the dollar sign", () => {
    expect(formatPrice(450, "USD", unit)).toBe("$120");
  });

  it("groups thousands", () => {
    expect(formatPrice(12500, "SAR", unit)).toBe("12,500 SAR");
    expect(formatPrice(12500, "USD", unit)).toBe("$3,333");
  });
});
