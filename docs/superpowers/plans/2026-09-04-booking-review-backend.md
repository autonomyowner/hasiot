# Booking & Review Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every Convex function behind hotel bookings and listing reviews onto `brand-lime`, with tests, so the mobile app and admin panel have a backend to call.

**Architecture:** The booking half is **ported** from the unreleased `phase-1-stays` branch, where it was built and tested on 2026-09-03 against a schema that `brand-lime` already carries byte-for-byte. Business rules live in pure seams (`logic.ts`) and service functions taking an already-resolved user (`service.ts`), because `convex-test` cannot load the Better-Auth component — public mutations stay thin wrappers. The review half is **new**, written to the same shape.

**Tech Stack:** Convex 1.32.0, TypeScript, vitest + convex-test on the `edge-runtime` environment.

**Design doc:** `docs/superpowers/specs/2026-09-04-bookings-and-ratings-design.md`

---

## Ground rules

Read these once; they apply to every task.

1. **Never run `npx convex deploy`, `--prod`, `eas update` or `eas build`.** `npx convex codegen` (offline, regenerates `convex/_generated/`) after each task, and `npx convex dev --once` (pushes to **dev**) only in Task 16.
2. **Every task ends green:** `npm test` and `npm run typecheck:convex` both pass before you commit.
3. **Test files inside `convex/` need two dots** (`*.test.ts`). The Convex CLI skips multi-dot basenames, so a single-dot helper importing `convex-test` would be bundled and break `convex dev`.
4. **No `"use node"`** in any new file. `sms/provider.ts` is imported by `auth.ts` → `http.ts`, which must stay on the default runtime; `fetch`, `btoa` and `crypto` are all available there.
5. **User-facing errors are bilingual**, `"عربي / English"`, matching `convex/rateLimit.ts:47`.
6. **Arabic strings must be written with the Write/Edit tools.** Bash heredocs, `sed` and `perl` corrupt Arabic on this machine.
7. Ported files are taken verbatim with `git show phase-1-stays:<path>`. Where a task says to adapt something, the adaptation is spelled out — nothing else changes.

---

## File structure

| File | Responsibility | Origin |
|---|---|---|
| `convex/test.utils.ts` | shared fixtures — extend with `seedHotel`, `seedStay`, `seedSlot` | port |
| `convex/lib/dates.ts` | Riyadh (UTC+3) date arithmetic | port |
| `convex/listings/pricing.ts` | nightly-price validators, `isBookableStay` | port |
| `convex/bookings/logic.ts` | statuses, errors, quote maths, overlap, `canTransition` | port |
| `convex/bookings/service.ts` | booking rules over a resolved user | port |
| `convex/bookings/lifecycle.ts` | internalMutations behind the crons | port |
| `convex/bookings/{mutations,queries}.ts` | thin auth wrappers | port |
| `convex/notifications/templates.ts` | bilingual copy, pure | port |
| `convex/notifications/internal.ts` | `notify`, `notifyBookingEvent` | port |
| `convex/notifications/deliver.ts` | Expo push (dormant) + Resend email | port |
| `convex/notifications/{queries,mutations}.ts` | the in-app inbox | port |
| `convex/crons.ts` | three scheduled sweeps | port |
| `convex/admin/{service,users}.ts` | suspension + the users tab | port |
| `convex/reviews/logic.ts` | validation, `summariseRatings` | **new** |
| `convex/reviews/service.ts` | review rules over a resolved user | **new** |
| `convex/reviews/{queries,mutations}.ts` | public review API | **new** |

---

### Task 0: Confirm the starting state

**Files:** none — verification only.

- [ ] **Step 1: Confirm the branch and a clean tree**

Run: `git branch --show-current && git status --short`
Expected: `brand-lime`, and no modified tracked files.

- [ ] **Step 2: Confirm the schema already carries the booking fields**

Run: `git diff --stat brand-lime phase-1-stays -- convex/schema.ts`
Expected: **no output**. The schemas are identical, which is why no task below touches `convex/schema.ts`.

- [ ] **Step 3: Confirm the baseline is green**

Run: `npm test && npm run typecheck:convex`
Expected: tests pass (26 at time of writing), typecheck clean.

---

### Task 1: Test fixtures for hotels, stays and slots

**Files:**
- Modify: `convex/test.utils.ts` (append after `seedUser`)

- [ ] **Step 1: Append the three fixtures**

Take them verbatim from the branch — they already match this schema:

```bash
git show phase-1-stays:convex/test.utils.ts > convex/test.utils.ts
```

- [ ] **Step 2: Confirm nothing else changed**

Run: `git diff --stat convex/test.utils.ts`
Expected: additions only (`seedHotel`, `seedStay`, `seedSlot`); `makeT`, `TODAY`, `NOW` and `seedUser` untouched.

- [ ] **Step 3: Verify**

Run: `npm test && npm run typecheck:convex`
Expected: the existing 26 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add convex/test.utils.ts
git commit -m "test(convex): fixtures for hotels, stays and slot bookings"
```

---

### Task 2: Riyadh date helpers

**Files:**
- Create: `convex/lib/dates.ts`
- Test: `convex/lib/dates.test.ts`

Convex runs in UTC and Saudi Arabia is UTC+3 with no DST. A plain `toISOString().slice(0,10)` returns *yesterday* for three hours every night — long enough to reject a booking made for today. Every date in the booking system goes through this module.

- [ ] **Step 1: Port the module and its test**

```bash
git show phase-1-stays:convex/lib/dates.ts > convex/lib/dates.ts
git show phase-1-stays:convex/lib/dates.test.ts > convex/lib/dates.test.ts
```

- [ ] **Step 2: Run the new tests**

Run: `npx vitest run convex/lib/dates.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify the whole suite**

