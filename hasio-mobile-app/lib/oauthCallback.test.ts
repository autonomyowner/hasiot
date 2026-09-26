import { describe, expect, it } from "vitest";
import {
  isOAuthCallbackLink,
  oauthStartUrl,
  parseOAuthCallback,
  readQuery,
  sessionTokenFromSetCookie,
} from "./oauthCallback";

describe("oauthStartUrl", () => {
  it("opens the server's own start page, with both returns to the app encoded", () => {
    expect(oauthStartUrl("https://limitless-mockingbird-449.eu-west-1.convex.site")).toBe(
      "https://limitless-mockingbird-449.eu-west-1.convex.site/api/auth/oauth-start" +
        "?provider=google&callbackURL=hasio%3A%2F%2Fauth-callback&errorCallbackURL=hasio%3A%2F%2Fauth-callback"
    );
  });

  it("does not double a trailing slash on the site URL", () => {
    expect(oauthStartUrl("https://x.convex.site/")).toMatch(/^https:\/\/x\.convex\.site\/api\/auth\/oauth-start\?/);
  });

  it("round-trips through a query reader", () => {
    expect(readQuery(oauthStartUrl("https://x.convex.site"))).toEqual({
      provider: "google",
      callbackURL: "hasio://auth-callback",
      errorCallbackURL: "hasio://auth-callback",
    });
  });
});

// A session token and its signature as Better Auth writes them: the cookie's
// value is `token.signature`, URL-encoded (the signature is base64, so `=` and
// `/` arrive as %3D and %2F).
const TOKEN = "pTq3kX9bLmN2vR7sYw4zA1cD5eF8gH0j";
const SIGNATURE = "Zm9vYmFyYmF6/cXV4+cXV1eA==";
const COOKIE_VALUE = encodeURIComponent(`${TOKEN}.${SIGNATURE}`);

/** The redirect the server builds: `cookie` set with URLSearchParams, as nativeOAuth.ts does. */
function callback(params: Record<string, string>): string {
  return `hasio://auth-callback?${new URLSearchParams(params).toString()}`;
}

// Several cookies joined by ", " (how a Fetch Headers object reads a repeated
// Set-Cookie), including an `Expires` date with its own comma.
const SET_COOKIE_HTTPS = [
  `__Secure-better-auth.session_token=${COOKIE_VALUE}; Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=None`,
  "__Secure-better-auth.session_data=eyJzZXNzaW9uIjp7fX0; Max-Age=300; Path=/; HttpOnly; Secure; SameSite=None",
  "__Secure-better-auth.state=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; Path=/",
].join(", ");

describe("sessionTokenFromSetCookie", () => {
  it("takes the token before the signature from the secure cookie", () => {
    expect(sessionTokenFromSetCookie(SET_COOKIE_HTTPS)).toBe(TOKEN);
  });

  it("reads the plain cookie name as well", () => {
    expect(
      sessionTokenFromSetCookie(`better-auth.session_token=${COOKIE_VALUE}; Path=/; HttpOnly`)
    ).toBe(TOKEN);
  });

  it("is not fooled by the comma in an Expires date before the session cookie", () => {
    const header = [
      "better-auth.state=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0",
      `better-auth.session_token=${COOKIE_VALUE}; Max-Age=604800`,
    ].join(", ");
    expect(sessionTokenFromSetCookie(header)).toBe(TOKEN);
  });

  it("ignores the session_data cookie and a cleared session cookie", () => {
    expect(
      sessionTokenFromSetCookie(
        "better-auth.session_data=abc.def; Path=/, better-auth.session_token=; Max-Age=0"
      )
    ).toBeNull();
  });

  it("is null when there is no session cookie at all", () => {
    expect(sessionTokenFromSetCookie("better-auth.state=; Max-Age=0")).toBeNull();
    expect(sessionTokenFromSetCookie("")).toBeNull();
  });
});

describe("parseOAuthCallback", () => {
  it("returns the session token of a successful sign-in", () => {
    expect(parseOAuthCallback(callback({ cookie: SET_COOKIE_HTTPS }))).toBe(TOKEN);
  });

  it("treats a cancel on Google's page as backing out, not an error", () => {
    // Exactly what the dev backend sent on 2026-09-26: the error, plus a
    // cookie parameter that only clears the OAuth state.
    const url =
      "hasio://auth-callback?error=access_denied&cookie=better-auth.state%3D%3B+Max-Age%3D0";
    expect(parseOAuthCallback(url)).toBeNull();
  });

  it("reads the error before any cookie", () => {
    const url = callback({ error: "state_mismatch", cookie: SET_COOKIE_HTTPS });
    expect(() => parseOAuthCallback(url)).toThrow(
      expect.objectContaining({ code: "GOOGLE_STATE_MISMATCH" })
    );
  });

  it("codes any other error GOOGLE_<ERROR>", () => {
    expect(() => parseOAuthCallback(callback({ error: "unable_to_create_user" }))).toThrow(
      expect.objectContaining({ code: "GOOGLE_UNABLE_TO_CREATE_USER" })
    );
  });

  it("fails, coded, when the redirect carries no session", () => {
    expect(() =>
      parseOAuthCallback(callback({ cookie: "better-auth.state=; Max-Age=0" }))
    ).toThrow(expect.objectContaining({ code: "GOOGLE_NO_SESSION" }));
    expect(() => parseOAuthCallback("hasio://auth-callback")).toThrow(
      expect.objectContaining({ code: "GOOGLE_NO_SESSION" })
    );
  });
});

describe("readQuery", () => {
  it("decodes + as a space and percent escapes, and drops the fragment", () => {
    expect(readQuery("hasio://x?a=one+two&b=%3D%3B#frag")).toEqual({ a: "one two", b: "=;" });
  });

  it("keeps the first of a repeated name", () => {
    expect(readQuery("hasio://x?a=1&a=2")).toEqual({ a: "1" });
  });
});

describe("isOAuthCallbackLink", () => {
  it.each([
    "hasio://auth-callback?cookie=abc",
    "hasio://auth-callback",
    "hasio:///auth-callback?error=access_denied",
    "/auth-callback?cookie=abc",
    "auth-callback",
  ])("recognises %s", (link) => {
    expect(isOAuthCallbackLink(link)).toBe(true);
  });

  it.each(["hasio://bookings/abc", "/", "/auth", "hasio://auth-callbacks"])(
    "leaves %s alone",
    (link) => {
      expect(isOAuthCallbackLink(link)).toBe(false);
    }
  );
});
