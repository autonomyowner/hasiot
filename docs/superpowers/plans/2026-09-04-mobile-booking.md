# Mobile Booking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guest picks dates on a hotel, sees a server-computed price, sends a request; the host confirms or declines from their phone; both sides see it.

**Architecture:** Ported from commit **`f7cf7d8`** on `phase-1-stays` — *not* the branch tip. The tip carries a later visual redesign that replaced the bookings list with a delegation to a `TripsScreenContent` that does not exist here. `f7cf7d8` is the last commit before the SDK 57 upgrade and that redesign, and every booking file except `app/bookings/index.tsx` is byte-identical between the two, so it is the safe source for all of them.

**Tech Stack:** Expo SDK 54, React Native 0.81, expo-router, Convex React hooks, `react-native-calendars` (pure JS).

**Depends on:** `docs/superpowers/plans/2026-09-04-booking-review-backend.md`, complete and pushed to dev.

**Design doc:** `docs/superpowers/specs/2026-09-04-bookings-and-ratings-design.md`

---

## Ground rules

1. **No new native modules.** This ships as an over-the-air update to binaries already on the App Store and Google Play, and a JS bundle referencing a native module the binary lacks **crashes on launch**. Only `react-native-calendars` may be added, because it is pure JS and travels inside the bundle.
2. **Do not touch `hasio-mobile-app/app.json`.** `version` must stay `1.0.2` — over-the-air updates target `runtimeVersion`, which equals `appVersion`, so bumping it sends the update to a binary nobody has, silently and with no error.
3. **Never run `eas update`, `eas build`, `npx convex deploy`, or anything with `--prod`.**
4. **Every new string goes into `constants/translations.ts` under BOTH `en` and `ar`.** The `TranslationKey` type is derived from the English object, so a missing Arabic key is a type error and a missing English one silently breaks every other key.
5. **Arabic must be written with the Write/Edit tools.** Bash heredocs, `sed` and `perl` corrupt Arabic on this machine. `git show > file` is byte-safe.
6. Use the app's own primitives: `appAlert` from `@/stores/dialogStore` (never `Alert.alert`), `ThemedTextInput`, `PressableScale`, `BackButton`, and the skeletons in `components/ui`.
7. Bottom padding: `TAB_BAR_CLEARANCE + insets.bottom` inside the tab pager only. New stack routes use `insets.bottom + 24`.
8. Each task ends with `npx tsc --noEmit` clean, run from `hasio-mobile-app/`.

---

## Three files that must be merged, never replaced

Work done on `brand-lime` this week diverged from the branch. Porting any of these wholesale would revert it:

| File | Why | What to do |
|---|---|---|
| `components/listing/ListingDetailSheet.tsx` | redesigned here — amenity icons, pinned Book bar (101 insertions / 117 deletions apart) | hand-wire ~20 lines (Task 7) |
| `constants/translations.ts` | this branch added filter and Book-bar keys the other does not have | merge keys, both languages (Task 4) |
| `components/ui/SkeletonScreens.tsx` | the lodging skeleton was rebuilt here for the new card | hand-add the booking skeletons (Task 10) |

---

## File structure

| File | Responsibility | Origin |
|---|---|---|
| `lib/haptics.ts` | three-verb feedback, **no-op shim** | **new** |
| `constants/motion.ts` | shared entrance/press presets | port |
| `lib/dates.ts` | Riyadh dates, mirrors the backend | port + test |
| `lib/bookingDisplay.ts` | status → label/action rules | port + test |
| `lib/bookingError.ts` | backend error → translation key | port |
| `lib/calendarLocale.ts` | Arabic month/day names for the calendar | port |
| `components/booking/*` | eight components — sheet, chip, stepper, notes, quote, row, host card, decline | port |
| `app/bookings/{_layout,index,[id]}.tsx` | the guest's own bookings | port |
| `app/business/bookings.tsx` | the host's inbox | port |
| `app/notifications.tsx` | the in-app inbox | port + edit |

---

### Task 1: The calendar dependency, a haptics shim, and motion presets