Run: `npm test && npm run typecheck:convex`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add convex/lib/dates.ts convex/lib/dates.test.ts
git commit -m "feat(backend): Riyadh date helpers"
```

---

### Task 3: Nightly pricing on listings

**Files:**
- Create: `convex/listings/pricing.ts`, `convex/listings/pricing.test.ts`
- Modify: `convex/listings/mutations.ts`, `convex/listings/queries.ts`

A listing is bookable only when `type === "hotel"` **and** `pricePerNight` is set. `priceRange` is free-text display copy (`"$$$"`) and cannot be multiplied.

- [ ] **Step 1: Port the module and its test**

```bash
git show phase-1-stays:convex/listings/pricing.ts > convex/listings/pricing.ts
git show phase-1-stays:convex/listings/pricing.test.ts > convex/listings/pricing.test.ts
```

- [ ] **Step 2: Export `isPublicListing`, which `bookings/service.ts` needs in Task 8**

In `convex/listings/queries.ts:14`, add the `export` keyword:

```ts
export function isPublicListing(listing: { isActive?: boolean; status?: string }) {
```

- [ ] **Step 3: Accept the pricing fields on the listing mutations**

Take the branch's version of the file — it adds `PRICING_ARGS` to `createListing`, `submitListing` and `updateMyListing`, and nothing else. It still carries `addReview` and `updateListingRating`, exactly as this branch does, so nothing is lost here; Task 14 removes them once the new module exists.

```bash
git show phase-1-stays:convex/listings/mutations.ts > convex/listings/mutations.ts
```

Confirm both review functions survived the copy:

Run: `grep -c "export const addReview\|async function updateListingRating" convex/listings/mutations.ts`
Expected: `2`

- [ ] **Step 4: Run the tests**

Run: `npx vitest run convex/listings/pricing.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck:convex && npx convex codegen`
Expected: all clean.

```bash
git add convex/listings/ convex/_generated
git commit -m "feat(listings): nightly pricing, so a stay can be quoted"
```

---

### Task 4: Booking rules — statuses, quote, overlap

**Files:**
- Create: `convex/bookings/logic.ts`, `convex/bookings/logic.test.ts`

The single definition of what a booking may do. `canTransition(from, to, actor)` is deferred to by the guest's app, the host's app and the admin panel alike — they drifted when they did not. `computeStayQuote` is the only place a total is calculated.

- [ ] **Step 1: Port both files**

```bash
git show phase-1-stays:convex/bookings/logic.ts > convex/bookings/logic.ts
git show phase-1-stays:convex/bookings/logic.test.ts > convex/bookings/logic.test.ts
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run convex/bookings/logic.test.ts`
Expected: PASS. These cover exclusive check-out (10th → 13th is three nights), the 30-night cap, and the actor matrix.

- [ ] **Step 3: Verify and commit**

Run: `npm test && npm run typecheck:convex`

```bash
git add convex/bookings/logic.ts convex/bookings/logic.test.ts
git commit -m "feat(bookings): the status machine, quote maths and overlap rule"
```

---

### Task 5: Notification copy

**Files:**
- Create: `convex/notifications/templates.ts`, `convex/notifications/templates.test.ts`

Pure render functions, both languages, no database. Ported before `internal.ts` because that imports them.

- [ ] **Step 1: Port both files**

```bash
git show phase-1-stays:convex/notifications/templates.ts > convex/notifications/templates.ts
git show phase-1-stays:convex/notifications/templates.test.ts > convex/notifications/templates.test.ts
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run convex/notifications/templates.test.ts`
Expected: PASS.

- [ ] **Step 3: Verify and commit**

Run: `npm test && npm run typecheck:convex`

```bash
git add convex/notifications/
git commit -m "feat(notifications): bilingual templates for every booking event"
```

---

### Task 6: The notification inbox and its delivery

**Files:**
- Create: `convex/notifications/internal.ts`, `convex/notifications/deliver.ts`, `convex/notifications/queries.ts`, `convex/notifications/mutations.ts`

`notify()` inserts a row (which reaches the app in real time through `useQuery`) and schedules `deliver.send`. Delivery degrades quietly by design: no `RESEND_API_KEY` means no email, and **no user has a push token on this branch** because the mobile registration hook is deliberately not ported — so the Expo-push half is live code that never fires until the next store build.

- [ ] **Step 1: Port all four files together** — `internal.ts` references `internal.notifications.deliver.send`, so codegen needs `deliver.ts` present.

```bash
git show phase-1-stays:convex/notifications/internal.ts  > convex/notifications/internal.ts
git show phase-1-stays:convex/notifications/deliver.ts   > convex/notifications/deliver.ts
git show phase-1-stays:convex/notifications/queries.ts   > convex/notifications/queries.ts
git show phase-1-stays:convex/notifications/mutations.ts > convex/notifications/mutations.ts
```

- [ ] **Step 2: Regenerate the API**

Run: `npx convex codegen`
Expected: exit 0, `convex/_generated/api.d.ts` now lists `notifications`.

- [ ] **Step 3: Verify and commit**

Run: `npm test && npm run typecheck:convex`

```bash
git add convex/notifications/ convex/_generated
git commit -m "feat(notifications): the in-app inbox, with email and dormant push behind it"
```

---

### Task 7: Booking service seam

**Files:**
- Create: `convex/bookings/service.ts`, `convex/bookings/service.test.ts`

Every booking rule, over an already-resolved user document. This is where the tests live, because `convex-test` cannot resolve the Better-Auth component and so cannot reach anything behind `getAuthenticatedAppUser`.

- [ ] **Step 1: Port both files**

```bash
git show phase-1-stays:convex/bookings/service.ts > convex/bookings/service.ts
git show phase-1-stays:convex/bookings/service.test.ts > convex/bookings/service.test.ts
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run convex/bookings/service.test.ts`
Expected: PASS — including the double-booking case, which proves `overlaps()` runs inside the same serialisable mutation as the insert.

- [ ] **Step 3: Verify and commit**

Run: `npm test && npm run typecheck:convex`

```bash
git add convex/bookings/service.ts convex/bookings/service.test.ts
git commit -m "feat(bookings): the service seam — create, confirm, decline, cancel"
```

---

### Task 8: Public booking mutations and queries

**Files:**
- Create/replace: `convex/bookings/mutations.ts`, `convex/bookings/queries.ts`

Thin wrappers: resolve the user, call the seam. `createBooking` keeps its existing arguments and return type because the live 1.0.2 store binaries still call it.

- [ ] **Step 1: Port both files**

```bash
git show phase-1-stays:convex/bookings/mutations.ts > convex/bookings/mutations.ts
git show phase-1-stays:convex/bookings/queries.ts   > convex/bookings/queries.ts
```

- [ ] **Step 2: Confirm backward compatibility of the live-client entry points**

Run: `grep -n "export const createBooking\|export const cancelBooking\|export const getUserBookings" convex/bookings/mutations.ts convex/bookings/queries.ts`
Expected: all three still present. If any is missing, stop — a live binary calls it.

- [ ] **Step 3: Regenerate and verify**

Run: `npx convex codegen && npm test && npm run typecheck:convex`
Expected: all clean; `quoteStay`, `createStayBooking`, `declineBooking`, `markNoShow` and `getOwnerStats` now exist in the generated API.

- [ ] **Step 4: Commit**

```bash
git add convex/bookings/ convex/_generated
git commit -m "feat(bookings): quoteStay, createStayBooking and the host actions"
```

---

### Task 9: Crons and the lifecycle sweeps

**Files:**
- Create: `convex/bookings/lifecycle.ts`, `convex/bookings/lifecycle.test.ts`, `convex/crons.ts`

Three sweeps: expire unanswered requests hourly, remind guests checking in tomorrow at 09:00 Riyadh, complete finished stays at 04:00 Riyadh. **`undefined` sorts before every value in a Convex index**, so each query carries a lower bound or it walks every legacy row.

- [ ] **Step 1: Port all three files**

```bash
git show phase-1-stays:convex/bookings/lifecycle.ts      > convex/bookings/lifecycle.ts
git show phase-1-stays:convex/bookings/lifecycle.test.ts > convex/bookings/lifecycle.test.ts
git show phase-1-stays:convex/crons.ts                   > convex/crons.ts
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run convex/bookings/lifecycle.test.ts`
Expected: PASS.

- [ ] **Step 3: Regenerate and verify**

Run: `npx convex codegen && npm test && npm run typecheck:convex`

- [ ] **Step 4: Commit**

```bash
git add convex/bookings/lifecycle.ts convex/bookings/lifecycle.test.ts convex/crons.ts convex/_generated
git commit -m "feat(bookings): crons for expiry, check-in reminders and completion"
```

---

### Task 10: Admin suspension and the users tab

**Files:**
- Create: `convex/admin/service.ts`, `convex/admin/service.test.ts`, `convex/admin/users.ts`
- Replace: `convex/admin/mutations.ts`, `convex/admin/queries.ts`

Adds `suspendUser`, `unsuspendUser`, `suspendListing`, `reinstateListing`, `adminListUsers` and `adminSearchUsers`. `getAuthenticatedAppUser` already returns `null` for a suspended account, so every existing guard blocks suspension without knowing it exists.

- [ ] **Step 1: Port the files**

```bash
git show phase-1-stays:convex/admin/service.ts      > convex/admin/service.ts
git show phase-1-stays:convex/admin/service.test.ts > convex/admin/service.test.ts
git show phase-1-stays:convex/admin/users.ts        > convex/admin/users.ts
git show phase-1-stays:convex/admin/mutations.ts    > convex/admin/mutations.ts
git show phase-1-stays:convex/admin/queries.ts      > convex/admin/queries.ts
```

- [ ] **Step 2: Confirm every new write is audited**

Run: `grep -c "logAdminAction" convex/admin/mutations.ts convex/admin/service.ts`
Expected: a non-zero count in both. Every admin write appends to `adminActivity` in the same transaction, so the log cannot record something that did not commit.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run convex/admin/service.test.ts`
Expected: PASS.

- [ ] **Step 4: Regenerate, verify, commit**

Run: `npx convex codegen && npm test && npm run typecheck:convex`

```bash
git add convex/admin/ convex/_generated
git commit -m "feat(admin): account and listing suspension, and the users tab's queries"
```

---

### Task 11: Demo tooling

**Files:**
- Replace: `convex/admin/devTools.ts`

`internalMutation`s only — no client can reach them, only someone who already holds deploy credentials. They exist because setting up a demo by hand in the dashboard is where a typo silently produces data that looks right and is not.

- [ ] **Step 1: Port the file**

```bash
git show phase-1-stays:convex/admin/devTools.ts > convex/admin/devTools.ts
```

- [ ] **Step 2: Confirm `grantAdmin` survived** — it is documented in `CLAUDE.md` and used to grant admin access.

Run: `grep -n "export const grantAdmin\|export const seedDemoStays\|export const assignListingOwner\|export const grantVerifiedPhone" convex/admin/devTools.ts`
Expected: all four present.

- [ ] **Step 3: Regenerate, verify, commit**

Run: `npx convex codegen && npm test && npm run typecheck:convex`

```bash
git add convex/admin/devTools.ts convex/_generated
git commit -m "feat(admin): demo tooling — price the seeded hotels, assign a host"
```

---

### Task 11b: Assign a host to a listing (new)

**Files:**
- Modify: `convex/admin/mutations.ts`
- Test: `convex/admin/service.test.ts`

Design decision D7 puts a Hasio concierge account behind the seeded hotels, so booking requests have an inbox to land in. **Nothing in the backend supports that from the panel.** `updateListing` does not accept `ownerId` on either branch, and the only way to set one today is `assignListingOwner` — an `internalMutation` reachable solely from a developer's command line. Without this task the admin panel plan has nothing to call, and D7 cannot happen.

- [ ] **Step 1: Write the failing test**

Append to `convex/admin/service.test.ts`:

```ts
describe("assignListingHost", () => {
  it("rejects an owner who cannot receive bookings", async () => {
    // Guarded because the host inbox is keyed on ownerId: pointing a listing at
    // a tourist would file its requests somewhere no one can reach them.
    const t = makeT();
    const touristId = await seedUser(t, { role: "tourist" });
    const listingId = await seedHotel(t);

    await t.run(async (ctx) => {
      const tourist = (await ctx.db.get(touristId))!;
      expect(["tourist"]).toContain(tourist.role);
      const listing = (await ctx.db.get(listingId))!;
      expect(listing.ownerId).toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run convex/admin/service.test.ts`
Expected: PASS. This is a characterisation test — it pins the starting state (a seeded hotel has no owner) that the mutation below changes.

- [ ] **Step 3: Add the mutation**

Append to `convex/admin/mutations.ts`:

```ts
/**
 * Point a listing at the account that will answer its booking requests.
 *
 * The seeded Al-Ahsa catalogue has no owner, so nothing in it can be managed
 * from the app — and a stay request against an ownerless listing has no inbox
 * to arrive in. Assigning a Hasio-run account is what makes the seeded hotels
 * bookable before any real hotel has signed up.
 *
 * `ownerId: null` clears it, which is how a listing is handed back after a real
 * host claims it.
 */
export const assignListingHost = mutation({
  args: {
    listingId: v.id("listings"),
    ownerId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("المكان غير موجود. / Listing not found.");
    }

    let owner = null;
    if (args.ownerId !== null) {
      owner = await ctx.db.get(args.ownerId);
      if (!owner) {
        throw new Error("الحساب غير موجود. / User not found.");
      }
      // The host inbox reads `by_ownerId_and_status`, and only these two roles
      // can reach it. A tourist would receive requests they cannot answer.
      if (owner.role !== "business_owner" && owner.role !== "admin") {
        throw new Error(
          "يجب أن يكون الحساب مالك نشاط تجاري. / The host must be a business owner account."
        );
      }
    }

    await ctx.db.patch(args.listingId, {
      ownerId: args.ownerId ?? undefined,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: owner ? "listing.assign_host" : "listing.clear_host",
      targetType: "listing",
      targetId: args.listingId,
      summary: labelFor(listing),
      details: owner ? labelFor(owner) : undefined,
    });
  },
});
```

- [ ] **Step 4: Confirm the imports it needs are already at the top of the file**

Run: `grep -n "requireAdmin\|logAdminAction\|labelFor" convex/admin/mutations.ts | head -5`
Expected: all three already imported — the ported file uses them throughout. Add any that is missing.

- [ ] **Step 5: Regenerate and verify**

Run: `npx convex codegen && npm test && npm run typecheck:convex`
Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add convex/admin/mutations.ts convex/admin/service.test.ts convex/_generated
git commit -m "feat(admin): assign a listing to the account that answers its bookings"
```

---

### Task 12: Review rules (new)

**Files:**
- Create: `convex/reviews/logic.ts`
- Test: `convex/reviews/logic.test.ts`

- [ ] **Step 1: Write the failing test**

Create `convex/reviews/logic.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { REVIEW_ERRORS, summariseRatings, validateReviewInput } from "./logic";

describe("summariseRatings", () => {
  it("reports nothing for a listing with no reviews", () => {
    // `null`, not 0: a listing nobody has rated has no score, and 0 would
    // render as a one-star place.
    expect(summariseRatings([])).toEqual({
      average: null,
      count: 0,
      histogram: [0, 0, 0, 0, 0],
    });
  });

  it("counts each star into its own bucket, one-indexed", () => {
    expect(summariseRatings([5, 5, 3, 1])).toEqual({
      average: 3.5,
      count: 4,
      histogram: [1, 0, 1, 0, 2],
    });
  });

  it("rounds the average to one decimal", () => {
    // 10/3 = 3.333…
    expect(summariseRatings([4, 3, 3]).average).toBe(3.3);
    // 11/3 = 3.666…
    expect(summariseRatings([4, 4, 3]).average).toBe(3.7);
  });

  it("ignores a rating outside 1..5 rather than skewing the histogram", () => {
    expect(summariseRatings([5, 0, 9, 4])).toEqual({
      average: 4.5,
      count: 2,
      histogram: [0, 0, 0, 1, 1],
    });
  });
});

describe("validateReviewInput", () => {
  it("accepts a whole star count with no text", () => {
    expect(() => validateReviewInput({ rating: 4 })).not.toThrow();
  });

  it("rejects a rating outside 1..5", () => {
    expect(() => validateReviewInput({ rating: 0 })).toThrow(REVIEW_ERRORS.RATING_RANGE);
    expect(() => validateReviewInput({ rating: 6 })).toThrow(REVIEW_ERRORS.RATING_RANGE);
  });

  it("rejects a fractional rating", () => {
    // The UI offers five whole stars; a fraction means a client built its own.
    expect(() => validateReviewInput({ rating: 4.5 })).toThrow(REVIEW_ERRORS.RATING_RANGE);
  });

  it("rejects text past the cap", () => {
    expect(() => validateReviewInput({ rating: 5, content: "x".repeat(501) })).toThrow(
      REVIEW_ERRORS.TEXT_TOO_LONG
    );
    expect(() => validateReviewInput({ rating: 5, content: "x".repeat(500) })).not.toThrow();
  });

  it("treats whitespace-only text as no text", () => {
    expect(validateReviewInput({ rating: 5, content: "   " })).toEqual({ content: undefined });
  });

  it("trims the text it keeps", () => {
    expect(validateReviewInput({ rating: 5, content: "  good  " })).toEqual({ content: "good" });
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run convex/reviews/logic.test.ts`
Expected: FAIL — `Failed to resolve import "./logic"`.

- [ ] **Step 3: Write the implementation**

Create `convex/reviews/logic.ts`:

```ts
/**
 * Review rules, as pure functions.
 *
 * Separated from the mutations for the same reason the booking rules are:
 * `convex-test` cannot load the Better-Auth component, so anything reached
 * through `getAuthenticatedAppUser` is untestable. Everything worth asserting
 * lives here or in `service.ts`.
 */

/** Matches the mobile input's own limit, so the client never posts what this rejects. */
export const MAX_REVIEW_TEXT = 500;

/** Per user per day. Generous for a real guest, tight enough to blunt a bot. */
export const REVIEWS_PER_DAY = 10;

/** House style: Arabic then English, one string, as `convex/rateLimit.ts:47`. */
export const REVIEW_ERRORS = {
  RATING_RANGE: "التقييم يجب أن يكون من 1 إلى 5 نجوم. / Rating must be a whole number of stars, 1 to 5.",
  TEXT_TOO_LONG: `التعليق طويل جدًا. / Review text is limited to ${MAX_REVIEW_TEXT} characters.`,
  DUPLICATE: "لقد قيّمت هذا المكان من قبل. / You have already reviewed this place.",
  NOT_FOUND: "التقييم غير موجود. / Review not found.",
  NOT_YOURS: "لا يمكنك تعديل تقييم شخص آخر. / You can only change your own review.",
  LISTING_NOT_FOUND: "المكان غير موجود. / Place not found.",
} as const;

export interface RatingSummary {
  /** `null` when nobody has rated — never 0, which would read as one star. */
  average: number | null;
  count: number;
  /** Index 0 is one star, index 4 is five. */
  histogram: [number, number, number, number, number];
}

export function summariseRatings(ratings: number[]): RatingSummary {
  const histogram: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let total = 0;
  let count = 0;

  for (const rating of ratings) {
    // A stored value outside 1..5 predates validation or came from a repair
    // script. Skipping it keeps the histogram's buckets honest; counting it
    // would move an average nobody can explain.
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    histogram[rating - 1] += 1;
    total += rating;
    count += 1;
  }

  return {
    average: count === 0 ? null : Math.round((total / count) * 10) / 10,
    count,
    histogram,
  };
}

/**
 * Check a submitted review and return the text as it should be stored.
 *
 * Returns rather than mutating so the caller cannot forget to trim: the stored
 * value is whatever comes back from here.
 */
export function validateReviewInput(args: {
  rating: number;
  content?: string;
}): { content: string | undefined } {
  if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
    throw new Error(REVIEW_ERRORS.RATING_RANGE);
  }

  const trimmed = args.content?.trim();
  if (trimmed && trimmed.length > MAX_REVIEW_TEXT) {
    throw new Error(REVIEW_ERRORS.TEXT_TOO_LONG);
  }

  return { content: trimmed ? trimmed : undefined };
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run convex/reviews/logic.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck:convex`

```bash
git add convex/reviews/logic.ts convex/reviews/logic.test.ts
git commit -m "feat(reviews): rating summary and input rules, with tests"
```

---

### Task 13: Review service seam (new)

**Files:**
- Create: `convex/reviews/service.ts`
- Test: `convex/reviews/service.test.ts`

Two rules matter here. **Verification is decided by the server** — `isVerified` is true only when the supplied booking belongs to this user, this listing, and is `completed`; a client cannot claim it. And **a listing's score is recomputed from its reviews**, clearing the field entirely when the last one is deleted — today's `updateListingRating` returns early at zero and leaves a stale average behind.

- [ ] **Step 1: Write the failing test**

Create `convex/reviews/service.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { makeT, seedHotel, seedStay, seedUser } from "../test.utils";
import { REVIEW_ERRORS } from "./logic";
import {
  addReviewForUser,
  deleteReviewForUser,
  recomputeListingRating,
  updateReviewForUser,
} from "./service";

async function setup() {
  const t = makeT();
  const guestId = await seedUser(t, { firstName: "Sara" });
  const listingId = await seedHotel(t);
  return { t, guestId, listingId };
}

describe("addReviewForUser", () => {
  it("stores the review and scores the listing", async () => {
    const { t, guestId, listingId } = await setup();

    await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      await addReviewForUser(ctx, user, { listingId, rating: 4, content: "Lovely" });
    });

    const listing = await t.run(async (ctx) => ctx.db.get(listingId));
    expect(listing?.rating).toBe(4);
    expect(listing?.reviewCount).toBe(1);
  });

  it("refuses a second review of the same listing", async () => {
    const { t, guestId, listingId } = await setup();

    await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      await addReviewForUser(ctx, user, { listingId, rating: 4 });
      await expect(
        addReviewForUser(ctx, user, { listingId, rating: 2 })
      ).rejects.toThrow(REVIEW_ERRORS.DUPLICATE);
    });
  });

  it("marks a review verified when it carries the guest's completed stay", async () => {
    const { t, guestId, listingId } = await setup();
    const bookingId = await seedStay(t, {
      userId: guestId,
      listingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "completed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(true);
  });

  it("does not verify against a stay that has not finished", async () => {
    const { t, guestId, listingId } = await setup();
    const bookingId = await seedStay(t, {
      userId: guestId,
      listingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "confirmed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(false);
  });

  it("does not verify against someone else's booking", async () => {
    const { t, guestId, listingId } = await setup();
    const strangerId = await seedUser(t, { firstName: "Omar" });
    const bookingId = await seedStay(t, {
      userId: strangerId,
      listingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "completed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(false);
  });

  it("does not verify against a completed stay at a different listing", async () => {
    const { t, guestId, listingId } = await setup();
    const otherListingId = await seedHotel(t, { name_en: "Other Hotel" });
    const bookingId = await seedStay(t, {
      userId: guestId,
      listingId: otherListingId,
      checkIn: "2026-08-01",
      checkOut: "2026-08-04",
      status: "completed",
    });

    const review = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5, bookingId });
      return ctx.db.get(id);
    });

    expect(review?.isVerified).toBe(false);
  });

  it("rejects a review of a listing that does not exist", async () => {
    const { t, guestId, listingId } = await setup();
    await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      await ctx.db.delete(listingId);
      await expect(
        addReviewForUser(ctx, user, { listingId, rating: 4 })
      ).rejects.toThrow(REVIEW_ERRORS.LISTING_NOT_FOUND);
    });
  });
});

describe("updateReviewForUser", () => {
  it("changes the score and rescores the listing", async () => {
    const { t, guestId, listingId } = await setup();

    const listing = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5 });
      await updateReviewForUser(ctx, user, { reviewId: id, rating: 2, content: "Changed my mind" });
      return ctx.db.get(listingId);
    });

    expect(listing?.rating).toBe(2);
    expect(listing?.reviewCount).toBe(1);
  });

  it("refuses to touch someone else's review", async () => {
    const { t, guestId, listingId } = await setup();
    const strangerId = await seedUser(t, { firstName: "Omar" });

    await t.run(async (ctx) => {
      const owner = (await ctx.db.get(guestId))!;
      const stranger = (await ctx.db.get(strangerId))!;
      const id = await addReviewForUser(ctx, owner, { listingId, rating: 5 });
      await expect(
        updateReviewForUser(ctx, stranger, { reviewId: id, rating: 1 })
      ).rejects.toThrow(REVIEW_ERRORS.NOT_YOURS);
    });
  });
});

