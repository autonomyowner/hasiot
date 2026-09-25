# Hasio 1.1.0: bookable services, push, a finished admin panel

- **Date:** 2026-09-25
- **Status:** design approved by the owner in conversation, part by part. This written version is awaiting the owner's review.
- **Covers:** `hasio-mobile-app/` (iOS and Android), the Convex backend in `convex/`, and the admin panel in `src/admin/`. The public website gets no new pages.
- **Branch:** `services-release`, from `sdk-57` at `2e6a836`. It merges back into `sdk-57`, which becomes the 1.1.0 store release.
- **How it is used:** the plan (`docs/superpowers/plans/2026-09-25-bookable-services-release.md`) and the backend contract (`docs/superpowers/contracts/2026-09-25-services-backend.md`) follow this document. Where they disagree, this document wins until it is changed.

## 1. Why

The owner's goal: the app, live on both stores, **fully production ready**. Every screen, button and text finished on iOS and Android, the admin panel working end to end, and **service providers bookable alongside hotels**.

What the research on 2026-09-25 found:
- **Services are supply-only.** Providers can sign up, get verified, and post, edit or delete services, and the admin approves them. But:
  - no traveller screen shows a service;
  - nothing can book one: `bookings.listingId` is required, and every booking, review, notification and cron path assumes a listing;
  - a service's price is free text ("100–200 SAR"), which cannot be multiplied.
- **Nobody is told about anything.**
  - Production has no `RESEND_API_KEY`, so no email is sent.
  - The app registers no push token, so no push is sent.
  - Most accounts are phone sign-ups whose email is a placeholder anyway.

  A host or provider learns about a booking request only by opening the app, and the request dies after 48 hours.
- **The admin panel cannot save a hotel.**
  - What goes wrong: commit `2449fbf` added nightly price and check-in times to `ListingForm.jsx`, but `admin.mutations.createListing` / `updateListing` do not accept them, so every hotel save is rejected by the validator.
  - Where it is live: the same code is on `main`, so production has the bug today.
  - Beyond this bug, the panel has no view of live services, no way to reject an account, and no way to take down a reported review.
- **Production still signs anyone in.** `SMS_PROVIDER` is `demo` (checked 2026-09-25), so any six digits sign in as any number.

## 2. Decisions (owner, 2026-09-25)

| # | Decision |
|---|---|
| D1 | **Scope:** the mobile app (iOS and Android), bookable services, and the admin panel end to end. The public website gets nothing new: no sign-up, no browse pages ("forget about the site totally", then "keep admin panel, it's needed"). |
| D2 | **hasio.net on Cloudflare is the live site; hasio.xyz is dropped.** Admin deploys go to Cloudflare (`wrangler.jsonc`, static assets). 1.1.0 opens its legal pages on hasio.net. hasio.xyz must keep serving `privacy-policy.html`, `terms-of-service.html` and `support.html` (or redirect them) until the live binaries are gone and both store listings point at hasio.net (section 8). |
| D3 | **Travellers find services in the "Book" tab**, which replaces "Stay": a Stays \| Services switch at the top. Home gains a "Local services" row. Five tabs, same order. |
| D4 | **Booking a service is a request, like a hotel.** The traveller picks a day, a start time and a quantity. The provider confirms or declines within 48 hours. Nothing is paid in the app; the traveller pays the provider directly. |
| D5 | **Service bookings share the `bookings` table** as `kind: "service"` (option A). `listingId` becomes optional and `serviceId` is added. The functions the live apps call never return a service booking to them (section 4.2). |
| D6 | **Push notifications ship in 1.1.0**, through `expo-notifications` and the Expo push service. iOS needs Nabil to switch on push for `com.hasio.travel` and create an APNs key. Android needs a Firebase project (the owner). The in-app inbox stays the source of truth. |
| D7 | **Trips is not built.** The trip count on Profile, which opens nothing, is removed. The backend (`convex/trips/`) stays for later. |
| D8 | **The icon art is unchanged.** It carries the Arabic "هاسيو", which the brand rule forbids, but a new icon is the owner's call. The splash's white square and the Android adaptive icon are fixed. |
| D9 | **The owner's uncommitted work was committed as it was**, before this work began: `335523d` (admin hook move), `6c7a496` (Taqnyat SMS route), `2e6a836` (privacy wording on phone numbers). |

