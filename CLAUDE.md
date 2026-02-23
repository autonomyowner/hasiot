# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tabra is an Algerian healthcare platform built with React and Vite. It features an AI symptom checker, doctor/clinic directory with map view, appointment booking, and digital health cards.

## Commands

```bash
npm run dev          # Start Vite development server
npm run dev:convex   # Start Convex backend server (run in separate terminal)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint
npx convex dashboard # Open Convex dashboard
npx convex deploy    # Deploy Convex to production
```

**Development**: Run `npm run dev` and `npm run dev:convex` in separate terminals simultaneously.

## Architecture

### Frontend (React + Vite)

- `src/main.jsx` - App entry point with Clerk + Convex providers (conditional auth based on env vars)
- `src/App.jsx` - Main landing page with all sections, includes `translations` object for AR/EN
- `src/MapPage.jsx` - Interactive map with Mapbox GL for doctor/clinic directory
- `src/AdminPage.jsx` - Admin dashboard (Arabic RTL) with own session auth
- `src/components/` - Reusable UI components
  - `auth/AuthButtons.jsx` - Sign in/up buttons with Clerk
  - `symptoms/SymptomChecker.jsx` - Conversational AI symptom analysis chat
  - `appointments/BookingForm.jsx` - Appointment booking UI

### Backend (Convex)

```
convex/
├── schema.ts              # Database schema (9 tables)
├── auth.config.ts         # Clerk JWT verification config
├── http.ts                # HTTP routes for webhooks
├── admin/
│   ├── queries.ts         # getDashboardStats, listAllDoctors, listTrainingData
│   └── mutations.ts       # CRUD for doctors and AI training data (no auth required)
├── users/
│   ├── queries.ts         # getCurrentUser, getFavorites, isFavorite
│   └── mutations.ts       # updateProfile, toggleFavorite, webhook handlers
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
│   ├── actions.ts         # analyzeSymptoms (OpenRouter API with conversation history)
│   ├── queries.ts         # getMyAnalyses, getAnalysis
│   └── mutations.ts       # storeAnalysis
└── webhooks/
    └── clerk.ts           # User sync from Clerk (create/update/delete)
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles synced from Clerk |
| `doctors` | Doctors, clinics, hospitals |
| `availabilitySchedules` | Time slots per doctor |
| `appointments` | Bookings with status tracking |
| `healthCards` | Digital health cards |
| `medicalRecords` | Prescriptions, lab results, etc. |
| `symptomAnalyses` | AI analysis history |
| `reviews` | Doctor ratings & reviews |
| `aiTrainingData` | Knowledge base for AI symptom checker |

## Key Technologies

- **React 19** with Vite 7
- **Convex** - Serverless backend with real-time subscriptions
- **Clerk** - Authentication (sign up/in, user management)
- **OpenRouter** - AI API (Claude 3.5 Haiku for symptom analysis)
- **Mapbox GL JS** - Interactive maps and geocoding
- **Framer Motion** - Animations
- **React Router DOM 7** - Client-side routing

## Environment Variables

### Frontend (.env.local)
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxx
VITE_MAPBOX_PUBLIC_TOKEN=pk.xxx
```

### Convex Dashboard (Settings > Environment Variables)
```
CLERK_JWT_ISSUER_DOMAIN=https://your-clerk.clerk.accounts.dev
CLERK_WEBHOOK_SECRET=whsec_xxx
OPENROUTER_API_KEY=sk-or-xxx
```

## Setup Instructions

1. Run `npx convex dev` to initialize Convex (creates deployment)
2. Copy the Convex URL to `VITE_CONVEX_URL` in `.env.local`
3. Add environment variables in Convex Dashboard > Settings
4. Set up Clerk webhook:
   - Go to Clerk Dashboard > Webhooks
   - Add endpoint: `https://your-convex.convex.site/clerk-users-webhook`
   - Select events: `user.created`, `user.updated`, `user.deleted`
   - Copy webhook secret to Convex environment

## Deployments

| Environment | Convex URL | Clerk |
|-------------|------------|-------|
| Development | `https://prestigious-duck-501.convex.cloud` | `pk_test_*` |
| Production | `https://zany-starling-644.convex.cloud` | `pk_live_*` (clerk.tabra.space) |

Frontend hosted on Vercel with environment variables for each deployment.

## Admin Panel

- **URL**: `/admin`
- **Auth**: Simple session-based (not Clerk) - Username: `admin`, Password: `admin2026`
- **Features**: Dashboard stats, doctor/clinic CRUD, AI training data management, appointments
- **Note**: Admin route bypasses Clerk provider in `main.jsx` to avoid domain restrictions on localhost

## Design Constraints

- No icons in UI (per project requirements)
- Red (#DC2626) primary color with generous white space
- Instrument Serif for headings, Outfit for body text, Cairo for Arabic
- Bilingual: Arabic (RTL) and English (LTR) with language toggle
- All translatable text in `translations` objects at component level
- Admin panel is Arabic-only with full RTL support