**Files:**
- Modify: `hasio-mobile-app/package.json`
- Create: `hasio-mobile-app/lib/haptics.ts`, `hasio-mobile-app/constants/motion.ts`

The branch's `lib/haptics.ts` does `await import("expo-haptics")` inside a try/catch. That is not safe here: Metro resolves dynamic imports **at build time**, so the package would have to be installed, and then its JS would sit in the bundle calling a native module the shipped binary does not contain. The shim below has the identical signature and does nothing, so every call site written against the real thing is already correct when a future native build adds it.

- [ ] **Step 1: Install the calendar**

Run from `hasio-mobile-app/`: `npx expo install react-native-calendars`
Expected: added to `dependencies`. It is pure JavaScript — no native module, so it is safe in an over-the-air update.

- [ ] **Step 2: Confirm nothing native came with it**

Run: `git diff hasio-mobile-app/package.json`
Expected: exactly one added dependency, `react-native-calendars`. If `expo-haptics`, `expo-notifications`, `expo-device` or `expo-blur` appear, remove them — each one would crash the shipped app.

- [ ] **Step 3: Write the shim**

Create `hasio-mobile-app/lib/haptics.ts`:

```ts
/**
 * Haptic feedback — currently a no-op.
 *
 * The real implementation needs `expo-haptics`, which is a native module. This
 * code ships as an over-the-air update to binaries already in the stores, and
 * a bundle that references a native module the binary lacks crashes on launch.
 *
 * The signature is the one the real version has, so every call site is already
 * written correctly: the next native build swaps this file's body for the
 * `expo-haptics` calls and nothing else changes.
 *
 * Three verbs, on purpose. "light" for a selection (a date, a tab), "success"
 * for the moment a request is accepted, "warning" before something the user
 * cannot take back. Anything finer becomes noise.
 */
export type HapticKind = "light" | "success" | "warning";

export async function haptic(_kind: HapticKind): Promise<void> {
  // Intentionally empty. See the note above before adding an import here.
}
```

- [ ] **Step 4: Port the motion presets**

```bash
git show f7cf7d8:hasio-mobile-app/constants/motion.ts > hasio-mobile-app/constants/motion.ts
```

These are Reanimated presets only — `react-native-reanimated` is already a dependency.

- [ ] **Step 5: Verify and commit**

Run from `hasio-mobile-app/`: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/package.json hasio-mobile-app/package-lock.json hasio-mobile-app/lib/haptics.ts hasio-mobile-app/constants/motion.ts
git commit -m "feat(mobile): the calendar, motion presets, and haptics stubbed for OTA"
```

---

### Task 2: Pure helpers

**Files:**
- Create: `lib/dates.ts` + `lib/dates.test.ts`, `lib/bookingDisplay.ts` + `lib/bookingDisplay.test.ts`, `lib/bookingError.ts`, `lib/calendarLocale.ts`

`lib/dates.ts` mirrors the backend's Riyadh helpers so the client and server agree on what "today" is — Saudi Arabia is UTC+3, so a device-local or UTC date disagrees with the server for three hours every night.

- [ ] **Step 1: Port all six files**

```bash
cd hasio-mobile-app
git show f7cf7d8:hasio-mobile-app/lib/dates.ts             > lib/dates.ts
git show f7cf7d8:hasio-mobile-app/lib/dates.test.ts        > lib/dates.test.ts
git show f7cf7d8:hasio-mobile-app/lib/bookingDisplay.ts    > lib/bookingDisplay.ts
git show f7cf7d8:hasio-mobile-app/lib/bookingDisplay.test.ts > lib/bookingDisplay.test.ts
git show f7cf7d8:hasio-mobile-app/lib/bookingError.ts      > lib/bookingError.ts
git show f7cf7d8:hasio-mobile-app/lib/calendarLocale.ts    > lib/calendarLocale.ts
```

- [ ] **Step 2: Add the notification route helper here rather than porting `lib/push.ts`**

`app/notifications.tsx` (Task 13) imports `routeForNotificationData` from `lib/push.ts`. That module is **not** being ported — it exists only to register push tokens, which needs `expo-notifications`. The one function needed from it is pure. Append to `lib/bookingDisplay.ts`:

```ts
/**
 * Where tapping a notification should land.
 *
 * Lives here rather than in a push module because it is pure routing and the
 * in-app inbox needs it whether or not push exists — push is only how a
 * notification reaches someone who is not already looking at the app.
 */
