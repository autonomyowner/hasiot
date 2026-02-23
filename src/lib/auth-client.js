import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";

// NO baseURL — uses same-origin /api/auth/* routes (avoids CORS)
export const authClient = createAuthClient({
  plugins: [convexClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
