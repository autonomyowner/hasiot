# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hasio is an **Al-Ahsa travel guide platform**. The product is the **React Native (Expo) mobile app** — AI travel planner, hotel/restaurant/attraction directory with map, bookings, trip itinerary builder, freelancer services marketplace and favourites. The **React + Vite website** in this repo is now only a **marketing landing page plus a hidden admin portal**; the public product pages (map, listings, services, dashboards, signup) were removed 2026-08-29. Both share the same Convex backend, and the backend still serves every feature — only the website's UI for them is gone.

**Eastern Province focus:** Hasio covers Saudi Arabia's Eastern Province, and nothing outside it. It began as an Al-Ahsa-only guide and the oasis is still its heart, but as of 2026-09-04 the city model is the **thirteen** governorates and cities of the province: Dammam, Al Khobar, Al Ahsa, Qatif, Jubail, Hafar Al Batin, Khafji, Ras Tanura, Abqaiq, Nairyah, Qaryat Al Ulya, Al Udayd, Al Bayda.

On 2026-09-05 the rest of the app followed the city list. **App copy** speaks of the province, not the oasis (`constants/translations.ts`; the keys `exploreOasis` and `exploreAlAhsa` became `heroTagline` and `exploreProvince`). **The AI planner prompt** in `convex/travelPlanner/actions.ts` now carries a per-city knowledge base for all thirteen, knows the coast exists — it used to be told outright not to discuss beaches or diving — and is instructed to establish which city the traveller is basing in before planning, because Dammam to Hafar Al Batin is a five-hour drive. **Every seeded listing is still Al-Ahsa**, so filtering by any other city returns nothing until real listings arrive.

`listings.coordinates` is **required** by the schema and neither posting form has a map picker, so both derive a city centre from `cityCoordinates()` in `constants/cities.ts`. They used to hardcode Hofuf, which pointed the detail sheet's directions link (coordinates win over `address`) at the wrong city. Al Udayd and Al Bayda have no confirmed centre and fall back to Dammam.

Al-Ahsa is now **one** entry rather than its villages. Hofuf, Mubarraz and Al Oyoun are sub-areas that belong in an address, and stored listings still carry them, so both clients fold aliases up to the city above: `hasio-mobile-app/constants/cities.ts` (`canonicalCity`, `cityLabel`) and `src/admin/constants.js` (`CITY_ALIASES`, `canonicalCity`). The two lists must be kept in step — the database stores the English key and each side looks up its own label. Dhahran folds into Al Khobar; Saihat, Safwa, Darin and Tarout into Qatif.

Content, city pickers and seed data must stay inside the province — NOT all of Saudi Arabia.

Three user roles: tourists (immediate access), business owners (post listings — hotels/restaurants/events/attractions), and service providers (post freelancer services — photographer/driver/guide/etc.). Business and service accounts require document upload + admin approval.

**Brand:** Always use "Hasio" in English — never "هاسيو" in logos or brand display, even in Arabic mode.

**Production:** https://www.hasio.xyz (Vercel, auto-deploys on push to `main`)

## Commands

```bash
npm run dev          # Start Vite development server (port 5173)
npm run dev:convex   # Start Convex backend server (run in separate terminal)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
npx convex dashboard # Open Convex dashboard
npx convex dev --once            # Push code to dev without watching
npx convex deploy --yes          # Deploy Convex to production
npx convex run <path> --prod     # Run a function against production
```

**Development**: Run `npm run dev` and `npm run dev:convex` in separate terminals simultaneously.

**Deploy to production**: `npx convex deploy --yes` pushes Convex functions. Frontend deploys automatically via Vercel on git push to `main`. For manual Vercel deploy: `npx vercel --prod --yes`.

## Architecture

### Authentication (Better-Auth + Convex)

Email/password only (no OAuth). Auth API runs on Convex HTTP backend, requiring cross-origin setup:

