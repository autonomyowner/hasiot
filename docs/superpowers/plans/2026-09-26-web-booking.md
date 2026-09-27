# Booking on hasio.net — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use
> checkbox (`- [ ]`) syntax. Part 1 is built by the coordinator, test-first; part 2 by four
> builders in parallel worktrees; part 3 by the coordinator.

**Goal:** a traveller can find a hotel or a service on hasio.net, send a booking request, and
follow, cancel and rate it there — on the backend the app already uses.

**Architecture:** public place/service pages read Convex over plain `fetch` (no Convex client, as
`/explore`); checkout, sign-in and My trips live under `AuthedLayout` (Convex React client + Better
Auth). Pure rules (dates, prices, parameters, statuses, error texts) sit in tested modules under
`src/booking/`; the backend only gains email links, two host emails and a config flag.

**Tech stack:** React 19 + Vite 7 + react-router 7, Convex 1.32, Better Auth 1.4 (phone, Google via
`/oauth-start`, email), vitest 3, plain CSS on App.css's tokens.

**Read first:** the design `docs/superpowers/specs/2026-09-26-web-booking-design.md` (W1–W25), the
contract `docs/superpowers/contracts/2026-09-26-web-booking.md`, `CLAUDE.md` (Frontend, Bundle &
Code Splitting, Authentication). Fable's review of this plan (2026-09-26) is folded in: tasks 1b
and 7b, the larger task 8, and the builders' use of the core's shared pieces.

Baseline on `web-booking` @ `aff154f`: `npx vitest run` → 50 files, 680 tests pass.

## File map

| File | Responsibility | Part |
|---|---|---|
| `convex/notifications/links.ts`, `convex/lib/site.ts` (+tests) | `emailDeliveryOn`, `publicSiteUrl`, `bookingActionUrl` | 1 |
| `convex/notifications/templates.ts` (+test) | action button, host-facing payment line | 1 |
| `convex/notifications/deliver.ts` | two more emailed events; action link, audience and guest name per email | 1 |
| `convex/config/queries.ts`, `convex/auth.ts` | `bookingEmails`; a lost Google state lands on `/login` | 1 |
| `src/lib/convexHttp.js`, `src/lib/useQuerySafe.js` (+test) | public reads; signed-in reads that never throw | 1 |
| `src/booking/{dates,text,money,params,serviceRules,status,errors,authReturn}.js` (+tests) | the pure rules | 1 |
| `src/booking/{Calendar,Stepper,StatusChip,ConfirmDialog}.jsx`, `src/booking/place/*`, `usePageMeta.js`, `useViewer.js`, `booking.css` | shared traveller UI | 1 |
| `src/site/SiteHeader.jsx` | the public header with "My trips" | 1 |
| `src/main.jsx` | the seven routes, placeholders | 1 |
| `src/App.jsx`, `src/pages/ExplorePage.jsx`, `index.html`, `public/robots.txt`, `public/sitemap.xml` | cards open `/places/:id`; "My trips" link; hasio.net as canonical | 1 |
| `src/pages/PlacePage.jsx`, `src/pages/place/*` | place page + stay booking section | 2A |
| `src/pages/ServicePage.jsx`, `src/pages/service/*`, `src/hooks/useServices.js`, Explore services chip | service page + booking section | 2B |
| `src/booking/{CheckoutPage,LoginPage}.jsx`, `src/booking/checkout/*`, `src/components/auth/*` | sign-in, checkout, phone step | 2C |
| `src/trips/*` | My trips, trip page, cancel, review | 2D |

---

## Part 1 — core (coordinator, test-first)

Every task: write the test, see it fail for the right reason, write the code, run
`npx vitest run <file>`, then commit with explicit paths.

### Task 1: email links and the config flag (backend)

**Files:** create `convex/notifications/links.ts`, `convex/notifications/links.test.ts`; modify
`convex/notifications/templates.ts`, `convex/notifications/templates.test.ts`,
`convex/notifications/deliver.ts`, `convex/config/queries.ts`.

- [ ] Test `links.test.ts`:
  - `emailDeliveryOn({})` → false; `emailDeliveryOn({RESEND_API_KEY: 're_x'})` → true;
    `emailDeliveryOn({RESEND_API_KEY: ''})` → false.
  - `publicSiteUrl({})` → `https://hasio.net`; `publicSiteUrl({PUBLIC_SITE_URL:
    'https://x.test//'})` → `https://x.test`.
  - `bookingActionUrl('tourist', {_id: 'b1', kind: 'stay'}, 'https://hasio.net')` →
    `https://hasio.net/trips/b1`; `('owner', {kind:'stay'})` → `…/partners/hotel/bookings`;
    `('owner', {kind:'service', serviceId:'s1'})` → `…/partners/services/bookings`.
- [ ] Test `templates.test.ts` additions:
  - `renderEmail('booking.confirmed', {...INPUT, actionUrl: 'https://hasio.net/trips/b1'}, 'en')`
    → `html` contains `href="https://hasio.net/trips/b1"` and "View booking"; `text` contains the
    URL; without `actionUrl` no `<a ` appears.
  - `actionUrl` with a `"` is escaped in `href`.
  - `renderEmail('booking.requested', {...INPUT, audience: 'owner', actionUrl}, 'ar')` → Arabic
    button «افتح حجوزاتك» and «يدفع الضيف لك مباشرة في مكان الإقامة.»; service input with
    `audience:'owner'` → «يدفع المسافر لك مباشرة.»; English equivalents.
