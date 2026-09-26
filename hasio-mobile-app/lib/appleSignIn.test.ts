import { describe, expect, it } from "vitest";
import { appleProfileName, appleSignInAvailable, isAppleCancel } from "./appleSignIn";

describe("appleSignInAvailable", () => {
  const config = { appleAuth: true };

  it("is offered on iOS when the backend and the build both support it", () => {
    expect(appleSignInAvailable(config, "ios", true)).toBe(true);
  });

  it("is never offered on Android or the web — guideline 4.8 is about iOS", () => {
    expect(appleSignInAvailable(config, "android", true)).toBe(false);
    expect(appleSignInAvailable(config, "web", true)).toBe(false);
  });

  it("waits for a backend that says so, and a build with the entitlement", () => {
    expect(appleSignInAvailable(undefined, "ios", true)).toBe(false);
    expect(appleSignInAvailable({}, "ios", true)).toBe(false);
    expect(appleSignInAvailable(config, "ios", false)).toBe(false);
    expect(appleSignInAvailable(config, "ios", undefined)).toBe(false);
  });
});

describe("appleProfileName", () => {
  it("takes the name Apple hands over on the first sign-in", () => {
    expect(appleProfileName({ givenName: "Sara", familyName: "Al Qahtani" })).toEqual({
      firstName: "Sara",
      lastName: "Al Qahtani",
    });
    expect(appleProfileName({ givenName: " Sara ", familyName: null })).toEqual({ firstName: "Sara" });
  });

  it("is null on every later sign-in, when Apple sends no name", () => {
    expect(appleProfileName(null)).toBeNull();
    expect(appleProfileName({ givenName: null, familyName: null })).toBeNull();
    expect(appleProfileName({ givenName: "  ", familyName: "" })).toBeNull();
  });
});

describe("isAppleCancel", () => {
  it("recognises the person closing Apple's sheet", () => {
    expect(isAppleCancel({ code: "ERR_REQUEST_CANCELED" })).toBe(true);
    expect(isAppleCancel({ code: "ERR_REQUEST_FAILED" })).toBe(false);
    expect(isAppleCancel(new Error("x"))).toBe(false);
    expect(isAppleCancel(null)).toBe(false);
  });
});
