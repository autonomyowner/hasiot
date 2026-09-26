import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { phoneNumberClient } from "better-auth/client/plugins";

// Point to Convex site URL where auth routes are registered
// credentials: "include" ensures cross-origin cookies are sent/received
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  fetchOptions: {
    credentials: "include",
  },
  // phoneNumberClient: the partner portal signs in by SMS code, like the app.
  // Its verify call fires $sessionSignal, so useSession refetches after it.
  plugins: [convexClient(), phoneNumberClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