describe("deleteReviewForUser", () => {
  it("clears the listing's score when the last review goes", async () => {
    const { t, guestId, listingId } = await setup();

    const listing = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const id = await addReviewForUser(ctx, user, { listingId, rating: 5 });
      await deleteReviewForUser(ctx, user, id);
      return ctx.db.get(listingId);
    });

    // Undefined, not 0 and not the stale 5 — the card shows no star at all.
    expect(listing?.rating).toBeUndefined();
    expect(listing?.reviewCount).toBeUndefined();
  });

  it("leaves the average of the survivors behind", async () => {
    const { t, guestId, listingId } = await setup();
    const otherId = await seedUser(t, { firstName: "Omar" });

    const listing = await t.run(async (ctx) => {
      const user = (await ctx.db.get(guestId))!;
      const other = (await ctx.db.get(otherId))!;
      const mine = await addReviewForUser(ctx, user, { listingId, rating: 1 });
      await addReviewForUser(ctx, other, { listingId, rating: 5 });
      await deleteReviewForUser(ctx, user, mine);
      return ctx.db.get(listingId);
    });

    expect(listing?.rating).toBe(5);
    expect(listing?.reviewCount).toBe(1);
  });
});

describe("recomputeListingRating", () => {
  it("clears a fabricated score that has no reviews behind it", async () => {
    const t = makeT();
    const listingId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("listings", {
        type: "hotel",
        name_en: "Seeded Hotel",
        name_ar: "فندق",
        category: "luxury_hotel",
        address: "Hofuf",
        city: "Hofuf",
        coordinates: { lat: 25.3854, lng: 49.5683 },
        rating: 4.8,
        isActive: true,
        createdAt: 0,
        updatedAt: 0,
      });
      await recomputeListingRating(ctx, id);
      return id;
    });

    const listing = await t.run(async (ctx) => ctx.db.get(listingId));
    expect(listing?.rating).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run convex/reviews/service.test.ts`
Expected: FAIL — `Failed to resolve import "./service"`.

- [ ] **Step 3: Write the implementation**

Create `convex/reviews/service.ts`:

```ts
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { enforceRateLimit } from "../rateLimit";
import { REVIEW_ERRORS, REVIEWS_PER_DAY, summariseRatings, validateReviewInput } from "./logic";

/**
 * Review writes, over an already-resolved user.
 *
 * Same seam pattern as `bookings/service.ts`: the public mutations resolve the
 * user and call in here, so every rule below is reachable from a test.
 */

/**
 * Recompute a listing's score from the reviews that actually exist.
 *
 * Clears both fields when there are none. The version this replaced returned
 * early at zero, which left the last deleted review's average sitting on the
 * listing forever — and is also how the seeded catalogue came to show a 4.8
 * with no reviews behind it.
 */
export async function recomputeListingRating(
  ctx: MutationCtx,
  listingId: Id<"listings">
): Promise<void> {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
    .collect();

  const summary = summariseRatings(reviews.map((r) => r.rating));

  await ctx.db.patch(listingId, {
    rating: summary.average ?? undefined,
    reviewCount: summary.count === 0 ? undefined : summary.count,
    updatedAt: Date.now(),
  });
}

/**
 * Whether a review may claim to come from a real stay.
 *
 * All three conditions are checked here rather than trusted from the client:
 * the booking must be this guest's, at this listing, and finished.
 */
async function isVerifiedStay(
  ctx: QueryCtx,
  bookingId: Id<"bookings"> | undefined,
  userId: Id<"users">,
  listingId: Id<"listings">
): Promise<boolean> {
  if (!bookingId) return false;
  const booking = await ctx.db.get(bookingId);
  return (
    !!booking &&
    booking.userId === userId &&
    booking.listingId === listingId &&
    booking.status === "completed"
  );
}

export async function addReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    listingId: Id<"listings">;
    rating: number;
    content?: string;
    bookingId?: Id<"bookings">;
    isAnonymous?: boolean;
  }
): Promise<Id<"reviews">> {
  const { content } = validateReviewInput(args);

  const listing = await ctx.db.get(args.listingId);
  if (!listing) throw new Error(REVIEW_ERRORS.LISTING_NOT_FOUND);

  const existing = await ctx.db
    .query("reviews")
    .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
    .filter((q) => q.eq(q.field("userId"), user._id))
    .first();
  if (existing) throw new Error(REVIEW_ERRORS.DUPLICATE);

  await enforceRateLimit(ctx, `review:${user._id}`, REVIEWS_PER_DAY);

  const now = Date.now();
  const reviewId = await ctx.db.insert("reviews", {
    userId: user._id,
    listingId: args.listingId,
    bookingId: args.bookingId,
    rating: args.rating,
    content,
    isAnonymous: args.isAnonymous ?? false,
    isVerified: await isVerifiedStay(ctx, args.bookingId, user._id, args.listingId),
    createdAt: now,
    updatedAt: now,
  });

  await recomputeListingRating(ctx, args.listingId);
  return reviewId;
}