export function routeForNotificationData(
  data: { bookingId?: string; audience?: string } | undefined,
  isHost: boolean
): string {
  if (data?.audience === "owner" && isHost) return "/business/bookings";
  if (data?.bookingId) return `/bookings/${data.bookingId}`;
  return "/notifications";
}
```

- [ ] **Step 3: Check whether this app runs tests at all**

Run: `grep -n '"test"' hasio-mobile-app/package.json`
If there is no `test` script, add one — the two ported test files are worthless without a runner, and `vitest` is already used at the repo root:

```json
    "test": "vitest run",
```

Then create `hasio-mobile-app/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Only `lib/**` is tested. Nothing importing react-native runs under plain
 * Node, and a React Native test renderer is not worth its weight for a handful
 * of pure functions.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

Install the runner if it is missing: `npm install -D vitest`

- [ ] **Step 4: Run the tests**

Run from `hasio-mobile-app/`: `npm test`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/lib hasio-mobile-app/package.json hasio-mobile-app/package-lock.json hasio-mobile-app/vitest.config.ts
git commit -m "feat(mobile): Riyadh dates, booking display rules and error mapping, with tests"
```

---

### Task 3: Nightly rate on the client's data

**Files:**
- Modify: `hasio-mobile-app/types/index.ts`, `hasio-mobile-app/hooks/useConvexData.ts`

Without these the Book button can never appear: it is gated on `pricePerNight`, and the field is currently dropped between Convex and the UI.

- [ ] **Step 1: Add the fields to the `Lodging` type**

In `hasio-mobile-app/types/index.ts`, inside `interface Lodging`, after `priceRange: string;`:

```ts
  /** SAR per night. Absent on any listing a host has not priced — such a
   *  listing cannot be booked, only browsed. */
  pricePerNight?: number;
  currency?: string;
  maxGuests?: number;
```

- [ ] **Step 2: Carry them through the mapper**

In `hasio-mobile-app/hooks/useConvexData.ts`, find the lodging mapper containing `rating: l.rating || 0,` and add beside it:

```ts
    pricePerNight: l.pricePerNight,
    currency: l.currency,
    maxGuests: l.maxGuests,
```

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/types/index.ts hasio-mobile-app/hooks/useConvexData.ts
git commit -m "feat(mobile): carry the nightly rate through to the UI"
```

---

### Task 4: Copy, in both languages

**Files:**
- Modify: `hasio-mobile-app/constants/translations.ts`

**Merge, do not replace.** This branch already added filter keys (`filters`, `filterType`, `filterPlace`, `filterBudget`, `filterClear`, `filterApply`, `filterNoMatch`) and Book-bar keys (`detailBook`, `detailBookSoon`) that the source commit does not have. Overwriting the file deletes them and breaks the home filter and the lodging sheet.

- [ ] **Step 1: See exactly what the branch adds**

```bash
git diff brand-lime f7cf7d8 -- hasio-mobile-app/constants/translations.ts > /tmp/trans.diff
```
Read `/tmp/trans.diff`. The added lines are the booking, notification and host-inbox keys.

- [ ] **Step 2: Add every added key to both objects, using the Edit tool**

Insert the new **English** keys into the `en` object and the new **Arabic** keys into the `ar` object, keeping each group next to related existing keys. Do not remove any key that is currently there.

**Write Arabic with the Edit tool only.** A heredoc or `sed` will corrupt it, and the corruption is invisible until an Arabic-speaking user sees mojibake.

- [ ] **Step 3: Prove both objects have the same keys**

The `TranslationKey` type derives from `en`, so a key missing from `ar` is a type error — but a key missing from `en` fails silently. Run from `hasio-mobile-app/`:

