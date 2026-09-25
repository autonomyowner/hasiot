# Bookable services, push and a finished admin panel: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Travellers can book service providers alongside hotels. Everyone is notified by push. The admin panel works end to end. The app is ready for a 1.1.0 store build on both platforms.

**Architecture:**
- **Backend:** service bookings are rows in the existing `bookings` table (`kind: "service"`). They reuse the request → confirm → complete lifecycle, the crons and the notification pipeline.
- **Live apps:** the queries the 1.0.2 / 1.0.0 apps call never return service bookings to them.
- **Clients:** built in parallel against `docs/superpowers/contracts/2026-09-25-services-backend.md`, after the backend is merged and pushed to the development deployment.

**Tech stack:**
- Convex, with `convex-test` and vitest for the backend tests.
- Expo SDK 57 / React Native 0.86 / expo-router for the app, plus `expo-notifications` and `expo-system-ui`.
- React 19 + Vite 7 + Tailwind v4 / shadcn for the admin panel (Arabic, RTL).

**Read first:**
- Design: `docs/superpowers/specs/2026-09-25-bookable-services-release-design.md`
- Contract: `docs/superpowers/contracts/2026-09-25-services-backend.md`
- `CLAUDE.md` (root): "Mobile App Production Patterns" and "Stores, accounts & shipping".

**Integration branch:** `services-release`, from `sdk-57`. Every piece of work merges into it with `--no-ff`. When Part 3 is green it merges into `sdk-57`.

---

## Part 1: the core (backend), test-first

Three pieces, in order:
- **F** (coordinator) lands the schema, the compatibility layer and the shared scaffolding.
- **B1** and **B2** (two Opus agents, one worktree each) then build on F's final commit **in parallel**.

### Task F: foundation (coordinator, on `services-release`)

**Files**
- Modify: `convex/schema.ts`, `convex/lib/cities.ts`, `convex/rateLimit.ts`
- Create: `convex/lib/errors.ts`
- Modify for the compatibility layer (every reader of `booking.listingId` / `review.listingId`, found by the type checker): `convex/bookings/mutations.ts`, `convex/bookings/queries.ts`, `convex/bookings/lifecycle.ts`, `convex/notifications/internal.ts`, `convex/admin/service.ts`, `convex/admin/queries.ts`, `convex/reviews/service.ts`, `convex/reviews/queries.ts`, `convex/users/mutations.ts`, plus any other file `tsc` flags
- Modify: `convex/notifications/templates.ts`, `convex/notifications/internal.ts` (new account events, `notifyUserEvent`, `data.target`)
- Test: `convex/bookings/compat.test.ts` (new), `convex/notifications/templates.test.ts`, `convex/lib/cities.test.ts` (new)

- [ ] **F1. Failing tests for the compatibility rule.** Create `convex/bookings/compat.test.ts`. It seeds a tourist, a provider, an approved service, and one service booking plus one stay for the tourist, using the new `seedService` / `seedServiceBooking` helpers (F2). The booking rows are written directly, because `createServiceBooking` does not exist yet. The query handlers themselves cannot be called from a test (they resolve the user through Better Auth), so the tests assert through exported seams:
  - a new exported helper `visibleToLegacyClients(bookings)` in `convex/bookings/queries.ts` returns only rows whose `kind !== "service"`;
  - `listMyReviewablePlaces`'s pure filter `reviewablePlaceBookings(bookings, reviewedListingIds)` skips rows without `listingId`;
  - `notifyBookingEvent` on a service booking whose service exists writes one notification, with `data.serviceId` and `data.target: "provider-inbox"` for the owner audience.

  ```ts
  import { describe, expect, it } from "vitest";
  import { makeT, seedUser, NOW } from "../test.utils";
  import { visibleToLegacyClients } from "./queries";

  describe("legacy clients never see service bookings", () => {
    it("filters kind service out", () => {
      const rows = [
        { kind: "stay", _id: "a" },
        { kind: "service", _id: "b" },
        { kind: undefined, _id: "c" },
        { kind: "slot", _id: "d" },
      ] as any[];
      expect(visibleToLegacyClients(rows).map((r) => r._id)).toEqual(["a", "c", "d"]);
    });
  });
  ```

  Run `npx vitest run convex/bookings/compat.test.ts`. Expected: FAIL, because `visibleToLegacyClients` does not exist.

- [ ] **F2. Schema.** Apply every change in contract section 2 to `convex/schema.ts`: the optional `bookings.listingId` and `reviews.listingId`, the new optional fields, the `by_serviceId` indexes, `search_services_ar`, the user rejection fields, `notifications.data.serviceId` / `target`, and the `pushTokens` table. Update the comments on `status` / `kind` / `type` to list the new values.

  In `convex/test.utils.ts`, add two helpers that B1 and B2 both use:
  - `seedService(t, { ownerId, status?, price?, priceUnit?, maxGroupSize?, city?, title_en? })`, which inserts an approved `tour_guide` in Al Ahsa, priced 150 `per_hour`, unless told otherwise;
  - `seedServiceBooking(t, { userId, serviceId, ownerId, date, time?, status?, quantity?, expiresAt? })`, which inserts a `kind: "service"` row with the mirrored `checkIn` / `checkOut`.

- [ ] **F3. Make it compile.** Run `npx tsc -p convex --noEmit` and fix every error with the smallest change that keeps today's behaviour for listing bookings:
  - `ctx.db.get(booking.listingId)` becomes `booking.listingId ? await ctx.db.get(booking.listingId) : null`.
  - `rescheduleBooking` throws `SERVICE_ERRORS.NO_RESCHEDULE`, defined in F as a constant in `convex/bookings/logic.ts` next to `BOOKING_ERRORS` (B1 moves it into `services/logic.ts`), for a booking with `kind === "service"` before it touches `listingId`.
  - `requireBookingManager` accepts `booking.ownerId === user._id` first, then falls back to the listing owner.
  - `recomputeListingRating(ctx, review.listingId)` becomes `recomputeReviewTarget(ctx, review)`. This new helper in `reviews/service.ts` recomputes the listing, or the service through a new `recomputeServiceRating` (same body against `by_serviceId` and `services.rating` / `reviewCount`).
  - `listMyReviewablePlaces` goes through the new pure `reviewablePlaceBookings`.