- [ ] Implement: `links.ts` (pure); `TemplateInput` gains `actionUrl?`, `audience?: 'owner' |
  'tourist'`; `renderEmail` adds the button row (table cell, inline styles, `esc()` on the URL)
  and the owner payment line; `deliver.ts`: `EMAILED_EVENTS` += `booking.requested`,
  `booking.cancelled`; in `send`, `audience = notification.data?.audience ?? 'tourist'`,
  `actionUrl = booking ? bookingActionUrl(audience, booking, publicSiteUrl()) : undefined`, both
  into `emailInputFor`'s result; `getPublicConfig` returns `bookingEmails: emailDeliveryOn()`.
- [ ] Run `npx vitest run convex/notifications` and `npm run typecheck:convex` — green.
- [ ] Commit `feat(email): booking emails link to the page that acts on them; hosts hear of new
  requests and cancellations`.

### Task 1b: after Fable's review — the guest's name, and where a lost Google state lands

**Files:** create `convex/lib/site.ts` (move `publicSiteUrl` there; `links.ts` imports it), modify
`convex/notifications/deliver.ts` (+test), `convex/auth.ts`.

- [ ] Test: the host's new-request email text contains "Sara Al Qahtani requested" when the
  booking's traveller has that name; `emailInputFor(..., guest)` sets `guestName`.
- [ ] Implement: `loadPayload` also returns the booking's traveller (`firstName`, `lastName`);
  `emailInputFor(booking, listing, service, guest)`; `auth.ts` `onAPIError.errorURL =
  ${publicSiteUrl()}/login`.
- [ ] `npx vitest run convex/notifications`, `npm run typecheck:convex`; commit.

### Task 2: plain-fetch Convex reads

**Files:** create `src/lib/convexHttp.js`, `src/lib/convexHttp.test.js`.

- [ ] Test with a stubbed `fetch` (`vi.stubGlobal`): success → value; `{status:'error',
  errorMessage:'Uncaught ConvexError: x', errorData:'عربي / English'}` → rejects with `err.data ===
  'عربي / English'`; HTTP 500 → rejects; the request body is `{path, args, format:'json'}`.
- [ ] Implement `convexQuery(path, args = {}, {signal} = {})` and `useConvexQuery(path, args,
  {skip = false, debounceMs = 0, keepPrevious = false} = {})` (state `{data, error, loading}`,
  keyed on `JSON.stringify(args)`, `AbortController` per run, debounced with `setTimeout`).
- [ ] Run, commit `feat(web): read public Convex queries with a plain fetch`.

### Task 3: dates

**Files:** `src/booking/dates.js`, `src/booking/dates.test.js`.

- [ ] Tests:
  - `riyadhToday(Date.UTC(2026, 8, 26, 20, 59))` → `'2026-09-26'`; `Date.UTC(2026, 8, 26, 21, 0)` →
    `'2026-09-27'` (midnight Riyadh = 21:00 UTC).
  - `isISODate('2026-02-29')` false, `'2028-02-29'` true, `'2026-9-1'` false.
  - `addDays('2026-12-31', 1)` → `'2027-01-01'`; `daysBetween('2026-09-10', '2026-09-13')` → 3.
  - `riyadhTimestamp('2026-09-27', '09:30')` → `Date.UTC(2026, 8, 27, 6, 30)`.
  - `monthGrid({year: 2026, month: 10})`: first week `[null×4, '2026-10-01', '2026-10-02',
    '2026-10-03']` (1 Oct 2026 is a Thursday), every week has 7 cells, last real cell
    `'2026-10-31'`.
  - `weekdayNames('en')[0]` → `'Sun'`; `weekdayNames('ar')[0]` → `'أحد'`.
  - `monthLabel({year:2026, month:10}, 'ar')` → `'أكتوبر 2026'`; `formatDay('2026-10-03', 'en')` →
    `'3 Oct'`; `formatDay('2026-10-03','ar')` → `'3 أكتوبر'`; `formatDayLong('2026-10-03','en')` →
    `'Sat, 3 Oct 2026'`; `formatRange('2026-10-03','2026-10-06','en')` → `'3 Oct – 6 Oct'`.
  - `nextRange({start:null,end:null}, 'A')` → `{start:'A', end:null}`; with start `2026-10-03`,
    click `2026-10-06` → end set; click `2026-10-03` (same) → restart there; click `2026-10-01`
    (earlier) → restart; click `2026-11-03` (31 nights) → restart; a complete range + any click →
    restart.
- [ ] Implement with UTC arithmetic only (`Date.UTC`, `getUTC*`), `Intl.DateTimeFormat` for names
  (`en-GB` / `ar-SA-u-ca-gregory-nu-latn`, `timeZone:'UTC'`), Arabic weekday list
  `['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت']`.
- [ ] Run, commit `feat(web): booking dates on the Riyadh clock`.

### Task 4: counts and money

**Files:** `src/booking/text.js`, `src/booking/money.js` and their tests.