**Defaults taken, which the owner can reverse:**

| # | Default |
|---|---|
| D10 | No availability calendar for services: the provider declines if busy. Two requests for the same time are not blocked, so group tours work. |
| D11 | A traveller can cancel a service booking until its start time (Riyadh). After that it is a conversation with the provider, as with a stay that has started. |
| D12 | Anyone signed in can rate a service. A review attached to that traveller's **completed** booking of that service carries the verified badge, the same rule as places (bookings design D8). |
| D13 | Services cannot be favourited in 1.1.0. |
| D14 | Push permission is asked in context, never at first launch. A traveller is asked after sending a booking request. A host or provider is asked on opening their inbox or dashboard. Settings has a row to turn it on later. |
| D15 | The admin can edit, suspend, reinstate and delete a live service. Suspending an account hides that owner's listings and services from travellers. |
| D16 | A service without a numeric price stays visible but shows **Contact** (call or email) instead of **Book**, so services posted before 1.1.0 keep working. |
| D17 | The EAS development and preview profiles keep pointing at production Convex. That is how the owner tests on a phone today. It is flagged, not changed. |

## 3. Goals and non-goals

**Goals**
- A traveller can find, book, cancel and rate a service provider end to end, in both languages.
- A provider can price a service, receive requests, and confirm, decline, complete or mark a no-show from the app.
- Hosts, providers and travellers are notified by push, and in the inbox, of every booking event and every approval or rejection that concerns them.
- Every admin workflow completes in the panel, with Arabic text, readable errors and a log entry.
- The live iOS 1.0.2 and Android 1.0.0 apps keep working against the new backend throughout.
- 1.1.0 is buildable for both stores from `sdk-57`, with every code-side pre-flight item closed.

**Non-goals**
- Online payments (the bookings design, D6, still holds).
- An availability calendar or per-unit inventory, for stays or services.
- Trips, a map view, favourite services.
- Any public website page. That includes the booking site built on 2026-09-13 and never committed; its source survives only in the Claude transcript `ca740407-a935-4230-b0fc-09c5a217c76b.jsonl`.
- Deploying anything, building anything on EAS, or submitting to a store without the owner's "ship it".

## 4. Backend

### 4.1 Compatibility rule

The live apps talk to production and cannot be changed:
- **iOS 1.0.2:** runtime 1.0.2, with over-the-air updates up to the bookings release.
- **Android 1.0.0:** the July bundle.

Every backend change in this work is therefore **additive**, or a fix that rejects only requests that were never meant to succeed.

**Allowed**
- New tables, optional fields, indexes and functions.
- New optional arguments.
- A required field made optional: `bookings.listingId`, `reviews.listingId`.
- New union values that no old client reads.

**Not allowed**
- Renaming or removing a function the live apps call.
- Adding a required argument.
- Changing a return shape.
- Returning a booking whose `listing` is `null` to a caller that does not ask for services.

**Never** publish an over-the-air update from this branch to runtime 1.0.2: RN 0.86 JavaScript on an RN 0.81 binary crashes at launch. `app.json` `version` stays `1.1.0`.

### 4.2 Service bookings (D4, D5)

**Price.** `services` gains `price` (whole SAR) and `maxGroupSize`. `priceUnit` keeps its four values, now with a meaning for the quote:

| `priceUnit` | The traveller chooses | Total |
|---|---|---|
| `per_hour` | hours, 1–12 | price × hours |
| `per_day` | days, 1–14 | price × days |
| `per_event` | nothing | price |
| `fixed` | nothing | price |

The number of people (1 to `maxGroupSize`, default 20) is recorded but does not change the total. A provider who charges per person sets up the service accordingly; a `per_person` unit is not added in 1.1.0.

**Bookable** means all of the following:
- the service is `approved`;
- it has a `price` above 0;
- its owner is an approved `service_provider` who is not suspended;
- the service is not suspended.

