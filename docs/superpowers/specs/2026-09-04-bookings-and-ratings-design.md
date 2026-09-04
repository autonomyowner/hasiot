# Bookings and ratings, shipped over the air

**Date:** 2026-09-04
**Branch:** `brand-lime` (stack: `main` → `otp-ota` → `arabic-font` → `brand-lime`)
**Status:** design, approved 2026-09-04

---

## 1. What this is

Two features the owner asked for, in one pass:

1. **A guest can book a hotel end to end inside the app** — pick dates, see the
   price, send a request, the host confirms, the guest sees it in *My bookings*.
2. **A guest can rate and review a place** — any listing type, with a verified
   mark on reviews written by someone who actually stayed.

Both reach existing users as **over-the-air updates**: minutes, no App Store or
Play Store review. That constraint shapes almost every decision below.

## 2. The head start

Most of this was already built. Phase 1 of the bookings roadmap
(`TODO.md`) was written on 2026-09-03 and sits unreleased on branch
**`phase-1-stays`** — 42 commits, 151 backend tests and 19 mobile tests, all
green, verified against the dev Convex deployment. It was never deployed
because the owner asked for one polished release rather than a trickle.

That branch cannot ship as it stands: it is on **Expo SDK 57 / RN 0.86** with
`version` bumped to **1.1.0**, while the store binaries are **SDK 54 / RN 0.81
/ 1.0.2**. It also carries four native modules and a full visual redesign that
conflicts with this week's lime design. So the work is **ported**, not merged.

Three things make the port much smaller than it sounds:

- **`convex/schema.ts` is already identical to the branch.** The OTP
  cherry-pick took it whole (a deliberate, documented deviation in
  `docs/plans/2026-09-04-otp-ota-release.md`). Every booking, pricing and
  notification field and index already exists here. Deploying the booking
  backend adds functions only — **no schema migration**.
- **The `reviews` table already exists** with `bookingId`, `isVerified`,
  `isAnonymous` and three indexes, plus a working `addReview` mutation and
  `getListingReviews` query in `convex/listings/`.
- **`convex/sms/provider.ts` is behind an interface**, so the Twilio account
  problem (see §9) is swappable, not structural.

## 3. Scope

**In**

| | |
|---|---|
| Guest booking | calendar, guest count, notes, live server-priced quote, submit, my bookings, booking detail, cancel |
| Host side | request inbox, one-tap confirm, decline with reason, real dashboard numbers |
| Ratings | rate + review any listing, edit and delete your own, summary with histogram, verified-stay badge, report |
| Notifications | in-app inbox and bell; email if Resend is configured |
| Admin | nightly price and stay fields on the listing form, host assignment, stay columns on bookings, users tab with suspend |
| Backend | the whole `bookings/`, `notifications/`, `listings/pricing.ts` port plus a new `reviews/` module, with their tests |

**Out** — payments, per-unit inventory and availability search, owner replies to
reviews, booking SMS, push *delivery*, the `phase-1-stays` visual redesign.

## 4. Locked decisions

| # | Decision | Why |
|---|---|---|
| D1 | Ship as **two OTA updates**, phone sign-in first, bookings second | Booking requires a reachable guest; the OTP work is already in flight |
| D2 | **Port by file** from `phase-1-stays`, adapting on landing — not a merge or a cherry-pick | The branch carries SDK 57, v1.1.0, four native modules and a conflicting redesign |
| D3 | **No native modules cross over.** `expo-notifications`, `expo-device`, `expo-blur` are left behind; `expo-haptics` becomes a no-op shim keeping the same `haptic()` signature | A native module in an OTA crashes the binary on launch |
| D4 | `react-native-calendars` **does** come across | Pure JS, so its code ships inside the bundle |
| D5 | **The server prices everything.** `computeStayQuote` is the single source for both the live quote and the commit | A client-supplied total is a client-supplied discount |
| D6 | **Booking is a request, not a payment.** Guest pays the hotel directly | Payments are Phase 3; a gateway needs the owner's CR and KYC |
| D7 | **A Hasio concierge account hosts the seed catalogue.** Admin sets a price and assigns the listing to it; requests land in its inbox and someone at Hasio phones the hotel | 13 hotels in production, 1 with an owner, 0 with a price — otherwise nobody ever sees the feature |
| D8 | **Anyone signed in can rate any listing; a completed booking earns a verified badge** | Content from day one, with the trust signal still meaningful |
| D9 | **Fabricated seed ratings are cleared.** A listing shows no star until a real review exists | 54 of 55 listings carry an invented 3.7–4.9 with `reviewCount: 0`; the first honest review would look like a bug |
| D10 | The **mobile push registration is not ported**; the server-side delivery seam is, and lies dormant | Registration needs `expo-notifications`. Leaving the server half in means the next store build switches push on without backend work |

