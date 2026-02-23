# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tabra (تبرا) is an Algerian healthcare platform built with React and Vite. It features an AI symptom checker, doctor/clinic directory with map view, appointment booking, and digital health cards. Two user roles: patients (immediate access) and doctors/clinics (require CV upload + admin approval).

## Commands

```bash
npm run dev          # Start Vite development server (port 5173)
npm run dev:convex   # Start Convex backend server (run in separate terminal)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
npx convex dashboard # Open Convex dashboard
npx convex deploy    # Deploy Convex to production
```

**Development**: Run `npm run dev` and `npm run dev:convex` in separate terminals simultaneously.

## Architecture

### Authentication (Better-Auth + Convex)

Authentication uses `@convex-dev/better-auth` with email/password. The auth API runs on the Convex HTTP backend (not the frontend), so cross-origin setup is required:

- **Server**: `convex/auth.ts` — `createAuth()` with `betterAuth()`, `getAuthenticatedAppUser(ctx)` helper (replaces all old Clerk patterns). Cookies use `SameSite=None; Secure` for cross-origin.
- **HTTP routes**: `convex/http.ts` — `authComponent.registerRoutes(http, createAuth, { cors: true })`
- **Client**: `src/lib/auth-client.js` — `createAuthClient()` with `baseURL` pointing to `VITE_CONVEX_SITE_URL` and `credentials: "include"`
- **Hooks**: `src/hooks/useCurrentUser.js` — `useCurrentUser()` and `useConvexAuth()` combine `authClient.useSession()` with Convex user query
- **Provider**: `src/main.jsx` — `ConvexBetterAuthProvider` wraps main routes; admin routes use plain `ConvexProvider`

**Auth pattern in all Convex functions:**
```ts
import { getAuthenticatedAppUser } from "../auth";
const user = await getAuthenticatedAppUser(ctx); // returns null if not authenticated
```

### User Roles & Approval Flow

- **Patients**: Sign up → immediate access to all features
- **Doctors/Clinics**: Sign up → redirected to `/doctor-dashboard` → must upload CV → admin reviews CV at `/admin` → approves → dashboard unlocks
- CV files stored in Convex file storage (`_storage`), referenced by `cvFileId` on user record

### Frontend (React + Vite)

- `src/main.jsx` — Routing: `/`, `/map`, `/sign-in`, `/sign-up`, `/doctor-dashboard`, `/admin`
- `src/App.jsx` — Landing page with `translations` object for AR/EN
- `src/MapPage.jsx` — Mapbox GL interactive map for doctor/clinic directory
- `src/AdminPage.jsx` — Arabic RTL admin dashboard with session auth
- `src/pages/` — SignInPage, SignUpPage, DoctorDashboard
- `src/components/auth/AuthButtons.jsx` — Uses `useCurrentUser()` hook, navigates to auth pages

### Backend (Convex)

```
convex/
├── schema.ts              # Database schema (9 tables)
├── convex.config.ts       # Registers betterAuth component
├── auth.config.ts         # getAuthConfigProvider()
├── auth.ts                # Better-Auth instance + getAuthenticatedAppUser helper
├── http.ts                # Auth routes with CORS
├── admin/
│   ├── queries.ts         # getDashboardStats, listAllDoctors, listPendingDoctors
│   └── mutations.ts       # CRUD for doctors and AI training data
├── users/
│   ├── queries.ts         # getCurrentUser, getFavorites, isFavorite, getCvUrl
│   └── mutations.ts       # updateProfile, toggleFavorite, setUserRole, approveDoctorAccount, generateUploadUrl, saveCvFile, createUser
├── doctors/
│   ├── queries.ts         # listDoctors, searchDoctors, getSpecialties, getNearLocation
│   └── mutations.ts       # createDoctor, updateDoctor, addReview, seedDoctors
├── appointments/
│   ├── queries.ts         # getUserAppointments, getAvailableSlots, getAppointment
│   └── mutations.ts       # bookAppointment, cancelAppointment, rescheduleAppointment
├── healthCards/
│   ├── queries.ts         # getMyHealthCard, getMyMedicalRecords
│   └── mutations.ts       # createHealthCard, updateHealthCard, addMedicalRecord
├── symptoms/
│   ├── actions.ts         # analyzeSymptoms (OpenRouter API with Claude 3.5 Haiku)
│   ├── queries.ts         # getMyAnalyses, getAnalysis
│   └── mutations.ts       # storeAnalysis
└── migrations/
    └── migrateUsersToRoles.ts  # One-time migration (already run)
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles with role (patient/doctor/clinic), isApproved, cvFileId |
| `doctors` | Doctors, clinics, hospitals with geolocation |
| `availabilitySchedules` | Time slots per doctor |
| `appointments` | Bookings with status tracking |
| `healthCards` | Digital health cards (TBR-XXX-XXX format) |
| `medicalRecords` | Prescriptions, lab results, etc. |
| `symptomAnalyses` | AI analysis history |
| `reviews` | Doctor ratings & reviews |
| `aiTrainingData` | Knowledge base for AI symptom checker |

## Key Technologies

- **React 19** with Vite 7
- **Convex** — Serverless backend with real-time subscriptions
- **Better-Auth** (`@convex-dev/better-auth`) — Email/password authentication
- **OpenRouter** — AI API (Claude 3.5 Haiku for symptom analysis)
- **Mapbox GL JS** — Interactive maps and geocoding
- **Framer Motion** — Animations
- **React Router DOM 7** — Client-side routing

## Environment Variables

### Frontend (.env.local)
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
VITE_MAPBOX_PUBLIC_TOKEN=pk.xxx
```

### Convex Dashboard (Settings > Environment Variables)
```
BETTER_AUTH_SECRET=<random-base64-string>
SITE_URL=https://your-deployment.convex.site
OPENROUTER_API_KEY=sk-or-xxx
```

## Deployments

| Environment | Convex Cloud | Convex Site |
|-------------|-------------|-------------|
| Development | `prestigious-duck-501.convex.cloud` | `prestigious-duck-501.convex.site` |
| Production | `zany-starling-644.convex.cloud` | `zany-starling-644.convex.site` |

Frontend hosted on Vercel at `tabra.space`. Auth `trustedOrigins` include both `tabra.space` and `www.tabra.space`.

## Admin Panel

- **URL**: `/admin`
- **Auth**: Session-based — Username: `admin`, Password: `admin2026`
- **Features**: Dashboard stats, doctor/clinic CRUD, pending doctor approvals (with CV review), AI training data, appointments
- **Note**: Admin route uses plain `ConvexProvider` (bypasses Better-Auth)

## Design Constraints

- Red (#DC2626) primary color with generous white space
- Instrument Serif for headings, Outfit for body text, Cairo for Arabic
- Bilingual: Arabic (RTL) and English (LTR) with language toggle
- All translatable text in `translations` objects at component level
- Admin panel is Arabic-only with full RTL support
- Arabic brand name is تبرا (not طبرة)