- **Server**: `convex/auth.ts` — `createAuth()` with `betterAuth()`, `getAuthenticatedAppUser(ctx)` helper, `requireAdmin(ctx)` guard. Cookies use `SameSite=None; Secure`. `trustedOrigins` must include all frontend domains.
- **HTTP routes**: `convex/http.ts` — `authComponent.registerRoutes(http, createAuth, { cors: true })`
- **Client**: `src/lib/auth-client.js` — `createAuthClient()` with `baseURL` pointing to `VITE_CONVEX_SITE_URL` and `credentials: "include"`
- **Hooks**: `src/hooks/useCurrentUser.js` — `useCurrentUser()` and `useConvexAuth()` combine `authClient.useSession()` with Convex user query
- **Provider**: `src/main.jsx` — `ConvexBetterAuthProvider` wraps all routes (including admin)

**Auth pattern in all Convex functions:**
```ts
import { getAuthenticatedAppUser } from "../auth";
const user = await getAuthenticatedAppUser(ctx); // returns null if not authenticated
```

**Admin-only Convex functions:**
```ts
import { requireAdmin } from "../auth";
await requireAdmin(ctx); // throws if not authenticated or role !== "admin"
```
All admin queries/mutations in `convex/admin/` and `approveBusinessAccount` in `convex/users/mutations.ts` are guarded with `requireAdmin()`.

**CORS gotcha**: When adding a new frontend domain, add it to `trustedOrigins` in `convex/auth.ts` AND redeploy Convex.

### User Roles & Approval Flow

