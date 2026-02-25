# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hasio is a Saudi Arabia travel guide platform built with React and Vite. It features an AI travel planner, hotel/restaurant/attraction directory with interactive map, booking system, trip itinerary builder, and favorite listings. Three user roles: tourists (immediate access), business owners and service providers (require document upload + admin approval).

**Brand:** Always use "Hasio" in English — never "هاسيو" in logos or brand display, even in Arabic mode. Arabic text content can reference هاسيو contextually.

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

Authentication uses `@convex-dev/better-auth` with email/password. The auth API runs on the Convex HTTP backend (not the frontend), so cross-origin setup is required:

- **Server**: `convex/auth.ts` — `createAuth()` with `betterAuth()`, `getAuthenticatedAppUser(ctx)` helper. Cookies use `SameSite=None; Secure` for cross-origin. `trustedOrigins` must include all frontend domains (localhost, hasio.xyz, hasio.vercel.app).
- **HTTP routes**: `convex/http.ts` — `authComponent.registerRoutes(http, createAuth, { cors: true })`
- **Client**: `src/lib/auth-client.js` — `createAuthClient()` with `baseURL` pointing to `VITE_CONVEX_SITE_URL` and `credentials: "include"`
- **Hooks**: `src/hooks/useCurrentUser.js` — `useCurrentUser()` and `useConvexAuth()` combine `authClient.useSession()` with Convex user query
- **Provider**: `src/main.jsx` — `ConvexBetterAuthProvider` wraps main routes; admin routes use plain `ConvexProvider`

**Auth pattern in all Convex functions:**
```ts
import { getAuthenticatedAppUser } from "../auth";
const user = await getAuthenticatedAppUser(ctx); // returns null if not authenticated
```

**CORS gotcha**: When adding a new frontend domain, you must add it to `trustedOrigins` in `convex/auth.ts` AND redeploy Convex (`npx convex deploy --yes`). Missing this causes "No 'Access-Control-Allow-Origin' header" errors on auth endpoints.

### User Roles & Approval Flow

- **Tourists**: Sign up → immediate access to all features
- **Business Owners / Service Providers**: Sign up → redirected to `/business` → must upload business document → admin reviews at `/admin` → approves → dashboard unlocks
- Business documents stored in Convex file storage (`_storage`), referenced by `businessDocFileId` on user record

### Frontend (React + Vite)

- `src/main.jsx` — Routing: `/`, `/explore`, `/sign-in`, `/sign-up`, `/dashboard`, `/business`, `/admin`
- `src/App.jsx` — Landing page with `translations` object for AR/EN. Lazy-loads Convex-dependent components (AuthButtons, TravelPlanner, ChatWidget) so the page renders even without a backend.
- `src/MapPage.jsx` — Mapbox GL interactive map centered on Riyadh (24.7136, 46.6753). Mapbox token loaded at runtime from Convex via `config.queries.getPublicConfig` (not hardcoded). Includes Al-Ahsa region highlight. Geocoding restricted to `country=sa`.
- `src/AdminPage.jsx` — Arabic RTL admin dashboard with session auth
- `src/components/travel/TravelPlanner.jsx` — AI travel planner chat interface, stores plans and supports "Save as Trip"
- `src/components/chat/ChatWidget.jsx` — Floating chat button wrapping TravelPlanner
- `src/components/trips/SaveToTripModal.jsx` — Reusable modal for saving listings to trips (used by MapPage, FavoritesSection, TravelPlanner)
- `src/components/dashboard/TripsSection.jsx` — Trip management tab with timeline view, stop reorder/edit, status flow, AI plan conversion

**File naming caveat**: `PatientDashboard.jsx` is the tourist dashboard, `DoctorDashboard.jsx` is the business dashboard. These names are legacy from the original codebase — `main.jsx` imports them with aliases (`BusinessDashboard`, `TouristDashboard`).

### Backend (Convex)

