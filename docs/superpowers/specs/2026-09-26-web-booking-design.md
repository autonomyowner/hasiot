# Booking on hasio.net — design

Date: 2026-09-26 · Branch: `web-booking` (from `sdk-57`) · Owner request: "check the hasio project,
site and app — for now focus on the website. I need booking to be fully wired and production
ready; currently they can't book on the site. Fix that. Think about the best approach and the
pages needed, and get it done." Standing rule for goals: no questions — defaults are recorded
here, a Fable review checks the plan and the merged code.

## Why

Every "Book" on hasio.net (the landing rows, `/explore`) sends the visitor to an app store, or to
`#download` on a desktop. Nobody can book on the site. Yet everything booking needs already exists
on the backend, and is in production since 2026-09-26: priced stays (`quoteStay`,
`createStayBooking`), priced services (`quoteService`, `createServiceBooking`), the phone rule for
booking (`canBook`, `setContactPhone`), the traveller's bookings (`getUserBookings`, `getBooking`,
`cancelBooking`), reviews, and hosts answering requests from the app **and** from `/partners` on
this same site. Production has 10 priced, hosted hotels today; no live services yet.

What is missing is the traveller's half on the web: a page per place, a way to choose dates, sign
in, give a phone number, send the request, and follow it afterwards.

## Approaches considered

1. **Web booking with an account, on the existing backend (chosen).** Public place and service
   pages read the backend with a plain `fetch` (like `/explore`); the Convex client loads only once
   the traveller starts a booking. Sign-in (Google, or a phone code) and the phone step sit inline
   in the checkout. Every rule, price and refusal stays on the server, unchanged.
2. Guest checkout (name + phone, no account). Rejected: `createStayBooking` needs an authenticated
   user, a request made without one could never be viewed or cancelled, and a phone-less stranger
   could flood hosts with requests. It would need new unauthenticated mutations and magic links.
3. Keep booking in the app and deep-link to it. Rejected: it is the status quo the owner asked to
   fix.

## Decisions (defaults taken, not asked)

