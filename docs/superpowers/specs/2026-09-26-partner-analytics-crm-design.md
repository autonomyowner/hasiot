# Partner analytics + guest CRM — design (2026-09-26)

Follows `2026-09-26-partner-portal-design.md` (the portal it lives in, branch `partners-web`).
Owner asked for "analytics and CRM in the dashboard they got"; defaults below were taken without
further questions (standing rule: autonomous goal, defaults in the spec). Contract:
`docs/superpowers/contracts/2026-09-26-partner-analytics-crm.md`.

## What partners get

**Analytics** (one page per role, `/partners/hotel/analytics`, `/partners/services/analytics`):
- A period switch: last 30 days / 90 days / 12 months (default 30). Counted by when the request
  was **made** (`createdAt`), so a number never moves after the period is over.
- Headline cards: requests, confirmed (confirmed + completed), acceptance rate, median time to
  answer, revenue (confirmed + completed `totalAmount`, SAR), average booking value; hotels also
  get nights sold. Each card shows the change against the previous period of the same length.
- A trend chart: requests, confirmed and revenue per bucket (day for 30, week for 90, month for 12
  months). Reuses the admin panel's `Charts.jsx`.
- Where requests end: confirmed, completed, declined, expired, cancelled, no-show (bar).
- Per place / per service table: requests, confirmed, revenue, rating, review count.
- Ratings: average, count, 1–5 distribution, latest five reviews (anonymous ones stay anonymous).
- Repeat guests: the share of guests in the period who had booked with this partner before.

**Guests (the CRM)** (`/partners/hotel/guests`, `/partners/services/guests`):
- A list of **everyone who has ever sent this partner a booking request**, one row per traveller:
  name, phone, bookings, completed stays/services, total spent, last visit, tags.
- Search by name or phone; filter by tag; sort by last visit (default), total spent, bookings.
- A guest drawer: contact (phone as a `tel:` link), every booking with this partner (code, dates,
  status, amount), and a **private note + tags** the partner writes. Guests never see these.
- CSV export of the list, built in the browser from what is on screen.

Default tags offered as one-tap chips: VIP, Repeat, Family, Business, Needs attention. Free tags
allowed (≤10 per guest, ≤24 chars).

## Rules

- Only an **approved** `business_owner` or `service_provider` (not suspended) gets data. A hotel
  sees stay/slot bookings (`kind !== "service"`), a provider sees service bookings — the same split
  `getOwnerStats` / `getProviderStats` use.
- The guest list is scoped to bookings where `ownerId` is the partner. A partner can read or write a
  note only for a traveller who has booked with them; anyone else is refused with the same text as
  "not found", so the endpoint cannot be used to probe who exists.
- Notes are private to the partner (not visible to admins in the UI, not to the guest).
- Account deletion: deleting the guest removes every note about them; deleting the partner removes
  the notes they wrote (`deleteAccountData`).
- Bounded reads: at most 2000 bookings per partner are read (`by_ownerId`, newest first). If the
  cap is hit, the response says `truncated: true` and the page says the numbers cover the most
  recent 2000 requests. Fine for a long time at current volume.

## Not built (recorded, not silently decided)

- **Page views / conversion from views.** Nothing records a listing view today; it needs a write
  from the app on every detail open, i.e. an app change and a new table with retention rules. Left
  for its own design once 1.1.0 is out.
- Messaging guests from the portal, email campaigns, reminders. The phone link is the contact path.
- Exports of analytics (only the guest list exports).

## Testing

Backend test-first with `convex-test` on the seams (`convex/partners/service.ts`): role and
approval gates, kind split, period bucketing (Riyadh dates), acceptance rate with zero answered
requests (null, not NaN), median response, repeat guests, truncation flag, note ownership refusal,
tag validation, deletion cleanup. Website: pure helpers (CSV builder, period labels) with vitest;
browser smoke on dev with the three dev partner accounts.
