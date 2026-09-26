import { describe, expect, it } from "vitest";
import {
  googleSignInAvailable,
  isSaudiMobile,
  saudiSmsBlocked,
  smsBlockedFor,
  userCanBook,
} from "./phoneRules";

describe("isSaudiMobile", () => {
  it("accepts +9665 and eight digits only", () => {
    expect(isSaudiMobile("+966501234567")).toBe(true);
    expect(isSaudiMobile("+966401234567")).toBe(false); // not a mobile
    expect(isSaudiMobile("+96650123456")).toBe(false); // one digit short
    expect(isSaudiMobile("+971501234567")).toBe(false);
    expect(isSaudiMobile("0501234567")).toBe(false); // not normalised
    expect(isSaudiMobile(null)).toBe(false);
  });
});

describe("saudiSmsBlocked", () => {
  it("is blocked when the server says Saudi SMS is off", () => {
    expect(saudiSmsBlocked({ saudiSmsLive: false, demoAuth: false })).toBe(true);
  });

  it("is blocked while the config is still loading, as the contract says", () => {
    expect(saudiSmsBlocked(undefined)).toBe(true);
    expect(saudiSmsBlocked(null)).toBe(true);
  });

  it("is open once Saudi SMS is live", () => {
    expect(saudiSmsBlocked({ saudiSmsLive: true, demoAuth: false })).toBe(false);
  });

  it("stays open in demo mode, so the dev backend can still be tested by phone", () => {
    expect(saudiSmsBlocked({ saudiSmsLive: false, demoAuth: true })).toBe(false);
  });
});

describe("smsBlockedFor", () => {
  const off = { saudiSmsLive: false, demoAuth: false };
  it("blocks a Saudi number only", () => {
    expect(smsBlockedFor("+966501234567", off)).toBe(true);
    expect(smsBlockedFor("+971501234567", off)).toBe(false);
    expect(smsBlockedFor(null, off)).toBe(false);
  });
});

describe("googleSignInAvailable", () => {
  it("needs the server's word and a native platform", () => {
    expect(googleSignInAvailable({ googleAuth: true }, "ios")).toBe(true);
    expect(googleSignInAvailable({ googleAuth: true }, "android")).toBe(true);
    expect(googleSignInAvailable({ googleAuth: true }, "web")).toBe(false);
    expect(googleSignInAvailable({ googleAuth: false }, "ios")).toBe(false);
    expect(googleSignInAvailable(undefined, "ios")).toBe(false);
  });
});

describe("userCanBook", () => {
  it("follows the server's canBook", () => {
    expect(userCanBook({ canBook: true, phoneVerified: false })).toBe(true);
    expect(userCanBook({ canBook: false, phoneVerified: false })).toBe(false);
  });

  it("falls back to a verified phone when an older backend sends no canBook", () => {
    expect(userCanBook({ phoneVerified: true })).toBe(true);
    expect(userCanBook({ phoneVerified: false })).toBe(false);
    expect(userCanBook({})).toBe(false);
  });

  it("is false with no user", () => {
    expect(userCanBook(null)).toBe(false);
    expect(userCanBook(undefined)).toBe(false);
  });
});