- [ ] Tests: `nightsText(1,'ar')` `'ليلة واحدة'`, `(2)` `'ليلتان'`, `(3)` `'3 ليالٍ'`, `(11)`
  `'11 ليلة'`, `(3,'en')` `'3 nights'`, `(1,'en')` `'1 night'`; the same four forms for
  `guestsText` (ضيف واحد / ضيفان / 3 ضيوف / 11 ضيفًا), `peopleText` (شخص واحد / شخصان / 3 أشخاص /
  11 شخصًا), `hoursText` (ساعة واحدة / ساعتان / 3 ساعات / 11 ساعة), `daysText` (يوم واحد / يومان /
  3 أيام / 11 يومًا); `quantityText('per_hour', 3, 'en')` `'3 hours'`, `('fixed', 1)` `''`.
  `formatAmount(1350,'ar')` `'1,350'`; `formatSAR(1350,'en')` `'1,350 SAR'`, `('ar')`
  `'1,350 ر.س'`; `unitLabel('per_event','en')` `'per booking'`; `priceLine(150,'per_hour','en')`
  `'150 SAR per hour'`; `priceLine(undefined,'per_hour','ar')` `'السعر عند الطلب'`.
- [ ] Implement (the Arabic forms copy `convex/notifications/templates.ts`), run, commit.

### Task 5: URL parameters and service rules

**Files:** `src/booking/params.js`, `src/booking/serviceRules.js` and tests.

- [ ] Tests (`today = '2026-09-27'`): `parseStayParams('?checkIn=2026-10-01&checkOut=2026-10-04&guests=2',
  today)` → valid; `checkIn` before today → `valid:false`; 31 nights → false; `guests=0` / `2.5` /
  `x` → guests null, false; missing → nulls. `stayQuery(...)` round-trips. Service: valid set;
  `time=25:00` → time null; `quantity` absent → null and still valid; `serviceQuery` omits a null
  quantity. `safeNext('/trips')` ok, `'/trips/abc'` ok, `'/book/stay/x?checkIn=…'` ok,
  `'//evil.com'` null, `'/admin'` null, `'https://x'` null, `'/book\\x'` null.
  `startTimes('2026-09-28', now)` → 35 times `'06:00'…'23:00'`; for today with Riyadh now 14:10 →
  first `'15:30'` (≥ 15:10, on the half hour); now 22:30 Riyadh → `[]`; a past date → `[]`.
  `firstServiceDay` → tomorrow at 22:30 Riyadh. `quantityRule('per_hour')` → hours 1–12,
  `'per_day'` → days 1–14, `'fixed'` / undefined → null. `maxPeople({})` 20, `({maxGroupSize: 6})` 6.
- [ ] Implement, run, commit.

### Task 6: statuses and cancel rules

**Files:** `src/booking/status.js` + test.

- [ ] Tests (now = `riyadhTimestamp('2026-09-27','12:00')`):
  - pending with `expiresAt` in the past → `effectiveStatus` `'expired'`.
  - labels: `('pending','service','en')` `'Awaiting provider'`, `('expired','stay','ar')`
    `'منتهي الصلاحية'`; tones: pending wait, confirmed ok, completed done, cancelled/declined/
    expired/no_show bad.
  - `isUpcoming`: confirmed stay checking out today → true; checked out yesterday → false; pending
    service starting in an hour → true; confirmed service that started an hour ago → false;
    cancelled → false.
  - `splitTrips`: upcoming sorted by start ascending, past by `createdAt` descending.
  - `canCancel`: pending stay checking in tomorrow → true; confirmed stay checking in today → false;
    pending service whose start passed → true; confirmed service starting in 2 h → true; confirmed
    service started → false; completed → false.
- [ ] Implement, run, commit.

### Task 7: refusal texts

**Files:** `src/booking/errors.js` + test.

- [ ] Tests, each with the exact server text wrapped as `{data: 'عربي / English'}`: every row of
  the app's two tables (`hasio-mobile-app/lib/bookingError.ts`, `lib/serviceBookingError.ts`) maps
  to its English and Arabic text from `hasio-mobile-app/constants/translations.ts`; an
  `Error('[CONVEX M(x)] Server Error')` → the generic line; an unknown bilingual refusal → its own
  half; `phoneErrorText` for Better Auth `{error:{message:'Invalid OTP'}}`, `'OTP expired'`,
  `'Too many attempts'`, `'Phone number already exists'`, the contact-phone refusals, and the OTP
  rate limit's bilingual text; `refusalKind` for duplicate (stay and service), no availability,
  invalid dates, phone required, not authenticated, own listing, booking limit, already closed,
  after it starts.
- [ ] Implement (the server's text: `err.data` string, `err.data.message`, `err.error.message`,
  `err.message`), run, commit.

### Task 7b: after Fable's review — ids, returns, redirects, names

- [ ] `convexHttp`: `err.validation = true` when `errorMessage` contains `ArgumentValidationError`
  (test).
- [ ] `src/booking/authReturn.js` + test: `readAuthReturn` (contract §3).
- [ ] `safeNext` refuses `..` and `%2e` segments (tests: `/trips/../admin`, `/trips/%2e%2e/admin`,
  `/book/x/..`).
- [ ] `errors.js`: the web's number-taken sentence (contract §3) (test).
- [ ] Move `src/admin/useQuerySafe.js` to `src/lib/useQuerySafe.js`; the admin file re-exports it.
- [ ] Commit.

