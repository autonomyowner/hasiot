import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";

/**
 * Social sign-in for clients that are not a page on the auth server's own
 * origin: the mobile app, and the website (hasio.net talking to the Convex
 * site). The same two pieces as `@better-auth/expo`'s server plugin, kept here
 * because that package pins an exact better-auth version and drags Expo
 * packages into the backend's dependencies as peers.
 *
 * 1. `GET /oauth-start?authorizationURL=…` — the client first asks
 *    /sign-in/social for Google's URL (with `disableRedirect`), then opens this
 *    in a browser as a top-level page. It sets Better Auth's signed `state`
 *    cookie *here*, first-party on the Convex site, and redirects to Google.
 *    Without it the cookie is whatever the /sign-in/social fetch left behind:
 *    in the app that is a different cookie jar from the browser's, and on the
 *    website it is a third-party cookie Safari throws away — either way the
 *    callback fails its state check.
 *
 * 2. After the OAuth callback, when the redirect goes to a trusted non-http
 *    origin (`hasio://`), the session's Set-Cookie header is appended to it as
 *    `?cookie=`, because a native app never sees the browser's cookies. The app
 *    lifts the session token out of it (lib/auth.ts, signInWithGoogle).
 */
export const nativeOAuth = () =>
  ({
    id: "native-oauth",
    endpoints: {
      oauthStart: createAuthEndpoint(
        "/oauth-start",
        { method: "GET" },
        async (ctx) => {
          // Read by hand rather than through a zod schema: zod is only a
          // transitive dependency here, and this is one string.
          const authorizationURL = ctx.request
            ? new URL(ctx.request.url).searchParams.get("authorizationURL")
            : null;
          if (!authorizationURL) {
            throw new APIError("BAD_REQUEST", { message: "Missing authorization URL" });
          }
          let target: URL;
          try {
            target = new URL(authorizationURL);
          } catch {
            throw new APIError("BAD_REQUEST", { message: "Invalid authorization URL" });
          }
          // Only ever a hop to Google's consent page — never an open redirect
          // to wherever a crafted link points.
          if (target.protocol !== "https:" || target.hostname !== "accounts.google.com") {
            throw new APIError("BAD_REQUEST", { message: "Unsupported authorization URL" });
          }
          const state = target.searchParams.get("state");
          if (!state) throw new APIError("BAD_REQUEST", { message: "Missing state" });

          const stateCookie = ctx.context.createAuthCookie("state", { maxAge: 300 * 1000 });
          await ctx.setSignedCookie(stateCookie.name, state, ctx.context.secret, stateCookie.attributes);
          return ctx.redirect(authorizationURL);
        }
      ),
    },
    hooks: {
      after: [
        {
          matcher: (context) => !!context.path?.startsWith("/callback"),
          handler: createAuthMiddleware(async (ctx) => {
            const headers = ctx.context.responseHeaders;
            const location = headers?.get("location");
            if (!location) return;
            const nativeTarget = ctx.context.trustedOrigins
              .filter((origin) => !origin.startsWith("http"))
              .some((origin) => location.startsWith(origin));
            if (!nativeTarget) return;
            const cookie = headers?.get("set-cookie");
            if (!cookie) return;
            const url = new URL(location);
            url.searchParams.set("cookie", cookie);
            ctx.setHeader("location", url.toString());
          }),
        },
      ],
    },
  }) satisfies BetterAuthPlugin;
