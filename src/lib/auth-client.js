import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { phoneNumberClient } from "better-auth/client/plugins";

// Where the auth routes are reached. In production that is hasio.net itself
// (VITE_AUTH_URL, set for the Cloudflare build): worker/index.js forwards
// /api/auth/* to the Convex site, so the session cookie is first-party and no
// browser's third-party cookie blocking can drop it. Everywhere else it is the
// Convex site directly, as before.
// credentials: "include" still matters for www.hasio.net, which calls hasio.net.
export const AUTH_BASE_URL = import.meta.env.VITE_AUTH_URL || import.meta.env.VITE_CONVEX_SITE_URL

export const authClient = createAuthClient({
  baseURL: AUTH_BASE_URL,
  fetchOptions: {
    credentials: "include",
  },
  // phoneNumberClient: the partner portal signs in by SMS code, like the app.
  // Its verify call fires $sessionSignal, so useSession refetches after it.
  plugins: [convexClient(), phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