| # | Decision | Why |
|---|---|---|
| W1 | Booking needs an account. Sign-in methods on the web: **Google**, **phone code**, and **email for existing accounts** (the app's three; Apple needs a Services ID from Nabil's account and stays app-only) | The server's rule; parity with the app |
| W2 | **Stays and services** are both bookable. Services show on `/explore` (a "Services" chip) only once at least one is live | The backend and the partner portal already take providers; none are live today, so nothing empty is shown |
| W3 | Public pages stay anonymous and light: `/places/:id` and `/services/:id` use plain `fetch` to Convex's HTTP query API — no Convex client, no Better Auth chunk (same rule as `/` and `/explore`). The Convex client loads only under `AuthedLayout`: `/book/*`, `/trips/*`, `/login` | Visitors who only browse pay nothing extra; the bundle rule in CLAUDE.md holds |
| W4 | Checkout is **its own page with the choice in the URL**: `/book/stay/:listingId?checkIn=&checkOut=&guests=`, `/book/service/:serviceId?date=&time=&quantity=&people=` | A Google round-trip, a reload or a shared link comes back to the same request |
| W5 | The phone step is the app's (`VerifyPhoneSheet`): while `saudiSmsLive` is false a **+966 mobile is typed once** (`setContactPhone`, unconfirmed); any other number — or a Saudi one once SMS is live — is confirmed by **SMS code** with `updatePhoneNumber: true` | One rule, owned by the server (`canBook`) |
| W6 | When the account has **no name** (phone sign-ups), the checkout asks for it — one "Your name" field, split into first and last name at the first space — and saves it with `updateProfile` | A host must know who is arriving at the door. The app never asks; the web has no profile screen to set it elsewhere |
| W7 | The app's limits and defaults: dates today (Riyadh) to 365 days out, 1–30 nights, guests default 2 (or `maxGuests` if lower), 1…`maxGuests` (fallback 4), notes ≤ 500. Services: a day, start times 06:00–23:00 every 30 min (today: at least 60 min ahead), hours 1–12 / days 1–14 for hourly/daily prices, people 1…`maxGroupSize` (fallback 20) | Same numbers the server enforces |
| W8 | No greyed-out dates. The live quote's `available` is the truth: "No rooms available for those dates" | The app has no per-day availability either |
| W9 | Cancel as in the app: a pending or confirmed booking, a stay before its check-in day, a confirmed service before its start; no reason asked; dialog "Cancel this booking?" · "Keep it" / "Cancel booking" | Server rules (`cancelAsTourist`) |
| W10 | A completed booking offers "Rate this place / Rate this service" on its trip page, sent with its `bookingId` (verified mark), like the app | Closes the loop the app closes |
| W11 | Every "Book" / "View" on `/` and `/explore` opens the web page for that place. The stores stay one tap away (a quiet "Also in the app" line on the trip page) | The point of the change |
| W12 | SAR only on the web (the app's USD toggle is not ported) | The server stores and quotes SAR |
| W13 | Dates are Gregorian on the Riyadh clock, week starting Sunday; Arabic uses `ar-SA-u-ca-gregory-nu-latn` (plain `ar-SA` would print Hijri dates); Arabic counts use the four plural forms | The app's rules (`lib/dates.ts`, `lib/calendarLocale.ts`) |
| W14 | **Email reaches web users.** (a) Every booking email carries a button to the page that acts on it — the traveller's trip page, or the host's / provider's inbox on `/partners`. (b) Hosts and providers are also emailed a **new request** and a **cancellation** (the app only pushes those). (c) `getPublicConfig().bookingEmails` tells the site whether email is switched on, so the confirmation never promises an email that will not come | A web traveller has no push, and a web-only host has no push either — an unseen request simply expires after 48 hours |
| W15 | "My trips" is linked from every public header (landing included, re-measured) and leads to `/trips`; signed out, `/trips` sends to `/login?next=/trips` | Travellers need a way back to their bookings |
| W16 | `/login?next=` is the traveller sign-in. `next` is followed only if it is a relative path under `/trips` or `/book/`, with no dot segments | No open redirect. `/sign-in` stays the admin's (unlinked) email login; a different word, not a hyphen, tells the two apart |
| W17 | Refusals read like the app: the English half of the server's message is matched against the app's tables (`lib/bookingError.ts`, `lib/serviceBookingError.ts`, the phone sheet's errors); anything unmatched but bilingual shows the half in the page's language; anything internal shows the generic line | Same wording across clients; the English half is already an API |
| W18 | The partner login's `CodeBoxes`, `ResendRing` and `GoogleMark` move to `src/components/auth/` and both sign-ins use them | One OTP input, not two |
| W19 | No new booking functions on the backend. The web calls exactly what the 1.1.0 app calls | The rules are already tested (518 backend tests) |
| W20 | A Google sign-in that fails before its own return address is known (a lost state cookie) lands on **`/login`**, not `/partners`: `onAPIError.errorURL` → `${PUBLIC_SITE_URL}/login`. `/login` reads `?error=` and `?state=state_not_found`, and links partners to `/partners` | A traveller landing on the partner login would be steered into applying as a partner |
| W21 | The checkout saves the page's language as the account's `preferredLanguage` (with the name, in one `updateProfile`) before sending the request | Every web account starts as Arabic (`users/sync.ts`); the emails about a booking should speak the language it was made in |
| W22 | The host's new-request email names the guest (`guestName` loaded with the booking), as the push already does | W6's name is wasted if the one email that needs it says "A guest" |
| W23 | Each new page sets its title, `canonical` and `og:url` to `https://hasio.net<path>` and restores them on leaving; `index.html`'s canonical, `og:url`, images and the sitemap move from hasio.xyz to hasio.net; `robots.txt` keeps `/book/`, `/trips` and `/login` out of search | Every page declared itself a copy of hasio.xyz's home |
| W24 | A malformed or foreign id in a link, or a booking that is not the viewer's own, shows "not found" — never the error screen. Public pages learn it from the HTTP error (`validation`), signed-in pages read queries through `useQuerySafe` | An email link cut short by a mail client must not look like a crash |
| W25 | Reservations made by the 1.0.x apps (restaurant/event "slot" bookings: a date, a time, a party size, no total or code) appear in My trips as such, and can be cancelled while open | `getUserBookings` returns them; the server allows it |

Fable's plan review (2026-09-26) is folded into W6, W16 and W20–W25 and into the contract. Two of
its suggestions were not taken: the Services chip on `/explore` stays (it costs one small request
and appears by itself once the first service is live — otherwise going live would need a deploy),
and `/sign-in` is not merged into the traveller page (it is the admin's login and
`/delete-account`'s; the traveller page is named `/login` instead). A "request received" email to
the traveller is deferred: tourist emails today are answers only, and adding one needs an
email-only path.

## Pages

Public (plain fetch, `AuthedLayout` not loaded):

- **`/places/:id`** — any public listing. Photo gallery; type, city, rating; name; for a priced
  hotel "450 SAR / night"; Call / Directions / Website; About (in the page's language, the other
  one as fallback); amenities (the partner portal's labels); opening hours for non-hotels; reviews
  (summary + the newest, "Verified stay" where earned). A priced hotel gets the **booking section**:
  an inline calendar (two months on a wide screen, one on a phone), a guests stepper, and a summary
  card — sticky beside the content on desktop, a sticky bar at the bottom on a phone — showing the
  live quote ("3 × 450 SAR", total, "Updating…"), the 48-hour / pay-at-the-property note and
  **"Request to book"**, which opens the checkout with the choice in the URL. A place that is not a
  priced hotel shows no booking section. Unknown or hidden id: "This place isn't available" + back
  to Explore.
- **`/services/:id`** — a public service. Photos, type, city, "Offered by …", price with its unit
  ("150 SAR per hour", "Price on request"), group size, languages, availability text, About,
  reviews. A bookable service gets the booking section: a one-day calendar, start-time chips,
  hours/days stepper when the unit asks, people stepper, live quote, "Request to book". An
  unpriced one shows **Contact** (call / email) instead (D16 of the services design).

Signed in (under `AuthedLayout`):

- **`/book/stay/:listingId`**, **`/book/service/:serviceId`** — the checkout. A summary card (photo,
  name, dates or day and time, guests or people, the live quote and its breakdown, the payment
  note) beside three steps:
  1. **Sign in** — Google, phone code, or "Sign in with email" for existing accounts. Signed in:
     "Signed in as … · Not you? Sign out".
  2. **Your details** — your name when missing (W6); the phone step when `canBook` is false
     (W5). Done: the number, marked "not confirmed by SMS" when it is.
  3. **Send your request** — notes (≤ 500), the terms line, **"Send booking request"**.
  Success replaces the page with the trip page (`/trips/:id?sent=1`). A quote that stops being
  valid (dates filled up, listing withdrawn) replaces the button with the reason and "Change dates".
- **`/trips`** — "My trips": Upcoming / Past, stays and services mixed, updating live; each row:
  photo, name, dates, nights/guests, status chip, total. Empty states as in the app.
- **`/trips/:bookingId`** — the booking: a "Request sent" banner on `?sent=1` (with the code, the
  48-hour note, and "We'll email you at …" only when W14c says email is on and the account has a
  real address); status; confirmation code; dates and times; guests; total; the host's reason when
  declined; address, Call, Directions; the provider's contact for services; Cancel (W9); Rate (W10).
- **`/login`** — the traveller sign-in on its own (W16, W20), for `/trips` and any signed-out entry.

## Flows

**Stay:** `/explore` → card → `/places/:id` → choose dates + guests (live `quoteStay` over plain
fetch, debounced) → "Request to book" → `/book/stay/:id?…` → sign in (Google returns to this same
URL) → name if missing → phone if `canBook` is false → notes → `createStayBooking` →
`/trips/:bookingId?sent=1`. The host answers from the app or `/partners/hotel/bookings`; the trip
page updates live; the traveller is emailed when email is on (W14).

**Service:** the same, with `/services/:id`, `quoteService`, `createServiceBooking`, and the
provider's inbox at `/partners/services/bookings`.

**Signing in with Google** uses the existing top-level `GET /api/auth/oauth-start` (never a fetch;
the login-CSRF fix of 2026-09-26) with `callbackURL` and `errorCallbackURL` both set to the page the
traveller is on; a failure comes back as `?error=`, is read once and removed from the address bar.

## Backend changes (small, test-first)

1. `getPublicConfig().bookingEmails` — `true` when `RESEND_API_KEY` is set (a pure helper,
   `emailDeliveryOn(env)`).
2. Booking emails carry an action link: traveller events → `${PUBLIC_SITE_URL}/trips/<bookingId>`;
   host events → `${PUBLIC_SITE_URL}/partners/hotel/bookings`, provider events →
   `${PUBLIC_SITE_URL}/partners/services/bookings`. `PUBLIC_SITE_URL` defaults to
   `https://hasio.net`.
3. `booking.requested` and `booking.cancelled` are emailed to the host / provider, with a
   host-facing payment line ("The guest pays you at the property." / "The traveller pays you
   directly.") and the guest's name (W22). Placeholder addresses are still never mailed.
4. `onAPIError.errorURL` → `${PUBLIC_SITE_URL}/login` (W20); `publicSiteUrl()` moves to
   `convex/lib/site.ts` so auth and email share it.
5. Found while building: a stay's notes are cut to 500 characters on the server, as a service's
   were; and (Fable's code review) booking emails are capped at 40 a day per recipient, counted
   only when email is on — requests and cancellations now reach the host, and cheap accounts
   must not be able to burn the sending domain through one inbox.

Nothing else on the server changes. The 1.0.x apps and the 1.1.0 app are unaffected: no function,
argument or return shape they use changes (only emails gain a link and two events, and a lost
Google state lands on `/login`).

## Errors

Mapped per W17. The ones a page acts on: **duplicate** ("You already have a booking for those
dates." + a link to My trips), **no availability** / **dates** ("Change dates"), **phone required**
(back to the phone step), **not authenticated** (back to sign-in), **own listing / own service**,
**daily limit**. Phone step: invalid number, wrong code, expired code, too many attempts, "This
number already belongs to another Hasio account. Use a different number.", SMS now live, too many
changes today.

## Testing and verification

- Unit tests (vitest) for every pure piece: Riyadh dates, the month grid, range selection, plural
  counts, money, URL parameters, service start times, status and cancel rules, error mapping.
- Backend tests for the three changes above; the whole backend suite and `typecheck:convex` stay
  green; `npm run lint` clean.
- Production build, and the bundle rule: `dist/index.html` has no `modulepreload`, and `/`,
  `/explore` and `/places/:id` load no `convex` or `better-auth` chunk.
- A real browser (headless Chrome through `playwright-core`) against the development backend, in
  both languages, at phone and desktop widths: browse → place → dates → checkout → phone sign-in →
  name → request → trip page; the host confirms (fixture) and the trip page flips live; cancel;
  an email account with no phone takes the Saudi "type once" path; a service booking end to end;
  a completed booking can be rated. Test accounts and bookings are removed afterwards.

## Out of scope

Online payment (none anywhere — pay at the property / the provider); the USD toggle; per-day
availability; slot bookings for restaurants and events (the 1.1.0 app offers none); Sign in with
Apple on the web; server-rendered meta tags for link previews; a traveller profile page (the
account can be deleted at `/delete-account`, linked from My trips).

## Risks

- **No email is configured in production** (`RESEND_API_KEY` is unset): until the owner sets it,
  a web traveller learns the host's answer only by opening My trips, and a host learns of a web
  request only in the app or on `/partners`. The confirmation page says so honestly (W14c).
- Hosts have no working push today either (iOS push waits for Nabil, Android for Firebase), so a
  request can expire unseen. The admin panel's الحجوزات tab shows every pending request; the owner
  can chase hosts from there until email is on.
- Saudi travellers can only sign in with Google (SMS cannot reach +966). No human has completed a
  real Google sign-in on production yet — the owner should do one after the deploy.
- An unconfirmed Saudi number can be anyone's (unchanged risk from the Google sign-in design).

## Owner setup (cannot be done from code)

- Email: create a Resend account, verify the sending domain (hasio.net), then
  `npx convex env set RESEND_API_KEY <key> --prod` and
  `npx convex env set RESEND_FROM "Hasio <bookings@hasio.net>" --prod`. No deploy needed.
- Optional: `PUBLIC_SITE_URL` if links should point anywhere but `https://hasio.net`.

## Rollout

`npx convex deploy --yes` (the email changes), then the website (`npm run build -- --mode
cloudflare`, `npx wrangler deploy`). No app release. Rollback: the previous website version with
`npx wrangler rollback`, and the backend from the previous commit.

## Summary

Travellers will be able to find a hotel or a local service on the website and send a booking request there.
They sign in with Google or their phone, and can see, cancel and rate their bookings on a "My trips" page.
Hosts are told by email about new requests once the owner switches email on.
