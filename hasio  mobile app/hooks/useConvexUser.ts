import { useQuery } from "convex/react";
import { api } from "@/convex";
import { useConvexAuth } from "convex/react";

/**
 * Get the current authenticated user from Convex.
 * Combines Convex auth state with the users table query.
 */
export function useConvexUser() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const user = useQuery(
    api.users.queries.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  const isUserLoading = authLoading || (isAuthenticated && user === undefined);

  return {
    isLoaded: !isUserLoading,
    isSignedIn: isAuthenticated && !!user,
    user: user ?? null,
    isUserLoading,
    userId: user?._id ?? null,
    userType: (user?.role as "tourist" | "business_owner" | "service_provider" | "admin") ?? "tourist",
    isBusinessOwner: user?.role === "business_owner",
    isServiceProvider: user?.role === "service_provider",
    isAdmin: user?.role === "admin",
  };
}

export function useRequireConvexAuth() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(
    api.users.queries.getCurrentUser,
    isAuthenticated ? {} : "skip"
  );

  return {
    isAuthenticated: isAuthenticated && !!user,
    isLoading: isLoading || (isAuthenticated && user === undefined),
    user: user ?? null,
  };
}

export type ConvexUser = NonNullable<
  ReturnType<typeof useConvexUser>["user"]
>;