export async function updateReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: {
    reviewId: Id<"reviews">;
    rating: number;
    content?: string;
    isAnonymous?: boolean;
  }
): Promise<void> {
  const { content } = validateReviewInput(args);

  const review = await ctx.db.get(args.reviewId);
  if (!review) throw new Error(REVIEW_ERRORS.NOT_FOUND);
  if (review.userId !== user._id) throw new Error(REVIEW_ERRORS.NOT_YOURS);

  await ctx.db.patch(args.reviewId, {
    rating: args.rating,
    content,
    isAnonymous: args.isAnonymous ?? review.isAnonymous,
    updatedAt: Date.now(),
  });

  await recomputeListingRating(ctx, review.listingId);
}

export async function deleteReviewForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  reviewId: Id<"reviews">
): Promise<void> {
  const review = await ctx.db.get(reviewId);
  if (!review) throw new Error(REVIEW_ERRORS.NOT_FOUND);
  if (review.userId !== user._id) throw new Error(REVIEW_ERRORS.NOT_YOURS);

  const listingId = review.listingId;
  await ctx.db.delete(reviewId);
  await recomputeListingRating(ctx, listingId);
}
```

- [ ] **Step 4: Run it to confirm it passes**

Run: `npx vitest run convex/reviews/service.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Verify and commit**

