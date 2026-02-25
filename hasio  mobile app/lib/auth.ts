import * as SecureStore from "expo-secure-store";

const CONVEX_SITE_URL =
  process.env.EXPO_PUBLIC_CONVEX_SITE_URL ||
  "https://dazzling-mosquito-29.eu-west-1.convex.site";

const TOKEN_KEY = "hasio_auth_token";
const SESSION_KEY = "hasio_session";

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

async function authFetch(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${CONVEX_SITE_URL}/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    let message = `Auth request failed (${res.status})`;
    try {
      const json = JSON.parse(text);
      message = json?.message || json?.error?.message || message;
    } catch {}
    throw new Error(message);
  }

  return res.json();
}

export async function signIn(email: string, password: string) {
  const data: AuthResponse = await authFetch("/sign-in/email", {
    email,
    password,
  });

  const token = data.token || data.session?.token;
  if (!token) throw new Error("No token received");

  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (data.user) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.user));
  }

  return { token, user: data.user };
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

  const token = data.token || data.session?.token;
  if (!token) throw new Error("No token received");

  await SecureStore.setItemAsync(TOKEN_KEY, token);
  if (data.user) {
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(data.user));
  }

  return { token, user: data.user };
}

export async function signOut() {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);

  if (token) {
    try {
      await fetch(`${CONVEX_SITE_URL}/api/auth/sign-out`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    } catch {
      // Ignore errors — clear local state regardless
    }
  }

  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

export async function getStoredToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function getStoredSession(): Promise<AuthSession["user"] | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function validateSession(): Promise<boolean> {
  const token = await getStoredToken();
  if (!token) return false;

  try {
    const res = await fetch(`${CONVEX_SITE_URL}/api/auth/get-session`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(SESSION_KEY);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