```bash
node -e "const s=require('fs').readFileSync('constants/translations.ts','utf8');const g=n=>{const i=s.indexOf(n+': {');const b=s.slice(i);let d=0,j=b.indexOf('{');for(let k=j;k<b.length;k++){if(b[k]==='{')d++;if(b[k]==='}'){d--;if(!d){j=k;break}}}return new Set([...b.slice(0,j).matchAll(/^\s{4}(\w+):/gm)].map(m=>m[1]))};const en=g('en'),ar=g('ar');const miss=[...en].filter(k=>!ar.has(k)),extra=[...ar].filter(k=>!en.has(k));console.log('en',en.size,'ar',ar.size);console.log('missing from ar:',miss);console.log('missing from en:',extra)"
```
Expected: equal sizes, and both lists empty.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/constants/translations.ts
git commit -m "feat(mobile): booking, host inbox and notification copy in both languages"
```

---

### Task 5: The small booking components

**Files:**
- Create: `components/booking/BookingStatusChip.tsx`, `GuestStepper.tsx`, `BookingNotesField.tsx`, `QuoteFooter.tsx`

Two of these exist for reasons worth keeping in mind. `BookingNotesField` holds its own text in an uncontrolled ref and exposes a handle — with the value in the sheet's state, every keystroke re-rendered the calendar. `QuoteFooter` keeps its height and its last good total while a new quote is in flight, so changing dates does not collapse the footer and jump the layout.

- [ ] **Step 1: Port all four**

```bash
cd hasio-mobile-app
for f in BookingStatusChip GuestStepper BookingNotesField QuoteFooter; do
  git show "f7cf7d8:hasio-mobile-app/components/booking/$f.tsx" > "components/booking/$f.tsx"
done
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/components/booking
git commit -m "feat(mobile): status chip, guest stepper, notes field and quote footer"
```

---

### Task 6: The booking sheet

**Files:**
- Create: `components/booking/BookingSheet.tsx`

The calendar, the guest count, the notes and the live quote. The quote comes from the server on every date change — the client never computes a total.

- [ ] **Step 1: Port it**

```bash
git show f7cf7d8:hasio-mobile-app/components/booking/BookingSheet.tsx > hasio-mobile-app/components/booking/BookingSheet.tsx
```

- [ ] **Step 2: Confirm it imports nothing native**

Run: `grep -n "expo-haptics\|expo-notifications\|expo-device\|expo-blur" hasio-mobile-app/components/booking/BookingSheet.tsx`
Expected: **no output**. It imports `@/lib/haptics`, which is the shim from Task 1 — that is fine.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/components/booking/BookingSheet.tsx
git commit -m "feat(mobile): the booking sheet — calendar, guests, notes and a live quote"
```

---

### Task 7: Make the Book button real

**Files:**
- Modify: `hasio-mobile-app/components/listing/ListingDetailSheet.tsx`

**Hand edit only.** This file was rebuilt on `brand-lime` — amenity icons, a pinned price-and-Book bar — and is 101 insertions / 117 deletions away from the source. Porting it would revert that work. The bar already exists and is disabled with a "booking soon" label; this wires it up.

- [ ] **Step 1: Add the imports**

```tsx
import { useRouter } from "expo-router";
import { useConvexAuth } from "convex/react";
import { BookingSheet } from "@/components/booking/BookingSheet";
import { useConvexUser } from "@/hooks/useConvexUser";
```

Some may already be present — do not duplicate them.

- [ ] **Step 2: Add the state and handler inside the component**

```tsx
  const router = useRouter();
  const { isAuthenticated } = useConvexAuth();
  const { user } = useConvexUser();
  const [bookingOpen, setBookingOpen] = useState(false);

  // Three gates, in order of what the guest can do about them. A visitor is
  // sent to sign in; a signed-in guest with no verified number is asked for
  // one, because the host has to be able to phone them; everyone else books.
  const handleBook = () => {
    if (!isAuthenticated) {
      onClose();
      router.push("/auth");
      return;
    }
    if (!user?.phoneVerified) {
      onClose();
      router.push("/auth");
      return;
    }
    setBookingOpen(true);
  };
```

- [ ] **Step 3: Point the existing button at it**

Find the Book button in the pinned bar — it currently renders `t("detailBookSoon")` and has no `onPress`. Replace its `disabled` state with a live press:

