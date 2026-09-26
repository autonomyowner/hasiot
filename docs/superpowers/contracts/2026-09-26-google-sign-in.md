# Contract — Google sign-in and the Saudi phone rule (2026-09-26)

Design: `docs/superpowers/specs/2026-09-26-google-sign-in-design.md`. Both clients build against this.

## Convex functions

### `config/queries:getPublicConfig` (query, public) — two new fields
```ts
{ mapboxToken: string; demoAuth: boolean;
  googleAuth: boolean;     // GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are both set
  saudiSmsLive: boolean }  // env SAUDI_SMS_LIVE === "true"
```
Clients show the Google button only when `googleAuth`. Clients treat `undefined` (loading) as
"Google hidden" and "Saudi SMS off".

### `users/queries:getCurrentUser` — one new field
Returns the users row as before **plus** `canBook: boolean` — true when the phone rule lets this
person book now: `phoneVerified`, or (Saudi SMS off **and** `phone` is a Saudi mobile
`+9665XXXXXXXX`). Clients gate the Book button on `canBook` instead of `phoneVerified`.

### `users/mutations:setContactPhone` (mutation, signed in) — new
```ts
args: { phone: string }            // E.164, must be +9665 followed by 8 digits
returns: { phone: string; phoneVerified: false }
```
Stores the number on the users row **unverified**. Refusals (`ConvexError`, exact text):
- `Not authenticated`
- `أدخل رقم جوال سعودي صحيح. / Enter a valid Saudi mobile number.` — not `^\+9665\d{8}$`
- `أرقام السعودية تُوثَّق برمز SMS الآن. / Saudi numbers are confirmed by SMS code now.` — Saudi SMS is live
- `رقم جوالك موثّق بالفعل. / Your phone number is already verified.` — the account already has a verified number
- the shared daily-limit text (`rateLimit.ts`) — more than 10 calls a day

### Bookings — unchanged API, changed rule
`createStayBooking`, `createBooking` (slot, if it gates) and `createServiceBooking` accept a person
when `canBook` would be true. Refusal text unchanged:
`يلزم توثيق رقم الجوال قبل الحجز. / A verified phone number is required to book.`

Host / provider inboxes already receive `guest.phoneVerified`; show «غير موثّق برسالة» /
"not confirmed by SMS" beside the number when it is false.

## Auth HTTP (Convex site, `/api/auth`)

| Step | Request | Result |
|---|---|---|
| 1 | Open `GET /oauth-start?provider=google&callbackURL=…&errorCallbackURL=…` **in the browser** (top-level; no fetch before it) | Creates the OAuth state in *that* browser (verification row + signed cookie, first-party), 302 to Google. Untrusted return address → 403; other provider / no callbackURL → 400 |
| 2 | Google → `GET /callback/google` | Success: 302 to `callbackURL` with the session cookie set. Error: 302 to `errorCallbackURL?error=<code>` |

**Changed 2026-09-26 after review:** the first version had the client `POST /sign-in/social` and
pass Google's URL to `/oauth-start`, which copied its state into the cookie. Anyone could mint such
a state, finish Google as themselves and plant it in a victim's browser (login CSRF). `/sign-in/social`
is no longer used by either client.

- **App:** `callbackURL` and `errorCallbackURL` = `hasio://auth-callback`. The server appends
  `cookie=<the Set-Cookie header>` to that redirect. The session token is the value of the cookie
  named `better-auth.session_token` or `__Secure-better-auth.session_token`. URL-decoded it is
  `token.signature`; the bearer is the part **before the first `.`** — the raw token, identical to
  the `token` a phone sign-in returns (verified on dev: the decoded whole value gets 401). Store it
  and call `/convex/token` exactly as for a phone sign-in. An `error` param, or no session cookie,
  is a failed sign-in. A cancel arrives as `?error=access_denied&cookie=better-auth.state%3D%3B…`.
- **Site:** `callbackURL` = `${location.origin}/partners`, `errorCallbackURL` =
  `${location.origin}/partners`. On return, `?error=<code>` means it failed (`access_denied` = the
  person cancelled, say nothing alarming). Server-level failures also land on `/partners?error=…`.
- Origin header: the app sends `Origin: https://www.hasio.xyz` as for every auth call.
- New users get a `users` row through the existing onCreate trigger (role `tourist`, name from
  Google). A Google login whose email matches an existing email account signs into that account.

## Sign in with Apple (iOS app only)

- `getPublicConfig().appleAuth: true` — the backend verifies Apple identity tokens.
- `POST /api/auth/sign-in/social` `{ provider: "apple", idToken: { token: <identityToken>, nonce } }`
  (Origin `https://www.hasio.xyz`) → `{ redirect: false, token, user }`. `token` is the session
  token (bearer), as for a phone sign-in. The token must be issued for `com.hasio.travel` and ≤ 1 h
  old; `nonce` must equal the one passed to Apple. A bad token is refused (currently HTTP 500 from
  Better Auth's verifier — the app treats any non-network failure as "Apple sign-in didn't complete").
- The name is not in the token: the app saves `fullName` (first sign-in only) with
  `users/mutations:updateProfile`. The server ignores email-shaped display names.
- The build must carry the entitlement: `extra.appleSignIn` (env `HASIO_IOS_APPLE_SIGNIN`, "off" in
  eas.json until the capability exists on the App ID).