The server computes every total (bookings design D5). The client sends the day, the start time and the quantity, never an amount.

**The booking row.** The same `bookings` table, with:
- `kind: "service"`, `type: "service"`;
- `serviceId`, `quantity`, `unitPrice`, `priceUnit`, `totalAmount`, `currency: "SAR"`;
- `ownerId` = the service's owner;
- `date` = the service day and `time` = the start time (both required fields, as for stays);
- `checkIn` = the service day, `checkOut` = the day after the last service day (exclusive, the same meaning as a stay's). A daily booking of 3 days from the 10th has `checkOut` 13th; every other service booking has `checkOut` = day + 1.

Filling `checkIn` and `checkOut` is what lets the existing jobs run unchanged:
- the hourly expiry, keyed on `expiresAt`;
- the 09:00 reminder, keyed on `checkIn`;
- the 04:00 auto-complete, keyed on `checkOut`.

The same mirroring is already done for stays (`date`/`time`).

**Rules.**
- A verified phone is required, because the provider has to reach the guest.
- The daily booking rate limit is shared with stays (30 a day).
- The day must be today or later in Riyadh, and a booking for today must start after now.
- A provider cannot book their own service.
- The same traveller cannot request the same service on the same day twice while a request is pending or confirmed (`DUPLICATE`).
- A pending request expires 48 hours after it is made (the existing `PENDING_TTL_MS`).
- State transitions are the existing `canTransition` table. The provider acts as `owner`. `requireBookingManager` is extended so the service's owner may manage it.
- Cancelling is allowed until the start time (D11). After it, `SERVICE_STARTED`.

**Queries the live apps call keep their behaviour.**
- `getUserBookings`, `getBooking`, `getBusinessBookings` and `getOwnerStats` skip `kind === "service"` unless the new optional `includeServices: true` is passed. 1.1.0 passes it.
- `getBooking` for a service booking returns `null` to a caller that does not ask for services, so an old app tapping a service notification shows "not found" instead of crashing.

### 4.3 Reviews of services (D12)

- `reviews` gains `serviceId`, and `listingId` becomes optional. Exactly one of the two is set.
- `addReview` takes `listingId` **or** `serviceId`. The existing listing path is unchanged.
- A service's `rating` and `reviewCount` are recomputed the way a listing's are, and cleared when the last review goes.
- New queries: `listForService`, `getServiceSummary`, `getMineForService`. `listMyReviewablePlaces` does not change shape. A new `listMyReviewableServices` feeds the "rate your provider" prompt.

### 4.4 Notifications and push (D6)

**New notification types**
- `listing.approved`, `listing.rejected`, `listing.suspended`
- `service.approved`, `service.rejected`, `service.suspended`
- `account.approved`, `account.rejected`

**Booking events** keep their names. Their text reads the booking's `kind`: a service booking names the service, the day and the start time instead of nights.

**Data** carries `serviceId` and a `target` telling the app where a tap lands: `booking`, `host-inbox`, `provider-inbox`, `my-listings`, `my-services` or `verification`.

**Push delivery already exists** in `convex/notifications/deliver.ts`: Expo push, with `DeviceNotRegistered` tokens pruned. Two changes:
- it sends `priority: "high"` and `channelId: "default"`;
- it stops requiring a listing before it will email.

The app registers its Expo push token with `users.mutations.registerPushToken` once permission is granted (D14), and removes it on sign-out with `unregisterPushToken`. At most 5 tokens per user, newest kept.

**Credentials, outside the code:**
- **iOS:** Nabil enables Push Notifications on the App ID `com.hasio.travel` and creates an APNs key (`.p8`, with its Key ID). The key is given to Expo through `eas credentials`, and the App Store provisioning profile is regenerated with push, by the Windows recipe in `IOS_RELEASE_STATUS.md`.
- **Android:** a Firebase project with the Android app `com.hasio.travel` supplies `google-services.json` (committed; it holds no secret) and an FCM V1 service-account key, uploaded to EAS.

If Nabil's step is not done by release time, an `app.config` switch builds iOS without the push entitlement, and Android ships push regardless.

### 4.5 Services, accounts and moderation

**Services**
- `services.status` gains `"suspended"`, with a `suspendedReason`.
- Public service queries hide services that are suspended, services whose owner is suspended, and services from owners the viewer blocked. `getService` gains the owner-blocked check it lacks.
- `search_services_ar` (on `title_ar`) makes services searchable in Arabic.
- `submitService` and `updateMyService` accept `price` and `maxGroupSize`, validate their arguments on the server (type, unit, lengths, price), and throw `ConvexError` with readable text instead of a plain `Error`, which production redacts to "Server Error". `rateLimit.ts` does the same.

**Accounts**
- An admin can reject a business or provider account with a reason (`accountRejectionReason`, `accountRejectedAt`).
- The app shows the reason on the verification screen. Uploading a new document clears it and puts the account back in the queue.
- A single approve now checks for a document on the server, as bulk approve already does.

**Listings**
- `deleteMyListing` refuses while the listing has a pending or confirmed booking.
- `updateMyListing` accepts `pricePerNight: null`, so a host can clear a nightly rate.
- Suspending an account hides that owner's listings from travellers.

**Moderation**
- `reportContent` accepts `targetType: "ai_message"`, with the message text in `details`. The planner's Report finally records something.
- An admin can remove a reported review. Its rating is recomputed, and the report is marked actioned.

**Every admin write** keeps calling `requireAdmin` and `logAdminAction` in the same transaction.

### 4.6 The contract

Every new and changed function is listed with its arguments, return shape and exact refusal text in `docs/superpowers/contracts/2026-09-25-services-backend.md`, written before any client work starts. Refusal text keeps the house format, **Arabic first, then English, in one string** (`BOOKING_ERRORS` in `convex/bookings/logic.ts`). The app maps the English half to its own keys (`lib/bookingError.ts`), so the English wording is an API.

## 5. The app

### 5.1 Travellers

- **Book tab** (was Stay, Arabic «احجز»): a Stays \| Services switch.
  - Stays is today's lodging list, plus search and a city filter across the 13 cities.
  - Services has type chips (guide, photographer, driver, translator, event planner, catering, equipment), a city filter, and search in both languages.
- **Home:** a "Local services" row of bookable services. "See all" opens the Book tab on Services.
- **Service sheet:** a `BottomSheet`, like the listing sheet. It shows photos, title, type, city, "Offered by …", languages, description, and price with its unit. Then the rating summary and recent reviews, **Book** (or **Contact**, D16), and **Report**. Book, Rate, Report and phone verification open **inside** the sheet (the iOS modal rules in CLAUDE.md).
- **Service booking sheet:** a calendar for the day, start-time chips every 30 minutes from 06:00 to 23:00, a quantity stepper when the unit asks for one, and number of people. It shows a note and the live server quote, then "Send booking request". It follows the never-faded primary-button rule with `nudge()`.
- **My bookings and booking detail** show service bookings beside stays. They show the provider's name and phone, the day, the start time and the quantity; cancel until the start time; and, once completed, "How was it?", which opens the review sheet with the booking attached.

### 5.2 Providers

- **Post / edit service:**
  - price (a number) and its unit, maximum group size, and a required city from the 13;
  - any edit still sends the service back for review, and the form says so before saving.
- **Provider Bookings inbox** (`app/provider/bookings.tsx`): confirm, decline with a reason, complete, no-show, and call the guest. It reuses the host inbox's card.
- **Provider dashboard:** real numbers (pending, upcoming, completed this month, revenue this month) and a link to the inbox.
- The verification screen shows a rejection reason and lets the provider upload again.

### 5.3 Everyone

- **Push:**
  - permission is asked in context (D14), with a Settings row to turn it on later;
  - taps route by `data.target`;
  - banners show while the app is open;
  - Android gets a high-importance `default` channel.
- **Notifications inbox:** covers the new types and routes providers correctly (today it routes by `isBusinessOwner` only).
- **Finished or removed:**
  - the Trips count goes (D7);
  - the planner's Report records the report;
  - the reviews page gets an empty state;
  - mark-read failures are handled instead of swallowed;
  - a "Contact support" row goes in Settings;
  - legal links point at hasio.net;
  - the unused strings from the audit are deleted (`detailBookSoon`, the Moments keys, `pushNotifications` unless reused).
- **Never-faded buttons:** sign-in's Send code and Verify, `VerifyPhoneSheet`, and Save while editing in the three posting forms follow the rule from `a37908e`.
- **Store build:**
  - Android system bars on dark-mode phones: `userInterfaceStyle: "light"` and `expo-system-ui`;
  - no Face ID usage text (`expo-secure-store` `faceIDPermission: false`);
  - Arabic permission prompts through `locales`;
  - a splash with no white square;
  - an Android adaptive icon from the layered IconKitchen files, with a monochrome layer.

  The icon art stays as it is (D8).

## 6. The admin panel (hasio.net/admin)

**Fixes**
1. Hotel create and edit: the admin `createListing` / `updateListing` accept and validate the pricing fields.
2. Coordinates cover all 13 cities. Latitude 24–27 / longitude 48–51 rejects Jubail, Nairyah, Qaryat Al Ulya, Khafji and Hafar Al Batin.
3. Lists never show "no results" while more pages exist (Listings, Users, Activity).
4. The dashboard's duplicate queue row and double count, the capped-count flag, and one stats subscription instead of one per tab.
5. Errors:
   - a failing header query no longer replaces the panel with the site's English error page;
   - tab errors are in Arabic;
   - the host picker shows readable errors.
6. Arabic everywhere:
   - statuses, sources, activity details, "Unknown";
   - one set of role labels;
   - Eastern Province wording instead of Al-Ahsa.
7. Smaller fixes:
   - working hours can close after midnight;
   - admins get a higher upload allowance;
   - a listing with open bookings cannot be deleted;
   - a field can be cleared;
   - "complete" on a pending booking asks first.

**New**
1. **Services tab** for live services:
   - search, and filters by type, city and status;
   - the full content (photos, description, price, contact, owner);
   - edit, suspend and reinstate with a reason, delete.
2. **Approval queues** (places and services) show photos, description, price and contact before approval.
3. **Bookings tab:** stays and services with a kind filter, paging, search by confirmation code or phone, and the provider's service name. The support-only forced status change is reachable behind a confirmation.
4. **Accounts:** reject with a reason. Accounts without a document are shown as such, not left in the queue forever.
5. **Reports:** remove a reported review. A service report suspends the service (not reject). The owner is notified.
6. **Users:** change a user's role, with confirmation and a log entry. A user detail view (bookings, listings, services, reports). The host picker shows the current host and hides suspended accounts.
7. **Every approval, rejection, suspension and takedown notifies the owner** (4.4).

**Deploy:** `npm run build -- --mode cloudflare`, then `npx wrangler deploy`, to hasio.net. Only on "ship it", and only after the backend it calls is on production.

## 7. Seed data

The owner will point to a folder of services and places to seed. Until then nothing is seeded. The rules, from the existing seeds:
- **Insert-only and idempotent:** an `internalMutation` that skips names it already has, safe to run twice.
- **Nothing invented:**
  - no ratings, reviews, discounts or phone numbers;
  - no stock photo presented as the place;
  - no provider that does not exist.
- **A seeded service needs a real provider account as its owner.** When the provider has no account yet, a Hasio concierge provider account owns it, and someone at Hasio fulfils requests with the real provider. This mirrors bookings design D7 for hotels, and needs the owner's yes per provider.
- Run on development first. Production only on "ship it".

## 8. Release (only on "ship it")

**Order**
1. `npx convex deploy --yes`. The backend is additive, so the live apps keep working.
2. The admin panel to hasio.net.
3. `SMS_PROVIDER` switched off `demo` (Taqnyat once its sender is registered, `console` as the stopgap).
4. Push credentials in place (4.4).
5. EAS production builds, both platforms.
6. Android submitted (service-account key restored, or a manual upload).
7. iOS submitted. Then Nabil is told the build number.

**Store listings**
- Privacy and Support URLs move to hasio.net: Nabil in App Store Connect, the owner in Play.
- The Play listing name, screenshots and Data Safety form: the phone number, plus "Device or other IDs" for push tokens.
- App Store privacy labels.

**hasio.xyz** keeps serving the three legal pages, or redirects them to hasio.net, until those URLs have changed and the live binaries have aged out. The support mailbox `support@hasio.xyz` is on that domain too (open decision 3).

Rollback points (the version ids and commits in use before the release) are written down before anything is deployed.

## 9. How it is verified

- **Backend:** test-first with `convex-test` for every rule in sections 4.2–4.5, faking Expo push at the network boundary. `npm test` and `npm run typecheck:convex` stay green.
- **App:** `npm run typecheck`, `npm run lint` (no new warnings beyond the documented 3) and `npm run test` in `hasio-mobile-app/`. The logic that can be pure (quote display, unit labels, routing a notification tap) gets `lib/**` tests.
- **Admin:** `npm run build` and `npm run lint` at the root, then headless Chrome against the development backend: create and edit a hotel, approve and suspend a service, reject an account, remove a review.
- **End to end on development:** a smoke script that makes its own accounts and deletes them afterwards. The provider posts a priced service, the admin approves it, the traveller books it, the provider confirms, the booking completes, the traveller rates it. The script also checks that the old-app queries never return the service booking.
- **Expo web**, at phone size in both languages: the Book tab, a service sheet, and the booking sheet as far as sending.
- **On a phone** (owner): the device checklist gains service booking, the provider inbox, push, and the tap routes. iPhone checks need a TestFlight build, because the development profile builds for the simulator only.

## 10. Risks

| Risk | Handling |
|---|---|
| A live 1.0.2 app is shown a service booking and crashes on a `null` listing | The old queries filter service bookings out unless asked (4.2); covered by tests and the smoke script. |
| `listingId` made optional breaks a reader that assumed it | The type checker flags every `booking.listingId` use; each is handled and tested. |
| The iOS build fails signing because the profile lacks push | The `app.config` switch (4.4); Android is unaffected. |
| Push asked too early and refused forever | Asked in context only (D14); refusal leads to a Settings row that opens the system settings. |
| A provider never answers | 48-hour expiry and push; the admin sees every pending request in the Bookings tab. |
| Five parallel agents hit the account's usage limit | They resume with SendMessage; nothing is lost (lesson from 2026-09-24). |
| An admin edit, suspension or deletion is not recorded | Every admin mutation logs in the same transaction, and the tests assert the log row. |

## 11. Open decisions (owner)

1. **Seed folder:** where it is, and which providers have agreed to be listed (section 7).
2. **The iOS push step:** Nabil must enable push and send the APNs key. Ask him the same day the plan starts.
3. **Support email after hasio.xyz:** `support@hasio.xyz` appears in the app, the legal pages and App Store Connect. If the domain goes, the mailbox goes with it. Which address replaces it?
4. **A new app icon** without the Arabic "هاسيو" (D8).
5. **Still open from before:**
   - the Play service-account key, or a manual upload;
   - `SMS_PROVIDER` off `demo`;
   - the app-transfer agreement with Nabil;
   - a TestFlight build for the iPhone checks;
   - Android dark mode was one of these, and it is now in scope (5.3).

## 12. Docs against code (checked 2026-09-25)

What `CLAUDE.md` says that the code or production no longer matches. These are corrected in the same change as this work, in section 9 of the method:
- "Production: https://www.hasio.xyz (Vercel)". It is hasio.net on Cloudflare now (D2), and the Cloudflare deploy commands are not documented.
- The backend tree omits `notifications/`, `reviews/`, `moderation/`, `sms/`, `lib/`, `crons.ts` and more.
- "AI Travel Planner … Claude 3.5 Haiku" in two places, while `travelPlanner/actions.ts` uses `anthropic/claude-haiku-4.5`.
- "Admin Panel … listing CRUD" is broken for hotels (section 1).
- The Stay tab becomes the Book tab, and the Trips count goes.
- The tourist-side services directory ("Services are invisible to travellers", open item from the UI audit) is closed by this work.