### Task 8: shared UI, header, routes, links

**Files:** create `src/booking/Calendar.jsx`, `src/booking/Stepper.jsx`, `src/booking/usePageMeta.js`,
`src/booking/useViewer.js`, `src/booking/StatusChip.jsx`, `src/booking/ConfirmDialog.jsx`,
`src/booking/place/{Gallery,Reviews,ContactActions}.jsx`, `src/booking/booking.css`,
`src/site/SiteHeader.jsx`, placeholders `src/pages/PlacePage.jsx`, `src/pages/ServicePage.jsx`,
`src/booking/LoginPage.jsx`, `src/booking/CheckoutPage.jsx`, `src/trips/TripsPage.jsx`,
`src/trips/TripPage.jsx`; modify `src/main.jsx`, `src/App.jsx`, `src/pages/ExplorePage.jsx`,
`src/App.css` (the header's "My trips" link only), `index.html` (canonical, `og:url`, images →
hasio.net), `public/robots.txt` (disallow `/book/`, `/trips`, `/login`; sitemap URL),
`public/sitemap.xml` (hasio.net, plus `/explore`).

- [ ] Calendar per contract §4 (range + single; `months` 2 at ≥ 900px via `matchMedia`, else 1;
  roving `tabIndex`; RTL arrow flip; `aria-label` = `formatDayLong`; selected start/end/in-range
  classes `is-start`, `is-end`, `is-between`; today marked `aria-current="date"`).
- [ ] Stepper, usePageMeta, useViewer, StatusChip, ConfirmDialog, Gallery, Reviews,
  ContactActions, SiteHeader, `booking.css` per contract §4.
- [ ] Routes: `/places/:id` and `/services/:id` beside `/explore`; `/login`, `/book/stay/:listingId`,
  `/book/service/:serviceId`, `/trips`, `/trips/:bookingId` inside `AuthedLayout`. Each
  placeholder renders `SiteHeader` and a "Coming soon" line so the route is visibly wired.
- [ ] Explore `ListingCard` and the landing `HotelCard`: the button and the whole card open
  `/places/${_id}` (a stretched link; duplicates in the marquee keep `tabIndex=-1` and
  `aria-hidden`); "Book" for priced hotels, "View" otherwise. Remove the now-unused store-URL
  helpers only where nothing else uses them.
- [ ] "My trips" (`/trips`, «رحلاتي») in the landing header's actions and burger panel and in
  Explore's header; re-measure the landing bar at 900/1024/1280px in both languages (it needed
  ~770px) and keep the burger breakpoint working.
- [ ] `npm run lint`, `npx vitest run`, `npm run build`; `dist/index.html` has no `modulepreload`.
- [ ] Commit `feat(web): routes, shared booking UI, and every Book button opens the place`.

---

## Part 2 — pages (four builders in parallel, one worktree each, `model: opus`)

Each builder starts from `web-booking` after part 1, checks `git log -1` shows the part-1 commit
(fast-forward first if not), reads the design, this task, the contract and CLAUDE.md, and works
**only in its own files**. No pushes, merges, deploys, dev servers or production builds. Commit
messages: `feat(web): …` with a body that says why. Checks each builder runs: `npx vitest run
src` and `npx eslint <its files>`; it reports the branch, commits, every file with one line, the
check output, decisions and risks.

### Task A: the place page and the stay booking section

**Files:** `src/pages/PlacePage.jsx` (replace the placeholder), `src/pages/place/StayBooking.jsx`,
`src/pages/place/place.css`, tests for any pure helper it adds (`src/pages/place/*.test.js`).
Uses the core's `Gallery`, `Reviews`, `ContactActions`, `Calendar`, `Stepper`, `usePageMeta`.

1. Data (plain fetch only): `useConvexQuery('listings/queries:getListing', {listingId: id})`;
   `reviews/queries:getSummary` and `listForListing {limit: 6}`. Loading skeleton; `null`, or an
   error with `validation` → "This place isn't available." / «هذا المكان غير متاح.» + "Back to
   Explore"; any other error → "We couldn't load this place." / «تعذّر تحميل هذا المكان.» + "Try
   again" (`reload`).