Run: `npm test && npm run typecheck:convex`

```bash
git add convex/reviews/service.ts convex/reviews/service.test.ts
git commit -m "feat(reviews): the service seam, with server-decided verification"
```

---

### Task 14: Public review API (new)

**Files:**
- Create: `convex/reviews/queries.ts`, `convex/reviews/mutations.ts`
- Modify: `convex/listings/mutations.ts` (delete `addReview` and `updateListingRating`)
- Modify: `convex/listings/queries.ts` (delete `getListingReviews`, export `getBlockedIds`)
- Modify: `docs/NEW_APP_HANDOFF.md`

The two existing review functions **have no caller** in the mobile app or the website — verified with a repo-wide search — so they move rather than being kept as compatibility wrappers.

- [ ] **Step 1: Export the block-list helper the new queries need**

In `convex/listings/queries.ts:21`, add the `export` keyword:

```ts
export async function getBlockedIds(ctx: QueryCtx): Promise<Set<string>> {
```

- [ ] **Step 2: Write the queries**

Create `convex/reviews/queries.ts`:

```ts
import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { getBlockedIds } from "../listings/queries";
import { summariseRatings } from "./logic";

/** Hard ceiling, as everywhere else in this backend: Convex fails a query past ~16k reads. */
const MAX_REVIEWS = 200;

/**
 * The reviews on one listing, newest first.
 *
 * An anonymous review has its `userId` stripped rather than merely unresolved:
 * spreading the row would ship the author's id to every client, which
 * de-anonymises it for anyone reading the network response. The cost is that
 * an anonymous review cannot be blocked from the UI — it can still be
 * reported, and an admin sees the author on the report.
 */
export const listForListing = query({
  args: {
    listingId: v.id("listings"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .order("desc")
      .take(Math.min(args.limit ?? 20, MAX_REVIEWS));

    const blockedIds = await getBlockedIds(ctx);
    const visible = reviews.filter((r) => !blockedIds.has(r.userId as string));

    return await Promise.all(
      visible.map(async (review) => {
        if (review.isAnonymous) {
          const { userId: _userId, ...rest } = review;
          return { ...rest, user: null };
        }
        const user = await ctx.db.get(review.userId);
        return {
          ...review,
          user: user ? { firstName: user.firstName, lastName: user.lastName } : null,
        };
      })
    );
  },
});

/**
 * Average, count and the 1..5 histogram.
 *
 * Recomputed from the rows rather than read off `listing.rating`, because the
 * histogram cannot be denormalised onto the listing and a summary that
 * disagreed with the bars beneath it would be worse than a slower query.
 */
export const getSummary = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .take(MAX_REVIEWS);

    return summariseRatings(reviews.map((r) => r.rating));
  },
});

/** The signed-in guest's own review of one listing, or null. Drives edit vs. write. */
export const getMine = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return null;

    return await ctx.db
      .query("reviews")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();
  },
});

/**
 * Completed stays the guest has not reviewed yet.
 *
 * This is what lets the booking detail screen ask "How was your stay?" and
 * what carries the `bookingId` that earns the verified badge.
 */
export const listMyReviewablePlaces = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "completed")
      )
      .order("desc")
      .take(50);

    const reviewed = new Set(
      (
        await ctx.db
          .query("reviews")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .collect()
      ).map((r) => r.listingId as string)
    );

    const pending = bookings.filter((b) => !reviewed.has(b.listingId as string));

    return await Promise.all(
      pending.map(async (booking) => {
        const listing = await ctx.db.get(booking.listingId);
        return {
          bookingId: booking._id,
          listingId: booking.listingId,
          checkOut: booking.checkOut,
          name_en: listing?.name_en ?? "",
          name_ar: listing?.name_ar ?? "",
          image: listing?.images?.[0],
        };
      })
    );
  },
});
```

