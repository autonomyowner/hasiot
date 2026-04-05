# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hasio is a Saudi Arabia travel guide platform with two codebases in this repo: a **React + Vite website** and a **React Native (Expo) mobile app**. Both share the same Convex backend. Features include an AI travel planner, hotel/restaurant/attraction directory with interactive map, booking system, trip itinerary builder, freelancer services marketplace, and favorite listings.

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

- **Tourists**: Sign up → immediate access. Can upgrade to business owner or service provider from `/dashboard` upgrade tab.
- **Business Owners**: Post hotels, restaurants, attractions, events. Require doc upload + admin approval.
- **Service Providers**: Post freelancer services (photographer, driver, guide, etc.). Require doc upload + admin approval.
- **Role upgrade**: Tourist → calls `setUserRole` → redirected to `/business` → upload doc → admin approves at `/admin`
- Business documents stored in Convex file storage (`_storage`), referenced by `cvFileId` on user record.

### Frontend (React + Vite)

- `src/main.jsx` — Routing: `/`, `/explore`, `/listings`, `/services`, `/sign-in`, `/sign-up`, `/dashboard`, `/business`, `/admin`. All routes lazy-loaded with `Suspense`.
- `src/App.jsx` — Landing page with `translations` object for AR/EN. Lazy-loads Convex-dependent components. Has a **mobile-only fixed bottom nav** (bottom-left, above chat FAB) with Destinations and Services buttons.
- `src/MapPage.jsx` — Mapbox GL map centered on Riyadh (24.7136, 46.6753). Token loaded at runtime from Convex via `config.queries.getPublicConfig`.
- `src/AdminPage.jsx` — Arabic RTL admin dashboard. Auth via Better-Auth (`useCurrentUser()` + `role === "admin"` check). Redirects to `/sign-in` if not logged in, shows "access denied" if not admin. Tabs: stats, listings, content approval, services approval, pending businesses, knowledge base, bookings, emails.
- `src/pages/DoctorDashboard.jsx` — **Business/service provider dashboard**. Role-adaptive tabs: service providers see services tab, business owners see listings tab. Includes `ImageUploader` component for multi-image upload to Convex storage.
- `src/pages/ListingsPage.jsx` — **Public browse page** for approved hotels, restaurants, attractions, events, tours. Filter by type/city/search. Bilingual. Uses `api.listings.queries.listListings` and `searchListings`.
- `src/pages/ServicesPage.jsx` — **Public browse page** for approved freelancer services. Filter by service type/city/search. Expandable cards with contact info. Uses `api.services.queries.listServices` and `searchServices`.
- `src/components/ImageCarousel.jsx` — Reusable image carousel with dot indicators, prev/next arrows, fallback placeholder. Used in ListingsPage and ServicesPage cards.
- `src/pages/PatientDashboard.jsx` — **Tourist dashboard**. Tabs: bookings, favorites, profile, trips, upgrade (role upgrade to business/service).

**File naming caveat**: `PatientDashboard.jsx` is the tourist dashboard, `DoctorDashboard.jsx` is the business dashboard. Legacy names — `main.jsx` imports them with aliases (`BusinessDashboard`, `TouristDashboard`).

### Mobile App (React Native + Expo)

Located in `hasio  mobile app/` (note the double space in directory name). Shares the same Convex backend.

- `app/business/` — Business owner screens: `post-lodging.tsx`, `post-food.tsx`, `post-event.tsx`, `post-destination.tsx`, `my-listings.tsx`
- `app/provider/` — Service provider screens: `post-service.tsx`, `my-services.tsx`
- `app/(tabs)/` — Main tab navigation
- Images uploaded via R2 (`lib/r2Upload.ts`), stored as URL strings

**Mobile → Backend mapping**: Mobile business forms use `api.listings.mutations.submitListing` (auto-sets ownerId + pending status). Service provider forms use `api.services.mutations.submitService`.

### Backend (Convex)

