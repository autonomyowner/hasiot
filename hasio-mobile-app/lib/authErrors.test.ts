import { describe, expect, it } from "vitest";
import { translations } from "@/constants/translations";
import {
  AUTH_ERROR_COPY,
  AUTH_ERROR_KINDS,
  describeAuthError,
  getAuthErrorKey,
  getAuthErrorKind,
  isCodeStepError,
  pickLanguageHalf,
} from "./authErrors";

/**
 * What lib/auth.ts throws when the server refuses a request: the server's
 * message, the HTTP status, and Better Auth's machine-readable code.
 */
function refused(status: number, code: string | undefined, message: string) {
  return Object.assign(new Error(message), { status, code });
}

// convex/auth.ts, verbatim: the per-number and daily OTP budget.
const OTP_LIMIT_MESSAGE =
  "طلبت رموزًا كثيرة اليوم. حاول لاحقًا. / Too many codes requested today. Please try again later.";

describe("getAuthErrorKind — the phone sign-in failures", () => {
  it("calls a mistyped code a wrong code, not a wrong email or password", () => {
    const error = refused(400, "INVALID_OTP", "Invalid OTP");
    expect(getAuthErrorKind(error)).toBe("codeWrong");
    expect(getAuthErrorKey(error)).toBe("authCodeWrong");
    expect(getAuthErrorKey(error)).not.toBe("wrongCredentials");
  });

  it("tells an expired or already-used code apart from a wrong one", () => {
    expect(getAuthErrorKind(refused(400, "OTP_EXPIRED", "OTP expired"))).toBe("codeExpired");
    // The server deletes a code once it is used or has run out of attempts.
    expect(getAuthErrorKind(refused(400, "OTP_NOT_FOUND", "OTP not found"))).toBe("codeExpired");
  });

  it("recognises the attempt limit", () => {
    expect(getAuthErrorKind(refused(403, "TOO_MANY_ATTEMPTS", "Too many attempts"))).toBe(
      "tooManyAttempts"
    );
  });

  it("says a taken number is a taken number, whichever spelling of the code arrives", () => {
    // better-call derives the wire code from the message text, so the
    // plugin's PHONE_NUMBER_EXIST reaches the app as ..._ALREADY_EXISTS.
    const onTheWire = refused(400, "PHONE_NUMBER_ALREADY_EXISTS", "Phone number already exists");
    const byConstant = refused(400, "PHONE_NUMBER_EXIST", "Phone number already exists");
    expect(getAuthErrorKind(onTheWire)).toBe("phoneTaken");
    expect(getAuthErrorKind(byConstant)).toBe("phoneTaken");
    expect(getAuthErrorKey(onTheWire)).not.toBe("emailAlreadyExists");
  });

  it("recognises a number the server will not text", () => {
    expect(getAuthErrorKind(refused(400, "INVALID_PHONE_NUMBER", "Invalid phone number"))).toBe(
      "invalidPhone"
    );
  });

  it("treats the server's own OTP budget and Better Auth's limiter as a rate limit", () => {
    expect(getAuthErrorKind(refused(429, "OTP_RATE_LIMITED", OTP_LIMIT_MESSAGE))).toBe("rateLimited");
    expect(
      getAuthErrorKind(refused(429, undefined, "Too many requests. Please try again later."))
    ).toBe("rateLimited");
  });

  it("says a signed-out session when attaching a number needs one", () => {
    expect(getAuthErrorKind(refused(401, "NOT_SIGNED_IN", "Not signed in"))).toBe("sessionExpired");
    // /phone-number/verify with updatePhoneNumber and no session.
    expect(getAuthErrorKind(refused(401, "USER_NOT_FOUND", "User not found"))).toBe("sessionExpired");
  });

  it("still reads the English message when there is no code at all", () => {
    // The original bug, pinned: without a code these must not fall into the
    // email and password branches either.
    expect(getAuthErrorKind(new Error("Invalid OTP"))).toBe("codeWrong");
    expect(getAuthErrorKind(new Error("OTP expired"))).toBe("codeExpired");
    expect(getAuthErrorKind(new Error("Phone number already exists"))).toBe("phoneTaken");
    expect(getAuthErrorKind(new Error("Too many attempts"))).toBe("tooManyAttempts");
  });
});

