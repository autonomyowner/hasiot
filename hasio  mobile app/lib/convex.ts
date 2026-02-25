import { ConvexReactClient } from "convex/react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { getStoredToken, validateSession } from "./auth";

const CONVEX_URL =
  process.env.EXPO_PUBLIC_CONVEX_URL ||
  "https://dazzling-mosquito-29.eu-west-1.convex.cloud";

export const convex = new ConvexReactClient(CONVEX_URL);

/**
 * Auth hook for ConvexProviderWithAuth.
 * Returns { isLoading, isAuthenticated, fetchAccessToken }.
 */
export function useAuthFromSecureStore() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      const storedToken = await getStoredToken();
      if (!storedToken) {
        if (mounted) {
          setIsAuthenticated(false);
          setToken(null);
          setIsLoading(false);
        }
        return;
      }

      const valid = await validateSession();
      if (mounted) {
        setIsAuthenticated(valid);
        setToken(valid ? storedToken : null);
        setIsLoading(false);
      }
    }

    checkAuth();
    return () => { mounted = false; };
  }, []);

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (forceRefreshToken) {
        const fresh = await getStoredToken();
        setToken(fresh);
        return fresh;
      }
      return token;
    },
    [token]
  );

  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken]
  );
}

/**
 * Call this after sign-in/sign-up to re-trigger auth check.
 * Components using useAuthFromSecureStore will re-render.
 */
export function refreshAuth() {
  // Force the ConvexReactClient to re-fetch the token
  // by clearing and recreating the auth state
  convex.setAuth(async ({ forceRefreshToken }) => {
    const token = await getStoredToken();
    return token;
  });
}