```
convex/
├── schema.ts              # Database schema (11 tables)
├── convex.config.ts       # Registers betterAuth component
├── auth.config.ts         # getAuthConfigProvider()
├── auth.ts                # Better-Auth instance + getAuthenticatedAppUser helper
├── http.ts                # Auth routes with CORS
├── config/
│   └── queries.ts         # getPublicConfig (exposes MAPBOX_PUBLIC_TOKEN to frontend)
├── admin/
│   ├── queries.ts         # getDashboardStats, listAllListings, listPendingBusinesses, listPendingServices
│   └── mutations.ts       # CRUD for listings, knowledge data, approveService/rejectService, approveContent/rejectContent
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
| `listings` | Hotels, restaurants, attractions, events, tours with geolocation (~88 seeded Saudi entries) |
| `services` | Freelancer services (photographer, driver, guide, etc.) with ownerId, serviceType, pricing, portfolio images |
| `availabilitySchedules` | Time slots per listing |
| `bookings` | Reservations, tour bookings, event tickets with status tracking |
| `travelPlans` | AI travel plan history |
| `trips` | User-created itineraries with embedded stops array (listing + date/time/notes/order) |
| `reviews` | Listing ratings & reviews |
| `emailCaptures` | Early access signups |
| `travelKnowledge` | Knowledge base for AI travel planner |

### Listings vs Services

**Listings** (`listings` table): Physical places — hotels, restaurants, attractions, events, tours. Created by business owners via `submitListing` (auth-protected, sets ownerId + status "pending"). Admin creates via `createListing` (no auth check, status "approved"). Seed data has no ownerId or status (treated as approved).

**Services** (`services` table): Freelancer offerings — tour_guide, photographer, driver, translator, event_planner, catering, equipment_rental, other. Created only by service providers via `submitService`. All start as "pending" and require admin approval.

Both follow the same approval flow: pending → admin approves/rejects → approved/rejected. Editing resets status to "pending".

### Content Approval Flow

1. Business owner/service provider submits listing or service → status: "pending"
2. Admin sees it in `/admin` under "محتوى معلق" (listings) or "خدمات معلقة" (services)
3. Admin approves → status: "approved", visible publicly
4. Admin rejects → status: "rejected" with optional reason, visible only to owner
5. Owner edits → status reset to "pending"

### Image Upload Pattern

Website uses Convex file storage: `generateUploadUrl()` → POST file → get storageId → resolve URL via `getStorageUrl` query. Mobile app uses R2 external storage via `uploadMultipleToR2()`, storing URL strings directly.

**Seed listing images**: `convex/listings/seedImages.ts` contains curated Unsplash URLs for all 88 seeded listings. Run `npx convex run listings/seedImages:addImagesToListings --prod` to populate images on listings that don't have any. The `patchListings` mutation was a one-time fix (King Fahd Fountain image + Saudi Cup deletion).

### Trip Itinerary Builder

Trips have embedded `stops` arrays (not a separate table). Each stop references a listing by ID with optional date, time, notes, and order.

- **Status flow**: `planning` → `active` → `completed`
- **"Save to Trip" modal** (`SaveToTripModal.jsx`): reusable across MapPage, FavoritesSection, and TravelPlanner
- **AI plan conversion**: `convertPlanToTrip` mutation best-effort matches destination names to listings via `search_listings` search index

### Seeding Data

```bash
npx convex run listings/mutations:seedListings          # dev
npx convex run listings/mutations:seedListings --prod    # production
```

### AI Travel Planner

`convex/travelPlanner/actions.ts` — multi-turn conversational action using OpenRouter with `anthropic/claude-3.5-haiku`. Asks follow-up questions before generating a full itinerary. Responds in the user's language. Returns JSON with `ready: false` (follow-up) or `ready: true` (full plan).

### Internationalization Pattern

Each component defines its own `translations` object with `ar` and `en` keys. No global i18n library — keep translations co-located with the component that uses them.

### Bundle & Code Splitting

All routes in `src/main.jsx` are lazy-loaded with `React.lazy()` + `<Suspense>`. Vite config (`vite.config.js`) splits vendor chunks: `mapbox-gl` (~1.6MB, only loads on `/explore`), `framer-motion`, `convex`, `better-auth`. Main bundle is ~235KB.

## Key Technologies

- **React 19** with Vite 7 (website)
- **React Native** with Expo (mobile app)
- **Convex** — Serverless backend with real-time subscriptions
- **Better-Auth** (`@convex-dev/better-auth`) — Email/password authentication
- **OpenRouter** — AI API (Claude 3.5 Haiku for travel planning)
- **Mapbox GL JS** — Interactive maps and geocoding
- **Framer Motion** — Animations
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

## Admin Panel

- **URL**: `/admin`
- **Auth**: Better-Auth role-based — user must have `role: "admin"` in `users` table. Set via Convex Dashboard Data tab.
- **Backend**: All admin queries/mutations require `requireAdmin(ctx)` — throws if not admin. No unauthenticated access possible.
- **Frontend**: `useCurrentUser()` checks role client-side. Not logged in → redirect to `/sign-in`. Logged in but not admin → "access denied" page.
- **Features**: Dashboard stats, listing CRUD, content approval (listings), services approval, pending business account approvals (with doc review), travel knowledge data, bookings, email captures
- **Setup**: To grant admin access, edit user's `role` field to `"admin"` in Convex Dashboard → Data → `users` table. No redeploy needed.

## Mobile App Production Patterns

The mobile app (`hasio  mobile app/`) includes these reliability features:

- **Error Boundary**: `components/ErrorBoundary.tsx` wraps root layout. Class component, reads language from Zustand outside React tree (`useAppStore.getState().language`). Bilingual fallback UI with retry button.
- **Search Debounce**: `hooks/useDebounce.ts` (300ms default). Used in `HomeScreenContent.tsx` — raw query drives the input, debounced query drives filtering.
- **ThemedTextInput**: `components/ui/ThemedTextInput.tsx` — wraps `TextInput` with focus state (green `#0D7A5F` border on focus, `#E5E5E5` default). Used in all business/provider form screens and auth. Exported from `components/ui/index.ts`.
- **Image Fallbacks**: All card components (`LodgingCard`, `FoodCard`, `EventCard`, `MomentCard`, `CategoryCard`) use `backgroundColor: "#E8DFD4"` (warm sand) on image containers + safe access (`images?.[0] ? { uri: ... } : undefined`).
- **Double-Submit Guard**: All form `handleSubmit` functions start with `if (isLoading) return;` before validation.
- **Email Validation**: `auth.tsx` validates with `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` after empty check.
- **Dark Mode**: Toggle replaced with "Coming Soon" subtitle in settings. Zustand `isDarkMode` state preserved for future use.

## Mobile App Play Store Deployment

**Status**: v1.0.0 published via EAS to Google Play (closed internal testing track, 14-day period required before production for new developer accounts).

### Key Decisions (v1)
- **Voice assistant disabled** — removed `expo-av`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` permissions, VoiceAssistant component, voiceService, and ElevenLabs/Groq integrations. Text-based AI planner remains fully functional via Convex `planTravel` action.
- **Images use Convex storage (not R2)** — `lib/convexUpload.ts` uploads via `generateUploadUrl` → `FileSystem.uploadAsync` → `getStorageUrl`. All 5 posting screens (`post-lodging`, `post-food`, `post-event`, `post-destination`, `post-service`) use `uploadMultipleToConvex()`. The old `lib/r2Upload.ts` is unused.
- **Auth env var is strict** — `lib/auth.ts` throws if `EXPO_PUBLIC_CONVEX_SITE_URL` is missing (no silent fallback).

### EAS Build & Submit
```bash
cd "hasio  mobile app"
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