describe("getAuthErrorKind — email sign-in and the network", () => {
  it("keeps the email failures it always had", () => {
    expect(
      getAuthErrorKind(refused(401, "INVALID_EMAIL_OR_PASSWORD", "Invalid email or password"))
    ).toBe("wrongCredentials");
    expect(getAuthErrorKind(refused(400, "INVALID_EMAIL", "Invalid email"))).toBe("invalidEmail");
    expect(getAuthErrorKind(refused(422, "USER_ALREADY_EXISTS", "User already exists."))).toBe(
      "emailTaken"
    );
    // What auth.tsx throws when the login exists but the app profile is gone.
    expect(getAuthErrorKind(Object.assign(new Error("No account found"), { status: 404 }))).toBe(
      "accountNotFound"
    );
  });

  it("calls a request that never got an answer a connection problem", () => {
    // fetch rejects with a TypeError; lib/auth.ts times out with one too.
    expect(getAuthErrorKind(new TypeError("Network request failed"))).toBe("network");
    expect(getAuthErrorKind(new TypeError("Request timeout"))).toBe("network");
  });

  it("falls back to a plain apology for anything it cannot place", () => {
    expect(getAuthErrorKind(new Error("No token received"))).toBe("unknown");
    expect(getAuthErrorKind(refused(500, undefined, "Auth request failed (500)"))).toBe("unknown");
    expect(getAuthErrorKind(undefined)).toBe("unknown");
    expect(getAuthErrorKind("something odd")).toBe("unknown");
  });
});

describe("the words shown for each failure", () => {
  it.each(AUTH_ERROR_KINDS)("%s has a title that is not its message, in both languages", (kind) => {
    const { title, message } = AUTH_ERROR_COPY[kind];
    for (const language of ["en", "ar"] as const) {
      const table = translations[language] as Record<string, string>;
      expect(table[title], `${language}.${title}`).toBeTruthy();
      expect(table[message], `${language}.${message}`).toBeTruthy();
      expect(table[title]).not.toBe(table[message]);
    }
  });

  it("gives the generic failure a title and a different line under it", () => {
    const { title, message } = describeAuthError(new Error("boom"), "en");
    expect(title).toBe("error");
    expect(message).toBe("pleaseTryAgain");
  });

  it("marks exactly the failures that belong under the code field", () => {
    expect(isCodeStepError("codeWrong")).toBe(true);
    expect(isCodeStepError("codeExpired")).toBe(true);
    expect(isCodeStepError("tooManyAttempts")).toBe(true);
    expect(isCodeStepError("network")).toBe(false);
    expect(isCodeStepError("phoneTaken")).toBe(false);
    expect(isCodeStepError("rateLimited")).toBe(false);
  });
});

describe("describeAuthError — the server's own bilingual words", () => {
  it("shows the half of a rate-limit message in the reader's language", () => {
    const error = refused(429, "OTP_RATE_LIMITED", OTP_LIMIT_MESSAGE);
    expect(describeAuthError(error, "en").serverText).toBe(
      "Too many codes requested today. Please try again later."
    );
    expect(describeAuthError(error, "ar").serverText).toBe("طلبت رموزًا كثيرة اليوم. حاول لاحقًا.");
  });

  it("uses its own copy when the server's message is English only", () => {
    const error = refused(429, undefined, "Too many requests. Please try again later.");
    const described = describeAuthError(error, "ar");
    expect(described.serverText).toBeNull();
    expect(described.message).toBe("authTooManyRequests");
  });

  it("never swaps a precise message for server text", () => {
    // A known failure keeps the app's copy even if the server ever words it
    // bilingually: the app's copy is written for the screen it appears on.
    const error = refused(400, "INVALID_OTP", "رمز خاطئ / Invalid OTP");
    expect(describeAuthError(error, "en").serverText).toBeNull();
  });

  it("prefers a bilingual server message to a bare apology", () => {
    const error = refused(400, "SOMETHING_NEW", "تعذّر ذلك الآن. / That could not be done right now.");
    expect(describeAuthError(error, "en").serverText).toBe("That could not be done right now.");
  });
});

describe("pickLanguageHalf", () => {
  it("splits the house style — Arabic, a spaced slash, English", () => {
    expect(pickLanguageHalf("مرحبا / Hello", "ar")).toBe("مرحبا");
    expect(pickLanguageHalf("مرحبا / Hello", "en")).toBe("Hello");
  });

  it("returns null for anything else", () => {
    expect(pickLanguageHalf("Too many requests. Please try again later.", "en")).toBeNull();
    // A slash inside ordinary English is not a language boundary.
    expect(pickLanguageHalf("Use 05X / +9665X numbers", "en")).toBeNull();
    // English first is not the house order.
    expect(pickLanguageHalf("Hello / مرحبا", "en")).toBeNull();
    expect(pickLanguageHalf("", "ar")).toBeNull();
  });
});

describe("getAuthErrorKind — Google sign-in", () => {
  it("reads every GOOGLE_ code from the return link as a Google failure", () => {
    for (const code of ["GOOGLE_STATE_MISMATCH", "GOOGLE_NO_SESSION", "GOOGLE_NO_URL"]) {
      const error = Object.assign(new Error("Google sign-in failed"), { code });
      expect(getAuthErrorKind(error)).toBe("googleFailed");
      expect(getAuthErrorKey(error)).toBe("authGoogleFailed");
    }
  });

  it("still calls a dropped connection a network failure", () => {
    expect(getAuthErrorKind(new TypeError("Network request failed"))).toBe("network");
  });
});
