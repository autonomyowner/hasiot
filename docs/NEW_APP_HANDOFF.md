# Hasio — new mobile app (full rebuild) handoff

_Written 2026-09-03 from the `phase-1-stays` branch of `D:\hasiot`. Copy this file into the new
project as `CLAUDE.md` (or reference it from there) so every session starts with it._

## What this project is

A **from-scratch rewrite of the Hasio mobile app**: new code, new structure, new design. Same
product, same goal, **same Convex backend, same Play Store and App Store listings**. When it ships it
*replaces* the app in `D:\hasiot\hasio-mobile-app` as a normal store update — the stores only care
about identity (bundle id, signing, version numbers), not code.

Hasio is an **Al-Ahsa (الأحساء) travel guide**: stays (hotel bookings), a directory of places, an AI
travel planner, business-owner and service-provider accounts, favourites. Read
`D:\hasiot\CLAUDE.md` in full before doing anything — it is the product bible and every rule in it
still applies here.

**The backend is not copied into this project.** It lives in `D:\hasiot\convex` and is deployed from
there. This project is a client only.

## Where everything is — `D:\hasiot` (check there before guessing)

| Path (under `D:\hasiot\`) | What it is |
|---|---|
| `CLAUDE.md` | Product rules, backend architecture, auth/bookings rules, store history |
| `convex/` | Backend source. One folder per domain (`users`, `listings`, `services`, `bookings`, `trips`, `travelPlanner`, `notifications`, `moments`, `moderation`, `admin`) |
| `convex/schema.ts` | Every table and index |
| `convex/_generated/api.d.ts`, `dataModel.d.ts` | The typed API — the authoritative list of functions and their args |
| `hasio-mobile-app/` | **The app being replaced.** Reference for behaviour, backend usage, edge cases |
| `hasio-mobile-app/lib/auth.ts`, `lib/convex.ts` | The Better-Auth ↔ Convex bridge — copy wholesale (see Auth) |
| `hasio-mobile-app/lib/convexUpload.ts`, `lib/push.ts`, `hooks/usePushRegistration.ts` | Upload + push patterns that already work |
| `hasio-mobile-app/lib/phone.ts`, `lib/dates.ts`, `lib/bookingDisplay.ts` (+ `*.test.ts`) | Pure, tested helpers (KSA phone normalisation, Riyadh dates, booking display). Copy as-is |
| `hasio-mobile-app/app.json`, `eas.json`, `credentials.json`, `credentials/`, `appstore-connect-api-key.p8`, `google-service-account.json` | **Store identity + signing** (see next section) |
| `hasio-mobile-app/docs/` | `DATA_SAFETY_ANSWERS.md`, `privacy-policy.html`, `terms-of-service.html` |
| `hasio-mobile-app/Hasio iOS mobile app flow new design/Hasio iOS Flow.dc.html` | The design canvas (untracked in git) — 5 screens: Home, Explore, Destination, Plan, Stay |
| `docs/plans/2026-09-03-mobile-redesign.md` | The canvas **decoded into numbers**: palette, glass recipes, type scale, per-screen specs |
| `docs/plans/2026-09-03-phase1-stays-plan.md` | How stays/bookings/OTP/notifications were designed |
| `docs/PHASE1_RELEASE_CHECKLIST.md` | Backend-first release order + the env vars prod needs |
| `IOS_RELEASE_STATUS.md` | **iOS shipping playbook. Mandatory reading before any iOS build** |
| `TODO.md` | Bookings roadmap |
| `src/admin/` | Website admin panel (approves listings, services, accounts; manages bookings). Not touched here, but it is the other half of every approval flow |

The old repo is git; branch state as of writing: `main` = what is deployed to production,
`phase-1-stays` = 42 unmerged commits (stays bookings, phone OTP, notifications, Expo SDK 57).

## Store identity — copy exactly

This is what makes the new binary "the same app" to both stores.

```jsonc
// app.json → expo
"slug": "hasio",
"owner": "autonomy",
"scheme": "hasio",
"ios":     { "bundleIdentifier": "com.hasio.travel", "supportsTablet": false,
             "infoPlist": { "ITSAppUsesNonExemptEncryption": false } },
"android": { "package": "com.hasio.travel" },
"runtimeVersion": { "policy": "appVersion" },
"updates": { "url": "https://u.expo.dev/8859775e-cedf-45b7-aa94-3c7cbfb7be12" },
"extra": { "eas": { "projectId": "8859775e-cedf-45b7-aa94-3c7cbfb7be12" } }
```

**Versions.** Live: Android `1.0.0` (versionCode 11, last verified 2026-05-15 — check Play Console,
the branch's app.json is already at 14); iOS `1.0.2` (build 6). The old branch is at `1.1.0`. The new
app must ship as **`version` ≥ `2.0.0`**, `android.versionCode` > 14, `ios.buildNumber` > 6 (EAS
`autoIncrement` bumps both; `appVersionSource: "local"` means app.json is the source of truth).

**Android signing** — the upload keystore is **EAS-managed, remote** (Build Credentials ID
`GDSrtB1EXC`). You get it automatically by building under the same EAS project id + owner. Never
`--clear-credentials`. Play submit needs `google-service-account.json` (may be missing on disk —
if so, upload the AAB through Play Console manually).

**iOS signing** — local files, all gitignored, copy them over by hand:
`credentials.json` → `credentials/hasio_dist.p12` + `credentials/hasio.mobileprovision`
(cert + profile expire **2027-08-11**), `appstore-connect-api-key.p8`. Published through a third
party's Apple team (**W23759GRP4**, ascAppId **6800297588**, ASC key `UR3PAK97LX`, issuer
`30cc1bab-a280-4644-8b93-900bcb21b973`). `eas.json` production profile has
`credentialsSource: "local"` and `EXPO_NO_CAPABILITY_SYNC: "1"` — both required, we have no Apple ID
login. **Never run `eas credentials` "set up all"** — it demands that login.

**`eas.json`** — copy verbatim (profiles, baked-in env, submit blocks). Root `.gitignore` of the old
repo blocks `*.p8 *.p12 *.mobileprovision *.jks google-service-account.json credentials.json
credentials/` — replicate that before the first commit here.

**Don't**: create a new EAS project, change bundle id / package, or reuse `version` `1.x` — a new
runtime version is also the safety catch that stops any OTA from reaching old binaries.

## Backend contract

**Production Convex**: `https://hearty-ram-74.eu-west-1.convex.cloud` /
`https://hearty-ram-74.eu-west-1.convex.site`. **Dev**: `limitless-mockingbird-449.eu-west-1.*`.
The `eu-west-1` segment is mandatory — without it auth 401s.

Env: `EXPO_PUBLIC_CONVEX_URL`, `EXPO_PUBLIC_CONVEX_SITE_URL` in `.env` (and baked into
`eas.json`). `.env.local` overrides `.env`. The old client throws at startup if either is missing —
keep that.

**Typed API without a `convex/` folder.** Never put a directory named `convex/` in the app — Metro
resolves `@/convex` to the `convex` npm package and every call fails with "Cannot read property of
undefined". The pattern that works (`hasio-mobile-app/backend/index.ts`):

```ts
import { anyApi } from "convex/server";
import type { api as FullApi } from "<path to D:/hasiot/convex/_generated/api>";
export const api: typeof FullApi = anyApi as unknown as typeof FullApi;
```

Type-only import, erased at runtime. Point it at `D:\hasiot\convex\_generated\` by relative path
(old tsconfig maps `convex/_generated/*` → `../convex/_generated/*`), or copy `api.d.ts` +
`dataModel.d.ts` in and re-copy after backend changes. Pin `convex` to the backend's version
(`1.32.0` in `D:\hasiot\package.json`).

### Auth (Better-Auth on Convex HTTP)

Endpoints under `${EXPO_PUBLIC_CONVEX_SITE_URL}/api/auth`: `/sign-in/email`, `/sign-up/email`,
`/phone-number/send-otp`, `/phone-number/verify` (+ `updatePhoneNumber: true` to attach a number
to a signed-in account), `/sign-out`, and `GET /convex/token` (Bearer session token → Convex JWT).

- **A native app must send `Origin: https://www.hasio.xyz`** on every auth request — Better-Auth
  checks it against `trustedOrigins`. `expo/fetch` (the global since SDK 56) passes it through.
- Flow: sign in → session token → exchange for Convex JWT → `ConvexProviderWithAuth` with a
  `useAuth` hook whose `fetchAccessToken({forceRefreshToken})` re-exchanges and, on failure,
  wipes local auth and flips to signed-out. `lib/convex.ts` + `lib/auth.ts` do all of this
  including the OTP error-code mapping (`INVALID_OTP`, `OTP_EXPIRED`, `OTP_RATE_LIMITED`…). Copy them.
- **SecureStore keys**: `hasio_session_token`, `hasio_convex_jwt`, `hasio_session`. Reuse the names
  and upgraders stay signed in; rename them and every upgrader is logged out (acceptable, but decide).
- Phone numbers must be E.164 (`normalizeKsaPhone` in `lib/phone.ts`); phone sign-ups get a
  placeholder email on `phone.hasio.xyz`. After an **email** sign-in call
  `users.mutations.ensureAuthLink` once.
- `getCurrentUser` returns `null` for suspended accounts — treat null-while-authenticated as signed out.

### Users, roles, approval

`role`: `tourist | business_owner | service_provider | admin`. Tourist → `setUserRole({role,
businessType?, firstName?, lastName?})` → upload document (`generateUploadUrl` → POST →
`saveBusinessDoc({fileId})`) → admin approves on the website. Derive UI state exactly as the old
`hooks/useConvexUser.ts` does: `isApproved = role === "admin" || user.isApproved`;
`verificationStatus = approved ? "approved" : cvFileId ? "pending" : "unverified"`.
Business/provider content (`submitListing`, `submitService`) starts `pending`; editing resets to
`pending`; only `approved` is public.

### Uploads

`generateUploadUrl` → `FileSystem.uploadAsync(url, uri, {httpMethod:"POST", uploadType:
BINARY_CONTENT, headers:{"Content-Type"}})` → `{storageId}` → `users.queries.getStorageUrl`.
`uploadAsync` must be imported from **`expo-file-system/legacy`** (the default export's stubs
throw). Listing images are stored as URL strings; verification docs as the raw storage id.

### Bookings (stays)

Server prices everything: `bookings.queries.quoteStay` live while picking dates, then
`bookings.mutations.createStayBooking` — never send a total. Check-out exclusive. All dates are
Riyadh dates (`lib/dates.ts`). Bookable = `type === "hotel" && pricePerNight` set. Statuses
`pending | confirmed | completed | cancelled | no_show | declined | expired`; allowed transitions
live in `convex/bookings/logic.ts` (`canTransition`) — mirror them, don't invent.

### AI planner

`travelPlanner.actions.planTravel` — multi-turn; returns `ready:false` (follow-up question) or
`ready:true` (plan). Rate-limited per user / per anonymous `sessionId` (20 / 5 / 1000 per day); the
old store persists a generated `sessionId` for signed-out use.

### Push

`users.mutations.registerPushToken({token, language})` on launch while signed in + enabled,
`unregisterPushToken({token})` on sign-out/disable. `lib/push.ts` returns `null` wherever push is
unavailable (Expo Go, simulator, web) and that is a normal state — the in-app inbox
(`notifications.queries.listMine`, `unreadCount`, `mutations.markRead/markAllRead`) carries everything.

### ⚠️ What production actually has today

**Prod (`hearty-ram-74`) runs `main`: email + password only, slot bookings, no notifications, no
push tokens, no `quoteStay`, no phone OTP.** Everything below marked *branch* exists only on
`phase-1-stays` / the dev deployment. If the new app uses any of it, **deploy that backend to prod
first** (`docs/PHASE1_RELEASE_CHECKLIST.md` §1–2: Twilio Verify + Resend env vars, `npx convex
deploy --yes` from `D:\hasiot` on that branch, backfills, then the website admin from `main` +
branch). Build 4 crashed on the App Store by shipping a client that called a function prod did not
have. Verify with: `cd D:\hasiot && npx convex function-spec --prod | grep <name>`.

Functions the old app calls (the surface area to cover):

| Domain | In prod now | *branch only* |
|---|---|---|
| users | `getCurrentUser`, `getFavorites`, `getStorageUrl`, `generateUploadUrl`, `saveBusinessDoc`, `setUserRole`, `toggleFavorite`, `updateProfile`, `deleteMyAccount`, `createUser` | `ensureAuthLink`, `registerPushToken`, `unregisterPushToken`, `setPreferredLanguage` |
| listings | `listListings`, `listListingsPaginated`, `searchListings`, `getListing`, `getCategories`, `getCities`, `getListingsNearLocation`, `getMyListings`, `submitListing`, `updateMyListing`, `deleteMyListing` | `pricePerNight` field + `listings/pricing.ts` |
| reviews | `listForListing`, `getSummary`, `getMine`, `listMyReviewablePlaces`, `addReview`, `updateMyReview`, `deleteMyReview` | new module; verification is server-decided |
| services | `listServices`, `listServicesPaginated`, `getService`, `searchServices`, `getServiceCities`, `getMyServices`, `submitService`, `updateMyService`, `deleteMyService` | — |
| bookings | `createBooking`, `cancelBooking`, `rescheduleBooking`, `confirmBooking`, `completeBooking`, `getUserBookings`, `getBooking`, `getAvailableSlots`, `getUpcomingCount`, `getBusinessBookings`, `getListingSchedule` | `quoteStay`, `createStayBooking`, `declineBooking`, `markNoShow`, `getOwnerStats` (and the stay-aware rewrites of the others) |
| notifications | — | `listMine`, `unreadCount`, `getNotification`, `markRead`, `markAllRead` |
| trips | `getMyTrips`, `getTrip`, `getMyTripSummaries`, `createTrip`, `addStopToTrip`, `updateStop`, `removeStop`, `reorderStops`, `updateTrip`, `deleteTrip`, `convertPlanToTrip` | — |
| travelPlanner | `planTravel` (action), `getMyPlans`, `getPlan` | — |
| moments | `getMyMoments`, `createMoment`, `deleteMoment` | — |
| moderation | `reportContent`, `blockUser`, `unblockUser`, `getMyBlockedUsers`, `getMyBlockedUserIds` | — |
| auth | email + password | phone OTP, Better-Auth triggers creating the `users` row (on `main` the client must call `createUser` after sign-up) |

## Local state left behind on upgraders' devices

The old app persists a zustand blob in AsyncStorage under **`hasio-storage`** (`language`,
`hasCompletedOnboarding`, `favorites`, `moments`, `dayPlans`, `notificationsEnabled`, `sessionId`)
plus the three SecureStore keys above. The new app will be installed *over* it. Either reuse the
same key with zustand `persist` `version` + `migrate`, or use a new key and delete `hasio-storage`
on first launch. Do not let new code parse the old shape by accident.

## Product and design rules that survive the rewrite

- **Al-Ahsa only** — content, city lists, map centre (Hofuf 25.3854, 49.5683), planner, seed data.
- **Brand is "Hasio" in Latin script always**, even in Arabic UI. Never "هاسيو" as a logo.
- **Bilingual ar/en with real RTL**; translations co-located per component (`{ar, en}` objects), no
  i18n library. Arabic is the default for the OTP SMS locale.
- Primary `#0D7A5F`; Instrument Serif headings, Outfit body, Cairo for Arabic; **monochrome icons
  only**. The new canvas's tokens (`sand #F5EFE6`, `ink #1F1D17`, `dune #EDE5D8`, glass recipes)
  are in `docs/plans/2026-09-03-mobile-redesign.md`.
- Image containers get a `#E8DFD4` sand fallback; cards must not break on `images?.[0]` missing.
- **Store-compliance features that must exist on day one** (both stores already reviewed them):
  in-app account deletion (`deleteMyAccount`), report content + block user (`moderation.*`), links
  to `https://www.hasio.xyz/privacy-policy.html`, `/terms-of-service.html`, `/support.html`
  (paths frozen — the live binaries open them). Only the photo-library permission is declared;
  `expo-image-picker` plugin with `cameraPermission: false, microphonePermission: false` (Google
  rejected versionCode 10 for `READ_MEDIA_IMAGES`). No camera, mic, location, or tracking unless the
  new app truly uses them — and then update Data Safety / App Privacy answers.
- Distribution stays at the 8 countries (DZ, AU, BH, KW, OM, QA, SA, AE). No EU/UK — deliberate.
- App Review demo account and every iOS trap: `IOS_RELEASE_STATUS.md`.

## Expo SDK 57 rules (from the upgrade on 2026-09-03)

No `sdkVersion` and no `newArchEnabled` in app.json; `npx expo install --fix` keeps `expo-*`
packages aligned (they version with the SDK: `expo-router@~57`); `StyleSheet.absoluteFill` (not
`absoluteFillObject`); `react-native-worklets/plugin` in babel; `expo/fetch` is the global fetch;
Expo Go must match the SDK major; min iOS 16.4. Old stack for reference: RN 0.86, React 19.2,
Reanimated 4.5, expo-router 57, NativeWind 4, zustand 5, expo-image, expo-blur.

## Shipping the replacement — in this order

1. **Backend first.** Decide which backend the app targets (see the table). Deploy it to prod from
   `D:\hasiot`, set env vars, run backfills, smoke-test OTP with a real number.
2. `version` `2.0.0` (or higher). **Native builds only — never `eas update` this onto the 1.x
   binaries.** Run `eas update:list --branch production` and make sure no update is published at the
   new runtime version (a stale OTA once replaced a fresh iOS build's bundle).
3. `npx eas build -p android --profile production` and
   `npx eas build -p ios --profile production --non-interactive` from **this** folder with the
   copied identity files in place.
4. Submit: Android `npx eas submit -p android --profile production` (or Play Console upload);
   iOS `npx eas submit -p ios --profile production --id <build-id> --non-interactive`, then the
   publisher selects the build in App Store Connect and submits for review.
5. Both stores re-review a redesign; refresh screenshots, Data Safety, App Privacy, review notes.
6. Afterwards, in `D:\hasiot`: replace or archive `hasio-mobile-app/`, update `CLAUDE.md`, and
   update `IOS_RELEASE_STATUS.md`'s version table.

## When in doubt

- How did the old app behave here? → `D:\hasiot\hasio-mobile-app\app\**` and `components\**`.
- What does this function take / return? → `D:\hasiot\convex\<domain>\<file>.ts` (source beats
  this document).
- Is it deployed? → `npx convex function-spec --prod` from `D:\hasiot`.
- Anything iOS → `D:\hasiot\IOS_RELEASE_STATUS.md` first, always.
