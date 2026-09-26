# Partner analytics + CRM — plan (2026-09-26)

Design: `docs/superpowers/specs/2026-09-26-partner-analytics-crm-design.md`.
Contract: `docs/superpowers/contracts/2026-09-26-partner-analytics-crm.md`. Branch `partners-web`.

## Part 1 — backend, test-first (agent A, branch `partners-crm-backend`)
1. Schema: `partnerGuestNotes` table.
2. `convex/partners/service.ts` seams + `service.test.ts`: `requirePartner`, `analyticsFor`,
   `listGuestsFor`, `getGuestFor`, `saveGuestNoteFor`, `PARTNER_ERRORS`.
3. `queries.ts`, `mutations.ts` wrappers.
4. `deleteAccountData` cleanup + test.
5. Checks: `npm run test`, `npm run typecheck:convex`, `npm run lint`.

## Part 2 — website, in parallel against the contract (agent B, branch `partners-crm-web`)
1. Shared `src/partners/insights/`: `AnalyticsPage.jsx` (takes `role`), `GuestsPage.jsx`,
   `GuestDrawer.jsx`, `csv.js` + test, `format.js` + test (money, %, minutes, bucket labels en/ar).
2. Routes `analytics` and `guests` in `HotelRoutes.jsx` and `ServicesRoutes.jsx`; nav items in
   `PartnersLayout.jsx`.
3. Checks: `npm run test`, `npm run lint`.

## Part 3 — integration (me)
Merge both, `npx convex dev --once` to dev, build (0 modulepreload), browser smoke with a real
booking on dev (traveller books the smoke hotel via the smoke script's pattern), update docs.

## Summary

Partners get a page showing how their bookings, income and ratings are doing over time.
They also get a list of every guest who booked with them, with private notes and labels.
All of it stays on a test branch until you say to ship.
