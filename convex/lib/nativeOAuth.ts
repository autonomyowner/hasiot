import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, createAuthMiddleware, originCheck } from "better-auth/api";
import { generateState } from "better-auth/oauth2";

/**
 * Social sign-in for clients that are not a page on the auth server's own
 * origin: the mobile app, and the website (hasio.net talking to the Convex
 * site). Modelled on `@better-auth/expo`'s server plugin, kept here because
 * that package pins an exact better-auth version and drags Expo packages into
 * the backend's dependencies as peers.
 *
 * 1. `GET /oauth-start?provider=google&callbackURL=…&errorCallbackURL=…`,
 *    opened by the client as a top-level page in a browser. It creates the
 *    OAuth state *here* — the verification row and Better Auth's signed
 *    `state` cookie, first-party on the Convex site — and redirects to Google.
 *
 *    The state must be born in the browser that finishes the flow. An earlier
 *    version accepted a Google URL minted by a separate /sign-in/social call
 *    and copied its state into the cookie; that let anyone mint a state, finish
 *    Google as themselves, and plant it plus their callback in a victim's
 *    browser — the victim then ended up signed in to the attacker's account
 *    (login CSRF; caught in review 2026-09-26). Minting here closes that: a
 *    state only ever lives in the browser that asked for it.
 *
 *    It also fixes where the cookie lands: a /sign-in/social fetch sets it in
 *    the app's cookie jar (not the browser's) or, on the website, as a
 *    third-party cookie Safari discards — either way the callback's state
 *    check fails.
 *
 * 2. After the OAuth callback, when the redirect goes to a trusted non-http
 *    origin (`hasio://`), the session's Set-Cookie header is appended to it as
 *    `?cookie=`, because a native app never sees the browser's cookies. The app
 *    lifts the session token out of it (lib/auth.ts, signInWithGoogle).
 */

/** Only Google is offered; anything else is a probe. */
const PROVIDERS = new Set(["google"]);

function queryParam(ctx: { request?: Request }, name: string): string | undefined {
  // Read by hand rather than through a zod schema: zod is only a transitive
  // dependency of this package.
  if (!ctx.request) return undefined;
  return new URL(ctx.request.url).searchParams.get(name) ?? undefined;
}

export const nativeOAuth = () =>
  ({
    id: "native-oauth",
    endpoints: {
      oauthStart: createAuthEndpoint(
        "/oauth-start",
        {
          method: "GET",
          // Both return addresses must be trusted origins (the site, or the
          // app's hasio:// scheme) — otherwise this is an open redirect that
          // hands a fresh session to wherever a crafted link points.
          use: [
            originCheck((ctx) =>
              [queryParam(ctx, "callbackURL"), queryParam(ctx, "errorCallbackURL")].filter(
                (url): url is string => !!url
              )
            ),
          ],
        },
        async (ctx) => {
          const providerId = queryParam(ctx, "provider") ?? "";
          const callbackURL = queryParam(ctx, "callbackURL");
          const errorCallbackURL = queryParam(ctx, "errorCallbackURL");
          if (!PROVIDERS.has(providerId) || !callbackURL) {
            throw new APIError("BAD_REQUEST", { message: "Unsupported sign-in request" });
          }
          const provider = ctx.context.socialProviders.find((p) => p.id === providerId);
          if (!provider) {
            throw new APIError("NOT_FOUND", { message: "Google sign-in is not configured" });
          }

          // generateState reads the return addresses from the body, as
          // /sign-in/social passes them; this GET carries them in the query.
          (ctx as { body?: unknown }).body = { callbackURL, errorCallbackURL };
          const { state, codeVerifier } = await generateState(ctx as never, undefined, undefined);
          const url = await provider.createAuthorizationURL({
            state,
            codeVerifier,
            redirectURI: `${ctx.context.baseURL}/callback/${provider.id}`,
          });
          return ctx.redirect(url.toString());
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