- [ ] **F4. Legacy filters.** Add `includeServices: v.optional(v.boolean())` to `getUserBookings` and `getBooking`.
  - Without it, `getUserBookings` passes its rows through `visibleToLegacyClients`, and `getBooking` returns `null` for `kind === "service"`.
  - `getBusinessBookings` and `getOwnerStats` always skip `kind === "service"`.

  Export `visibleToLegacyClients` and `reviewablePlaceBookings`.

- [ ] **F5. Cities and errors.**
  - Create `convex/lib/errors.ts` with `AUTH_ERRORS` (contract section 1).
  - Add `EASTERN_PROVINCE_CITIES` and `toProvinceCity` to `convex/lib/cities.ts`, with tests in `convex/lib/cities.test.ts`:
    - `toProvinceCity("Hofuf") === "Al Ahsa"`, `toProvinceCity("Dhahran") === "Al Khobar"`, `toProvinceCity("Al Bayda") === "Al Bayda"`;
    - `toProvinceCity("Riyadh") === null`, `toProvinceCity("") === null`.
  - `enforceRateLimit` throws `new ConvexError(message)`.

- [ ] **F6. Account notifications.** In `convex/notifications/templates.ts`:
  - add `ACCOUNT_EVENTS`;
  - add `renderAccountNotification(event, { name_en?, name_ar?, reason? })`;
  - widen `NotificationEvent` to include the account events.

  Exact text:

  | Event | English title / body | Arabic title / body |
  |---|---|---|
  | `listing.approved` | "Your place is live" / "{name} was approved and travellers can now find it." | "تم اعتماد مكانك" / "تم اعتماد {name} وأصبح ظاهرًا للمسافرين." |
  | `listing.rejected` | "Your place needs changes" / "{name} was not approved.{ Reason: …}" | "مكانك يحتاج إلى تعديل" / "لم يُعتمد {name}.{ السبب: …}" |
  | `listing.suspended` | "Your place was taken down" / "{name} is hidden from travellers.{ Reason: …} Contact support if you think this is a mistake." | "تم إيقاف مكانك" / "أصبح {name} مخفيًا عن المسافرين.{ السبب: …} تواصل مع الدعم إن كان هذا خطأ." |
  | `service.approved` | "Your service is live" / "{name} was approved and travellers can now book it." | "تم اعتماد خدمتك" / "تم اعتماد {name} وأصبح بإمكان المسافرين حجزها." |
  | `service.rejected` | "Your service needs changes" / "{name} was not approved.{ Reason: …}" | "خدمتك تحتاج إلى تعديل" / "لم تُعتمد {name}.{ السبب: …}" |
  | `service.suspended` | "Your service was taken down" / "{name} is hidden from travellers.{ Reason: …} Contact support if you think this is a mistake." | "تم إيقاف خدمتك" / "أصبحت {name} مخفية عن المسافرين.{ السبب: …} تواصل مع الدعم إن كان هذا خطأ." |
  | `account.approved` | "Your account is approved" / "You can now post on Hasio." | "تم اعتماد حسابك" / "يمكنك الآن النشر على Hasio." |
  | `account.rejected` | "Your documents were not approved" / "Upload a new document to try again.{ Reason: …}" | "لم تُعتمد وثائقك" / "ارفع وثيقة جديدة للمحاولة مرة أخرى.{ السبب: …}" |

  Tests in `templates.test.ts` assert every event in both languages, with and without a reason. The brand stays "Hasio" in Arabic (CLAUDE.md brand rule), and no text contains "هاسيو".

  In `convex/notifications/internal.ts`:
  - add `notifyUserEvent` (contract section 6);
  - make `notifyBookingEvent` set `data.target` from the audience and the booking kind;
  - make `notifyBookingEvent` render service bookings through the service's title when `booking.serviceId` is set. B1 replaces the wording; F only avoids crashing, and a service booking notifies with the service title and the booking dates.

  Existing booking templates keep their exact text. `booking.cancelled_admin` still says "Hasio support" in English and «فريق هاسيو» must become «فريق Hasio» (brand rule); update its test.

- [ ] **F7. Green.** Run `npx vitest run` (all backend tests) and `npx tsc -p convex --noEmit`. Expected: every test passes, including the existing ones, and the type check is clean.

- [ ] **F8. Commit** in small commits:
  - `feat(schema): service bookings, service reviews, push tokens, account rejection`
  - `fix(bookings): the live apps never see a service booking`
  - `feat(notifications): approval, rejection and takedown events`
  - `contract: backend contract for bookable services`, which commits the contract doc

  Then `npx convex codegen`, and commit the regenerated `convex/_generated` with the schema commit.

### Task B1: service bookings, reviews, push (Opus agent, worktree from F)

