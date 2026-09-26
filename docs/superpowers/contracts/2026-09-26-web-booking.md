# Booking on hasio.net — contract

Design: `docs/superpowers/specs/2026-09-26-web-booking-design.md` (decisions W1–W19). Plan:
`docs/superpowers/plans/2026-09-26-web-booking.md`. Everything a page builder may rely on is here;
nobody guesses. The **core** (part 1 of the plan) builds sections 3–5 before the pages start.

## 1. Routes

| Path | Where | Page (lazy) | Owner |
|---|---|---|---|
| `/places/:id` | public | `src/pages/PlacePage.jsx` | builder A |
| `/services/:id` | public | `src/pages/ServicePage.jsx` | builder B |
| `/signin` | `AuthedLayout` | `src/booking/SignInPage.jsx` | builder C |
| `/book/stay/:listingId` | `AuthedLayout` | `src/booking/CheckoutPage.jsx` (`kind="stay"`) | builder C |
| `/book/service/:serviceId` | `AuthedLayout` | `src/booking/CheckoutPage.jsx` (`kind="service"`) | builder C |
| `/trips` | `AuthedLayout` | `src/trips/TripsPage.jsx` | builder D |
| `/trips/:bookingId` | `AuthedLayout` | `src/trips/TripPage.jsx` | builder D |

The core registers every route in `src/main.jsx` with a placeholder file at each path; builders
replace the placeholder's body and never edit `main.jsx`.

URL parameters (built and read only through `src/booking/params.js`):

- stay: `?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N`
- service: `?date=YYYY-MM-DD&time=HH:MM&quantity=N&people=N` (`quantity` only for hourly/daily)
- `/signin?next=<path>` — followed only when `safeNext(next)` accepts it (`/trips…`, `/book/…`)
- `/trips/:bookingId?sent=1` — the checkout's success hand-off (show the "Request sent" banner once)
- Google returns: `?error=<code>` on any page that started Google; read with
  `readGoogleReturn` (`src/partners/lib/googleSignIn.js`) and removed with `history.replaceState`

## 2. Backend — what the web calls

Public (plain fetch through `convexQuery`, no session): `listings/queries:getListing {listingId}` →
listing or `null`; `bookings/queries:quoteStay {listingId, checkIn, checkOut, guests}` →
`{ok:true, quote:{checkIn, checkOut, nights, guests, pricePerNight, totalAmount, currency},
available, checkInTime?, checkOutTime?}` | `{ok:false, error}`; `services/queries:getService
{serviceId}` → service + `{bookable, provider:{firstName,lastName,memberSince}|null}` or `null`;
`services/queries:listServices {}` → rows with `bookable`; `bookings/queries:quoteService
{serviceId, date, time, quantity?, partySize?}` → `{ok:true, quote:{date, time, quantity,
priceUnit, unitPrice, totalAmount, currency, partySize, checkIn, checkOut}}` | `{ok:false, error}`;
`reviews/queries:getSummary {listingId}` / `getServiceSummary {serviceId}` →
`{average: number|null (one decimal), count, histogram: [n1…n5]}`; `reviews/queries:listForListing {listingId, limit}` / `listForService {serviceId, limit}` →
reviews `{_id, rating, content?, isVerified?, isAnonymous?, createdAt, user:{firstName,lastName}|null}`;
`config/queries:getPublicConfig {}` → `{googleAuth, saudiSmsLive, demoAuth, appleAuth,
bookingEmails, mapboxToken}`.

Signed in (Convex React client, `api.*` from `convex/_generated/api`):