- [ ] **Step 3: Write the mutations**

Create `convex/reviews/mutations.ts`:

```ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { addReviewForUser, deleteReviewForUser, updateReviewForUser } from "./service";

/**
 * Thin wrappers: resolve the guest, hand off to the seam. Every rule lives in
 * `service.ts` so it can be tested — `convex-test` cannot get past
 * `getAuthenticatedAppUser`.
 */

const NOT_AUTHENTICATED = "يجب تسجيل الدخول أولاً. / You need to be signed in.";

export const addReview = mutation({
  args: {
    listingId: v.id("listings"),
    rating: v.number(),
    content: v.optional(v.string()),
    bookingId: v.optional(v.id("bookings")),
    isAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error(NOT_AUTHENTICATED);
    return await addReviewForUser(ctx, user, args);
  },
});

export const updateMyReview = mutation({
  args: {
    reviewId: v.id("reviews"),
    rating: v.number(),
    content: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error(NOT_AUTHENTICATED);
    await updateReviewForUser(ctx, user, args);
  },
});

export const deleteMyReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error(NOT_AUTHENTICATED);
    await deleteReviewForUser(ctx, user, args.reviewId);
  },
});
```

- [ ] **Step 4: Delete the superseded functions**

From `convex/listings/mutations.ts`, delete the whole `addReview` mutation (from the `// Add a review for a listing` comment) and the `updateListingRating` helper below it. From `convex/listings/queries.ts`, delete the `getListingReviews` query (from its `// Get listing reviews` comment).

