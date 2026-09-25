import { describe, expect, it } from "vitest";
import { EASTERN_PROVINCE_CITIES, toProvinceCity } from "./cities";

describe("toProvinceCity", () => {
  it("returns each of the thirteen cities unchanged", () => {
    expect(EASTERN_PROVINCE_CITIES).toHaveLength(13);
    for (const city of EASTERN_PROVINCE_CITIES) {
      expect(toProvinceCity(city)).toBe(city);
    }
  });

  it("folds sub-areas into the city above them", () => {
    expect(toProvinceCity("Hofuf")).toBe("Al Ahsa");
    expect(toProvinceCity("Mubarraz")).toBe("Al Ahsa");
    expect(toProvinceCity("Dhahran")).toBe("Al Khobar");
    expect(toProvinceCity("Tarout")).toBe("Qatif");
  });

  it("refuses anything outside the province, and blanks", () => {
    expect(toProvinceCity("Riyadh")).toBeNull();
    expect(toProvinceCity("Jeddah")).toBeNull();
    expect(toProvinceCity("")).toBeNull();
    expect(toProvinceCity(undefined)).toBeNull();
    expect(toProvinceCity(null)).toBeNull();
  });
});
