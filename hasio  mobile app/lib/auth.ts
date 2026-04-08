import * as SecureStore from "expo-secure-store";

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

interface AuthError extends Error {
  status?: number;
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

async function authFetch(path: string, body: Record<string, unknown>) {
  const res = await fetchWithTimeout(`${CONVEX_SITE_URL}/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://www.hasio.xyz",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();

    let message = `Auth request failed (${res.status})`;
    try {
      const json = JSON.parse(text);
      message = json?.message || json?.error?.message || message;
    } catch {}
    const err: AuthError = new Error(message);
    err.status = res.status;
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
  } catch (e) {

    return null;
  }
}

export function getAuthErrorKey(error: unknown): string {
  if (error instanceof TypeError) {
    return "networkError";
  }

  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  const status = (error as AuthError)?.status;

  if (status === 401 || /invalid|credentials|incorrect/.test(msg)) {
    return "wrongCredentials";
  }
  if (status === 404 || /not found|no user|no account/.test(msg)) {
    return "accountNotFound";
  }
  if (status === 422 || /already exists|duplicate|already registered/.test(msg)) {
    return "emailAlreadyExists";
  }
  if (/network|fetch|econnrefused|timeout/.test(msg)) {
    return "networkError";
  }

  return "somethingWentWrong";
}

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
  } catch (e) {

  }

  return { token: sessionToken, user: data.user };
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
  } catch (e) {

  }

  return { token: sessionToken, user: data.user };
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

  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
    await SecureStore.deleteItemAsync(JWT_KEY);
    await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch (e) {

  }
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