| Function | Args | Returns | Refusals the page handles |
|---|---|---|---|
| `users.queries.getCurrentUser` | `{}` | user + `canBook`, or `null` (signed out, suspended, deleted) | — |
| `partners.queries.getAccountStatus` | `{}` | `{status: "signed_out" \| "no_account" \| "suspended" \| "active", reason?}` — asked only when a session exists but `getCurrentUser` is `null` | — |
| `listings.queries.getListing` | `{listingId}` | listing or `null` | — |
| `services.queries.getService` | `{serviceId}` | as above | — |
| `bookings.queries.quoteStay` / `quoteService` | as above | as above | `ok:false` carries the refusal text |
| `bookings.mutations.createStayBooking` | `{listingId, checkIn, checkOut, guests, notes?}` | `{bookingId, confirmationCode}` | BOOKING_ERRORS (`convex/bookings/logic.ts`), daily limit, `Not authenticated` |
| `bookings.mutations.createServiceBooking` | `{serviceId, date, time, quantity?, partySize?, notes?}` | `{bookingId, confirmationCode}` | SERVICE_ERRORS (`convex/services/logic.ts`), phone, daily limit |
| `bookings.queries.getUserBookings` | `{includeServices: true}` | rows newest first: booking + `listing` summary (1 image) + `service` summary | — (`[]` signed out) |
| `bookings.queries.getBooking` | `{bookingId, includeServices: true}` | booking + full `listing` + `service` + `provider` + `viewerRole`, or `null` | — |
| `bookings.mutations.cancelBooking` | `{bookingId}` | `{success}` | ALREADY_CLOSED, STAY_STARTED, SERVICE_STARTED |
| `users.mutations.setContactPhone` | `{phone}` (E.164) | `{phone, phoneVerified:false}` | CONTACT_PHONE_ERRORS, the daily limit (10) |
| `users.mutations.updateProfile` | `{firstName?, lastName?}` | `{success}` | — |
| `reviews.queries.getMine` / `getMineForService` | `{listingId}` / `{serviceId}` | review or `null` | — |
| `reviews.mutations.addReview` | `{listingId? , serviceId?, rating 1–5, content?, bookingId, isAnonymous?}` | review id | the refusals in `convex/reviews/logic.ts` |

Better Auth (the shared `authClient`, `src/lib/auth-client.js`):
`phoneNumber.sendOtp({phoneNumber, fetchOptions:{headers:{'Accept-Language': lang}}})`;
`phoneNumber.verify({phoneNumber, code, fetchOptions})` (sign-in / sign-up);
`phoneNumber.verify({phoneNumber, code, updatePhoneNumber: true, fetchOptions})` (attach to the
signed-in account — refused with "Phone number already exists" when another account has it);
`signIn.email({email, password})`; `signOut()`; Google = a top-level navigation to
`oauthStartURL(AUTH_BASE_URL, returnURL)` with `callbackURL = errorCallbackURL = returnURL`.
Every result is `{data, error}`; treat `result.error` as thrown.

### Backend changes (core)

- `getPublicConfig()` gains `bookingEmails: boolean` — `emailDeliveryOn(process.env)`, true when
  `RESEND_API_KEY` is set.
- Emails: `renderEmail(event, input, locale)` renders `input.actionUrl` (when present) as a button
  "View booking" / «عرض الحجز» (traveller) or "Open your bookings" / «افتح حجوزاتك» (host,
  provider), and as a line in the text part. `bookingActionUrl(audience, booking, base)`:
  tourist → `${base}/trips/${bookingId}`; owner of a listing → `${base}/partners/hotel/bookings`;
  owner of a service → `${base}/partners/services/bookings`. `base = PUBLIC_SITE_URL ||
  "https://hasio.net"`, trailing slashes removed.
- `EMAILED_EVENTS` adds `booking.requested` and `booking.cancelled`. For the owner audience the
  payment line reads "The guest pays you at the property." / «يدفع الضيف لك مباشرة في مكان الإقامة.»
  (stay) and "The traveller pays you directly." / «يدفع المسافر لك مباشرة.» (service).

## 3. Core modules (pure, tested) — `src/booking/`

All functions are pure; `now` (ms) and `today` (ISO) are parameters with the real clock as the
default. `lang` is `'en' | 'ar'`.

