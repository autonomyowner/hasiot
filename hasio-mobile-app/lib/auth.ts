import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { appleProfileName, isAppleCancel } from "./appleSignIn";
import { OAUTH_CALLBACK_URL, oauthStartUrl, parseOAuthCallback } from "./oauthCallback";

const CONVEX_SITE_URL = process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
if (!CONVEX_SITE_URL) {
  throw new Error(
    "Missing EXPO_PUBLIC_CONVEX_SITE_URL environment variable. " +
    "Set it in your .env or eas.json build config."
  );
}

const SESSION_TOKEN_KEY = "hasio_session_token"; // Better-Auth session token
const JWT_KEY = "hasio_convex_jwt"; // Convex JWT derived from session
const SESSION_KEY = "hasio_session"; // Cached user info
const AUTH_TIMEOUT_MS = 10000;

interface AuthSession {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

interface AuthResponse {
  token?: string;
  session?: { token: string };
  user?: { id: string; email: string; name: string };
  error?: { message: string };
}

/**
 * A request the auth server refused. `status` is the HTTP status and `code` is
 * Better Auth's machine-readable reason (INVALID_OTP, OTP_EXPIRED, …), which is
 * what lib/authErrors.ts reads to tell the guest what actually went wrong.
 */
interface AuthError extends Error {
  status?: number;
  code?: string;
}

function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = AUTH_TIMEOUT_MS
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new TypeError("Request timeout"));
    }, timeoutMs);

    fetch(url, { ...options, signal: controller.signal })
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
}

async function authFetch(
  path: string,
  body: Record<string, unknown>,
  // Both optional so every existing two-argument call site is untouched.
  // `locale` picks the language of the SMS the server sends; `bearer` is only
  // needed when attaching a phone number to an account that is already signed
  // in, where the request has to be authenticated as that user.
  opts: { locale?: "ar" | "en"; bearer?: string } = {}
) {
  const res = await fetchWithTimeout(`${CONVEX_SITE_URL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Better-Auth checks this against its trustedOrigins list, and a native
      // app sends no Origin of its own.
      Origin: "https://www.hasio.xyz",
      ...(opts.locale ? { "Accept-Language": opts.locale } : {}),
      ...(opts.bearer ? { Authorization: `Bearer ${opts.bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();

    let message = `Auth request failed (${res.status})`;
    let code: string | undefined;
    try {
      const json = JSON.parse(text);
      message = json?.message || json?.error?.message || message;
      // The code used to be dropped here, leaving only the English message to
      // guess from — which is how a wrong one-time code came to be reported as
      // a wrong email or password.
      const raw = json?.code ?? json?.error?.code;
      if (typeof raw === "string") code = raw;
    } catch {}
    const err: AuthError = new Error(message);
    err.status = res.status;
    err.code = code;
    throw err;
  }

  return res.json();
}

/**
 * Exchange the Better-Auth session token for a Convex JWT.
 * This JWT is what Convex actually validates on the server.
 */
export async function fetchConvexToken(sessionToken: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(
      `${CONVEX_SITE_URL}/api/auth/convex/token`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          Origin: "https://www.hasio.xyz",
        },
      },
      AUTH_TIMEOUT_MS
    );

    if (!res.ok) {

      return null;
    }

    const data = await res.json();
    const jwt = data.token;
    if (jwt) {
      await SecureStore.setItemAsync(JWT_KEY, jwt);
    }
    return jwt || null;
  } catch {

    return null;
  }
}

// Moved to lib/authErrors.ts, which is pure and so can be tested under Node —
// this file cannot be, it imports expo-secure-store. Re-exported so every
// existing `import { getAuthErrorKey } from "@/lib/auth"` keeps working.
export { getAuthErrorKey } from "./authErrors";

export async function signIn(email: string, password: string) {
  const data: AuthResponse = await authFetch("/sign-in/email", {
    email,
    password,
  });

  const sessionToken = data.token || data.session?.token;
  if (!sessionToken) throw new Error("No token received");

  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
    if (data.user) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.user));
    }
    // Exchange session token for Convex JWT
    await fetchConvexToken(sessionToken);
  } catch {

  }

  return { token: sessionToken, user: data.user };
}

