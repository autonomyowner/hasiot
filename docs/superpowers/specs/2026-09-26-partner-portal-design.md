# Partner portal on hasio.net — design (2026-09-26)

Hotels (business owners) and service providers can sign up, sign in and run their business from
the website, with the same account and the same data as the mobile app. Analytics and CRM are a
**separate, later design** — this one builds the door and the rooms they will live in.

Decisions taken with the owner (brainstorming, 2026-09-26):

| # | Decision |
|---|---|
| P1 | Scope now: sign-up + login + dashboards for both roles. Analytics + CRM next, own spec. |
| P2 | Sign-in is **phone number + SMS code**, same as the app — one account on both. |
| P3 | Dashboard is **full parity** with the app's owner screens (post/edit, bookings inbox, verification). |
| P4 | Built **inside the existing website** at `/partners`, behind `AuthedLayout`, lazy-loaded. |

## No backend change

Everything already exists and is already used by the app, so web and app cannot drift:

- Better Auth phone plugin: `POST /phone-number/send-otp`, `POST /phone-number/verify` (creates the
  account on first verify; the `users` row is made by the auth trigger, role `tourist`).
- `users/mutations:setUserRole` (`business_owner` | `service_provider`, `businessType`, names),
  `generateUploadUrl`, `saveBusinessDoc`, `users/queries:getCurrentUser`.
- Listings: `submitListing`, `updateMyListing`, `deleteMyListing`, `getMyListings`, `saveWorkingHours`
  if owner-callable (else hours go in the submit/update payload, as the app does).
- Services: `submitService`, `updateMyService`, `deleteMyService`, `getMyServices`.
- Bookings: `getBusinessBookings`, `getOwnerStats`, `getProviderBookings`, `getProviderStats`,
  `confirmBooking`, `declineBooking`, `completeBooking`, `markNoShow`.

The implementation copies argument shapes from the mobile screens (`hasio-mobile-app/app/business/*`,
`app/provider/*`, `lib/listingForm.ts`) — the app is the source of truth for behaviour, including
"an edit never overwrites pin/address/capacity with form defaults".

The only config dependency: `https://hasio.net` is already in `trustedOrigins` (convex/auth.ts).
Web cookies are `SameSite=None; Secure`, the same path `/admin` uses today.

**Go-live gate (not a code task):** `SMS_PROVIDER` is `demo` in production — any six digits sign in
as any number. The portal must not be linked from the landing page until that is off demo. It
ships **unlinked**; the footer link is a one-line follow-up once SMS is real.

## Routes (all inside `AuthedLayout`, all `React.lazy`)

| Route | Screen |
|---|---|
| `/partners` | Signed out → phone login. Signed in → redirect by role/state (below). |
| `/partners/join` | Choose "Hotel / place" or "Service provider" → names + business type → `setUserRole` |
| `/partners/verify` | Upload a document (PDF/image, ≤10 MB) → `saveBusinessDoc`; shows pending / rejected-with-reason / approved |
| `/partners/hotel` | Hotel dashboard: overview (owner stats), My places, Bookings inbox |
| `/partners/hotel/place/new`, `/partners/hotel/place/:id` | Post / edit a place |
| `/partners/services` | Provider dashboard: overview (provider stats), My services, Bookings inbox |
| `/partners/services/new`, `/partners/services/:id` | Post / edit a service |

**Routing by state** (one `usePartnerGate()` hook): not signed in → login; role `tourist` →
`/join`; business role without a document or rejected → `/verify`; pending approval → `/verify`
(status view, dashboard read-only is not offered — the app doesn't either); approved → the role's
dashboard; `admin` → a link to `/admin`. A logged-in user hitting the wrong role's dashboard is
redirected, never shown an error. The server re-checks every call anyway.

## Login screen

Country code fixed to +966 with a free field for other E.164 numbers (the app's `normalizePhone`
rules, ported to `src/partners/lib/phone.js`: `05xxxxxxxx` → `+9665xxxxxxxx`, Arabic digits folded).
Step 1 number → "Send code"; step 2 six-digit code, resend after 60 s. Errors show the server's
text in the current language (`"عربي / English"` split); the rate-limit message comes through
verbatim. Signing in via `authClient` so the Convex provider picks up the session. Sign out in the
header.

## Look and language

Bilingual (en/ar, RTL), toggle in the header, co-located `translations` objects (house rule). The
landing page's palette and fonts (Instrument Serif headings, Outfit / Cairo body, green `#0D7A5F`),
monochrome icons. Desktop-first two-column shell (side nav + content) collapsing to a top bar
below 850 px. Reuses admin primitives where they fit (`ImageUploader`, `WorkingHoursModal`,
`ConfirmDialog`, `ToastProvider`, `States`, `Drawer`) — imported, not copied; if one is
Arabic-only, it gets a `labels` prop rather than a fork.

## Bookings inbox

Same statuses and actions as the app: pending → confirm / decline (reason required) ; confirmed →
complete / no-show. Filter chips: pending, upcoming, past. Each row: code, guest name and phone,
dates or day + start time, quantity, total, status. Every action through `useConfirm` + toast;
refusals show the server's text.

## Errors

Every screen has loading, empty and error states. No `window.confirm/alert`. A lapsed session
anywhere sends the user to `/partners` with `?next=` (relative paths only).

## Testing

- Unit (vitest, website): `phone.js` normalisation, the gate's state→route function (pure), the
  form→payload builders for place and service (mirroring `lib/listingForm.ts`'s tests: an edit
  never sends defaults over existing pin/address/capacity).
- Build check: `dist/index.html` has **zero** `modulepreload`; the landing chunk does not grow.
- Browser smoke on dev (`npm run dev`, dev backend, `SMS_PROVIDER=demo` there): sign up as a hotel,
  upload a doc, approve in `/admin`, post a place, see it in My places; same for a provider.
- `npm run lint`, `npm run test`, `npm run typecheck` stay green.

## Out of scope

Analytics, CRM, web booking by travellers, email login for partners, notifications on web, the
landing-page link (until SMS is real), deploys.