**`dates.js`** — `MAX_NIGHTS = 30`, `MAX_DAYS_AHEAD = 365`.
`riyadhToday(now?) → 'YYYY-MM-DD'`; `isISODate(s)`; `addDays(iso, n)`; `daysBetween(a, b)` (b − a,
whole days); `riyadhTimestamp(date, time) → ms` (Riyadh wall clock, UTC+3, no DST);
`monthOf(iso) → {year, month}` (month 1–12); `addMonths({year, month}, n)`;
`monthGrid({year, month}) → Array<Array<iso|null>>` (weeks of 7, Sunday first, `null` outside the
month); `weekdayNames(lang)` (7 short names, Sunday first); `monthLabel({year, month}, lang)`
("October 2026" / "أكتوبر 2026"); `formatDay(iso, lang)` ("10 Oct" / "10 أكتوبر");
`formatDayLong(iso, lang)` ("Sat, 10 Oct 2026" / "السبت، 10 أكتوبر 2026");
`formatRange(a, b, lang)` ("10 Oct – 13 Oct"); `nextRange({start, end}, clicked, maxNights?)` — the
app's rule: with no start, or a complete range, the tap starts over; a tap on or before the start
starts over; a tap more than `maxNights` after the start starts over; otherwise it sets the end.
Arabic dates use `ar-SA-u-ca-gregory-nu-latn`, English `en-GB`, both with `timeZone: 'UTC'` on a
UTC-midnight `Date`.

**`text.js`** — `nightsText, guestsText, peopleText, hoursText, daysText (n, lang)`: English
"1 night" / "3 nights"; Arabic the server's four forms (`convex/notifications/templates.ts`):
"ليلة واحدة", "ليلتان", "3 ليالٍ", "11 ليلة" (and the same for ضيف / شخص / ساعة / يوم).
`quantityText(priceUnit, n, lang)` → hours or days text, `''` for other units.

**`money.js`** — `formatAmount(n, lang)` ("1,350", Latin digits in both languages);
`formatSAR(n, lang)` ("1,350 SAR" / "1,350 ر.س"); `unitLabel(priceUnit, lang)` ("per hour",
"per day", "per booking" / «للساعة», «لليوم», «للحجز»; `per_event` and `fixed` are both "per
booking"); `priceLine(price, priceUnit, lang)` ("150 SAR per hour"; no price → "Price on request" /
«السعر عند الطلب»).

**`params.js`** — `parseStayParams(search, today?) → {checkIn, checkOut, guests, valid}` (each
field `null` when missing or malformed; `valid` = both dates ISO, `checkIn ≥ today`, 1–30 nights,
guests a whole number ≥ 1); `stayQuery({checkIn, checkOut, guests}) → '?checkIn=…'`;
`parseServiceParams(search, today?) → {date, time, quantity, people, valid}` (`valid` = ISO date ≥
today, `HH:MM` time, people ≥ 1, quantity a whole number ≥ 1 or `null`); `serviceQuery({date,
time, quantity, people})` (omits `quantity` when null); `safeNext(next) → path | null`.

**`serviceRules.js`** — `SERVICE_START = '06:00'`, `SERVICE_END = '23:00'`, `STEP_MIN = 30`,
`LEAD_MIN = 60`. `startTimes(date, now?) → ['06:00', …, '23:00']`, today only times ≥ now + 60 min
(Riyadh), a past date `[]`; `firstServiceDay(now?)` (today if a time is left, else tomorrow);
`quantityRule(priceUnit) → null | {kind: 'hours', min: 1, max: 12} | {kind: 'days', min: 1, max: 14}`;
`maxPeople(service) → maxGroupSize ?? 20`.

**`status.js`** — `effectiveStatus(booking, now?)` (a `pending` past `expiresAt` reads `expired`);
`statusLabel(status, kind, lang)` (the app's words: pending "Awaiting host" / "Awaiting provider"
· «بانتظار المضيف» / «بانتظار مقدم الخدمة»; confirmed «مؤكد»; completed «مكتمل»; cancelled «ملغى»;
declined «مرفوض»; expired «منتهي الصلاحية»; no_show "No-show" «لم يحضر»);
`statusTone(status) → 'wait' | 'ok' | 'done' | 'bad'`; `isUpcoming(booking, now?)` (effective status
pending/confirmed, and for a stay `checkOut ≥ today`, for a service the start still ahead);
`splitTrips(rows, now?) → {upcoming (soonest first), past (newest first)}`;
`canCancel(booking, now?)` (W9: pending or confirmed; stay: `checkIn > today`; service: pending
always, confirmed only before its start).