```tsx
                <Pressable
                  style={styles.bookButton}
                  onPress={handleBook}
                  accessibilityRole="button"
                  accessibilityLabel={t("detailBook")}
                >
                  <Text style={styles.bookButtonText}>{t("detailBook")}</Text>
                </Pressable>
```

Delete the `t("detailBookSoon")` line beneath the price. Leave the `detailBookSoon` translation key in place — Task 8's list uses it for a listing with no rate.

- [ ] **Step 4: Render the sheet**

Beside the other sheets near the end of the component's JSX:

```tsx
      <BookingSheet
        visible={bookingOpen}
        item={item}
        onClose={() => setBookingOpen(false)}
      />
```

Check `BookingSheet`'s actual prop names and match them.

- [ ] **Step 5: Confirm the bar only appears where a booking is possible**

`showBookBar` is already `!!(item?.bookable && item.priceLine)`. Confirm the lodging mappers set `bookable` only when `pricePerNight` exists:

Run: `grep -n "bookable" hasio-mobile-app/components/screens/*.tsx hasio-mobile-app/components/listing/ListingDetailSheet.tsx`
Expected: `bookable` set from a nightly rate, not from the listing type alone. Fix any mapper that sets it unconditionally.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/components/listing/ListingDetailSheet.tsx
git commit -m "feat(mobile): the Book button opens the booking sheet"
```

---

### Task 8: My bookings

**Files:**
- Create: `app/bookings/_layout.tsx`, `app/bookings/index.tsx`, `components/booking/BookingRow.tsx`

**Source `index.tsx` from `f7cf7d8`, not the branch tip.** The tip's version is a twelve-line delegation to a `TripsScreenContent` introduced by a later redesign that is not being ported; the real 169-line screen is at `f7cf7d8`.

- [ ] **Step 1: Port all three**

```bash
cd hasio-mobile-app
git show f7cf7d8:hasio-mobile-app/app/bookings/_layout.tsx        > app/bookings/_layout.tsx
git show f7cf7d8:hasio-mobile-app/app/bookings/index.tsx          > app/bookings/index.tsx
git show f7cf7d8:hasio-mobile-app/components/booking/BookingRow.tsx > components/booking/BookingRow.tsx
```

- [ ] **Step 2: Confirm you took the real screen, not the shim**

Run: `wc -l hasio-mobile-app/app/bookings/index.tsx`
Expected: **169**. If it says 12, you took it from the tip — redo Step 1.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/app/bookings hasio-mobile-app/components/booking/BookingRow.tsx
git commit -m "feat(mobile): my bookings — upcoming and past"
```

---

### Task 9: Booking detail

**Files:**
- Create: `app/bookings/[id].tsx`

Status, dates, nights, guests, total, the confirmation code, and cancel-before-check-in.

- [ ] **Step 1: Port it**

```bash
git show "f7cf7d8:hasio-mobile-app/app/bookings/[id].tsx" > "hasio-mobile-app/app/bookings/[id].tsx"
```

- [ ] **Step 2: It references a skeleton that arrives in Task 10**

`SkeletonBookingDetail` does not exist yet, so `tsc` will fail here. That is expected. Either do Task 10 first, or accept the single unresolved import and verify at the end of Task 10.

- [ ] **Step 3: Commit**

```bash
git add "hasio-mobile-app/app/bookings/[id].tsx"
git commit -m "feat(mobile): booking detail, with cancel before check-in"
```

---

### Task 10: Booking skeletons

**Files:**
- Modify: `hasio-mobile-app/components/ui/SkeletonScreens.tsx`

**Hand-add, do not replace the file.** Its lodging skeleton was rebuilt on `brand-lime` to match the new photo card, and porting the whole file would revert that.

- [ ] **Step 1: Extract just the booking skeletons from the source**

```bash
git show f7cf7d8:hasio-mobile-app/components/ui/SkeletonScreens.tsx > /tmp/skel-source.tsx
```

Read `/tmp/skel-source.tsx` and find `SkeletonBookingList` and `SkeletonBookingDetail` and any styles they use.

