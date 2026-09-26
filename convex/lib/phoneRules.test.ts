import { afterEach, describe, expect, it, vi } from "vitest";
import { canBookWithPhone, googleProvider, isSaudiMobile, saudiSmsLive } from "./phoneRules";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isSaudiMobile", () => {
  it("accepts +9665 and eight digits", () => {
    expect(isSaudiMobile("+966501234567")).toBe(true);
  });

  it("refuses landlines, other countries, local shapes and junk", () => {
    expect(isSaudiMobile("+966131234567")).toBe(false); // a landline, not a phone a guest carries
    expect(isSaudiMobile("+213551234567")).toBe(false);
    expect(isSaudiMobile("0501234567")).toBe(false);
    expect(isSaudiMobile("+9665012345678")).toBe(false);
    expect(isSaudiMobile(undefined)).toBe(false);
    expect(isSaudiMobile(null)).toBe(false);
  });
});

describe("saudiSmsLive", () => {
  it("is off unless the setting says exactly true", () => {
    vi.stubEnv("SAUDI_SMS_LIVE", "");
    expect(saudiSmsLive()).toBe(false);
    vi.stubEnv("SAUDI_SMS_LIVE", "yes");
    expect(saudiSmsLive()).toBe(false);
    vi.stubEnv("SAUDI_SMS_LIVE", "true");
    expect(saudiSmsLive()).toBe(true);
  });
});

describe("canBookWithPhone", () => {
  it("lets a verified number book, whatever SMS can do", () => {
    expect(canBookWithPhone({ phone: "+213551234567", phoneVerified: true }, true)).toBe(true);
    expect(canBookWithPhone({ phone: "+966501234567", phoneVerified: true }, false)).toBe(true);
  });

  it("lets an unconfirmed Saudi mobile book only while Saudi SMS is off", () => {
    const guest = { phone: "+966501234567", phoneVerified: false };
    expect(canBookWithPhone(guest, false)).toBe(true);
    // Once a code can arrive, the number has to be confirmed like any other.
    expect(canBookWithPhone(guest, true)).toBe(false);
  });

  it("never lets an unconfirmed number from elsewhere book", () => {
    // SMS reaches those countries today, so there is no reason to skip the code.
    expect(canBookWithPhone({ phone: "+213551234567", phoneVerified: false }, false)).toBe(false);
  });

  it("refuses an account with no number at all", () => {
    expect(canBookWithPhone({}, false)).toBe(false);
    expect(canBookWithPhone({ phoneVerified: false }, false)).toBe(false);
  });
});

describe("googleProvider", () => {
  const env = {
    GOOGLE_CLIENT_ID: "id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "secret",
    CONVEX_SITE_URL: "https://example-123.eu-west-1.convex.site",
  };

  it("is absent until both Google keys are set", () => {
    expect(googleProvider({})).toBeUndefined();
    expect(googleProvider({ ...env, GOOGLE_CLIENT_SECRET: "" })).toBeUndefined();
    expect(googleProvider({ ...env, GOOGLE_CLIENT_ID: undefined })).toBeUndefined();
  });

  it("sends Google back to the Convex site, where the auth routes live", () => {
    // Better Auth's baseURL is SITE_URL (the website), which serves no /api/auth.
    expect(googleProvider(env)).toMatchObject({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectURI: "https://example-123.eu-west-1.convex.site/api/auth/callback/google",
    });
  });
});