**`errors.js`** — `bookingErrorText(err, lang, kind = 'stay')` with the app's tables
(`hasio-mobile-app/lib/bookingError.ts`, `lib/serviceBookingError.ts`) and their exact English and
Arabic strings from `hasio-mobile-app/constants/translations.ts`; unmatched → the half of a
bilingual server message in `lang`; internal (`Server Error`, `[CONVEX`, stack) → "Please try
again later" / «يرجى المحاولة لاحقاً». `phoneErrorText(err, lang)` for the phone and sign-in steps
(invalid Saudi mobile, wrong code, expired code, too many attempts, number taken, SMS now live,
daily change limit, the OTP rate limit's own bilingual text). `refusalKind(err) → 'duplicate' |
'unavailable' | 'dates' | 'phone' | 'auth' | 'own' | 'limit' | 'closed' | 'started' | null` — what
the page should offer next.

## 4. Core modules (shared, not pure)

- `src/lib/convexHttp.js` — `convexQuery(path, args?, {signal}?) → Promise<value>`: POST
  `${VITE_CONVEX_URL}/api/query` `{path, args, format:'json'}`; a `status:'error'` answer throws an
  `Error` whose `data` is the server's `errorData` (a ConvexError's text) and `message` its
  `errorMessage`. `useConvexQuery(path, args, {skip, debounceMs, keepPrevious}) →
  {data, error, loading}` — re-runs when the serialised args change, aborts the stale request,
  keeps the previous `data` while loading when `keepPrevious`.
- `src/booking/Calendar.jsx` — `<Calendar mode="range"|"single" value onChange min max lang
  months={1|2} maxNights? label />`. `value` is `{start, end}` (range) or an ISO string (single).
  Days are buttons with full-date `aria-label`s; one is tabbable; arrow keys move a day / a week
  (left and right flip in RTL), Home/End the week, PageUp/PageDown the month, Enter/Space picks.
  Days outside `[min, max]` are disabled. Prev/next month buttons, mirrored in RTL.
- `src/booking/Stepper.jsx` — `<Stepper label value min max onChange format? />`: − / value / +,
  44px targets, `aria-live` value.
- `src/booking/useTitle.js` — `useTitle(text)` sets `document.title` to `"${text} · Hasio"`.
- `src/components/auth/CodeBoxes.jsx`, `ResendRing.jsx`, `GoogleMark.jsx` — moved verbatim from
  `src/partners/pages/LoginPage.jsx` (builder C moves them; the partner login must render
  identically). Class names stay `p-otp`, `p-otp-box`, `p-ring…`; the traveller pages style them
  under their own root.
- `src/site/SiteHeader.jsx` — `<SiteHeader lang toggleLang isRtl current="explore"|"trips"|null />`:
  the `/explore` bar (brand, Explore / Home / The app / Contact, "My trips", the language button),
  `home-nav is-stuck` classes from `App.css`.
- `src/booking/booking.css` — the traveller look shared by every new page, all under `.bk`:
  page and card frames, buttons (`.bk-btn`, `.bk-btn-primary` green, `.bk-btn-ghost`), fields,
  chips, status chips (`.bk-status[data-tone]`), the calendar, the stepper, the summary card, the
  sticky phone bar, the OTP boxes. Tokens are App.css's (`--ink`, `--green`, `--paper`, `--gold`,
  `--muted`, `--line`), fonts `.landing-type`'s. Each builder adds its own CSS file
  (`place.css`, `service.css`, `checkout.css`, `trips.css`) and never edits `booking.css` — a
  missing shared style is reported, not added.

## 5. Rules every builder follows

- Public pages (`PlacePage`, `ServicePage`) import nothing from `convex/react`, `convex/browser`,
  `@convex-dev/better-auth`, `better-auth` or `src/lib/auth-client.js`; navigation to `/book/…` is
  a `useNavigate()` call. They may `import('../AuthedLayout.jsx')` to prefetch once dates are chosen.
- Text is co-located: `const translations = { en: {…}, ar: {…} }` in each component; language from
  `useLanguage()`; `dir` on the page root; brand always "Hasio".
- Buttons: a primary button is never faded to wait for input — it is disabled only while its own
  request is in flight (with a spinner), and pressed too early it says what is missing.
- Every submit guards against double taps with a ref.
- No `window.alert`/`confirm`. Confirmations are a small in-page dialog with focus trapped and
  Escape to close.
- Links from content (`website`) render only if they are `http(s)`.
- Images: `loading="lazy"` except the first gallery photo; `alt` is the place's name.
- Monochrome icons (inline SVG, `currentColor`).
