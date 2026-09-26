/**
 * The end of a Google sign-in, as the app receives it.
 *
 * The server finishes Google's OAuth dance in the system browser and then
 * redirects to `hasio://auth-callback`. A browser keeps its cookies to itself,
 * so the server's native-OAuth plugin (convex/lib/nativeOAuth.ts) appends the
 * session's whole Set-Cookie header to that redirect as `?cookie=…`; on a
 * failure it appends `?error=<code>` instead. This turns that URL into the
 * bearer token the rest of lib/auth.ts already knows how to use.
 *
 * Pure — no Expo, no React Native — so it is tested under plain Node
 * (lib/oauthCallback.test.ts). React Native's `URL` has historically thrown
 * "not implemented" on `searchParams`, which is why the query is read by hand.
 */

/** Where the server sends the browser back to. Must be a trusted origin on the server. */
export const OAUTH_CALLBACK_URL = "hasio://auth-callback";

/**
 * The one page the browser opens to start a Google sign-in.
 *
 * The server's /oauth-start creates the OAuth state itself, *in that
 * browser*, and redirects to Google. The app used to mint the state first
 * with a POST to /sign-in/social and hand the browser the resulting Google
 * URL — but a state minted outside the browser can be minted by anyone and
 * handed to someone else's browser (login CSRF: the victim ends up signed in
 * as the attacker), so the state is now only ever born where it is checked.
 */
export function oauthStartUrl(convexSiteUrl: string, provider = "google"): string {
  const base = convexSiteUrl.replace(/\/+$/, "");
  const callback = encodeURIComponent(OAUTH_CALLBACK_URL);
  return (
    `${base}/api/auth/oauth-start?provider=${encodeURIComponent(provider)}` +
    `&callbackURL=${callback}&errorCallbackURL=${callback}`
  );
}

/** Both names Better Auth gives the session cookie: the second on HTTPS. */
const SESSION_COOKIE = /(?:^|[;,]\s*)(?:__Secure-)?better-auth\.session_token=([^;,\s]*)/g;

/** A failed sign-in, coded like lib/auth.ts's server refusals so lib/authErrors.ts can read it. */
export interface OAuthCallbackError extends Error {
  code: string;
}

function fail(code: string, message: string): OAuthCallbackError {
  return Object.assign(new Error(message), { code });
}

function decode(part: string): string {
  // `+` is a space in a query string; URLSearchParams on the server writes
  // spaces that way, and decodeURIComponent alone would leave them as `+`.
  const spaced = part.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

/** The query parameters of a URL, first occurrence of each name wins. */
export function readQuery(url: string): Record<string, string> {
  const params: Record<string, string> = {};
  const start = url.indexOf("?");
  if (start < 0) return params;
  const hash = url.indexOf("#", start);
  const query = url.slice(start + 1, hash < 0 ? undefined : hash);
  for (const pair of query.split("&")) {
    if (!pair) continue;
    const eq = pair.indexOf("=");
    const name = decode(eq < 0 ? pair : pair.slice(0, eq));
    const value = eq < 0 ? "" : decode(pair.slice(eq + 1));
    if (!(name in params)) params[name] = value;
  }
  return params;
}

/**
 * The session token inside a Set-Cookie header, or null when it holds none.
 *
 * The header may carry several cookies joined by ", " — and a cookie's own
 * `Expires=Thu, 01 Jan 1970 …` has a comma in it too, so the header cannot
 * simply be split on commas. The pattern anchors each match to the start of
 * the header or to a `;`/`,` separator and stops at the next one, which a
 * URL-encoded cookie value never contains.
 *
 * The cookie's value is `token.signature`, URL-encoded. Only the part before
 * the first dot is the session token — the same string a phone sign-in's JSON
 * returns as `token` — and it is what the server accepts as a bearer; the whole
 * signed value is refused with a 401 (checked against the dev backend,
 * 2026-09-26). An emptied cookie (`=; Max-Age=0`, a deletion) is skipped.
 */
export function sessionTokenFromSetCookie(header: string): string | null {
  let token: string | null = null;
  for (const match of header.matchAll(SESSION_COOKIE)) {
    // A cookie value is percent-encoded, not form-encoded: a `+` in it is a
    // `+`, so this is not `decode`.
    let value = match[1] ?? "";
    try {
      value = decodeURIComponent(value);
    } catch {
      // Malformed escapes: the raw text is still the best guess.
    }
    const raw = value.split(".")[0]?.trim() ?? "";
    // The last non-empty one wins: if a header both clears and sets the
    // cookie, the setting is what the browser would have kept.
    if (raw) token = raw;
  }
  return token;
}

/**
 * The session token from the URL Google's sign-in came back on.
 *
 * - `error=access_denied` is the person pressing Cancel on Google's page:
 *   returns null, which the screen treats as "backed out" and says nothing.
 *   The error is read first because that redirect also carries a `cookie`
 *   parameter — one that only clears the OAuth state cookie.
 * - any other `error` throws, coded `GOOGLE_<ERROR>` (upper-cased).
 * - no session cookie throws `GOOGLE_NO_SESSION`.
 */
export function parseOAuthCallback(url: string): string | null {
  const params = readQuery(url);

  const error = params.error?.trim();
  if (error) {
    if (error.toLowerCase() === "access_denied") return null;
    const code = `GOOGLE_${error.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}`;
    throw fail(code, `Google sign-in failed: ${error}`);
  }

  const token = params.cookie ? sessionTokenFromSetCookie(params.cookie) : null;
  if (!token) throw fail("GOOGLE_NO_SESSION", "Google sign-in returned no session");
  return token;
}

/**
 * Whether an incoming link is the OAuth return. On Android the redirect also
 * reaches expo-router as an ordinary deep link; app/+native-intent.tsx uses
 * this to keep it from being routed anywhere.
 */
export function isOAuthCallbackLink(path: string): boolean {
  return /^(?:hasio:\/\/|\/)?\/?auth-callback(?:[/?#]|$)/i.test(path.trim());
}
