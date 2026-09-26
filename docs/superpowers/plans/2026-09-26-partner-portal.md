# Partner portal — plan (2026-09-26)

Design: `docs/superpowers/specs/2026-09-26-partner-portal-design.md`. Branch `partners-web` (from
`sdk-57`). No backend change, no deploy. Website only, under `src/partners/`.

## Part 1 — core (one agent, test-first)

1. `vitest.config.js`: add `src/partners/**/*.test.js` to `include` (pure functions only).
2. `src/partners/lib/phone.js` (+ test): `toLatinDigits`, `normalizePhone` — port the app's rules
   (`hasio-mobile-app/lib/phone.ts`, `lib/digits.ts`).
3. `src/partners/lib/gate.js` (+ test): `partnerRoute(user, isAuthenticated)` → one of
   `login | join | verify | hotel | services | admin` per the spec's table.
4. `src/partners/lib/errors.js` (+ test): split `"عربي / English"` by language; fallback text.
5. `src/lib/auth-client.js`: add `phoneNumberClient()` plugin. Check the landing entry chunk is
   unaffected (auth-client is only imported from the authed chunk).
6. `src/partners/PartnersLayout.jsx`: shell (header with wordmark, language toggle, sign out;
   side nav per role; `ToastProvider` + confirm host), `usePartnerGate` redirects,
   `translations` en/ar, `partners.css` (landing palette + fonts, RTL, <850 px top bar).
7. `LoginPage.jsx` (phone → code, resend at 60 s), `JoinPage.jsx` (role → names + businessType →
   `setUserRole`), `VerifyPage.jsx` (upload → `generateUploadUrl` → POST → `saveBusinessDoc`;
   pending / rejected-with-reason / approved states).
8. Routes in `src/main.jsx`, all lazy, nested under `AuthedLayout`. Dashboard routes point at
   placeholder components that Part 2 replaces.
9. Checks: `npm run test`, `npm run lint`, `npm run build` then zero `modulepreload` in
   `dist/index.html`.

## Part 2 — dashboards (two agents in parallel, from Part 1's commit)

**2a Hotel** (`src/partners/hotel/`): overview (`getOwnerStats`), My places (`getMyListings`,
delete via `deleteMyListing` behind confirm), place form new/edit (`submitListing` /
`updateMyListing`; photos via admin `ImageUploader`; hours via `WorkingHoursModal`; payload builder
`placePayload.js` + test mirroring `hasio-mobile-app/lib/listingForm.ts`), bookings inbox
(`getBusinessBookings` + confirm/decline/complete/markNoShow).

**2b Provider** (`src/partners/services/`): overview (`getProviderStats`), My services
(`getMyServices`, `deleteMyService`), service form (`submitService` / `updateMyService`, payload
builder `servicePayload.js` + test mirroring `app/provider/post-service.tsx`), bookings inbox
(`getProviderBookings` + the same actions).

Shared bookings table goes in Part 1 as `src/partners/components/BookingsInbox.jsx` taking
`bookings` + `kind`, so 2a and 2b do not both write it.

## Part 3 — integration and verification (me)

Review both diffs, merge `--no-ff`, run test/lint/typecheck/build, browser smoke on the dev backend
(sign up hotel → doc → approve in `/admin` → post place; same for a provider), update CLAUDE.md.

## Summary

Hotels and service providers get their own sign-in on the website, using their phone like in the app.
After signing up they send a document, and once approved they manage their places or services and bookings.
Nothing goes live until you say so and the text-message codes are made real.
