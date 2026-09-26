import { describe, expect, it } from "vitest";
import { translations } from "@/constants/translations";
import { describeContactPhoneError } from "./contactPhoneError";

// The server's strings, word for word: CONTACT_PHONE_ERRORS in
// convex/users/contactPhone.ts and the daily limit in convex/rateLimit.ts.
// Their English halves are the API.
const SERVER = {
  INVALID_SAUDI_MOBILE: "أدخل رقم جوال سعودي صحيح. / Enter a valid Saudi mobile number.",
  SMS_IS_LIVE: "أرقام السعودية تُوثَّق برمز SMS الآن. / Saudi numbers are confirmed by SMS code now.",
  ALREADY_VERIFIED: "رقم جوالك موثّق بالفعل. / Your phone number is already verified.",
  DAILY_LIMIT:
    "لقد تجاوزت الحد المسموح لهذا اليوم. يرجى المحاولة غدًا. / Daily limit reached. Please try again tomorrow.",
  NOT_AUTHENTICATED: "Not authenticated",
} as const;

/** A ConvexError, as the client receives it: the text on `data`. */
const convexError = (data: string) => ({ data });

/** A plain server Error, as a development deployment delivers it. */
const convexDev = (message: string) =>
  new Error(
    `[CONVEX M(users/mutations:setContactPhone)] [Request ID: 1a2b] Server Error\nUncaught ConvexError: ${message}\n    at handler (../convex/users/contactPhone.ts:32:11)`
  );

describe("describeContactPhoneError", () => {
  it("puts a number the server will not take under the field", () => {
    for (const error of [convexError(SERVER.INVALID_SAUDI_MOBILE), convexDev(SERVER.INVALID_SAUDI_MOBILE)]) {
      expect(describeContactPhoneError(error)).toEqual({
        key: "invalidPhone",
        field: true,
        alreadyVerified: false,
      });
    }
  });

  it("lets an already verified number carry on to the booking", () => {
    expect(describeContactPhoneError(convexError(SERVER.ALREADY_VERIFIED))).toMatchObject({
      alreadyVerified: true,
    });
  });

  it("says when Saudi SMS has come back", () => {
    expect(describeContactPhoneError(convexError(SERVER.SMS_IS_LIVE)).key).toBe("contactPhoneSmsLive");
  });

  it("names the daily limit as a limit on changing the number", () => {
    expect(describeContactPhoneError(convexError(SERVER.DAILY_LIMIT)).key).toBe("contactPhoneDailyLimit");
  });

  it("reads a lapsed sign-in as an expired session", () => {
    expect(describeContactPhoneError(new Error(SERVER.NOT_AUTHENTICATED)).key).toBe("errorSessionExpired");
  });

  it("falls back to try again for anything else", () => {
    expect(describeContactPhoneError(new Error("Server Error")).key).toBe("pleaseTryAgain");
    expect(describeContactPhoneError(undefined).key).toBe("pleaseTryAgain");
  });

  it("only ever answers with keys that exist in both languages", () => {
    const keys = [
      ...Object.values(SERVER).map((s) => describeContactPhoneError(convexError(s)).key),
      describeContactPhoneError(new Error("Network request failed")).key,
      describeContactPhoneError(undefined).key,
    ];
    for (const key of keys) {
      expect((translations.en as Record<string, string>)[key], `en.${key}`).toBeTruthy();
      expect((translations.ar as Record<string, string>)[key], `ar.${key}`).toBeTruthy();
    }
  });
});