- [ ] **Step 2: Append them to the current file**

Add the two components and their styles to `hasio-mobile-app/components/ui/SkeletonScreens.tsx`, keeping the existing `SkeletonListingCard`, `SkeletonList`, `SkeletonHomeSections` and `SkeletonOwnerList` exactly as they are. Reuse the file's existing `Skeleton`, `SkeletonLine` and `sweepPhase` rather than redefining them.

- [ ] **Step 3: Confirm the lodging skeleton is untouched**

Run: `git diff hasio-mobile-app/components/ui/SkeletonScreens.tsx | grep "^-" | grep -v "^---"`
Expected: **no output** — additions only. Any deletion means the port reached too far.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0, including `app/bookings/[id].tsx` from Task 9.

```bash
git add hasio-mobile-app/components/ui/SkeletonScreens.tsx
git commit -m "feat(mobile): skeletons shaped like the booking list and detail"
```

---

### Task 11: The host's inbox

**Files:**
- Create: `components/booking/HostBookingCard.tsx`, `components/booking/DeclineReasonSheet.tsx`, `app/business/bookings.tsx`
- Modify: `app/business/_layout.tsx`

One-tap confirm, decline with a reason, and the guest's phone number as a tappable link — the host phoning the guest is the whole point of requiring a verified number.

- [ ] **Step 1: Port the three files**

```bash
cd hasio-mobile-app
git show f7cf7d8:hasio-mobile-app/components/booking/HostBookingCard.tsx   > components/booking/HostBookingCard.tsx
git show f7cf7d8:hasio-mobile-app/components/booking/DeclineReasonSheet.tsx > components/booking/DeclineReasonSheet.tsx
git show f7cf7d8:hasio-mobile-app/app/business/bookings.tsx                 > app/business/bookings.tsx
```

- [ ] **Step 2: Register the route**

In `hasio-mobile-app/app/business/_layout.tsx`, add beside the other screens:

```tsx
        <Stack.Screen name="bookings" />
```

- [ ] **Step 3: `HostBookingCard` imports `formatPhoneForDisplay` from `@/lib/phone`**

Check whether that file exists: `ls hasio-mobile-app/lib/phone.ts`

If it does not, port it — it is pure and has tests:
```bash
git show f7cf7d8:hasio-mobile-app/lib/phone.ts      > hasio-mobile-app/lib/phone.ts
git show f7cf7d8:hasio-mobile-app/lib/phone.test.ts > hasio-mobile-app/lib/phone.test.ts
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit` and `npm test`
Expected: both clean.

```bash
git add hasio-mobile-app/components/booking hasio-mobile-app/app/business hasio-mobile-app/lib
git commit -m "feat(mobile): the host's booking inbox — confirm, decline, call the guest"
```

---

### Task 12: Real numbers for hosts, and a rate they can set

**Files:**
- Modify: `components/screens/BusinessDashboardContent.tsx`, `app/business/post-lodging.tsx`

The dashboard's stat cards are currently hardcoded `"—"` and `"0"`. And a host cannot price their own listing, which means only admin-created hotels could ever be booked.

- [ ] **Step 1: See what the branch changed in each**

```bash
git diff brand-lime f7cf7d8 -- hasio-mobile-app/components/screens/BusinessDashboardContent.tsx hasio-mobile-app/app/business/post-lodging.tsx
```

- [ ] **Step 2: Apply those changes by hand**

`BusinessDashboardContent.tsx` gains `useQuery(api.bookings.queries.getOwnerStats, isSignedIn ? {} : "skip")` and a row linking to `/business/bookings`. `post-lodging.tsx` gains nightly rate, max guests, unit count and check-in/check-out fields, validated before submit.