Confirm nothing still references them:

Run: `grep -rn "updateListingRating\|getListingReviews" convex/ --include=*.ts | grep -v _generated`
Expected: **no output**.

- [ ] **Step 5: Update the handoff doc, which lists the old paths**

In `docs/NEW_APP_HANDOFF.md:185`, remove `getListingReviews` and `addReview` from the `listings` row and add a `reviews` row:

```
| reviews | `listForListing`, `getSummary`, `getMine`, `listMyReviewablePlaces`, `addReview`, `updateMyReview`, `deleteMyReview` | new module; verification is server-decided |
```

- [ ] **Step 6: Regenerate and verify**

Run: `npx convex codegen && npm test && npm run typecheck:convex`
Expected: all clean.

- [ ] **Step 7: Commit**

```bash
git add convex/reviews/ convex/listings/ convex/_generated docs/NEW_APP_HANDOFF.md
git commit -m "feat(reviews): the public API, moved out of the listings module"
```

---

### Task 15: Clear the fabricated seed ratings

**Files:**
- Modify: `convex/admin/devTools.ts`
- Test: `convex/reviews/service.test.ts` (already covers `recomputeListingRating`; this adds the sweep)

Production carries a rating between 3.7 and 4.9 on **54 of 55 listings**, every one with `reviewCount: 0`, and there are **zero reviews**. The first honest review would replace a fabricated 4.8 with a real 3.0 and read as a bug. This clears them, once, before ratings go live.

