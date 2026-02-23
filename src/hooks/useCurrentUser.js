import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "../lib/auth-client";

export function useCurrentUser() {
  const { data: session, isPending } = authClient.useSession();
  const user = useQuery(api.users.queries.getCurrentUser);

  return {
    user,
    isLoading: isPending || (session && user === undefined),
    isAuthenticated: !!session,
  };
}

export function useConvexAuth() {
  const { data: session, isPending } = authClient.useSession();
  return {
    isAuthenticated: !!session,
    isLoading: isPending,
  };
}