2. Layout: `SiteHeader current={null}`; `Gallery`; name (page language, other as fallback), type
   chip, city label (`CITY_LABELS`, `canonicalCity` from `src/admin/constants.js`), the rating line;
   `ContactActions` (phone, email, website, coordinates, address); About; Amenities (labels from
   `src/partners/hotel/amenities.js`, unknown keys shown as typed); opening hours for non-hotels
   (`workingHours`, "Closed" / «مغلق»); check-in/check-out times for hotels when set ("Check-in from
   15:00 · Check-out by 12:00" / «الوصول من 15:00 · المغادرة حتى 12:00»); `Reviews kind="stay"`.
3. `usePageMeta({title: name})`.
4. `StayBooking` only when `type === 'hotel' && pricePerNight > 0`: heading "Book your stay" /
   «احجز إقامتك»; "Choose your arrival, then your departure" / «اختر يوم الوصول ثم يوم المغادرة»;
   `Calendar mode="range" min={riyadhToday()} max={addDays(today, MAX_DAYS_AHEAD)}
   maxNights={MAX_NIGHTS}`; `Stepper` "Guests" / «الضيوف» 1…`maxGuests ?? 4`, default
   `min(2, max)`; initial state from the URL (`parseStayParams(location.search)`), written back
   with `replace` so a reload keeps it.
5. The live quote: `useConvexQuery('bookings/queries:quoteStay', {listingId, checkIn, checkOut,
   guests}, {skip: !checkOut, debounceMs: 250, keepPrevious: true})`. Summary card texts: no dates
   "Choose your dates to see the total" / «اختر التواريخ لعرض الإجمالي»; first load "Calculating
   total…" / «جارٍ حساب الإجمالي…»; reloading keeps the old figures faded with "Updating…" /
   «جارٍ التحديث…»; ok → `formatRange`, `nightsText · guestsText`, "3 × 450 SAR" line, "Total" /
   «الإجمالي» `formatSAR(total)`; `available === false` → "No rooms available for those dates" /
   «لا توجد وحدات متاحة لهذه التواريخ»; `ok:false` → `bookingErrorText(error, lang)`. Always:
   "The host confirms within 48 hours. No payment is taken online — you pay at the property." /
   «يؤكد المضيف خلال 48 ساعة. لا يُدفع شيء عبر الإنترنت — الدفع في مكان الإقامة.»
6. "Request to book" / «اطلب الحجز»: with a valid, available quote →
   `navigate('/book/stay/' + id + stayQuery(...))`; pressed early → scrolls the calendar into view
   and says "Choose your dates first" / «اختر التواريخ أولًا» (never faded). Once dates are chosen,
   prefetch `import('../AuthedLayout.jsx')` and `import('../booking/CheckoutPage.jsx')`.
7. Wide screens: the summary card is sticky beside the content; phones: a sticky bottom bar with
   the total (or "450 SAR / night") and the button, which scrolls to the booking section when no
   dates are chosen.
8. Not a priced hotel: no booking section.

### Task B: the service page, its booking section, and services on Explore

**Files:** `src/pages/ServicePage.jsx`, `src/pages/service/ServiceBooking.jsx`,
`src/pages/service/service.css`, `src/hooks/useServices.js`, `src/pages/ExplorePage.jsx` (the
services chip and cards only), tests for any pure helper.

1. Data: `services/queries:getService {serviceId}`, `reviews/queries:getServiceSummary`,
   `listForService {limit: 6}` via `useConvexQuery`. `null` or a `validation` error → "This
   service isn't available right now." / «هذه الخدمة غير متاحة حاليًا.»; other errors → a retry.
   `usePageMeta({title})`.
2. Layout: `SiteHeader`; the core's `Gallery`; type (labels from `src/partners/services/labels.js`),
   city, "Offered by {name}" / «يقدّمها {name}», `priceLine(price, priceUnit)`, "Up to {n}" / «حتى
   {n}» with `peopleText`, "Languages: …" / «اللغات: …», availability text (`availability_en/_ar`),
   About, the core's `Reviews kind="service"`. Never import `SERVICE_ERRORS` or anything else
   under `convex/` (contract §5).
3. `bookable` → `ServiceBooking`: "Book this service" / «احجز هذه الخدمة»; "Choose a day" /
   «اختر اليوم» with `Calendar mode="single" min={firstServiceDay()}`; "Start time" / «وقت البدء»
   chips from `startTimes(date)`, "Times are in Saudi time." / «الأوقات بتوقيت السعودية.»; before a
   day "The start times appear once you choose a day." / «تظهر أوقات البدء بعد اختيار اليوم.»;
   none left "No start times left today. Pick another day." / «لم يتبقَّ وقت بدء اليوم. اختر يومًا
   آخر.»; `quantityRule` → Stepper "Hours" / «الساعات» or "Days" / «الأيام»; Stepper "People" /
   «الأشخاص» 1…`maxPeople`. Live `quoteService` (debounced, keepPrevious): "Pick a day first",
   "Pick a start time" (the app's strings), "Total", "3 hours × 150 SAR". Note: "The provider
   confirms within 48 hours, or before the start time if that's sooner. You pay the provider
   directly." / «يؤكد مقدم الخدمة خلال 48 ساعة، أو قبل وقت البدء إن كان أقرب. تدفع لمقدم الخدمة
   مباشرة.» "Request to book" → `navigate('/book/service/' + id + serviceQuery(...))`.
4. Not bookable but public → "Contact" / «تواصل» through the core's `ContactActions`
   (`contactPhone`, `contactEmail`); neither → no button, price line "Price on request".
5. Explore: `useServices()` (plain fetch `services/queries:listServices {}`, `null` loading, `[]`
   on failure); a "Services" / «الخدمات» chip appears only when the list is non-empty; selecting it
   (or a search that matches a service title, city or type) shows service cards (the same
   `place-card` frame; `priceLine`; opens `/services/:id`). The marquee rows stay places only.

### Task C: sign-in, checkout and the phone step

**Files:** `src/booking/LoginPage.jsx`, `src/booking/CheckoutPage.jsx`,
`src/booking/checkout/{SignInPanel,PhonePanel,NameStep,Summary}.jsx`, `src/booking/checkout/checkout.css`,
`src/components/auth/{CodeBoxes,ResendRing,GoogleMark}.jsx`, `src/partners/pages/LoginPage.jsx`
(imports only), tests for any pure helper.

1. Move `CodeBoxes`, `ResendRing`, `GoogleMark` (and `digitsOf`) verbatim out of the partner login
   into `src/components/auth/`; the partner login imports them — no behaviour or markup change.
2. `SignInPanel({returnTo, lang})`: Google first when `getPublicConfig().googleAuth` (top-level
   navigation to `oauthStartURL(AUTH_BASE_URL, returnTo)`; `pageshow` un-sticks the spinner;
   `?error=` (and on `/login` `?state=state_not_found`) read once via `readAuthReturn` and removed;
   "Google sign-in didn't complete. Please try again." / «لم يكتمل تسجيل الدخول عبر Google. حاول
   مرة أخرى.»; a cancel says nothing); "or"; phone: Saudi / Another country,
   `+966` prefix, `normalizePhone`, `smsBlockedFor(e164, saudiSmsOpen(config))` → the notice
   "SMS codes can't reach Saudi numbers yet. Continue with Google instead." / «رسائل الرمز لا تصل
   إلى الأرقام السعودية حاليًا. تابع باستخدام Google.»; code boxes, resend ring 60 s, auto-verify
   at six digits; "Sign in with email" / «الدخول بالبريد الإلكتروني» opens email + password for
   existing accounts ("Email sign-in is for existing accounts. New accounts start with Google or a
   phone number." / «الدخول بالبريد للحسابات الحالية فقط. الحسابات الجديدة تبدأ بـ Google أو رقم
   الجوال.»). `Accept-Language: lang` on every OTP call. Errors via `phoneErrorText`.
3. `LoginPage` (`/login`): `SiteHeader`, "Sign in" / «تسجيل الدخول», the panel with `returnTo =
   origin + '/login' + (next ? '?next=' + encodeURIComponent(next) : '')` so a Google failure
   comes back here, and once `useViewer().state === 'active'`, `navigate(safeNext(next) ??
   '/trips', {replace: true})`. Under the panel: "Hotel or service provider? Partner sign-in" /
   «فندق أو مقدم خدمة؟ دخول الشركاء» → `/partners` (W20). `usePageMeta`.
4. `CheckoutPage kind="stay"|"service"`: params via `parseStayParams` / `parseServiceParams`;
   invalid → "Those dates can't be booked." / «لا يمكن حجز هذه التواريخ.» + "Change dates" back to
   the place page with the params. Data (Convex client): `getListing` or `getService` through
   `useQuerySafe` (an error or `null` → "This place isn't taking bookings right now." / the
   service line, + "Back to Explore"), `quoteStay` / `quoteService` (live, `useQuerySafe`), and
   `useViewer()` — `suspended` → "Your account is suspended. Contact support@hasio.xyz." /
   «حسابك موقوف. تواصل مع support@hasio.xyz.».
5. Summary (sticky on wide screens, first on phones): photo, name, city, dates or day + time +
   duration, guests or people, "3 × 450 SAR", Total, the payment note of task A / B, "Change" /
   «تغيير» back to the place or service page with the params.
6. Step 1 "Sign in" / «تسجيل الدخول»: signed out → `SignInPanel returnTo={location.href}`; signed
   in → "Signed in as {name | phone | email}" / «مسجّل باسم …» + "Not you? Sign out" / «لست أنت؟
   تسجيل الخروج».
7. Step 2 "Your details" / «بياناتك»: `NameStep` when the user has no first name (one field "Your
   name" / «اسمك», split at the first space into `firstName` / `lastName`, 1–60 characters, "The
   host sees your name on your request." / «يرى المضيف اسمك في طلبك.»; `updateProfile`);
   `PhonePanel` when
   `canBook === false`: Saudi SMS off → "Add your phone number" / «أضف رقم جوالك», "SMS to Saudi
   numbers isn't available yet. Your host will see this number, marked as not confirmed." /
   «رسائل SMS لا تصل إلى الأرقام السعودية بعد. سيرى المضيف هذا الرقم مع إشارة أنه غير موثّق.»,
   "Save number" / «حفظ الرقم» → `setContactPhone`; a non-Saudi number, or any once SMS is live →
   "Verify your phone" / «وثّق رقم جوالك», "Booking needs a verified number so your host can reach
   you." / «يحتاج الحجز إلى رقم موثّق ليتمكن المضيف من التواصل معك.», "Send code" → code → verify
   with `updatePhoneNumber: true`, "Change number" / «تغيير الرقم». Done → the number (formatted)
   and, when `phoneVerified` is false, "not confirmed by SMS" / «غير موثّق برسالة».
8. Step 3 "Send your request" / «أرسل طلبك»: notes (≤ 500, counter) — stay "Notes for the host
   (optional)" / «ملاحظات للمضيف (اختياري)», placeholder "Arriving late, travelling with family…"
   / «وصول متأخر، سفر مع العائلة…»; service "Anything the provider should know? (optional)" /
   «هل هناك ما يجب أن يعرفه مقدم الخدمة؟ (اختياري)», placeholder "Meeting point, languages,
   special requests…" / «نقطة اللقاء، اللغات، طلبات خاصة…»; "By sending this request you agree to
   the Terms of Service." (link `/terms-of-service.html`); "Send booking request" / «إرسال طلب
   الحجز» → first `updateProfile({preferredLanguage: lang})` when it differs from the account's
   (W21; sent together with the name when step 2 asked for one), then `createStayBooking` /
   `createServiceBooking` (`partySize: people` for a service) → `navigate('/trips/' + bookingId +
   '?sent=1', {replace: true})`. Refusals: `bookingErrorText(err, lang, kind)` under the button;
   `refusalKind` → duplicate adds "Open My trips" / «افتح رحلاتي»; unavailable/dates add "Change
   dates"; phone reopens step 2; auth reopens step 1.
9. A quote that is not ok (or `available === false`) replaces the button with the reason and
   "Change dates".
10. `usePageMeta({title: 'Request to book'})`; focus moves to each step's heading as it opens.

### Task D: My trips

**Files:** `src/trips/TripsPage.jsx`, `src/trips/TripPage.jsx`, `src/trips/TripCard.jsx`,
`src/trips/ReviewForm.jsx`, `src/trips/trips.css`, tests for any pure helper. Uses the core's
`useViewer`, `useQuerySafe`, `StatusChip`, `ConfirmDialog`, `usePageMeta`.

1. Both pages: `useViewer()`: `loading` → a spinner (never redirect before the session settles);
   `signed_out` → `<Navigate to={'/login?next=' + encodeURIComponent(path + search)} replace />`;
   `suspended` → "Your account is suspended. Contact support@hasio.xyz." / «حسابك موقوف. تواصل مع
   support@hasio.xyz.».
2. `/trips`: `getUserBookings({includeServices: true})`; `splitTrips`; tabs "Upcoming" / «القادمة»,
   "Past" / «السابقة» (default Upcoming, or Past when Upcoming is empty and Past is not). Card:
   photo (listing or service, sand fallback), name, stay `formatRange` or service "10 Oct at
   19:00" / «10 أكتوبر الساعة 19:00», `nightsText · guestsText` or `quantityText · peopleText`,
   status chip (`statusLabel`, `statusTone`), `formatSAR(total)`; links to `/trips/:id`. Empty:
   "No bookings yet" / «لا توجد حجوزات بعد», "Stays and services you book will appear here." /
   «ستظهر هنا الإقامات والخدمات التي تحجزها.» + "Explore stays" → `/explore`; "No upcoming
   bookings" / «لا توجد حجوزات قادمة», "Your earlier bookings are under Past." / «حجوزاتك السابقة
   في تبويب السابقة.»; "Nothing here yet" / «لا شيء هنا بعد», "Bookings appear here once they're
   over." / «تظهر الحجوزات هنا بعد انتهائها.». Foot: "Signed in as …", "Sign out", "Delete
   account" (`/delete-account`).
   A slot row (1.0.x restaurant/event reservation, contract §4) shows "3 Oct at 19:00 · 4 people"
   and no total. `usePageMeta({title: 'My trips'})`.
3. `/trips/:bookingId`: `getBooking({bookingId, includeServices: true})` through `useQuerySafe`;
   `null` or an error → "We couldn't find this booking." / «لم نعثر على هذا الحجز.» + "My trips";
   `viewerRole !== 'guest'` → "This booking isn't one of your trips." / «هذا الحجز ليس من
   رحلاتك.» + "Partner bookings" / «حجوزات الشركاء» → `/partners`. `?sent=1` → a banner "Request
   sent" / «تم إرسال الطلب», the code, "The host confirms within 48 hours." (service: the provider
   line), and "We'll email you at {email} when they answer." / «سنراسلك على {email} عند الرد.» only
   when `getPublicConfig().bookingEmails` and the account has a real email (not
   `@phone.hasio.xyz`), else "This page updates the moment they answer." / «تتحدث هذه الصفحة فور
   الرد.»; focus moves to the banner; it closes and the `sent` param is removed with `replace`.
4. Detail: status chip; "Your confirmation code" / «رمز التأكيد» + code (monospace, copy button);
   stay rows "Check-in" `formatDay · checkInTime`, "Check-out" `formatDay · checkOutTime`, "Stay"
   `nights · guests`, "Total"; service rows "Date", "Start", "Duration", "People", "Total"; notes;
   "Reason from the host" / «سبب المضيف» (service: «سبب مقدم الخدمة») when declined or cancelled by
   the host/admin; pending note (the 48-hour line; service: the provider line); stay: address,
   Call (`listing.phone`), Directions; service: "Provider" + name + phone + "Call provider" (the
   phone arrives only once confirmed). Live — a host's answer flips the page.
5. Cancel when `canCancel`: "Cancel booking" / «إلغاء الحجز» (pending service: "Cancel request" /
   «إلغاء الطلب») → `ConfirmDialog` "Cancel this booking?" / «إلغاء هذا الحجز؟» ("Cancel this
   request?" / «إلغاء هذا الطلب؟»), "The host will be notified." / «سيتم إشعار المضيف.» ("The
   provider will be told." / «سيتم إبلاغ مقدم الخدمة.»), "Keep it" / «الإبقاء عليه», "Cancel
   booking" → `cancelBooking`; success "Booking cancelled" / «تم إلغاء الحجز»; refusal via
   `bookingErrorText`.
6. Rate when `status === 'completed'`: `getMine({listingId})` / `getMineForService({serviceId})`;
   none → "How was your stay?" / «كيف كانت إقامتك؟» ("How was it?" / «كيف كانت الخدمة؟»), "Your
   rating helps other travellers." / «تقييمك يساعد المسافرين الآخرين.», "Rate this place" / «قيّم
   هذا المكان» ("Rate this service" / «قيّم هذه الخدمة») → `ReviewForm`: five stars (radio group,
   arrow keys), "Tell others about it (optional)" / «أخبر الآخرين عن تجربتك (اختياري)», "Post
   without my name" / «النشر دون اسمي», "Post review" / «نشر التقييم» → `addReview({listingId |
   serviceId, rating, content, bookingId, isAnonymous})`; done → "Thanks — your review is live." /
   «شكرًا، تم نشر تقييمك.»; already rated → "You rated this {n}/5" / «قيّمته {n}/5».
7. "Also in the app" / «متوفر أيضًا في التطبيق» with the two store links, quiet, at the foot.
8. Slot bookings: date, time, party size; Cancel while open (`canCancel`); no rating (the server
   rates places from stays and services only).

---

## Part 3 — integration and verification (coordinator)

- [ ] Read every builder's diff; follow each error path to the text a person sees; decide on every
  risk a builder raised (fix test-first, or record why not).
- [ ] Merge each builder branch into `web-booking` with `--no-ff` (merge-tree plumbing if the
  owner's index is dirty — see memory "git-and-agents-on-this-box").
- [ ] Hoist CSS rules two builders duplicated into `booking.css`.
- [ ] Checks: `npx vitest run` (all), `npm run typecheck:convex`, `npm run lint`, `npm run build`,
  `dist/index.html` has no `modulepreload`; the built chunks for `/`, `/explore`, `PlacePage` and
  `ServicePage` import no `convex` or `better-auth` chunk, directly or through a shared chunk
  (walk each chunk's static imports).
- [ ] Push the backend to development: `npx convex dev --once` (with `CONVEX_TMPDIR`).
- [ ] Browser (headless Chrome via `playwright-core` from the scratchpad, `npm run dev` on 5173,
  dev backend, `node scripts/smoke/partner-fixture.mjs create` for a hotel host and a provider):
  1. `/explore` → a hotel card → `/places/:id` renders; pick dates; the total appears.
  2. "Request to book" → `/book/stay/…` → phone sign-in with a fresh `+2135…` number, any six
     digits → name step → notes → "Send booking request" → `/trips/:id?sent=1` shows the code.
  3. The host (fixture) confirms through `bookings/mutations:confirmBooking` → the open trip page
     flips to Confirmed without a reload.
  4. Cancel a second booking → Cancelled.
  5. An email account with no phone (dev) → sign in with email → the Saudi "type once" path →
     booking goes through; the host inbox marks "not confirmed by SMS".
  6. The fixture's service → `/services/:id` → day, time, hours → checkout → request → trip page.
  7. Complete a booking (CLI completion job with a chosen date, as `services-e2e.mjs` does) →
     "Rate this place" → review posted → visible on the place page.
  8. Arabic at 390px for steps 1–2 and 6; no console errors; no horizontal scroll.
  Remove every test account and booking afterwards (`deleteMyAccount`, fixture `cleanup`).
- [ ] Fable 5.1 review of the merged code (security: redirects, OAuth return, what a public page
  can leak; correctness of dates and cancel rules); fold in the findings.
- [ ] Update `CLAUDE.md` (routes, the landing/explore "Book" lines, the new pages, the email
  switch), the memory notes, and the design's open items. No deploy without "ship it"; the deploy
  order is the design's Rollout.

### Outcome (2026-09-27)

All of part 3 ran. The four builders' branches were merged `--no-ff` (D `1d2a604`, A `1888239`,
B `5ebe25d`, C `a0b587e`) after each diff was read; the shared pieces they found wanting were fixed
in the core (`065349b`, `ed96bf8`, `4fa7b41`), including a backend gap (a stay's notes were not
length-capped on the server). Fable's review of the merged code found no blocker; its three
should-fix items (a daily cap on booking emails per recipient, HTTP 560 error bodies, an internal
message shown raw) and four polish items are in `03a072e`.

Evidence: `npx vitest run` 73 files / 1013 tests (backend + website), `npm run lint` and
`typecheck:convex` clean, `npm run build` clean with `modulepreload` 0 and the landing, `/explore`,
place and service chunks walking to no Convex client or Better Auth code. In headless Chrome
against development, with `scripts/smoke/web-booking-fixture.mjs` (not the partner fixture — it
seeds its own bookings): 20 steps passed — the eight above plus a duplicate refused in the app's
words, bad and foreign ids reading "not found" on four pages, and the partner sign-in still
reaching its code boxes — and a sweep of 7 pages × 320/768/1024/1440px × both languages showed
no sideways scroll and no console errors. A separate run covered the phone step's code path: an
email account attached a +213 number by SMS code (`updatePhoneNumber`) and booked. Test accounts
were deleted afterwards. Not run: a real Google sign-in (it needs a person at Google's screen) and
real SMS delivery (development accepts any six digits).

## Summary

First I build the shared rules, the email changes and the page skeletons myself, with tests.
Then four helpers build the place page, the service page, the checkout, and My trips at the same time.
Last I join their work, test the whole booking in a real browser in both languages, and have it reviewed.