```
convex/
├── schema.ts              # Database schema (9 tables)
├── convex.config.ts       # Registers betterAuth component
├── auth.config.ts         # getAuthConfigProvider()
├── auth.ts                # Better-Auth instance + getAuthenticatedAppUser helper
├── http.ts                # Auth routes with CORS
├── config/
│   └── queries.ts         # getPublicConfig (exposes MAPBOX_PUBLIC_TOKEN to frontend)
├── admin/
│   ├── queries.ts         # getDashboardStats, listAllListings, listPendingBusinesses
│   └── mutations.ts       # CRUD for listings and travel knowledge data
├── users/
│   ├── queries.ts         # getCurrentUser, getFavorites, isFavorite, getBusinessDocUrl
│   └── mutations.ts       # updateProfile, toggleFavorite, setUserRole, approveBusinessAccount, generateUploadUrl, saveBusinessDoc, createUser
├── listings/
│   ├── queries.ts         # listListings, searchListings, getCategories, getCities, getListingsNearLocation
│   └── mutations.ts       # createListing, updateListing, addReview, seedListings
├── bookings/
│   ├── queries.ts         # getUserBookings, getAvailableSlots, getBooking, getBusinessBookings
│   └── mutations.ts       # createBooking, cancelBooking, rescheduleBooking, confirmBooking
├── trips/
│   ├── queries.ts         # getMyTrips (hydrated stops), getTrip, getMyTripSummaries
│   └── mutations.ts       # createTrip, addStopToTrip, updateStop, removeStop, reorderStops, updateTrip, deleteTrip, convertPlanToTrip
└── travelPlanner/
    ├── actions.ts         # planTravel (OpenRouter API with Claude 3.5 Haiku — conversational Saudi travel planner)
    ├── queries.ts         # getMyPlans, getPlan
    └── mutations.ts       # storePlan
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles with role (tourist/business_owner/service_provider/admin), isApproved, businessDocFileId |
| `listings` | Hotels, restaurants, attractions, events, tours with geolocation (~88 Saudi entries) |
| `availabilitySchedules` | Time slots per listing |
| `bookings` | Reservations, tour bookings, event tickets with status tracking |
| `travelPlans` | AI travel plan history |
| `trips` | User-created itineraries with embedded stops array (listing + date/time/notes/order) |
| `reviews` | Listing ratings & reviews |
| `travelKnowledge` | Knowledge base for AI travel planner |

### Trip Itinerary Builder

Trips have embedded `stops` arrays (not a separate table) since typical trips have 5-20 stops. Each stop references a listing by ID and includes optional date, time, notes, and order.

- **Status flow**: `planning` → `active` → `completed`
- **"Save to Trip" modal** (`SaveToTripModal.jsx`): reusable across MapPage popup, FavoritesSection, and TravelPlanner
- **AI plan conversion**: `convertPlanToTrip` mutation best-effort matches destination names to listings via the `search_listings` search index
- **Stop hydration**: `getMyTrips` and `getTrip` queries resolve each stop's `listingId` to include name, type, city, coordinates

### Seeding Data

The `listings` table is populated via `convex/listings/mutations.ts:seedListings` (internal mutation). It clears existing data then inserts 88 Saudi Arabia listings (hotels, restaurants, attractions, events, tours) across Riyadh, Jeddah, Mecca, Medina, AlUla, Abha, Dammam, and more. Run with:
```bash
npx convex run listings/mutations:seedListings          # dev
npx convex run listings/mutations:seedListings --prod    # production
```

### AI Travel Planner

`convex/travelPlanner/actions.ts` exports `planTravel` — a multi-turn conversational action that:
- Uses OpenRouter API with `anthropic/claude-3.5-haiku`
- Asks 3-5 follow-up questions before generating a full plan
- Understands Saudi/Gulf Arabic dialect expressions
- Returns JSON with `ready: false` (follow-up question) or `ready: true` (full itinerary, destinations, tips, budget)
- Matches the user's language — responds in English to English input, Arabic to Arabic input
- Plans can be saved as editable trips via "Save as Trip" in the UI

### Internationalization Pattern

Each component defines its own `translations` object with `ar` and `en` keys. Language state is passed as a prop or managed locally. There is no global i18n library — keep translations co-located with the component that uses them.

## Key Technologies

- **React 19** with Vite 7
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
OPENROUTER_API_KEY=sk-or-xxx
```

### Convex Dashboard (Settings > Environment Variables)
```
BETTER_AUTH_SECRET=<random-base64-string>
SITE_URL=https://www.hasio.xyz
OPENROUTER_API_KEY=sk-or-xxx
MAPBOX_PUBLIC_TOKEN=pk.xxx
```

**Note:** `SITE_URL` in Convex should point to the production frontend domain (not the Convex site URL) — it's used by Better-Auth for cookie domain and redirect handling.

### Vercel Environment Variables
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

## Admin Panel

- **URL**: `/admin`
- **Auth**: Session-based — Username: `admin`, Password: `admin2026`
- **Features**: Dashboard stats, listing CRUD, pending business approvals (with doc review), travel knowledge data, bookings
- **Note**: Admin route uses plain `ConvexProvider` (bypasses Better-Auth)

## Design Constraints

- Green (#0D7A5F) primary color with generous white space
- Instrument Serif for headings, Outfit for body text, Cairo for Arabic
- Bilingual: Arabic (RTL) and English (LTR) with language toggle on all pages
- All translatable text in `translations` objects at component level
- Admin panel is Arabic-only with full RTL support
- Brand name always displayed as "Hasio" (English) in UI — never Arabic script for the logo
- Icons must be monochrome/neutral — never use colored icons