## 5. Architecture

### 5.1 Backend — bookings (ported)

Taken from `phase-1-stays` essentially unchanged, because it is already tested
and the schema it targets is already here:

```
convex/lib/dates.ts              Riyadh (UTC+3) date helpers            + test
convex/listings/pricing.ts       PRICING_ARGS, validatePricing, isBookableStay + test
convex/bookings/logic.ts         statuses, bilingual errors, computeStayQuote,
                                 overlaps, confirmation codes, canTransition  + test
convex/bookings/service.ts       createStayForUser, confirmAsManager,
                                 declineAsManager, cancelAsTourist, ...        + test
convex/bookings/lifecycle.ts     internalMutations behind the crons            + test
convex/bookings/{mutations,queries}.ts   thin auth wrappers over the seams
convex/notifications/*           templates, internal notify(), queries, mutations
convex/crons.ts                  expire pending (hourly), check-in reminders,
                                 complete finished stays
```

Rules worth restating because they are load-bearing (they are already recorded
in the branch's `CLAUDE.md` and come across with the code):

- **Check-out is exclusive.** 10th → 13th is three nights, and a guest leaving
  on the 13th does not collide with one arriving that day.
- **All dates are Riyadh dates.** Convex runs UTC; a plain
  `toISOString().slice(0,10)` returns yesterday for three hours every night —
  long enough to reject a booking made for today.
- **`undefined` sorts before every value in a Convex index**, so each cron sweep
  needs a lower bound or it walks every legacy row.
- A stay also fills the legacy `date`/`time` fields, because
  `by_listingId_and_date`, `getUpcomingCount` and the admin grouping all read
  them.
- A listing is bookable only when `type === "hotel"` **and** `pricePerNight` is
  set. `priceRange` is free-text display copy and cannot be multiplied.

`convex/notifications/deliver.ts` comes across with the Expo-push half **left
in but dormant** — it already no-ops when a user has no `pushTokens`, and
without the mobile registration hook nobody ever has one. Email through Resend
is the live channel, and it too degrades quietly when `RESEND_API_KEY` is
unset.

### 5.2 Backend — reviews (new)

The existing `addReview` and `getListingReviews` have **no caller anywhere** in
the mobile app or the website, so they move rather than being wrapped:

```
convex/reviews/logic.ts       validation, summariseRatings (average + 1..5 histogram)   + test
convex/reviews/service.ts     addReviewForUser, updateReviewForUser, deleteReviewForUser + test
convex/reviews/queries.ts     listForListing, getSummary, getMine, listMyReviewablePlaces
convex/reviews/mutations.ts   addReview, updateMyReview, deleteMyReview
```

Changes to what exists today:

- **`updateListingRating` currently returns early when there are no reviews**,
  which leaves a stale average behind after the last one is deleted. It must
  clear `rating` and `reviewCount` instead.
- Verification is decided **server-side**: `isVerified` is true only when the
  supplied `bookingId` belongs to this user, this listing, and has status
  `completed`. A client cannot claim it.
- One review per person per listing (already enforced), stars 1–5 required,
  text optional and capped at 500 characters, anonymous flag preserved.
- Rate-limited through the existing `enforceRateLimit` helper.
- Blocked users' reviews stay hidden — `getBlockedIds` already does this and
  the behaviour carries over.

A `clearSeededRatings` internalMutation in `convex/admin/devTools.ts` nulls
`rating` and `reviewCount` on every listing with no reviews behind it (D9). It
is run once against production.

### 5.3 Mobile — guest booking

Ported from the branch and re-skinned to this week's design system — the lime
palette, `useThemedStyles`, the caption/scrim card language, `CaptionScrim`,
the Cairo/Instrument-Serif font roles.

```
app/bookings/_layout.tsx      auth gate — nothing here concerns a visitor
app/bookings/index.tsx        my bookings, upcoming / past
app/bookings/[id].tsx         detail: status, dates, code, cancel, "rate your stay"
components/booking/BookingSheet.tsx      calendar + guests + notes + quote
components/booking/QuoteFooter.tsx       holds its height and last total mid-quote
components/booking/GuestStepper.tsx
components/booking/BookingNotesField.tsx uncontrolled, so typing does not
                                         re-render the calendar
components/booking/BookingStatusChip.tsx
components/booking/BookingRow.tsx
lib/{dates,bookingDisplay,bookingError,calendarLocale}.ts   + tests
```

The entry point already exists: the **Book bar** added to
`components/listing/ListingDetailSheet.tsx` in commit `98e426d` is currently a
disabled button reading "booking soon". It becomes live for a bookable listing
and keeps its disabled state everywhere else.

### 5.4 Mobile — host side

```
app/business/bookings.tsx                     the request inbox
components/booking/HostBookingCard.tsx        confirm / decline, guest phone
components/booking/DeclineReasonSheet.tsx
components/screens/BusinessDashboardContent.tsx   real numbers from getOwnerStats
app/business/post-lodging.tsx                 nightly rate, max guests, units,
                                              check-in / check-out times
```

### 5.5 Mobile — ratings (new UI)

Nothing exists on the client today, so this is written fresh against the lime
system rather than ported.

```
components/review/RatingSummary.tsx    average, count, 1..5 histogram bars
components/review/StarRating.tsx       display and interactive, RTL-aware
components/review/ReviewCard.tsx       author or "anonymous", stars, text,
                                       verified-stay badge, report action
components/review/ReviewSheet.tsx      write / edit / delete your own
app/reviews/[listingId].tsx            see all
```

Surfaces:

- **Listing detail sheet** gains a reviews section: summary, a *Rate this
  place* button, your own review if you have one, the most recent few, and
  *see all*.
- **Booking detail**, once the stay is `completed`, asks *How was your stay?*
  and opens the same sheet with the `bookingId` attached — this is what earns
  the verified badge.
- Cards keep showing a star only when a listing has a real rating (D9).

### 5.6 Admin panel (website)

Ported from the branch, then extended:

- `ListingForm.jsx` — nightly price, max guests, unit count, check-in and
  check-out times (built on the branch), **plus a host picker** (new): search a
  user by name, phone or email and assign the listing, which is what makes D7
  work.
- `BookingsTab.jsx` — stay columns, status filter, owner column.
- `UsersTab.jsx` — list, search, suspend and unsuspend.
- `ListingsTab.jsx` — suspend and reinstate.
- Every new mutation calls `logAdminAction` in the same transaction, per the
  existing audit rule.

### 5.7 What must not cross over

| Left behind | Why | Replacement |
|---|---|---|
| `expo-notifications`, `hooks/usePushRegistration.ts`, `lib/push.ts` | native module | in-app inbox + email; push lands with the next store build |
| `expo-device` | native, only used by push | — |
| `expo-blur`, `components/ui/Glass.tsx` | native, part of the branch's redesign | the lime design does not use it |
| `expo-haptics` | native | `lib/haptics.ts` shimmed to a no-op with an identical signature, so call sites are already correct when the real module arrives |
| SDK 57 / RN 0.86, `version: 1.1.0` | would break the OTA outright | stay on SDK 54 / 1.0.2 |
| the branch's visual redesign (`app/stay/`, `app/destination/`, `app/explore/`, new tab bar) | conflicts with the lime work | — |

## 6. Release plan

Two updates. Order is not negotiable inside either one: **backend first,
always** — build 4 crashed on the App Store because a client shipped calling a
function that only existed in the repo.

**OTA-1 — phone sign-in** (already planned, `docs/plans/2026-09-04-otp-ota-release.md`)
blocked on the Twilio account (§9).

**OTA-2 — bookings and ratings**

1. `npx convex deploy --yes` — functions and the three crons. Additive; the
   schema is already live from OTA-1.
2. Confirm the crons are scheduled in the dashboard.
3. `npx convex run bookings/lifecycle:backfillOwnerIds --prod`
4. `npx convex run admin/devTools:clearSeededRatings --prod` (D9)
5. Set prices and assign hosts (§7) — before the app can use any of it.
6. Push the website to `main` so Vercel releases the admin panel. **After** the
   backend, never before: the panel calls functions that must already exist.
7. Confirm `app.json` still says **1.0.2** and `hasio-mobile-app/.env.local` is
   deleted, then
   `npx eas update --channel production --message "Book a stay, rate a place"`.

Rollback is `eas update:republish` to the previous group — minutes. The backend
is additive, so an older client keeps working against it and nothing needs
undoing server-side.

## 7. Content prerequisites

The feature is invisible without data. Production today:

| | |
|---|---|
| Listings | 55 (14 active) |
| Hotels | 13 — **1 with an owner, 0 with a nightly price** |
| Users | 20 — 6 business owners, 2 approved |
| Bookings | 0 |
| Reviews | **0**, yet 54 listings carry a fabricated 3.7–4.9 rating with `reviewCount: 0` |

So before OTA-2 is useful someone must, in the admin panel:

1. Create or nominate the **Hasio concierge** account (an approved business
   owner).
2. For each hotel meant to be bookable: set a nightly price, max guests, unit
   count and check-in/out times, and assign it to that account.

A hotel with no price simply shows no Book button, so a partial rollout is
safe — this can start with three or four hotels.

## 8. Risks

| Risk | Handling |
|---|---|
| An OTA reaches every user at once, with no store review to catch a mistake | Full Expo Go run against dev first; `eas update:republish` rollback rehearsed |
| A native import sneaks in and crashes the binary on launch | `git diff main -- hasio-mobile-app/package.json` reviewed before shipping; only `react-native-calendars` may appear |
| Guests book, nobody confirms | 48-hour expiry cron, plus email to the host; the concierge inbox is a real person's job |
| Double booking | Convex mutations are serialisable and `overlaps()` runs inside the same mutation; covered by a test |
| Fake ratings replaced by honest low ones look like a regression | D9 clears them first, so the change is visible and deliberate |
| The branch and this work diverge further | The port lands on `brand-lime`; `phase-1-stays` is then only the source of the redesign, for a later store release |

## 9. The Twilio dependency

The account is locked ("inactive user") pending Twilio's compliance review, so
OTA-1 has no delivery path today. This does **not** block building any of the
above: bookings and ratings need no SMS. The only tie is the product rule that
a guest needs a verified phone before booking, so the host can call them.

If Twilio stays blocked, `convex/sms/provider.ts` is an interface with Twilio as
one implementation behind it — another aggregator is one object and one branch
in `getSmsProvider`, roughly forty lines. Saudi carriers drop unregistered
senders, so the realistic alternatives are the other large aggregators
(Vonage, Infobip, Sinch); the cheaper local providers want a Saudi commercial
registration first.

## 10. Verification

| | |
|---|---|
| `npm test` | the ported backend tests plus the new reviews tests |
| `npm run typecheck:convex` | clean |
| `cd hasio-mobile-app && npx tsc --noEmit` | clean |
| `npx expo export --platform android` | exit 0 |
| `npm run build` (website) | clean, and `/` still has zero `modulepreload` entries |
| Expo Go against dev | sign in → book → confirm as host → complete → rate, in both languages |
| Native modules | none added beyond `react-native-calendars` |
| `app.json` version | still 1.0.2 |