/**
 * Ask the server to text a one-time code.
 *
 * The code itself is never returned — it goes to the handset. In development
 * the console SMS provider prints it to the Convex logs instead, which is how
 * this is tested without spending real messages.
 */
export async function sendPhoneOtp(phone: string, locale: "ar" | "en" = "ar") {
  await authFetch("/phone-number/send-otp", { phoneNumber: phone }, { locale });
  return { sent: true };
}

/**
 * Check a code, and either sign in or attach the number to the current account.
 *
 * `updatePhoneNumber` is the difference between the two. Attaching requires the
 * caller to already be signed in, so it sends the stored session as a bearer
 * token and returns the session that was already in play — there is nothing new
 * to persist. Signing in fresh returns a new session, which is stored.
 */
export async function verifyPhoneOtp(
  phone: string,
  code: string,
  opts: { updatePhoneNumber?: boolean; locale?: "ar" | "en" } = {}
) {
  const bearer =
    (opts.updatePhoneNumber ? await getStoredSessionToken() : null) ?? undefined;

  if (opts.updatePhoneNumber && !bearer) {
    const err: AuthError = new Error("Not signed in");
    err.status = 401;
    // Coded like a server refusal, so it reads as a lapsed session rather than
    // as the email-and-password failure a bare 401 means on the sign-in path.
    err.code = "NOT_SIGNED_IN";
    throw err;
  }

  const data: AuthResponse = await authFetch(
    "/phone-number/verify",
    {
      phoneNumber: phone,
      code,
      ...(opts.updatePhoneNumber ? { updatePhoneNumber: true } : {}),
    },
    { bearer, locale: opts.locale }
  );

  if (opts.updatePhoneNumber) {
    return { token: data.token ?? null, user: data.user };
  }

  const sessionToken = data.token || data.session?.token;
  if (!sessionToken) throw new Error("No token received");

  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
    if (data.user) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.user));
    }
    await fetchConvexToken(sessionToken);
  } catch {
    // A failed write leaves the caller signed in for this session only, which
    // is better than blocking a verification the server already accepted.
  }

  return { token: sessionToken, user: data.user };
}

/**
 * Sign in (or up) with Google, in the system browser.
 *
 * Everything before the return happens in the browser, set up by the server
 * (convex/lib/nativeOAuth.ts):
 * 1. The browser opens /oauth-start (lib/oauthCallback.ts oauthStartUrl). The
 *    server creates the OAuth state there — its cookie first-party in that
 *    browser, where the callback will check it — and redirects to Google.
 *    The app never mints the state itself with a fetch: a state made outside
 *    the browser that checks it could be handed to someone else's browser
 *    and sign them in as the wrong person (login CSRF).
 * 2. Google returns to the server, which redirects to hasio://auth-callback
 *    with the session's Set-Cookie header in the query. openAuthSessionAsync
 *    (ASWebAuthenticationSession on iOS, a Custom Tab on Android) resolves
 *    with that URL, and lib/oauthCallback.ts lifts the token out of it.
 *
 * Null when the person backed out — closed the browser or pressed Cancel on
 * Google's page. That is a choice, not a failure, so the screen says nothing.
 * JS-only: expo-web-browser is already in the dev client and store builds.
 */
export async function signInWithGoogle(): Promise<{ token: string } | null> {
  const result = await WebBrowser.openAuthSessionAsync(
    oauthStartUrl(CONVEX_SITE_URL!),
    OAUTH_CALLBACK_URL
  );
  if (result.type !== "success") return null;

  const sessionToken = parseOAuthCallback(result.url);
  if (!sessionToken) return null;

  // Stored exactly as a phone sign-in stores its token. The cached user
  // (SESSION_KEY) is cleared rather than fetched: nothing reads it, a
  // fetch would be one more round trip between the person and the app, and
  // an old one would name whoever was signed in before.
  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // As in verifyPhoneOtp: signed in for this session only is still better
    // than refusing a sign-in the server has already accepted.
  }
  const jwt = await fetchConvexToken(sessionToken);
  if (!jwt) {
    // The token did not buy a Convex identity, so there is no signed-in app
    // to go back to. Leave nothing half-stored behind.
    await clearStoredAuth();
    const err: AuthError = new Error("Google sign-in returned an unusable session");
    err.code = "GOOGLE_NO_SESSION";
    throw err;
  }

  return { token: sessionToken };
}

