import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@/backend";

/**
 * Where a business/provider account sits in the admin approval pipeline.
 * - "unverified": role upgraded, but no document uploaded yet
 * - "pending":    document uploaded, waiting on an admin decision
 * - "approved":   admin approved — posting is unlocked
 */
export type VerificationStatus = "unverified" | "pending" | "approved";

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

  // True until it is known whether anyone is signed in. Screens that differ
  // for a guest must wait on this rather than read `isSignedIn` straight
  // away: it is false while the session is still being read, which is how
  // Profile used to greet a signed-in person with the guest page.
  const isUserLoading = authLoading || (isAuthenticated && user === undefined);

  const isBusinessOwner = user?.role === "business_owner";
  const isServiceProvider = user?.role === "service_provider";
  const isAdmin = user?.role === "admin";

  // Admins bypass the approval pipeline entirely; tourists never enter it.
  const isApproved = isAdmin || user?.isApproved === true;
  const hasSubmittedDoc = !!user?.cvFileId;

  const verificationStatus: VerificationStatus = isApproved
    ? "approved"
    : hasSubmittedDoc
    ? "pending"
    : "unverified";

  return {
    isLoaded: !isUserLoading,
    isSignedIn: isAuthenticated && !!user,
    user: user ?? null,
    isUserLoading,
    userId: user?._id ?? null,
    userType: (user?.role as "tourist" | "business_owner" | "service_provider" | "admin") ?? "tourist",
    isBusinessOwner,
    isServiceProvider,
    isAdmin,
    /** True only when the account may actually post listings/services. */
    isApproved,
    hasSubmittedDoc,
    verificationStatus,
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