**Files** (this agent's only files)
- `convex/services/logic.ts` (new) + `logic.test.ts`
- `convex/services/mutations.ts`, `convex/services/queries.ts` + `services.test.ts` (new)
- `convex/bookings/service.ts`, `mutations.ts`, `queries.ts`, `logic.ts` + `service.test.ts`, `lifecycle.test.ts`
- `convex/reviews/*` + tests
- `convex/users/push.ts` (new) + `push.test.ts`
- `convex/notifications/templates.ts` (booking wording for services only), `convex/notifications/deliver.ts` + tests
- `convex/moderation/mutations.ts` (the `ai_message` target only)

**Build**, in this order, each test-first:
1. **`services/logic.ts`**: the constants, `SERVICE_ERRORS` (move `NO_RESCHEDULE` here from F's temporary spot), `isPublicService`, `isBookableService`, `computeServiceQuote` and `validateServiceInput`, exactly as in contract section 1. The tests cover, at a minimum:
   - every refusal in `computeServiceQuote`'s order;
   - `per_hour` 3 × 150 = 450, and `per_day` 2 days with `checkOut` = date + 2;
   - `fixed` and `per_event` with quantity forced to 1, and an unknown unit treated as `fixed`;
   - today's date with the start time before now → `PAST_TIME`; after now → ok (with `NOW` / `TODAY` from `test.utils.ts`);
   - `maxGroupSize` undefined allows 20 and refuses 21;
   - `validateServiceInput`: every refusal, city folding ("Hofuf" → "Al Ahsa"), and `null` clearing in update mode.
2. **`services/queries.ts` and `services/mutations.ts`** (contract section 4). Add a seed helper `seedService(t, opts)` in `convex/test.utils.ts` next to `seedHotel`.
   - `submitService` / `updateMyService` / `deleteMyService` get service seams in a new `convex/services/service.ts` (`submitServiceForUser`, `updateServiceForUser`, `deleteServiceForUser`) so they are testable.
   - The public queries apply `isPublicService`, the blocked-owner filter, `matchesCity`, and the `bookable` flag. Put that filtering in pure helpers and test them.
3. **`bookings/service.ts` `createServiceForUser`** and `bookings/mutations.ts` `createServiceBooking` (contract section 3). Tests:
   - the whole refusal order;
   - the inserted row's fields (`kind`, `checkIn` / `checkOut`, `ownerId`, `expiresAt`, `totalAmount`);
   - one `booking.requested` notification to the provider, with `target: "provider-inbox"`;
   - `DUPLICATE` for the same day, and not for a cancelled one;
   - the phone requirement, own service, a suspended owner, and an unpriced service.
4. **`cancelAsTourist`** for service bookings: `SERVICE_STARTED` after the start time. It notifies the provider on cancel. Test both sides of the start time.
5. **`bookings/queries.ts`**:
   - `quoteService`;
   - `getProviderBookings` and `getProviderStats`;
   - the `service` summary on `getUserBookings` with `includeServices`;
   - `getBooking`'s service shape (`service`, `provider`, `viewerRole: "provider"`).

   Put the row shaping in exported pure functions and test them.
6. **Lifecycle:** one test each, showing that a service booking expires after 48 hours, gets its reminder the day before `checkIn`, and completes after `checkOut`. No production code change is expected; if one is needed, make it.
7. **Booking wording for services** in `notifications/templates.ts`. `TemplateInput` gains `kind?: "stay" | "service"`, `serviceTitle_en?`, `serviceTitle_ar?`, `startTime?`, `quantity?` and `priceUnit?`. For `kind === "service"`:

   | Event | English | Arabic |
   |---|---|---|
   | requested | "New booking request" / "{guest} requested {service} on {date} at {time}{, 3 hours}. {people}. Total SAR {total}. Code {code}." | "طلب حجز جديد" / "{guest} طلب {service} يوم {date} الساعة {time}{، 3 ساعات}. {الأشخاص}. الإجمالي SAR {total}. رمز التأكيد {code}." |
   | confirmed | "Booking confirmed" / "{service} is confirmed for {date} at {time}. Code {code}." | "تم تأكيد حجزك" / "تم تأكيد {service} يوم {date} الساعة {time}. رمز التأكيد {code}." |
   | declined | "Request declined" / "{service} could not take your booking for {date}.{ Reason: …} You have not been charged." | "تم رفض طلب الحجز" / "تعذّر على {service} قبول حجزك يوم {date}.{ السبب: …} لم يتم خصم أي مبلغ." |
   | expired | "Request expired" / "The provider of {service} did not respond within 48 hours, so your request for {date} was closed." | "انتهت صلاحية الطلب" / "لم يرد مقدم {service} خلال 48 ساعة، لذا أُغلق طلبك ليوم {date}." |
   | cancelled | "Booking cancelled" / "{guest} cancelled {service} on {date} at {time}. Code {code}." | "تم إلغاء حجز" / "ألغى {guest} حجز {service} يوم {date} الساعة {time}. رمز التأكيد {code}." |
   | cancelled_admin | "Booking cancelled" / "Hasio support cancelled your booking of {service} on {date}.{ Reason: …}" | "تم إلغاء حجزك" / "ألغى فريق Hasio حجزك لـ{service} يوم {date}.{ السبب: …}" |
   | reminder | "Your booking is tomorrow" / "{service}, {date} at {time}. Code {code}." | "موعدك غدًا" / "{service}، يوم {date} الساعة {time}. رمز التأكيد {code}." |

   - Hours and days use the existing count style: "1 hour / N hours", "1 day / N days". In Arabic: «ساعة واحدة، ساعتان، 3 ساعات، 11 ساعة» and «يوم واحد، يومان، 3 أيام، 11 يومًا».
   - People: «شخص واحد، شخصان، 3 أشخاص، 11 شخصًا».
   - The email payment note for services reads "Payment is made directly to the provider." / «الدفع يتم مباشرة لمقدم الخدمة.».
   - `notifyBookingEvent` fills these fields from the service.
8. **`reviews/*`** (contract section 5): the `addReviewForUser` generalisation, the service queries, and `listMyReviewableServices`. Tests cover:
   - the exactly-one-target rule;
   - verification against a completed service booking of the same service, and not against another service or a pending booking;
   - the rating recompute and clear;
   - duplicate refusal.
9. **`users/push.ts`** and **`notifications/deliver.ts`** (contract section 6). Push tests fake `fetch` at the network boundary (`vi.stubGlobal("fetch", …)`):
   - the request body carries `priority: "high"` and `channelId: "default"`;
   - a `DeviceNotRegistered` token is deleted from `pushTokens`;
   - a token moved from user A to user B is gone from A;
   - the newest 5 are kept;
   - an invalid token is refused;
   - unregister is a no-op when signed out.

   Register and unregister get seams in `users/push.ts` (`registerPushTokenForUser`, `unregisterPushTokenForUser`) for the tests.
10. **`moderation/mutations.ts`**: accept `"ai_message"` (contract section 7), with a seam test for the length limits.

**Checks** (from the worktree, with the main repo's `node_modules` linked in): `npx vitest run convex` and `npx tsc -p convex --noEmit`, both green. Run `npx convex codegen` after adding `users/push.ts`, and commit `_generated`.

### Task B2: admin backend and account fixes (Opus agent, worktree from F, parallel with B1)

**Files** (this agent's only files)
- `convex/admin/*` + tests
- `convex/users/mutations.ts`, `convex/users/queries.ts`
- `convex/listings/mutations.ts`, `convex/listings/queries.ts`, `convex/listings/pricing.ts`
- `convex/moderation/queries.ts`

It must **not** touch B1's files. It may import from `convex/services/logic.ts` only after B1 has merged. Until then, it uses an inline copy of `validateServiceInput` in `convex/admin/serviceInput.ts`, and the coordinator swaps that copy for the import at merge time (see Part 1 merge).

**Build**, each test-first, with seams in `convex/admin/service.ts` so tests avoid `requireAdmin`:
1. **Listings:**
   - admin `createListing` / `updateListing` take pricing, and `null` clears (contract section 8);
   - `validatePricing` throws `ConvexError`;
   - `deleteMyListing` refuses while bookings are open;
   - `updateMyListing` accepts a `null` price and keeps a suspended listing suspended;
   - public listing queries hide suspended owners.

   Tests cover each item.
2. **Services admin:**
   - `adminListServices`, `adminGetService`, `adminUpdateService`, `suspendService`, `reinstateService`, `deleteService`, each logged;
   - the notify calls through F's `notifyUserEvent`.
3. **Approvals notify:** content, services, businesses (single and bulk), and `suspendListing` send the right event to the owner. Tests assert the notification row and the log row.
4. **Accounts:**
   - `rejectBusinessAccount`;
   - `approveBusinessAccount` refuses without a document and clears a rejection;
   - `saveBusinessDoc` clears a rejection;
   - `listPendingBusinesses` gains `hasDocument` and `accountRejectionReason`.
5. **Users:**
   - `setUserRoleAsAdmin` refuses the admin's own account and admin accounts, keeps `searchText` right, and logs;
   - `adminGetUser`.
6. **Bookings:** `adminListBookings` with the `kind` filter, search by code or phone, and service and listing summaries.
7. **Reviews:** `removeReview`, which recomputes the target's rating through F's `recomputeReviewTarget` and marks the report `actioned`.
8. **Paging bug:** `adminListListings`, `adminListUsers` and `listAdminActivity` move their post-page filters into `.filter()` before `.paginate()`, so a page is never empty while more rows match. Test with 30 rows where only the last 5 match and a page size of 10: the first page returns 5 rows.
9. **Dashboard:**
   - `getDashboardStats` returns each queue count once;
   - it returns `capped: boolean` where a count hit its read cap;
   - service bookings are labelled in `listAllBookings`.
10. **Readable errors:** every plain `Error` a person can trigger in `convex/admin/*`, `convex/users/mutations.ts` and `convex/listings/*` becomes a `ConvexError`, bilingual where a user sees it (the admin panel is Arabic, so Arabic first).
11. **`generateUploadUrl`:** admins get 500 a day.

**Checks:** `npx vitest run convex` and `npx tsc -p convex --noEmit`, both green.

### Part 1 merge (coordinator)

- [ ] Review both diffs in full: the error paths, and whether each refusal really reaches the person as `ConvexError` text.
- [ ] Merge B1, then B2, into `services-release` with `--no-ff`.
- [ ] Replace `convex/admin/serviceInput.ts` with the import of `validateServiceInput` from `convex/services/logic.ts`.
- [ ] `npx convex codegen`, then `npx vitest run` and `npm run typecheck:convex`. Expected: all green.
- [ ] `npx convex dev --once` pushes the functions to the **development** deployment. Never `deploy` to production in this plan.

---

### M0: shared pieces before Part 2 (coordinator, done in `68feacf`)

- `expo-notifications`, `expo-system-ui` and `expo-device` are installed at their SDK 57 versions with `npx expo install`, **before** the agents start, so the push code is written against the real typings. No `--fix` later: it could move other native versions.
- `lib/pushPrompt.ts` holds `maybeAskForPush`'s final signature with an empty body, so M1 and M2 can call it before M3 fills it in.
- The `nothingChangedYet` string exists once. M2 and M3 both use it, and a duplicate key would not compile.
- File ownership, from the design review:
  - M1 owns `app/(tabs)/_layout.tsx` and a new `stores/bookTabStore.ts`;
  - M3 owns a new `stores/pushStore.ts`;
  - nobody edits `stores/appStore.ts`;
  - M2 keeps `routeForNotificationData` exported while M3 moves `app/notifications.tsx` to `lib/notificationRoute.ts`.
- The agents' full instructions are the prompt files in the session scratchpad (common rules, M1, M2, M3 and A), which carry these decisions.

## Part 2: the clients, in parallel (four Opus agents, one worktree each, launched in one message)

**Every agent:**
- starts from the Part 1 merge commit;
- reads the design, the contract, this plan's section for its task, and `CLAUDE.md` "Mobile App Production Patterns";
- builds against the contract without guessing: if something it needs is missing, it records it in its report instead of inventing a backend function.

**Translations** (`hasio-mobile-app/constants/translations.ts`): each mobile agent adds its keys in one block per language, at its own anchor, so the three merges do not collide:
- **M1:** directly after `tabStay` in both `en` and `ar`.
- **M2:** directly after `postLodging` in both.
- **M3:** at the very end of each block.

Both languages get every key. The brand is "Hasio" in Arabic too.

**Checks agents may run** (with `node_modules` linked from the main repo): `npx vitest run <their test files>` only. **No** `tsc`, `lint`, `expo`, EAS, dev server or build: the coordinator runs those after merging (8 GB RAM).

### Task M1: travellers find and book services (mobile)

**Files** (this agent's only files)
- Create:
  - `components/services/ServicesList.tsx`
  - `components/services/ServiceCard.tsx`
  - `components/services/ServiceDetailSheet.tsx`
  - `components/services/ServiceBookingSheet.tsx`
  - `components/services/LocalServicesRail.tsx`
  - `lib/serviceDisplay.ts` + `lib/serviceDisplay.test.ts`
  - `lib/serviceBookingError.ts` + `lib/serviceBookingError.test.ts`
  - `app/reviews/service/[serviceId].tsx`
- Modify:
  - `components/screens/LodgingScreenContent.tsx`: the Book tab, with the switch and the Stays search and city filter
  - `components/screens/HomeScreenContent.tsx`: the rail only
  - `components/review/*`: generalise to a target of `{ listingId } | { serviceId }`
  - `app/reviews/[listingId].tsx`: the empty state
  - `hooks/useConvexData.ts`: service adapters
  - `constants/translations.ts`: the M1 block

**Build**
1. **The tab label** `tabStay` becomes "Book" / «احجز», with the same key.
2. **The Book tab** gets a two-segment switch at the top: "Stays" / «الإقامة» and "Services" / «الخدمات». The choice survives tab swipes (component state lifted to the screen).
   - Stays keeps today's list and adds a search field ("Search stays" / «ابحث عن إقامة») and a city filter (all 13, through `cityLabel`, plus "All cities" / «كل المدن»).
3. **`ServicesList`** reads `api.services.queries.listServices` and `searchServices`, debounced like Home, with Arabic folding from `lib/searchText.ts`.
   - Type chips: All plus the eight types, reusing the existing type label keys, horizontal and `inverted={isRTL}`.
   - A city filter.
   - Loading skeletons, and an empty state: "No services here yet" / «لا توجد خدمات هنا بعد», with "Try another city or type." / «جرّب مدينة أو نوعًا آخر.».
4. **`ServiceCard`** shows the image (or the sand fallback), title, type · city, the star only when `rating` exists, and a price line from `lib/serviceDisplay.ts`:
   - `formatServicePrice({ price, priceUnit }, lang)` gives "SAR 150 / hour" or «150 ريال / للساعة». Units: hour «للساعة», day «لليوم», booking «للحجز» (both `per_event` and `fixed`).
   - With no price: "Price on request" / «السعر عند التواصل».
   - `PressableScale` for the card.
5. **`ServiceDetailSheet`**, on `BottomSheet`, built like `ListingDetailSheet`:
   - photos, title, type, city;
   - "Offered by {name}" / «تقدمها {name}»;
   - languages, description, the price line, and "Up to {n} people" / «حتى {n} أشخاص», with the Arabic count forms from `countForm`;
   - `RatingSummary` + the latest 3 reviews + "See all" → `app/reviews/service/[serviceId].tsx`;
   - "Rate this service" / «قيّم هذه الخدمة» and Report (`ReportSheet`, `targetType: "service"`).

   The footer is **Book** / «احجز» when `bookable`. Otherwise it is **Contact** / «تواصل», which opens call or email from `contactPhone` / `contactEmail`.

   Every sub-sheet (book, rate, report, phone verification) renders **inside** this sheet's Modal (the iOS modal rules). An unverified phone gets `VerifyPhoneSheet` first, as the listing sheet does.
6. **`ServiceBookingSheet`**, on `BottomSheet`:
   - **The calendar** (`react-native-calendars`, the listing calendar's locale setup), from today.
   - **Start-time chips** from `lib/serviceDisplay.ts` `startTimes(date, now)`: 06:00 to 23:00 every 30 minutes. For today, only times after now + 60 minutes. Formatted with the locale; Arabic uses Latin digits, per the rest of the app.
   - **A stepper** for hours (1–12) or days (1–14), only when the unit asks.
   - **People** (1–`maxGroupSize`, default 20).
   - **A note:** "Anything the provider should know? (optional)" / «هل هناك ما يجب أن يعرفه مقدم الخدمة؟ (اختياري)».
   - **The footer** is the live `quoteService` total, "Total" / «الإجمالي», with the same held-height behaviour as `QuoteFooter`, and "Send booking request". Reuse the existing stay key and its Arabic.
   - **Under it:** "You won't be charged in the app. You pay the provider directly." / «لن يُخصم أي مبلغ في التطبيق. تدفع لمقدم الخدمة مباشرة.»
   - **The button is never faded.** Tapped too early, it calls `nudge()` on the missing piece: "Pick a day first" / «اختر اليوم أولًا», "Pick a start time" / «اختر وقت البدء».
   - **On success,** the sheet closes; after `onDismissed`, an `appAlert` shows "Request sent" / «تم إرسال الطلب" with "We'll tell you as soon as {provider} replies." / «سنخبرك فور رد {provider}.», and buttons "View my bookings" (→ `/bookings`) and "OK".
   - **Double-submit guard** with a ref. A dirty sheet asks "Discard changes?" as the stay sheet does.
7. **`lib/serviceBookingError.ts`** maps the English halves of `SERVICE_ERRORS` and `BOOKING_ERRORS.PHONE_REQUIRED` to keys:

   | Key | English | Arabic |
   |---|---|---|
   | `errorServiceUnavailable` | "This service isn't available right now." | «هذه الخدمة غير متاحة حاليًا.» |
   | `errorOwnService` | "You can't book your own service." | «لا يمكنك حجز خدمتك الخاصة.» |
   | `errorPastTime` | "That time has passed. Pick a later time." | «هذا الوقت مضى. اختر وقتًا لاحقًا.» |
   | `errorDuplicateServiceRequest` | "You already have a request for this service that day." | «لديك طلب قائم لهذه الخدمة في ذلك اليوم.» |
   | `errorTooManyPeople` | "That's more people than this service takes." | «هذا العدد أكبر مما تسمح به الخدمة.» |
   | `errorInvalidQuantity` | "Choose a valid number of hours or days." | «اختر عددًا صحيحًا من الساعات أو الأيام.» |

   Fallbacks: `errorPhoneRequired`, `errorDailyLimit` and `errorSessionExpired`, with `pleaseTryAgain` last. Test every mapping.
8. **Home:** `LocalServicesRail`, "Local services" / «خدمات محلية», with "See all" switching the Book tab to Services. Bookable services first, up to 10, `FlatList inverted={isRTL}`. It is hidden when there are none.
9. **Reviews:** the components take a `target`. `app/reviews/service/[serviceId].tsx` mirrors the listing screen. Both screens get an empty state: "No reviews yet" / «لا توجد تقييمات بعد», with "Be the first to share how it went." / «كن أول من يشارك تجربته.».

**Tests:** `lib/serviceDisplay.test.ts`:
- the price formats in both languages;
- `startTimes` for today at 10:10 gives 11:30 first; for tomorrow, 06:00 first;
- the unit labels.

`lib/serviceBookingError.test.ts`: every mapping.

### Task M2: bookings and the provider side (mobile)

**Files** (this agent's only files)
- `app/bookings/index.tsx`, `app/bookings/[id].tsx`
- `components/booking/BookingRow.tsx`, `components/booking/HostBookingCard.tsx`
- `lib/bookingDisplay.ts` + test
- `app/provider/bookings.tsx` (new), `app/provider/_layout.tsx`
- `components/screens/ProviderDashboardContent.tsx`
- `app/provider/post-service.tsx`, `app/provider/my-services.tsx`
- `lib/listingForm.ts` (the service part) + test, `lib/submitError.ts` + test
- `components/screens/VerificationScreenContent.tsx`
- `constants/translations.ts` (the M2 block)

**Build**
1. **My bookings** calls `getUserBookings({ includeServices: true })`. `BookingRow` renders a service row with:
   - the service image, title, "{date} at {time}" / «{date} الساعة {time}» and the quantity;
   - the quantity reads "1 hour/N hours", «ساعة واحدة/ساعتان/3 ساعات/11 ساعة», or days «يوم واحد/يومان/3 أيام/11 يومًا».

   Upcoming and past use the booking's start timestamp for services. Put that logic in `lib/bookingDisplay.ts` and test it.
2. **Booking detail** calls `getBooking({ bookingId, includeServices: true })`. For a service it shows:
   - "Provider" / «مقدم الخدمة» with "Call provider" / «اتصل بمقدم الخدمة» when `provider.phone` exists;
   - no directions;
   - the confirmation code;
   - Cancel until the start time, confirmed by "Cancel this request?" / «إلغاء هذا الطلب؟», "The provider will be told." / «سيتم إبلاغ مقدم الخدمة.»;
   - once completed, "How was it?" / «كيف كانت التجربة؟», which opens M1's review sheet with `{ serviceId }` and the `bookingId`.

   When `viewerRole` is `"provider"`, the detail shows the host-style actions.
3. **Provider inbox**, `app/provider/bookings.tsx`:
   - `getProviderBookings`, with Pending / Upcoming / Past filters reusing the host inbox keys;
   - `HostBookingCard` generalised to show a service booking: the service title, date and time, quantity, people, total, the guest's name and phone, and call;
   - confirm, decline with a reason (`DeclineReasonSheet`), complete and no-show call the same mutations;
   - the empty state "No booking requests yet" / «لا توجد طلبات حجز بعد», with "Requests for your services will appear here." / «ستظهر هنا طلبات الحجز لخدماتك.».

   Register the route in `app/provider/_layout.tsx`.
4. **Provider dashboard:** `getProviderStats` tiles:

   | Tile | English | Arabic |
   |---|---|---|
   | pending | "Pending requests" | «طلبات معلقة» |
   | upcoming | "Upcoming" | «القادمة» |
   | completedMonth | "Completed this month" | «المكتملة هذا الشهر» |
   | revenueMonth | "Revenue this month" | «الإيرادات هذا الشهر» |

   Plus a "Booking requests" / «طلبات الحجز» row with the pending count, which opens the inbox.
5. **Post / edit service:**
   - **Price:** "Price (SAR)" / «السعر (ريال)», a number field through `toLatinDigits`. Help text: "Travellers book at this price. Leave it empty to show Contact instead." / «يحجز المسافرون بهذا السعر. اتركه فارغًا لإظهار زر التواصل بدلًا من الحجز.».
   - **The unit chips** already exist.
   - **Group size:** "Maximum group size" / «أقصى عدد للأشخاص».
   - **City:** required, "City" / «المدينة», a picker of the 13 through `cityLabel`. The nudge text is "Choose the city you work in" / «اختر المدينة التي تعمل فيها».

   On save, it sends `price` / `maxGroupSize`, with `null` to clear in edit mode, and `city`. In edit mode, Save is never faded: with nothing changed it nudges "Nothing has changed yet" / «لم تغيّر شيئًا بعد». The form already warns that an edit goes back to review; keep that.

   `lib/submitError.ts` maps the new `SERVICE_ERRORS` English halves:
   - "Enter a whole price between 1 and 100,000 SAR." / «أدخل سعرًا صحيحًا بين 1 و100٬000 ريال.»
   - "Choose a city from the list." / «اختر مدينة من القائمة.»
   - "This service has open bookings, so it can't be deleted yet." / «لا يمكن حذف هذه الخدمة لأن لديها حجوزات قائمة.»

   Test the mappings and the form-to-args conversion in `lib/listingForm.test.ts`.
6. **My services:** a suspended service shows its status ("Suspended" / «موقوفة») and its `suspendedReason`. Delete refuses in the app when the server says there are open bookings, using the mapped message.
7. **Verification screen:** when `accountRejectionReason` is set, it shows:
   - "Your documents were not approved" / «لم تُعتمد وثائقك»;
   - "Reason: {reason}" / «السبب: {reason}»;
   - "Upload a new document" / «ارفع وثيقة جديدة».

   The upload flow is unchanged; the server clears the rejection.

**Tests:** `lib/bookingDisplay.test.ts` covers the service rows, the quantity labels in both languages, and upcoming or past around the start time. `lib/listingForm.test.ts` covers price, group size, city and `null` clearing. `lib/submitError.test.ts` covers the new mappings.

### Task M3: push, polish and the store build (mobile)

**Files** (this agent's only files)
- Create: `lib/push.ts`, `lib/notificationRoute.ts` + `lib/notificationRoute.test.ts`, `hooks/usePushRegistration.ts`, `components/PushPrompt.tsx`, `app.config.js`, `plugins/withoutPushEntitlement.js`
- Modify:
  - `app/_layout.tsx`: notification handler, tap listener, Android channel
  - `app/notifications.tsx`
  - `components/screens/SettingsScreenContent.tsx`
  - `app/auth.tsx`
  - `components/VerifyPhoneSheet.tsx` (or wherever it lives)
  - `app/business/post-lodging.tsx`, `app/business/post-destination.tsx`
  - `components/planner/ChatBubble.tsx`
  - `package.json`
  - `constants/translations.ts` (the M3 block at the end)
  - `assets/` (splash and adaptive icon)

**Build**
1. **Dependencies.** Add `expo-notifications` and `expo-system-ui` to `package.json`, at the versions listed for SDK 57 in `node_modules/expo/bundledNativeModules.json`. Read that file; do not run `npx expo install`, which would write into the shared `node_modules`. The coordinator installs after the merge.
2. **`app.config.js`** wraps `app.json` (`({ config }) => ({ ...config, … })`):
   - adds the `expo-notifications` plugin, with icon and colour;
   - sets `android.googleServicesFile` **only when** `./google-services.json` exists;
   - adds `plugins/withoutPushEntitlement.js`, which removes `aps-environment` from the iOS entitlements when `process.env.HASIO_IOS_PUSH === "off"`;
   - sets `userInterfaceStyle: "light"` (top level, and Android);
   - adds `expo-system-ui`;
   - sets `expo-secure-store` `faceIDPermission: false`;
   - adds `locales: { ar: "./locales/ar.json", en: "./locales/en.json" }`, with the photo-library usage text in both languages (create those two files).

   Keep `sdkVersion`, `version: "1.1.0"` and `runtimeVersion` untouched.
3. **`lib/push.ts`:**
   - `getPushTokenAsync()` returns the Expo token, using `projectId` from `Constants.expoConfig.extra.eas.projectId`, or `null` on a simulator or web, or when permission is not granted;
   - `ensureAndroidChannel()` creates a `default` channel with HIGH importance, named "Bookings" / «الحجوزات» by app language.
4. **`hooks/usePushRegistration.ts`:**
   - When signed in and permission is already granted, it gets the token and calls `api.users.push.registerPushToken` once per session per token.
   - `signOutWithPush()` calls `unregisterPushToken` before the existing sign-out. Wire it in Settings' sign-out and in delete-account.
5. **`PushPrompt`**, a `BottomSheet` explained before the system prompt:
   - title "Get booking updates?" / «هل تريد تنبيهات الحجز؟»;
   - guest body: "We'll tell you the moment your request is confirmed, and remind you the day before." / «سنخبرك فور تأكيد طلبك، ونذكّرك قبل الموعد بيوم.»;
   - host/provider body: "Get a notification the moment a booking request arrives, so it never expires unseen." / «استلم تنبيهًا فور وصول طلب حجز، حتى لا تنتهي صلاحيته دون أن تراه.»;
   - buttons "Turn on notifications" / «تفعيل التنبيهات» and "Not now" / «ليس الآن».

   **When it shows** (D14):
   - after a booking request is sent (stay or service), once the success alert has closed;
   - when a host or provider opens their inbox or dashboard;
   - never twice in 7 days (store the last-asked time in `appStore`), and never once the system permission is granted or permanently denied.

   Export `maybeAskForPush(context)` for M1 and M2's success paths. The coordinator wires the calls if the agents could not see it.
6. **Taps:** `lib/notificationRoute.ts` has the pure `routeForNotification(data, role)`:

   | `target` | Route |
   |---|---|
   | `booking` | `/bookings/{bookingId}` |
   | `host-inbox` | `/business/bookings` |
   | `provider-inbox` | `/provider/bookings` |
   | `my-listings` | `/business/my-listings` |
   | `my-services` | `/provider/my-services` |
   | `verification` | `/business/verification` or `/provider/verification`, by role |
   | missing `target` (older rows) | the old audience rule |

   `app/_layout.tsx` sets `setNotificationHandler` (banner + sound while in the foreground) and listens for taps, including a cold start via `getLastNotificationResponseAsync`, routing through it. `app/notifications.tsx` routes rows through the same function. Mark-read failures show "Couldn't update. Check your connection." / «تعذّر التحديث. تحقق من اتصالك.» instead of being swallowed.
7. **Settings:**
   - **A "Notifications" / «التنبيهات» row:**
     - shows "On" / «مفعّلة» or "Off" / «متوقفة»;
     - tapping it runs `PushPrompt`, or opens the system settings when denied: "Turn on in Settings" / «فعّلها من الإعدادات».
   - **A "Contact support" / «تواصل مع الدعم» row** opens `mailto:support@hasio.xyz` (open decision 3 may change the address; keep it in one constant).
   - **The Trips count is removed.**
   - **The legal links** (here and in `app/auth.tsx`) move to `https://hasio.net/privacy-policy.html` and `https://hasio.net/terms-of-service.html`. **Do not touch** `lib/auth.ts`'s `Origin: https://www.hasio.xyz` or the `phone.hasio.xyz` placeholder domain: those are identifiers, not links.
8. **Never-faded buttons.** Sign-in's Send code and Verify, `VerifyPhoneSheet`'s buttons, and Save in edit mode on `post-lodging` / `post-destination` stay solid and call `nudge()`:
   - "Enter your phone number" / «أدخل رقم جوالك»
   - "Enter the 6-digit code" / «أدخل الرمز المكوّن من 6 أرقام»
   - "Nothing has changed yet" / «لم تغيّر شيئًا بعد»

   Busy (a request in flight) is the only reason to fade.
9. **Planner Report** sends `reportContent({ targetType: "ai_message", targetId: message.id, reason, details: message.text })`. It thanks the user only on success; on failure: "Couldn't send the report. Try again." / «تعذّر إرسال البلاغ. حاول مرة أخرى.».
10. **Unused strings:** delete `detailBookSoon`, the Moments keys and `pushNotifications` (unless reused), in both languages.
11. **Splash and icon:**
    - the splash `backgroundColor` matches the icon's background, so there is no white square (read the image's corner pixel);
    - the Android `adaptiveIcon` uses the IconKitchen layered foreground/background from `assets/IconKitchen-Output/android/res` (copy the xxxhdpi PNGs into `assets/images/`), plus a `monochromeImage`;
    - the icon art itself is unchanged (D8).

**Tests:** `lib/notificationRoute.test.ts` covers every target, the role split for verification, and the old-row fallback.

### Task A: the admin panel (Opus agent)

**Files** (this agent's only files): `src/admin/**`.

It does not touch `src/App.jsx`, `src/main.jsx`, the landing page or `public/`.

**Build**, against contract section 8:
1. **Fixes:**
   1. `ListingForm.jsx` sends pricing to the fixed mutations, and clearing a field sends `null`.
   2. The coordinate bounds are latitude 16–33 and longitude 34–56 (Saudi Arabia), with a warning (not a block) when the point is more than 150 km from the chosen city's centre (the centres in `constants.js`, copied from the app's `cityCoordinates`).
   3. `WorkingHoursModal` allows a close time earlier than open, meaning overnight, labelled «(بعد منتصف الليل)».
   4. On the Listings, Users and Activity tabs, "Load more" shows while `!isDone`, and an empty page with more to come loads the next one by itself.
   5. `DashboardTab` has one row per queue and shows «الأرقام تقريبية» when `capped`.
   6. The header stats move inside the error boundary, so a failure shows an Arabic card, not the site's English page. `TabErrorBoundary` shows «تعذّر تحميل هذا القسم» with «إعادة المحاولة» and the technical detail folded.
   7. The host picker shows «المضيف الحالي: …», hides suspended accounts, and shows readable errors.
   8. «إتمام» on a pending booking asks first.
   9. Labels:
      - every raw status, source and "Unknown" gets an Arabic label from `constants.js`;
      - there is one set of role labels (صاحب منشأة، مقدم خدمة، سائح، مدير);
      - Al-Ahsa wording becomes المنطقة الشرقية.
   10. Knowledge "load more" beyond 200. Email captures get a CSV export button «تصدير CSV».
2. **New Services tab «الخدمات المنشورة»:**
   - `adminListServices`, with search and filters (type, city, status);
   - a detail drawer from `adminGetService`: photos, description, price and unit, group size, contact, owner, recent bookings, open reports;
   - edit (`adminUpdateService`), suspend with a reason, reinstate, and delete (confirm, then the `HAS_OPEN_BOOKINGS` message when refused).

   The pending-services approval tab gets the same drawer before approve / reject.
3. **Content approval** shows photos, description, price and contact in a drawer before approval.
4. **Bookings tab:**
   - `adminListBookings`, with «الكل / إقامات / خدمات» and status filters;
   - search by code or phone, and paging;
   - the service title for service rows;
   - the forced status change «تغيير الحالة (للدعم)» behind a confirmation that names the old and new status.
5. **Accounts:**
   - «رفض» with a required reason (`rejectBusinessAccount`);
   - rows without a document say «بدون وثيقة»;
   - the rejection reason shows.
6. **Reports:**
   - on a review report, «حذف التقييم» calls `removeReview` with the report id;
   - on a service report, «إيقاف الخدمة» calls `suspendService` (not reject);
   - the dialog tells the truth: «سيتم إشعار صاحب المحتوى».
7. **Users:**
   - a detail drawer from `adminGetUser`;
   - «تغيير الدور» with a confirmation, through `setUserRoleAsAdmin`.
8. **A new tab** has the standard head block (`.admin-page-head`, title, one-line subtitle with the count, primary action at the far end), per CLAUDE.md. It uses `useConfirm` / `useToast`, with loading, empty and error states. Never `window.confirm`.

**Checks:** `npx eslint src/admin` only. The coordinator builds.

---

## Part 3: integration and verification (coordinator)

- [ ] **Review** every agent's diff in full. Decide on every risk an agent raises: fix it test-first, or record why not.
- [ ] **Merge** M1, M2, M3 and A into `services-release` with `--no-ff`, one at a time. Resolve the translation blocks. Wire any `maybeAskForPush` call an agent could not.
- [ ] **Install:** nothing new, because M0 installed the three native modules. Check `git diff 550462e -- hasio-mobile-app/package.json`: it should show only `expo-device`, `expo-notifications` and `expo-system-ui`.
- [ ] **iOS push switch:** `npx expo config --type introspect` with `HASIO_IOS_PUSH=off` shows no `aps-environment`; without it, it shows the entitlement. With `EAS_BUILD_PROFILE=production` and no `google-services.json`, the config throws unless `HASIO_ANDROID_PUSH=off`.
- [ ] **Development client:** the installed one (`af661805`) cannot load code that imports the new native modules. Any phone check needs a new development build, and that is an EAS build: only on the owner's word. Say so in the report.
- [ ] **Checks,** one heavy process at a time, in the foreground. Expected: all green, and lint at no more than the documented 3 warnings.
  - root: `npx vitest run`, `npm run typecheck`, `npm run lint`, `npm run build`, and `(Select-String -Path dist/index.html -Pattern modulepreload).Count` = 0;
  - `hasio-mobile-app`: `npm run typecheck`, `npm run lint`, `npm run test`.
- [ ] **Development backend:** `npx convex dev --once`.
- [ ] **Smoke script** `scripts/smoke/services-e2e.mjs` (written by the coordinator while Part 2 runs), against development. It:
  - creates a tourist, a provider and an admin with email sign-up;
  - marks the phone verified and approves the provider (`npx convex run` internal mutations on dev only);
  - has the provider post a priced service, the admin approve it, the tourist quote and book it, the provider confirm it;
  - checks the push token row and the notification rows;
  - completes the booking through `completeFinishedStays` with a clock argument, and rates it verified;
  - checks that `getUserBookings` without `includeServices` does not return it;
  - deletes everything it made.

  Expected: every step prints OK.
- [ ] **Expo web smoke,** headless Chrome at 390×844 in English and in Arabic: Book tab → Services → a service sheet → booking sheet → pick a day, time and hours → quote shown → send (signed in on development) → My bookings shows it. Also Home's Local services row and Settings' Notifications and Support rows. Screenshots are saved to the scratchpad.
- [ ] **Admin smoke,** headless Chrome against Vite + development, signed in as the smoke admin:
  - create and edit a hotel with a nightly price;
  - approve and suspend a service;
  - reject an account;
  - remove a reported review;
  - search a booking by code.
- [ ] **Docs:**
  - `CLAUDE.md`: hasio.net and Cloudflare deploy commands, the backend tree, the Book tab, services booking, push, the admin tabs, the stale lines from design section 12, the pre-flight list;
  - `docs/SHIPPING.md`;
  - the device checklist: new checks for service booking, the provider inbox, push and tap routes;
  - memory notes.
- [ ] **Merge** `services-release` into `sdk-57` with `--no-ff`.
- [ ] **Report** to the owner: the result first, then what ran, the decisions, what is not verified (phone checks, push on real devices, iOS signing with push), and the open items. **No** production deploy, EAS build or store submission until the owner says "ship it".

## Summary

Travellers will be able to book guides, photographers and other local services in the app, the same way they book hotels.
Everyone will get phone notifications about their bookings, and the admin panel will be fixed and finished.
The app will be checked and ready for new store versions on iPhone and Android, waiting only for your go-ahead to publish.
