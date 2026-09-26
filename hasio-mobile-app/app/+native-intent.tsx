import { isOAuthCallbackLink } from "@/lib/oauthCallback";

/**
 * Keeps Google sign-in's return link out of the router.
 *
 * On Android the browser hands `hasio://auth-callback?cookie=…` back to the
 * app as an ordinary deep link. expo-web-browser's openAuthSessionAsync is
 * listening for it through React Native's Linking and resolves with it — but
 * expo-router hears the same link, and there is no `auth-callback` route, so
 * it would push its "unmatched route" screen over the sign-in screen at the
 * very moment sign-in succeeds, and the screen's own navigation afterwards
 * would go back to *that*. (iOS never delivers it: ASWebAuthenticationSession
 * catches the scheme itself.)
 *
 * This file rather than an empty `app/auth-callback.tsx` route: a route would
 * still be pushed on top of the sign-in screen and need popping by hand, with
 * a frame of blank screen in between. Returning null here means "no
 * navigation" — the app stays exactly where it is and the sign-in screen
 * finishes the flow.
 *
 * The one case left is a cold start *from* that link: Android killed the app
 * while the browser was open. The promise that would have taken the token is
 * gone with the old process, so there is nothing to finish; the app opens at
 * its start instead of on an unmatched route, and the person signs in again.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    if (isOAuthCallbackLink(path)) return initial ? "/" : null;
    return path;
  } catch {
    // Throwing here crashes the app (expo-router's own warning); an unreadable
    // link is simply followed as it came.
    return path;
  }
}