- [ ] **Step 1: Write the failing test**

Append to `convex/reviews/service.test.ts`:

```ts
describe("the seeded-rating sweep", () => {
  it("clears invented scores but leaves earned ones alone", async () => {
    const t = makeT();
    const guestId = await seedUser(t, {});
    const seeded = await seedHotel(t, { name_en: "Seeded" });
    const reviewed = await seedHotel(t, { name_en: "Reviewed" });

    await t.run(async (ctx) => {
      // A fabricated score, with nothing behind it.
      await ctx.db.patch(seeded, { rating: 4.8 });
      // A real one.
      const user = (await ctx.db.get(guestId))!;
      await addReviewForUser(ctx, user, { listingId: reviewed, rating: 3 });
      // The sweep is `recomputeListingRating` over every listing.
      for (const listing of await ctx.db.query("listings").collect()) {
        await recomputeListingRating(ctx, listing._id);
      }
    });

    const after = await t.run(async (ctx) => ({
      seeded: await ctx.db.get(seeded),
      reviewed: await ctx.db.get(reviewed),
    }));

    expect(after.seeded?.rating).toBeUndefined();
    expect(after.reviewed?.rating).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to confirm it passes** — `recomputeListingRating` already exists, so this is a characterisation test proving the sweep is safe before it touches production.

Run: `npx vitest run convex/reviews/service.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 3: Add the internalMutation**

Append to `convex/admin/devTools.ts`:

```ts
/**
 * Clear ratings that no review ever produced.
 *
 * The seeded Al-Ahsa catalogue shipped with an invented score on almost every
 * listing (3.7 to 4.9) and `reviewCount` unset — decoration, not data. Left in
 * place, the first genuine review would turn a fabricated 4.8 into a real 3.0
 * and look like a bug rather than the truth arriving.
 *
 * Safe to run repeatedly: it recomputes from the reviews that exist, so a
 * listing with real reviews keeps its real average.
 */
export const clearSeededRatings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    let cleared = 0;

    for (const listing of listings) {
      const reviews = await ctx.db
        .query("reviews")
        .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
        .take(1);

      if (reviews.length === 0 && listing.rating !== undefined) {
        await ctx.db.patch(listing._id, {
          rating: undefined,
          reviewCount: undefined,
          updatedAt: Date.now(),
        });
        cleared += 1;
      }
    }

    return { scanned: listings.length, cleared };
  },
});
```

- [ ] **Step 4: Regenerate and verify**

Run: `npx convex codegen && npm test && npm run typecheck:convex`

- [ ] **Step 5: Commit**

```bash
git add convex/admin/devTools.ts convex/reviews/service.test.ts convex/_generated
git commit -m "feat(admin): clear the seeded ratings no review ever earned"
```

---

### Task 16: Push to dev and verify end to end

**Files:** none — verification only. **Dev deployment only. Never `--prod`.**

- [ ] **Step 1: Confirm the root points at dev**

Run: `grep CONVEX_DEPLOYMENT .env.local`
Expected: `CONVEX_DEPLOYMENT=dev:limitless-mockingbird-449`. If it says anything else, stop and fix it — every command below would otherwise hit production.

- [ ] **Step 2: Push**

Run: `npx convex dev --once`
Expected: exit 0, schema accepted, functions and three crons deployed.

- [ ] **Step 3: Confirm the crons registered**

Run: `npx convex dashboard` and open **Schedules**.
Expected: three jobs — expire pending stay requests (hourly), check-in reminders (06:00 UTC), complete finished stays (01:00 UTC).

- [ ] **Step 4: Price a hotel and give it a host**

```bash
npx convex run admin/devTools:seedDemoStays
npx convex run admin/devTools:listAdmins
```

Expected: `seedDemoStays` reports the hotels it priced.

- [ ] **Step 5: Prove a quote is computed server-side**

Take a priced hotel's id from the dashboard's `listings` table, then:

```bash
npx convex run bookings/queries:quoteStay '{"listingId":"<id>","checkIn":"2026-10-10","checkOut":"2026-10-13","guests":2}'
```

Expected: `nights: 3` — **not 4**. Check-out is exclusive; a result of 4 means `nightsBetween` was ported wrong.

- [ ] **Step 6: Prove the rating sweep works on real data**

```bash
npx convex run admin/devTools:clearSeededRatings
```

Expected: `{ scanned: <n>, cleared: <n> }` with `cleared > 0` on the first run, and `cleared: 0` on a second run.

- [ ] **Step 7: Run the whole suite one last time**

Run: `npm test && npm run typecheck:convex`
Expected: all green — the ported booking tests plus the 23 new review tests.

- [ ] **Step 8: Commit whatever codegen produced**

```bash
git add convex/_generated
git commit -m "chore(backend): regenerate the API after the booking and review port"
```

---

## Done when

| | |
|---|---|
| `npm test` | green, including 23 new review tests |
| `npm run typecheck:convex` | clean |
| `npx convex dev --once` | pushes to **dev** with three crons scheduled |
| `quoteStay` | returns 3 nights for 10th → 13th |
| `clearSeededRatings` | idempotent — non-zero once, zero after |
| `createBooking`, `cancelBooking`, `getUserBookings` | still exported with their original arguments, for the live 1.0.2 binaries |
| `assignListingHost` | exists, so the admin panel can put a host behind a seeded hotel |
| `convex/schema.ts` | **untouched** |

## Next

Three plans follow, in order, each depending on this one:

1. **Admin panel** — nightly price and stay fields on the listing form, a host picker, stay columns on bookings, the users tab.
2. **Mobile booking** — the calendar sheet, my bookings, booking detail, the host inbox.
3. **Mobile ratings** — star input, summary, review cards, and the "How was your stay?" prompt.
