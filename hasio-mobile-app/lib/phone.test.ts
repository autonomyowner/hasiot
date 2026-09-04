import { describe, expect, it } from "vitest";
import { formatPhoneForDisplay, isPlaceholderEmail, normalizeKsaPhone } from "./phone";

describe("normalizeKsaPhone", () => {
  it("accepts every shape a Saudi guest might type", () => {
    // All the same number.
    for (const input of [
      "0501234567",
      "501234567",
      "966501234567",
      "00966501234567",
      "+966501234567",
      "+966 50 123 4567",
      "050-123-4567",
      "(050) 123 4567",
      "  0501234567  ",
    ]) {
      expect(normalizeKsaPhone(input)).toBe("+966501234567");
    }
  });

  it("covers the whole Saudi mobile range", () => {
    for (const prefix of ["50", "53", "54", "55", "56", "58", "59"]) {
      expect(normalizeKsaPhone(`0${prefix}1234567`)).toBe(`+966${prefix}1234567`);
    }
  });

  it("lets a visitor sign in with a foreign number", () => {
    expect(normalizeKsaPhone("+971501234567")).toBe("+971501234567");
    expect(normalizeKsaPhone("+14155552671")).toBe("+14155552671");
    expect(normalizeKsaPhone("00971501234567")).toBe("+971501234567");
  });

  it("rejects anything that could not receive an SMS", () => {
    expect(normalizeKsaPhone("")).toBeNull();
    expect(normalizeKsaPhone("   ")).toBeNull();
    expect(normalizeKsaPhone("12345")).toBeNull();
    expect(normalizeKsaPhone("abcdefghij")).toBeNull();
    // A Saudi landline, which cannot receive a text.
    expect(normalizeKsaPhone("0138001234")).toBeNull();
    // Too few and too many digits.
    expect(normalizeKsaPhone("050123456")).toBeNull();
    expect(normalizeKsaPhone("05012345678")).toBeNull();
    expect(normalizeKsaPhone("+9665012345678901234")).toBeNull();
    // A country code of 0 does not exist.
    expect(normalizeKsaPhone("+0501234567")).toBeNull();
  });

  it("is idempotent", () => {
    const once = normalizeKsaPhone("0501234567")!;
    expect(normalizeKsaPhone(once)).toBe(once);
  });
});

describe("formatPhoneForDisplay", () => {
  it("groups a Saudi number the way it reads aloud", () => {
    expect(formatPhoneForDisplay("+966501234567")).toBe("+966 50 123 4567");
  });

  it("passes anything else through untouched", () => {
    expect(formatPhoneForDisplay("+971501234567")).toBe("+971501234567");
    expect(formatPhoneForDisplay(null)).toBe("");
    expect(formatPhoneForDisplay(undefined)).toBe("");
  });
});

describe("isPlaceholderEmail", () => {
  it("matches the server's definition", () => {
    expect(isPlaceholderEmail("966501234567@phone.hasio.xyz")).toBe(true);
    expect(isPlaceholderEmail("966501234567@PHONE.HASIO.XYZ")).toBe(true);
    expect(isPlaceholderEmail("guest@gmail.com")).toBe(false);
    expect(isPlaceholderEmail(undefined)).toBe(false);
  });
});
