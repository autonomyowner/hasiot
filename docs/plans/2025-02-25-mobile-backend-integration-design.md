# Mobile App Backend Integration Design

**Date**: 2025-02-25
**Goal**: Connect the Hasio React Native (Expo) mobile app to the existing Convex backend with Better-Auth token-based authentication.

## Decisions

| Decision | Choice |
|----------|--------|
| Auth strategy | Token-based (bearer tokens via SecureStore) |
| Auth methods | Email/password only |
| Data scope | All features — full parity with web |
| Convex setup | Separate config in mobile app, same deployment |
| Data hooks | Drop-in replacement of mock hooks |

## Phase 1 — Foundation (Auth + Convex Client)

1. Install `convex` and `expo-secure-store` in mobile app
2. Create `convex.json` pointing to existing deployment
3. Generate `_generated/` types from shared backend
4. Create `lib/auth.ts` — REST calls to Better-Auth endpoints (signIn, signUp, signOut, getSession, getToken)
5. Create `lib/convex.ts` — ConvexReactClient instance + useAuthFromSecureStore hook
6. Rewrite `hooks/useConvexUser.ts` with real auth state
7. Update `app/_layout.tsx` with ConvexProviderWithAuth
8. Wire sign-in/sign-up into onboarding flow

## Phase 2 — Core Data Hooks

1. Rewrite `hooks/useConvexData.ts` — replace all mock hooks with Convex queries
2. Adapter layer: map Convex listing fields → mobile TypeScript types
3. Remove `constants/mockData.ts`
4. Test browse tabs (lodging, food, events, home)

### Hook → Query Mapping

| Mock Hook | Convex Query | Filter |
|-----------|-------------|--------|
| useLodgings() | listings.queries:listListings | type: "hotel" |
| useFoods() | listings.queries:listListings | type: "restaurant" |
| useEvents() | listings.queries:listListings | type: "event" |
| useDestinations() | listings.queries:listListings | type: "attraction" |
| useFavorites() | users.queries:getFavorites | — |
| useBookings() | bookings.queries:getUserBookings | — |
| useTrips() | trips.queries:getMyTrips | — |
| useTravelPlans() | travelPlanner.queries:getMyPlans | — |

## Phase 3 — User Features

1. Favorites — swap Zustand store for Convex toggleFavorite mutation
2. Trips — wire create/edit/delete/reorder to Convex trips mutations
3. AI Planner — connect to planTravel action
4. Bookings — wire full createBooking/cancelBooking/rescheduleBooking flow

## Phase 4 — Business/Provider/Admin

1. Business document upload (expo-document-picker + generateUploadUrl + saveBusinessDoc)
2. Listing creation forms → Convex createListing mutation
3. Provider service posting
4. Admin dashboard queries (getDashboardStats, listPendingBusinesses, approveBusinessAccount)

## Phase 5 — Polish

1. Error handling + offline states
2. Pull-to-refresh on list screens
3. Real-time updates (automatic via Convex subscriptions)
4. End-to-end testing

## Architecture

```
Mobile App (Expo)
  ↓ token in header
Convex HTTP Backend
  ↓ Better-Auth validates token
  ↓ getAuthenticatedAppUser(ctx)
Convex Database (shared with web)
```

No changes to the Convex backend required. The mobile app calls the same queries/mutations/actions as the web app.