- **Tourists**: Sign up → immediate access. Can upgrade to business owner or service provider from the mobile app. (The website's `/dashboard` upgrade tab was removed 2026-08-29 — sign-up and role upgrade are mobile-only now.)
- **Business Owners**: Post hotels, restaurants, attractions, events. Require doc upload + admin approval.
- **Service Providers**: Post freelancer services (photographer, driver, guide, etc.). Require doc upload + admin approval.
- **Role upgrade**: Tourist → calls `setUserRole` → uploads doc in the app → admin approves at `/admin` on the website
- Business documents stored in Convex file storage (`_storage`), referenced by `cvFileId` on user record.

### Frontend (React + Vite) — landing page + admin only

- `src/main.jsx` — Four routes, all lazy: `/` (landing), `/sign-in`, `/delete-account`, `/admin`. A `*` route redirects everything else to `/` so old links never render blank.
- `src/AuthedLayout.jsx` — Layout route that owns `ConvexReactClient` + `ConvexBetterAuthProvider` + `authClient`. **Only** `/sign-in`, `/delete-account` and `/admin` sit inside it, so the convex and better-auth chunks never load for anonymous visitors on `/`. Keep Convex imports out of `main.jsx` or that isolation breaks.
- `src/App.jsx` — The landing page. Bilingual `content = { en, ar }`, sections: hero → story → places carousel → in-app showcase → concierge → quote → download → footer. Every CTA points at the App Store / Play Store; there are no internal links left except the static legal pages. The header is `position: fixed` and swaps to a solid paper bar (`.is-stuck`) once the hero scrolls under it — driven by an IntersectionObserver on `.hero-wrap`, not a scroll listener. `.home-redesign` sets `overflow: hidden`, which is why the header is fixed rather than sticky. Below 850px the section links move into a burger panel; below 640px the header's "Get the app" pill is dropped (four controls do not fit a 390px bar — the CTA is in the panel, the hero and its own section).
- **Arrow chips** (`.place-cta span`, `.place-go`, `.rail-nav button`) — all use the shared `Arrow` /
  `Chevron` SVGs in `App.jsx`, never the `&#8594;` / `&#8592;` entities, which render as a hairline in
  Instrument Serif. Two rules keep them crisp, and both were bugs once: **(chip size − icon size) must
  be even**, or `place-items: center` puts the svg on a half pixel and the whole arrow renders at half
  alpha; and `stroke-width` is in viewBox units, so it has to be re-scaled per icon size (2.4@20px,
  2.67@18px) to land on the same 2px rendered weight. The paths are symmetric about `x=12` for the
  same reason. In RTL only the `svg` is mirrored, not its chip.
- `src/hooks/useReveal.js` — IntersectionObserver scroll reveals (replaced framer-motion on the landing page). Elements opt in with `data-reveal`; the hidden start state is scoped to `.reveal-ready` so the page still renders if JS fails. **Takes a `dep`** (`useReveal(lang)`): the landing page keys its lists by translated strings, so a language toggle unmounts every revealed node and mounts new ones — without a re-scan they are never observed and stay at `opacity: 0` forever. Stagger a group with `style={{'--d': i}}`.
- `src/admin/` — Arabic RTL admin dashboard, the only real app left on the web. `AdminPage.jsx` is the
  shell (auth gate + nav with live pending badges); one file per tab in `tabs/`; shared primitives in
  `components/` (Modal, ConfirmDialog, ToastProvider + `toast-context`, ImageUploader,
  WorkingHoursModal, States); shared lookups and date helpers in `constants.js`. Auth via Better-Auth
  (`useCurrentUser()` + `role === "admin"`); redirects to `/sign-in?next=/admin` when logged out.
  Ten tabs: stats, listings, content approval, services approval, pending accounts, reports, bookings,
  knowledge base, activity log, emails. Still uses framer-motion (lazy admin chunk only).
  **No `window.confirm`/`alert`** — destructive actions go through `useConfirm()` and every mutation
  reports through `useToast()`; each tab renders explicit loading, empty and error states.
  **Every tab opens with the same block**: `.admin-page-head` (or `.admin-card-header`, same rule)
  wrapping an `.admin-page-title` and a one-line `.admin-page-subtitle` that carries the count, with
  any primary action pushed to the far end. Four tabs used to open with a small `.admin-section-title`
  plus a count badge instead, which made the panel read as several tools bolted together — don't
  reintroduce that for a new tab. `.admin-section-title` is for sections *within* a tab.
- `src/pages/SignInPage.jsx` — **Unlinked from everywhere.** It exists so the admin portal has a login. Honours `?next=` (relative paths only), defaults to `/admin`. No public sign-up.
- `src/pages/DeleteAccountPage.jsx` — **Do not remove.** App Store guideline 5.1.1(v); linked from `public/support.html`, which is the live App Store Support URL.

**Static pages in `public/` are not routes** — `privacy-policy.html`, `terms-of-service.html`, `support.html`, `download.html`. Vercel's filesystem check beats the SPA rewrite in `vercel.json`, so React routing cannot affect them. **The shipped mobile binaries open two of them by absolute URL** (`hasio-mobile-app/app/auth.tsx:31-32`, `components/screens/SettingsScreenContent.tsx:38-39`), so their paths are frozen — a redirect is the only safe way to ever move them.

**Landing page assets** (all local, no external image hosts):
- `public/hasio-oasis-hero{,-mobile}.webp` — hero, swapped by media query
- `public/posters/{gate,arch}.webp` — the two art-directed brand posters in the "inside the app" section. **Shown whole, never `object-fit: cover`** — their typography is part of the artwork, so cropping cuts the wordmark, and nothing may be laid over them. `gate.webp` is deliberately cropped short of its master (1085×1335 of 1450): the master's bottom band is portfolio metadata ("Brand Identity / Tourism / Art Direction", "2026") that has no place on a live tourism site. Masters: `design-assets/poster-{gate,arch}.png`.
- The phone-mockup screenshots that used to fill that section were dropped 2026-09-02; they now live in `design-assets/app-screens/` (they are hand-cropped from `hasio-mobile-app/assets/screenshots/` with OS bars removed and the stale voice-assistant mic painted out of `plan.webp`, so they are worth keeping even though nothing references them).
- `public/places/*.webp` — carousel cards, all 520×880. `heritage` and `flavours` are cropped from `hasio-mobile-app/assets/images/generated/`; `nature`, `culture`, `mountains` and `stays` are photographs cropped from the masters in `design-assets/place-sources/` (which the blanket `*.jpg` ignore rule has a narrow exception for). A new card needs four things in step: the path in `places`, an entry in `placeIcons`, and a `places` entry in **both** `content.en` and `content.ar` — a missing translation renders an empty card rather than throwing.
- `public/logo-mark.webp` — trimmed `logo.png`, shown in a white chip so it reads on the dark nav and footer
- PNG masters live in `design-assets/` (outside `public/`) so Vite stops copying ~7 MB into every deploy

### Mobile App (React Native + Expo)

Located in `hasio-mobile-app/`. **Renamed 2026-08-11** from `hasio<SPACE><SPACE>mobile app` (two spaces) — the double space broke iOS builds (CocoaPods script phases over-escape the path, failing with `bash: /Users/expo/workingdir/build/hasio: No such file or directory`). Never reintroduce spaces in this directory name. Shares the same Convex backend.

- `app/business/` — Business owner screens: `post-lodging.tsx`, `post-food.tsx`, `post-event.tsx`, `post-destination.tsx`, `my-listings.tsx`
- `app/provider/` — Service provider screens: `post-service.tsx`, `my-services.tsx`
- `app/(tabs)/` — Main tab navigation
- Images uploaded via Convex storage (`lib/convexUpload.ts`), stored as URL strings

**Mobile API import**: The Convex `api` object is exported from `backend/index.ts` (NOT `convex/`). All mobile app files import it as `import { api } from "@/backend"`. The directory was renamed from `convex/` to `backend/` because Metro bundler resolves `@/convex` to the `convex` npm package instead of the local directory. **Never rename `backend/` back to `convex/`** — it will break all API calls at runtime with "Cannot read property of undefined" errors.

**Mobile → Backend mapping**: Mobile business forms use `api.listings.mutations.submitListing` (auto-sets ownerId + pending status). Service provider forms use `api.services.mutations.submitService`.

### Backend (Convex)

```
convex/
├── schema.ts              # Database schema (adminActivity added 2026-08-30)
├── convex.config.ts       # Registers betterAuth component
├── auth.config.ts         # getAuthConfigProvider()
├── auth.ts                # Better-Auth instance + getAuthenticatedAppUser helper
├── http.ts                # Auth routes with CORS
├── config/
│   └── queries.ts         # getPublicConfig (exposes MAPBOX_PUBLIC_TOKEN to frontend)
├── admin/
│   ├── queries.ts         # getDashboardStats, adminListListings (paginated), adminSearchListings,
│   │                     # listPending{Content,Services,Businesses}, listAllBookings, listAdminActivity
│   ├── mutations.ts       # listing/knowledge CRUD, approve+reject content/services,
│   │                     # updateBookingStatus, bulkApprove*/bulkReject*
│   ├── activity.ts        # logAdminAction() — called by every admin write
│   └── devTools.ts        # internalMutation grantAdmin/revokeAdmin/listAdmins (CLI only)
├── users/
│   ├── queries.ts         # getCurrentUser, getFavorites, isFavorite, getBusinessDocUrl, getStorageUrl
│   └── mutations.ts       # updateProfile, toggleFavorite, setUserRole, approveBusinessAccount, generateUploadUrl, saveBusinessDoc, createUser
├── listings/
│   ├── queries.ts         # listListings, searchListings, getMyListings, getCategories, getCities, getListingsNearLocation
│   └── mutations.ts       # createListing, submitListing, updateMyListing, deleteMyListing, seedListings
├── services/
│   ├── queries.ts         # getMyServices, listServices, getService, searchServices
│   └── mutations.ts       # submitService, updateMyService, deleteMyService
├── bookings/
│   ├── queries.ts         # getUserBookings, getAvailableSlots, getBooking, getBusinessBookings
│   └── mutations.ts       # createBooking, cancelBooking, rescheduleBooking, confirmBooking
├── trips/
│   ├── queries.ts         # getMyTrips (hydrated stops), getTrip, getMyTripSummaries
│   └── mutations.ts       # createTrip, addStopToTrip, updateStop, removeStop, reorderStops, updateTrip, deleteTrip, convertPlanToTrip
└── travelPlanner/
    ├── actions.ts         # planTravel (OpenRouter API with Claude 3.5 Haiku)
    ├── queries.ts         # getMyPlans, getPlan
    └── mutations.ts       # storePlan
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles with role (tourist/business_owner/service_provider/admin), isApproved, cvFileId |
| `listings` | Hotels, restaurants, attractions, events, tours with geolocation (56 seeded Al-Ahsa entries) |
| `services` | Freelancer services (photographer, driver, guide, etc.) with ownerId, serviceType, pricing, portfolio images |
| `availabilitySchedules` | Time slots per listing |
| `bookings` | Reservations, tour bookings, event tickets with status tracking |
| `travelPlans` | AI travel plan history |
| `trips` | User-created itineraries with embedded stops array (listing + date/time/notes/order) |
| `reviews` | Listing ratings & reviews |
| `emailCaptures` | Early access signups |
| `travelKnowledge` | Knowledge base for AI travel planner |
| `adminActivity` | Append-only log of every admin action (who / what / when), read by the السجل tab |

### Listings vs Services

**Listings** (`listings` table): Physical places — hotels, restaurants, attractions, events, tours. Created by business owners via `submitListing` (auth-protected, sets ownerId + status "pending"). Admin creates via `createListing` (`requireAdmin`, status "approved"). Seed data has no ownerId or status (treated as approved).

**Services** (`services` table): Freelancer offerings — tour_guide, photographer, driver, translator, event_planner, catering, equipment_rental, other. Created only by service providers via `submitService`. All start as "pending" and require admin approval.

Both follow the same approval flow: pending → admin approves/rejects → approved/rejected. Editing resets status to "pending".

### Content Approval Flow

1. Business owner/service provider submits listing or service → status: "pending"
2. Admin sees it in `/admin` under "محتوى معلق" (listings) or "خدمات معلقة" (services)
3. Admin approves → status: "approved", visible publicly
4. Admin rejects → status: "rejected" with optional reason, visible only to owner
5. Owner edits → status reset to "pending"

### Image Upload Pattern

Convex file storage: `generateUploadUrl()` → POST file → get storageId → resolve URL via `getStorageUrl` query. Used by the admin panel and by the mobile app (`lib/convexUpload.ts`). The website's uploader lived in the business dashboard, which was removed 2026-08-29.

**Seed listing images**: `convex/listings/seedImages.ts` contains curated Unsplash URLs for all 56 Al-Ahsa seeded listings. Run `npx convex run listings/seedImages:addImagesToListings --prod` to populate images on listings that don't have any.

### Trip Itinerary Builder

Trips have embedded `stops` arrays (not a separate table). Each stop references a listing by ID with optional date, time, notes, and order.

- **Status flow**: `planning` → `active` → `completed`
- **"Save to Trip" modal** (`SaveToTripModal.jsx`): reusable across MapPage, FavoritesSection, and TravelPlanner
- **AI plan conversion**: `convertPlanToTrip` mutation best-effort matches destination names to listings via `search_listings` search index

### Seeding Data

Seed data contains **56 Al-Ahsa-only listings** (12 hotels, 16 restaurants, 18 attractions, 10 events/tours) across Hofuf, Mubarraz, Al Oyoun, and Al Omran. No listings from other Saudi cities. After seeding, run `addImagesToListings` to assign Unsplash images.

```bash
npx convex run listings/mutations:seedListings          # dev
npx convex run listings/mutations:seedListings --prod    # production
npx convex run listings/seedImages:addImagesToListings --prod  # add images
```

### AI Travel Planner

`convex/travelPlanner/actions.ts` — multi-turn conversational action using OpenRouter with `anthropic/claude-haiku-4.5`. Asks follow-up questions before generating a full itinerary. Responds in the user's language. Returns JSON with `ready: false` (follow-up) or `ready: true` (full plan).

### Internationalization Pattern

Each component defines its own `translations` object with `ar` and `en` keys. No global i18n library — keep translations co-located with the component that uses them.

### Bundle & Code Splitting

All routes in `src/main.jsx` are lazy-loaded with `React.lazy()` + `<Suspense>`. `vite.config.js` has **no `manualChunks`** — it used to, and it forced `convex` and `better-auth` into the entry's `modulepreload` list so every anonymous visitor downloaded them. Rollup's automatic splitting follows the real dynamic-import graph instead; don't reintroduce `manualChunks` without re-checking `dist/index.html`.

The landing page loads only the entry chunk (~234 kB raw / ~75 kB gzip: React + react-dom + react-router) plus an ~18 kB / ~7 kB gzip `App` chunk. No convex, no better-auth, no framer-motion, no admin. Verify with: `grep modulepreload dist/index.html` (expect zero matches).

The Google Fonts stylesheet is a `<link>` in `index.html`, **not** an `@import` in `src/index.css`. An `@import` inside the bundled CSS cannot begin downloading until that file has itself downloaded and parsed, which puts two serial round trips in front of first paint; the `<link>` races the bundle instead. Don't move it back.

## Key Technologies

- **React 19** with Vite 7 (website)
- **React Native** with Expo (mobile app)
- **Convex** — Serverless backend with real-time subscriptions
- **Better-Auth** (`@convex-dev/better-auth`) — Email/password authentication
- **OpenRouter** — AI API (Claude 3.5 Haiku for travel planning)
- **Mapbox GL JS** — Interactive maps and geocoding (mobile app only; `mapbox-gl` was removed from the website's dependencies 2026-08-29)
- **Framer Motion** — Animations (website: admin panel only — the landing page uses `useReveal`)
- **React Router DOM 7** — Client-side routing

## Environment Variables

### Frontend (.env.local)
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

### Convex Dashboard (Settings > Environment Variables)
```
BETTER_AUTH_SECRET=<random-base64-string>
SITE_URL=https://www.hasio.xyz
OPENROUTER_API_KEY=sk-or-xxx
MAPBOX_PUBLIC_TOKEN=pk.xxx
```

**Note:** `SITE_URL` in Convex must point to the production frontend domain (not the Convex site URL) — used by Better-Auth for cookie domain and redirect handling.

### Vercel Environment Variables
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

### Mobile App Environment (.env, .env.local, eas.json)
```
EXPO_PUBLIC_CONVEX_URL=https://hearty-ram-74.eu-west-1.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://hearty-ram-74.eu-west-1.convex.site
```

**CRITICAL — EU region prefix:** The production Convex deployment is in `eu-west-1`. All Convex URLs **must** include the region: `hearty-ram-74.eu-west-1.convex.cloud` (NOT `hearty-ram-74.convex.cloud`). Missing the region causes auth requests to hit the wrong endpoint → 401 errors. This applies to three files:
- `hasio-mobile-app/.env`
- `hasio-mobile-app/.env.local`
- `hasio-mobile-app/eas.json` (in `build.production.env`)

**`.env.local` overrides `.env`** in Expo — if both exist, `.env.local` wins. Always keep them in sync or remove `.env.local` if not needed.

## Admin Panel

- **URL**: `/admin`
- **Auth**: Better-Auth role-based — user must have `role: "admin"` in `users` table. Set via Convex Dashboard Data tab.
- **Backend**: All admin queries/mutations require `requireAdmin(ctx)` — throws if not admin. No unauthenticated access possible.
- **Frontend**: `useCurrentUser()` checks role client-side. Not logged in → redirect to `/sign-in`. Logged in but not admin → "access denied" page.
- **Features**: dashboard built around pending work (queue cards link into the tab that clears them),
  listing CRUD **with photo upload** (multi-image, reorder, cover = index 0), **working-hours editor**
  per listing, **booking management** (confirm / complete / cancel-with-reason / no-show, grouped
  today / upcoming / past), content + service approval with **bulk approve/reject**, pending account
  approvals with document review, reports, knowledge base, **admin activity log**, email captures.
- **Listing search**: Arabic *and* English names, via two search indexes (`search_listings` on
  `name_en`, `search_listings_ar` on `name_ar`) merged in `adminSearchListings`. Browsing uses
  `adminListListings` with cursor pagination; filters for type/city/review-status/has-photos/has-hours.
- **Audit trail**: every admin write appends to `adminActivity` via `logAdminAction()` in the same
  transaction, so the log cannot record something that did not commit. Add a call there when adding
  any new admin mutation.
- **Setup**: To grant admin access, either edit the user's `role` field to `"admin"` in Convex
  Dashboard → Data → `users`, or run
  `npx convex run admin/devTools:grantAdmin '{"email":"..."}' --prod`. The user must have signed in
  at least once (they need a `users` row). No redeploy needed.

## Mobile App Production Patterns

The mobile app (`hasio-mobile-app/`) includes these reliability features:

- **Error Boundary**: `components/ErrorBoundary.tsx` wraps root layout. Class component, reads language from Zustand outside React tree (`useAppStore.getState().language`). Bilingual fallback UI with retry button.
- **Search Debounce**: `hooks/useDebounce.ts` (300ms default). Used in `HomeScreenContent.tsx` — raw query drives the input, debounced query drives filtering.
- **ThemedTextInput**: `components/ui/ThemedTextInput.tsx` — wraps `TextInput` with focus state (green `#0D7A5F` border on focus, `#E5E5E5` default). Used in all business/provider form screens and auth. Exported from `components/ui/index.ts`.
- **Image Fallbacks**: All card components (`LodgingCard`, `FoodCard`, `EventCard`, `MomentCard`, `CategoryCard`) use `backgroundColor: "#E8DFD4"` (warm sand) on image containers + safe access (`images?.[0] ? { uri: ... } : undefined`).
- **Double-Submit Guard**: All form `handleSubmit` functions start with `if (isLoading) return;` before validation.
- **Email Validation**: `auth.tsx` validates with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` after empty check.
- **Dark Mode**: Toggle replaced with "Coming Soon" subtitle in settings. Zustand `isDarkMode` state preserved for future use.

## Mobile App Play Store Deployment

**Status**: v1.0.0 published via EAS to Google Play. Passed 14-day closed testing (12 testers) and granted production access. Promoted tested build to Production track.

### Production Target Countries (8)
Algeria, Australia, Bahrain, Kuwait, Oman, Qatar, Saudi Arabia, United Arab Emirates.

**No EU/UK distribution** — intentionally skipped to avoid EU Digital Services Act (DSA) trader status requirements, GDPR data-controller obligations, and UK Online Safety Act compliance overhead. Same 8 countries used in both closed testing and production tracks.

### Key Decisions (v1)
- **Voice assistant disabled** — removed `expo-av`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` permissions, VoiceAssistant component, voiceService, and ElevenLabs/Groq integrations. Text-based AI planner remains fully functional via Convex `planTravel` action.
- **Images use Convex storage (not R2)** — `lib/convexUpload.ts` uploads via `generateUploadUrl` → `FileSystem.uploadAsync` → `getStorageUrl`. All 5 posting screens (`post-lodging`, `post-food`, `post-event`, `post-destination`, `post-service`) use `uploadMultipleToConvex()`. The old `lib/r2Upload.ts` is unused.
- **Auth env var is strict** — `lib/auth.ts` throws if `EXPO_PUBLIC_CONVEX_SITE_URL` is missing (no silent fallback).

### EAS Build & Submit
```bash
cd "hasio-mobile-app"
npx eas build -p android --profile production   # Builds AAB, auto-increments versionCode
npx eas submit -p android --profile production   # Uploads to Play Store (track set in eas.json)
npx eas update --channel production --message "description"  # OTA update (JS-only, no review)
```

- `eas.json` production profile has `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL` env vars baked in.
- Submit track is `"internal"` for initial closed testing. Change to `"production"` after 14-day testing period + production access granted.
- Service account key: `google-service-account.json` (gitignored).

### Legal Documents (3 locations in mobile app)
- `docs/terms-of-service.html` — Terms of Service
- `docs/privacy-policy.html` — Privacy Policy
- `assets/privacy-policy.html` — Privacy Policy (bundled in app)
- `docs/DATA_SAFETY_ANSWERS.md` — Google Play Data Safety form answers
- All updated April 2026: no voice/audio references, no Groq/ElevenLabs, email is `support@hasio.xyz`.

## Design Constraints

- Green (#0D7A5F) primary color with generous white space
- Instrument Serif for headings, Outfit for body text, Cairo for Arabic
- Bilingual: Arabic (RTL) and English (LTR) with language toggle on all pages
- All translatable text in `translations` objects at component level
- Admin panel is Arabic-only with full RTL support
- Brand name always displayed as "Hasio" (English) in UI — never Arabic script for the logo
- Icons must be monochrome/neutral — never use colored icons
