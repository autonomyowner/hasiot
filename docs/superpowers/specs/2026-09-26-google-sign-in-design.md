# Google sign-in, and booking without Saudi SMS — design

Date: 2026-09-26 · Branch: `google-auth` (from `sdk-57`) · Owner request: "Google sign-up and sign-in
for both the mobile app and the site, so we have a working project until the SMS problem is solved;
keep SMS, but say SMS to Saudi numbers is not supported yet."

## Why

Production SMS (Infobip) cannot reach +966 numbers (`EC_ACCOUNT_NOT_PROVISIONED_FOR_CHANNEL`). The
app's phone field is Saudi-only, so **a new traveller cannot create an account in the app today**,
and a Saudi partner cannot sign in to `/partners`. Email sign-in exists but the app offers no email
sign-up. Google is the fastest way to a working account on both clients.

Booking has a second SMS dependency: `createStayForUser` / `createServiceForUser` refuse anyone
without `phoneVerified`. A Google account has no phone, so Google alone would still leave Saudi
travellers unable to book.

## Decisions

| # | Decision | Why |
|---|---|---|
| G1 | Google via Better Auth `socialProviders.google`, one Google OAuth **web** client for both clients | One redirect URI on the Convex site; no native SDK, no SHA-1 / iOS client ids |
| G2 | The app runs the flow in the system browser (`expo-web-browser`, already in the dev client) using an in-house copy of `@better-auth/expo`'s server plugin (`convex/lib/nativeOAuth.ts`): `/oauth-start` + the callback hook that appends the session cookie to a `hasio://` redirect | **JS-only** — no new native module, no dev-client rebuild |
| G3 | The site also starts the flow through `/oauth-start` (a top-level navigation), not the plain `signIn.social` redirect | The OAuth state cookie is then set first-party on the Convex site; Safari's third-party cookie blocking cannot break the state check |
| G4 | `redirectURI` is `${CONVEX_SITE_URL}/api/auth/callback/google`, set explicitly | `baseURL` is `SITE_URL` (hasio.xyz), which serves no auth routes |
| G5 | Google is **off until configured**: the provider is registered only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, and `getPublicConfig().googleAuth` tells clients whether to show the button | A deploy never shows a button that fails |
| G6 | Saudi SMS availability is one server setting, `SAUDI_SMS_LIVE` (env, `"true"` = live), exposed as `getPublicConfig().saudiSmsLive` | One switch for both clients and the booking rule; the web's hard-coded `SAUDI_SMS_LIVE` constant goes |
| G7 | **Owner's choice:** while Saudi SMS is off, a traveller may book with an **unconfirmed +966 mobile number** they type once (`users/mutations:setContactPhone`). Numbers outside Saudi still need the SMS code. Hosts and providers see "not confirmed by SMS" beside it | Keeps booking working; flipping `SAUDI_SMS_LIVE` restores the old rule with no deploy |
| G8 | Phone sign-in stays. When the number is +966 and Saudi SMS is off (and the backend is not in demo mode), the client does not send the code and says SMS to Saudi numbers is not supported yet, pointing at Google | The owner's words; demo mode on dev keeps phone testable |
| G9 | Account linking uses Better Auth's default: a Google login whose verified email matches an existing email account signs into that account | Existing email users are not split in two |
| G10 | Admin sign-in (`/sign-in`) stays email-only | Admin accounts are email accounts; not asked for |

## Out of scope

Apple sign-in (App Store guideline 4.8 asks for it when a third-party login is offered on iOS — see
Risks), native Google Sign-In, profile photos from Google.

## Risks

- **App Store 4.8 (Login Services):** an app offering Google sign-in on iOS must also offer an
  equivalent privacy-focused option (Sign in with Apple). iOS 1.1.0 review may reject on it.
  Recorded as an open owner decision; not built here.
- The site's session after sign-in is still a third-party cookie on the Convex site (as for email
  and phone today), so Safari users of `/partners` may not stay signed in — pre-existing, unchanged.
- **The `hasio://` hand-off (review, medium):** the session comes back to the app on a custom URL
  scheme, which is not exclusive — a malicious app on the same phone that also claims `hasio://`
  could receive a Google sign-in's session. Same exposure as `@better-auth/expo`. The real fix is a
  verified App Link / Universal Link (`https://hasio.net/auth-callback` + `assetlinks.json` /
  `apple-app-site-association`), a native change that fits the 1.1.0 build — open owner decision.
- **Login CSRF (review, high) — fixed:** `/oauth-start` creates the state itself; see the contract.
- An unconfirmed number can be anyone's. Harm is bounded: it is only shown to the host of a booking
  that person made, marked unconfirmed.

## Owner setup (cannot be done from code)

Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → **Web
application**. Authorised redirect URIs:
`https://hearty-ram-74.eu-west-1.convex.site/api/auth/callback/google` (prod) and
`https://limitless-mockingbird-449.eu-west-1.convex.site/api/auth/callback/google` (dev). Consent
screen: app name Hasio, support email, `hasio.net` as authorised domain, publish to production.
Then `npx convex env set GOOGLE_CLIENT_ID …` and `GOOGLE_CLIENT_SECRET …` (dev, then `--prod`).

## Sign in with Apple (added 2026-09-26, owner: "yes add sign in with apple too")

Why: App Store guideline 4.8 — an iOS app that offers Google sign-in must also offer an equivalent
privacy-focused login, in practice Sign in with Apple. It applies to the iOS app only.

| # | Decision | Why |
|---|---|---|
| A1 | **iOS app only**, with Apple's native sheet (`expo-apple-authentication`). Not on Android, not on the website | 4.8 covers iOS apps; the web/Android flow needs a Services ID and a signed client secret from Nabil's Apple account for no review benefit |
| A2 | The app sends Apple's identity token to Better Auth `POST /sign-in/social { provider: "apple", idToken: { token, nonce } }`; the server verifies it against Apple's keys with audience `com.hasio.travel` and returns a session token like a phone sign-in | No browser hop, no client secret, no custom scheme hand-off |
| A3 | The provider is always registered (it needs no secret for id tokens); `getPublicConfig().appleAuth` says the backend supports it | An older backend never gets a button it cannot serve |
| A4 | The build decides whether the app can use it: `HASIO_IOS_APPLE_SIGNIN="off"` (eas.json, next to `HASIO_IOS_PUSH`) builds without the `com.apple.developer.applesignin` entitlement, and `extra.appleSignIn` hides the button | `EXPO_NO_CAPABILITY_SYNC=1`: EAS will not add the capability, so a build with the entitlement fails to sign until Nabil enables *Sign in with Apple* on the App ID and the profile is regenerated — the same trip as push |
| A5 | Apple gives the person's name only on the first sign-in and never in the token: the app saves it with `updateProfile` right after; the server's name split ignores anything that looks like an email (Better Auth falls back to the email as the display name) | Otherwise "abc@privaterelay.appleid.com" becomes a first name |
| A6 | A fresh random nonce per attempt, passed to Apple and to the server unchanged | Replay protection; Better Auth compares it with the token's claim |

Open (owner / Nabil): enable the capability + regenerate the profile, then remove `HASIO_IOS_APPLE_SIGNIN: "off"`;
Apple also asks apps using Sign in with Apple to revoke the user's Apple tokens when the account is
deleted (REST API with a key from Nabil's account) — not built.
