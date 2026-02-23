import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// Point to Convex site URL where auth routes are registered
// (Vite SPA has no /api/auth routes — they live on Convex HTTP)
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_SITE_URL,
  plugins: [convexClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
