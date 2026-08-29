import { ConvexReactClient } from "convex/react";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import {
  getStoredToken,
  getStoredSessionToken,
  fetchConvexToken,
  clearStoredAuth,
} from "./auth";

const CONVEX_URL = process.env.EXPO_PUBLIC_CONVEX_URL;
if (!CONVEX_URL) {
  throw new Error(
    "Missing EXPO_PUBLIC_CONVEX_URL environment variable. " +
    "Set it in your .env or eas.json build config."
  );
}

export const convex = new ConvexReactClient(CONVEX_URL);

// Simple event emitter to notify useAuthFromSecureStore when auth changes
type AuthListener = () => void;
const authListeners = new Set<AuthListener>();

/**
 * Auth hook for ConvexProviderWithAuth.
 * Returns { isLoading, isAuthenticated, fetchAccessToken }.
 */
export function useAuthFromSecureStore() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const tokenRef = useRef<string | null>(null);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const listener = () => setAuthVersion((v) => v + 1);
    authListeners.add(listener);
    return () => { authListeners.delete(listener); };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      // First try to get a cached JWT
      let jwt = await getStoredToken();

      if (!jwt) {
        // No JWT cached — try to get one from session token
        const sessionToken = await getStoredSessionToken();
        if (sessionToken) {
          jwt = await fetchConvexToken(sessionToken);
          if (!jwt) {
            // Session token is dead — don't leave stale user info behind,
            // it would render a signed-in UI whose queries all fail.
            await clearStoredAuth();
          }
        }
      }

      if (mounted) {
        const authenticated = !!jwt;

        tokenRef.current = jwt;
        setIsAuthenticated(authenticated);
        setIsLoading(false);
      }
    }

    checkAuth();
    return () => { mounted = false; };
  }, [authVersion]);

  // Stable callback — no deps on token state, uses ref instead to avoid re-render loop
  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (forceRefreshToken) {
        const sessionToken = await getStoredSessionToken();
        const fresh = sessionToken ? await fetchConvexToken(sessionToken) : null;

        tokenRef.current = fresh;

        if (!fresh) {
          // Convex asked for a fresh token and we can't produce one: the
          // session is gone. Wipe local auth and flip the app to signed-out
          // instead of leaving a signed-in shell with failing queries.
          await clearStoredAuth();
          setIsAuthenticated(false);
        }

        return fresh;
      }
      return tokenRef.current;
    },
    []
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
  // Notify the useAuthFromSecureStore hook to re-check auth state
  authListeners.forEach((listener) => listener());
}