Apply the diff by hand rather than checking the files out: both were touched on `brand-lime` by this week's design work.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/components/screens/BusinessDashboardContent.tsx hasio-mobile-app/app/business/post-lodging.tsx
git commit -m "feat(mobile): real host numbers, and a nightly rate a host can set"
```

---

### Task 13: The notification inbox

**Files:**
- Create: `app/notifications.tsx`
- Modify: `components/screens/SettingsScreenContent.tsx`

Push is not part of this release, so the in-app inbox is the only place a notification appears. It is also the one that always works.

- [ ] **Step 1: Port the screen**

```bash
git show f7cf7d8:hasio-mobile-app/app/notifications.tsx > hasio-mobile-app/app/notifications.tsx
```

- [ ] **Step 2: Repoint its one push import**

Line 13 imports `routeForNotificationData` from `@/lib/push`, which is not being ported. Change it to the copy added in Task 2:

```tsx
import { routeForNotificationData } from "@/lib/bookingDisplay";
```

- [ ] **Step 3: Confirm nothing else reaches for push**

Run: `grep -rn "lib/push\|expo-notifications\|usePushRegistration" hasio-mobile-app/app hasio-mobile-app/components hasio-mobile-app/hooks`
Expected: **no output**. Any hit would crash the shipped binary.

- [ ] **Step 4: Add the two rows to Settings**

In `components/screens/SettingsScreenContent.tsx`, add a row opening `/bookings` and one opening `/notifications`, matching the existing rows' shape (`icon`, label from `t(...)`, `onPress`). Use the keys added in Task 4. Keep the current spacing and grouping — this screen was reworked on `brand-lime` this week.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit`
Expected: exit 0.

```bash
git add hasio-mobile-app/app/notifications.tsx hasio-mobile-app/components/screens/SettingsScreenContent.tsx
git commit -m "feat(mobile): the notification inbox, reachable from settings"
```

---

### Task 14: Register the routes and check the whole thing builds

**Files:**
- Modify: `hasio-mobile-app/app/_layout.tsx`

- [ ] **Step 1: Add the two stack screens**

In `hasio-mobile-app/app/_layout.tsx`, beside the existing `<Stack.Screen>` entries:

```tsx
        <Stack.Screen name="bookings" />
        <Stack.Screen name="notifications" />
```

Do **not** add `usePushRegistration` — the branch's version of this file calls it, and it needs `expo-notifications`.

- [ ] **Step 2: Confirm no native module crept in anywhere**

Run: `git diff main -- hasio-mobile-app/package.json`
Expected: the only added dependency across this whole plan is `react-native-calendars` (plus `vitest` as a devDependency, which never ships).

- [ ] **Step 3: Confirm the version is untouched**

Run: `grep '"version"' hasio-mobile-app/app.json`
Expected: `"version": "1.0.2"`. If it changed, the over-the-air update would reach nobody.

- [ ] **Step 4: Full verification**

Run from `hasio-mobile-app/`:
```bash
npx tsc --noEmit && npm test && npx expo export --platform android
```
Expected: all three exit 0. The export is the real proof — it resolves every import the way the device will.

- [ ] **Step 5: Commit**

```bash
git add hasio-mobile-app/app/_layout.tsx
git commit -m "feat(mobile): register the bookings and notifications routes"
```

---

## Done when

| | |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm test` | passing (dates, booking display, phone) |
| `npx expo export --platform android` | exit 0 |
| `package.json` vs `main` | one new dependency, `react-native-calendars` |
| `app.json` version | still **1.0.2** |
| `grep -rn "expo-notifications\|expo-haptics\|expo-blur\|expo-device" app components hooks` | no output |
| `app/bookings/index.tsx` | 169 lines, not 12 |
| `ListingDetailSheet.tsx`, `translations.ts`, `SkeletonScreens.tsx` | merged, with this week's work intact |

## Manual run-through, in Expo Go against dev

Point `hasio-mobile-app/.env.local` at the dev deployment first, and **delete it again before any release**.

1. Sign in, open a priced hotel, tap **Book**.
2. Pick a Thursday and the Sunday after — the footer must read **3 nights**, not 4.
3. Submit. The request appears under *My bookings* as pending, with a code.
4. Sign in as the host account, open the inbox, confirm it.
5. Back as the guest: the status is confirmed, and the notification is in the inbox.
6. Repeat the first three steps in Arabic and check the calendar reads right-to-left.

## Next

`docs/superpowers/plans/` — the mobile ratings plan: star input, rating summary, review cards, and the "How was your stay?" prompt on a completed booking.