/**
 * Sign in (or up) with Apple — iOS only, with Apple's own sheet.
 *
 * No browser and no redirect: Apple hands the app a signed identity token,
 * and Better Auth verifies it against Apple's public keys with the bundle id
 * as audience (convex/lib/phoneRules.ts appleProvider), then answers with a
 * session token exactly like a phone sign-in's.
 *
 * The nonce is fresh per attempt and sent to Apple and to the server
 * unchanged; Apple copies it into the token and Better Auth checks the two
 * match, so a token lifted from one sign-in cannot be replayed into another.
 *
 * Apple gives the person's name on the first sign-in only and never inside
 * the token, so it is saved here straight away (best effort: a failure costs
 * a name, not the sign-in). Null when the person closed Apple's sheet.
 */
export async function signInWithApple(): Promise<{ token: string } | null> {
  const nonce = Crypto.randomUUID();
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce,
    });
  } catch (error) {
    if (isAppleCancel(error)) return null;
    const err: AuthError = new Error("Apple sign-in failed");
    err.code = "APPLE_FAILED";
    throw err;
  }
  if (!credential.identityToken) {
    const err: AuthError = new Error("Apple returned no identity token");
    err.code = "APPLE_FAILED";
    throw err;
  }

  const data: AuthResponse = await authFetch("/sign-in/social", {
    provider: "apple",
    idToken: { token: credential.identityToken, nonce },
  });
  const sessionToken = data.token || data.session?.token;
  if (!sessionToken) throw new Error("No token received");

  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
    if (data.user) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.user));
    }
  } catch {
    // As in verifyPhoneOtp.
  }
  const jwt = await fetchConvexToken(sessionToken);

  const name = appleProfileName(credential.fullName);
  if (jwt && name) await saveProfileName(jwt, name);

  return { token: sessionToken };
}

/**
 * users/mutations:updateProfile over Convex's HTTP API, with the JWT just
 * issued — the app's Convex client has not picked up the new session yet at
 * this point. Never throws.
 */
async function saveProfileName(jwt: string, name: { firstName?: string; lastName?: string }) {
  const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
  if (!convexUrl) return;
  try {
    await fetchWithTimeout(`${convexUrl}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ path: "users/mutations:updateProfile", args: name, format: "json" }),
    });
  } catch {
    // The account works without it; the person can add a name in Settings.
  }
}

export async function signUp(
  email: string,
  password: string,
  name: string
) {
  const data: AuthResponse = await authFetch("/sign-up/email", {
    email,
    password,
    name,
  });

  const sessionToken = data.token || data.session?.token;
  if (!sessionToken) throw new Error("No token received");

  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
    if (data.user) {
      await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.user));
    }
    // Exchange session token for Convex JWT
    await fetchConvexToken(sessionToken);
  } catch {

  }

  return { token: sessionToken, user: data.user };
}

/**
 * Wipe all locally stored auth state. Does not call the server — use when the
 * session is already known to be dead (e.g. token refresh returned null).
 */
export async function clearStoredAuth() {
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    await SecureStore.deleteItemAsync(JWT_KEY);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {

  }
}

export async function signOut() {
  const sessionToken = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);

  if (sessionToken) {
    try {
      await fetchWithTimeout(`${CONVEX_SITE_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
          Origin: "https://www.hasio.xyz",
        },
      }, 5000);
    } catch {
      // Ignore errors — clear local state regardless
    }
  }

  await clearStoredAuth();
}

/** Get the stored session token (for Better-Auth API calls) */
export async function getStoredSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Get the stored Convex JWT (for Convex WebSocket auth) */
export async function getStoredToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(JWT_KEY);
  } catch {
    return null;
  }
}

export async function getStoredSession(): Promise<AuthSession["user"] | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function validateSession(): Promise<boolean> {
  const token = await getStoredToken();
  return !!token;
}
