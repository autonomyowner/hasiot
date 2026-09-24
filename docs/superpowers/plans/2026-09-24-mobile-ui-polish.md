# Mobile app UI/UX polish — audit findings and fix plan (2026-09-24)

Branch: `ui-polish` (from `sdk-57`). Owner's request, verbatim: "check the mobile app and make sure
everything is perfect the uiux buttons swiping smoothness popups etc".

Six read-only reviewers audited the app by area (Home/Stay, listing sheet + booking + reviews,
Planner + Favorites, Profile + sign-in, business + provider, app shell + popups). About 150
findings; this file is the accepted list, what is already done, and who fixes the rest. Paths are
relative to `hasio-mobile-app/`. Line numbers are approximate — re-read the code, it has moved.

## House rules every fixer follows

- **JS only.** The JS ships over the air to binaries that do not contain new native modules. Do not
  add dependencies. `lib/haptics.ts` stays a no-op.
- **Explain why in comments and commit messages** — read `hooks/useKeyboardOverlap.ts` for the house
  style. A fix that does not say what was actually wrong is not finished.
- **RTL is manual.** No `I18nManager.forceRTL`: layout is always LTR natively, Arabic is handled
  with `isRTL` + `row-reverse` + `textAlign: "right"`. Everything directional must be flipped by hand.
- **Lime is a fill** (`colors.primary.DEFAULT`); text/icons on it are `colors.ink`. Lime *as text* on
  a light background is `colors.primary.deep`.
- **Styles** through `useThemedStyles(makeStyles)`. In Arabic it now zeroes `letterSpacing` and raises
  any `lineHeight` below 1.4× `fontSize` automatically — do not add per-style Arabic tracking fixes.
- **Popups:** use `components/ui/BottomSheet.tsx` for any bottom sheet (fading backdrop, UI-thread
  slide, keyboard handling on both platforms, its own `AppDialogHost`, drag handle, `onDismissed`).
  **On iOS nothing can be presented while another Modal is presenting or dismissing, and a Modal
  presents from the nearest view controller** — so a sheet opened from inside another Modal must be
  rendered *inside* that Modal, and "close A, then open B / then alert" must wait for A's
  `onDismissed` (iOS `Modal onDismiss`; Android: immediately).
- **Alerts:** `appAlert()` from `@/stores/dialogStore`. Never `Alert.alert`.
- **Press feedback on everything tappable**: `PressableScale` for cards, or
  `style={({ pressed }) => [..., pressed && styles.pressed]}` with `pressed: { opacity: 0.7 }`.
  Icon-only buttons: ≥44pt target (size or `hitSlop`) and an `accessibilityLabel`.
- **Numbers typed by users** go through `toLatinDigits()` (`lib/digits.ts`) before `Number()` or a
  `\d` regex — an Arabic keypad types ٠١٢…
- **Leaving unsaved forms:** `useLeaveGuard(active)` (`hooks/useLeaveGuard.ts`).
- **Busy buttons:** `<Button loading>` keeps the size and shows a spinner.
- **New strings:** add to BOTH `en` and `ar` in `constants/translations.ts`, directly under your
  slice's `// ── ui-polish: … ──` marker (one marker per slice, at the end of each block), so
  parallel changes merge cleanly. Never write "هاسيو" — the brand is always "Hasio".
- **Ownership:** edit only your slice's files. If something outside them must change, stop and say
  so in your report instead.

## Already done (committed on `ui-polish`)

| Commit | What |
|---|---|
| `a80c559` | `app.json` version 1.1.0 — the safety catch against an OTA from SDK 57 reaching 1.0.2 binaries |
| `ce4c3c5` | `BottomSheet`; EditName, Review, DeclineReason, VerifyPhone and Filter sheets moved onto it (fixes: keyboard covering EditName and Review; Decline had no dialog host; alerts after close sequenced) |
| `6d91b6d` | ReportSheet restyled into the sheet family (palette, Cairo, RTL rows, ink spinner) |
| `7ebddef` | `Button loading` |
| `2d300fd` | `lib/digits.ts` + Arabic digits in `normalizeKsaPhone` |
| `e9fef34` | `useLeaveGuard` + its strings |
| `a93869b` | SkeletonFade no longer leaves screens rasterised in one texture after their second layout |
| `5ec2323` | Arabic: no letter-spacing, line height ≥ 1.4× size (central, in `useThemedStyles`) |
| `6cb0a58` | Favourites: guests see theirs, merge on sign-in, optimistic heart, errors shown; category labels (`constants/categories.ts`); folded + localised city names; apartment/camp types; memoised adapters |
| `79c3d20` | BottomSheet body only mounted while open; visible handle; Button chains press handlers; brand caret colour |

## Decisions taken (defaults — the owner can reverse any)

1. **Guest favourites** stay account-free: shown in Favorites, merged into the account at sign-in.
2. **Moments** is unreachable (no tab, no route renders it) — its client code is deleted. The backend
   and account deletion keep handling any stored moments.
3. **Arabic neighbourhood/address boxes** on the posting forms were never saved — removed rather than
   adding backend fields.
4. **Provider dashboard**: fake "0 · demo" stats replaced by real service counts.
5. **Planner chat** persists on the device (last ~40 messages) so a plan survives a restart.
6. **No backend changes and no deploys** in this pass. Items that need one are listed as open.

## Open items for the owner (not done here)

- **Services are invisible to travellers.** Approved provider services appear on no traveller screen
  (the website's pages were removed 2026-08-29). Build a directory, or hide provider sign-up.
- **Clearing a listing's nightly price** needs the backend to accept `null` (`validatePricing` rejects
  0, the validator rejects null). Until then a host cannot make a listing un-bookable from the app.
- **Readable errors from services and rate limits** need `ConvexError` in
  `convex/services/mutations.ts` and `convex/rateLimit.ts` (production redacts plain `Error`s).
- **Android dark mode:** add `expo-system-ui` and `android.userInterfaceStyle: "light"` in the 1.1.0
  build (native change). Without it, a dark-mode phone gets light navigation-bar icons over the white
  tab bar and in every Modal.
- **Reports on AI chat messages are not recorded** (the backend has no `ai_message` target type).
- **Privacy policies** say moments never leave the device; the old moments code uploaded them.
- **iPhone checks**: nothing here was run on a device. See "Device checks" at the end.

## Slices

### Slice 1 — Discovery (Home, Stay, filters, search)

Files: `components/screens/HomeScreenContent.tsx`, `components/screens/LodgingScreenContent.tsx`,
`components/lodging/LodgingCard.tsx`, `components/ui/{RangeSlider,FilterSheet,SearchBar,FilterChip,PressableScale,Card,CategoryCard}.tsx`,
`components/ui/index.ts` (exports only), `components/ui/SkeletonScreens.tsx` (Home + lodging parts
only), `constants/layout.ts`, new `lib/searchText.ts` (+ test).

1. **RTL double reversal** — the Home kind chips, the Stay type chips and the Featured rail are
   `.reverse()`d *and* rendered in a `row-reverse` container, so in Arabic they are not mirrored at
   all, while the skeleton is — content jumps sideways when data lands. Use `FlatList horizontal
   inverted={isRTL}` (mirrors order, starting edge, swipe and snapping) and delete both reversals.
2. **Featured card city** — pass the localised city (`dest.city` / `dest.cityAr` now come folded and
   translated from `useDestinations`).
3. **Home keyboard** — `keyboardShouldPersistTaps="handled"` and `keyboardDismissMode="on-drag"` on the
   Home ScrollView (the first tap on a result only closed the keyboard); `returnKeyType="search"`.
4. **Budget slider applies a filter on touch** — any release commits, and Home treats any non-null
   bound as active, so tapping a thumb hid every attraction. Store `null` at the bounds
   (`lower <= min`, `upper >= max`) and skip `onChange` for a tap that changed nothing.
5. **A drag interrupted by the sheet's ScrollView is lost** — add
   `onPanResponderTerminationRequest: () => false`, commit on terminate like on release, and
   `alwaysBounceVertical={false}` on the filter sheet's ScrollView.
6. **"More destinations / No destinations found" under a full rail** — render that block only when
   `rest.length > 0`; the empty state only when featured and rest are both empty.
7. **Stay chips** come from the data (like Home's); empty state gets a "Show all" action.
8. **Home skeleton heights** do not match (section title/eyebrow line heights, chip height, esp. in
   Arabic) — give the section text explicit line heights shared through `constants/layout.ts` and use
   them in the skeleton per language (Arabic line heights are raised to ≥1.4× automatically).
9. **Masonry grid** leaves 50pt holes — two columns, or one card height.
10. **"★ 0.0"** on unreviewed places — show the rating only when `> 0` (grid and LodgingCard).
11. **Filter sheet cities** — derive from the lodgings + destinations actually listed (`getCities`
    counts restaurants too, so counts are wrong and some cities return nothing); handle the sheet
    having nothing to offer.
12. **RangeSlider handling** — `hitSlop` on the thumbs; when the thumbs overlap pick the one the drag
    direction implies; tapping the track moves the nearest thumb; fill and thumb ring in
    `primary.deep` (lime on beige was 1.16:1); accessibility increment/decrement actions.
13. **Search results** — no star icon on a non-rating line; no dangling "•" when there is no price;
    `enterFade(index)` (capped) instead of an uncapped delay; correct singular/plural ("1 result",
    Arabic count forms); results clear immediately with the query; places match city names; Arabic
    matching normalised (أ/إ/آ→ا, ة→ه, ى→ي, strip tashkeel) in `lib/searchText.ts` with tests.
14. **Speed** — `React.memo` the cards with stable callbacks; LodgingCard mounts its ReportSheet only
    after the first "⋯" tap; cap the Home grid (e.g. first 24 + "Show more").
15. **Cards shrink when a scroll starts on them** — `unstable_pressDelay` ~90ms in `PressableScale`
    and the Home card pressables.
16. **LodgingCard** — heart and "⋯" get pressed feedback and non-overlapping ≥44pt targets; no
    " per night" without a price; a price band alone is not "per night"; name may take two lines.
17. **Odds and ends** — hero eyebrow "EASTERN PROVINCE" is hard-coded English → `t()`; pull-to-refresh
    `colors` for Android; filter button's a11y label says the count (not `expanded`); SearchBar's
    clear button gets a label and 44pt; SearchBar's hard-coded "Filters" label → `t("filters")`; the
    grid passes `{ uri: "" }` for no image → `undefined`; `alwaysBounceHorizontal={false}` on a chip
    row that fits, so an iOS swipe there still changes tabs.
18. **Large text** — SearchBar's captioned input has `height: 22` → `minHeight`; the Home hero's fixed
    190pt box → `maxFontSizeMultiplier={1.3}` on its text.
19. **FilterChip** `marginRight: 10` breaks RTL alignment (also used by both bookings screens) — use
    the parent's `gap`.
20. **Delete unused** `Card.tsx` and `CategoryCard.tsx` (grep first) and their exports.
21. *(Optional)* after ~6s of loading while `useConvexConnectionState()` says disconnected, show a
    "can't connect" message instead of an endless shimmer on Home and Stay.

### Slice 2 — Listing sheet, booking, reviews

Files: `components/listing/ListingDetailSheet.tsx`, `components/booking/*`, `app/bookings/*`,
`app/business/bookings.tsx`, `components/review/*`, `app/reviews/*`, `lib/{bookingDisplay,dates,calendarLocale,bookingError,reviewError}.ts` (+ tests),
`components/ui/SkeletonScreens.tsx` (booking parts only).

1. **P0 (iOS): Book, Rate, Report and the phone check never appear from the listing sheet.** They are
   rendered as *siblings* of the detail Modal; RN presents from the same view controller, which is
   already presenting the detail pageSheet, and UIKit refuses (RN has already set `_isPresented` and
   never retries). Render all four *inside* the detail `<Modal>` (after the content, before its
   `AppDialogHost`), gated on the shown item; the comment claiming nesting "clips" was never tested
   (`ReviewCard`'s report sheet is already nested and works). Reset the four open-flags when the
   detail closes.
2. **Verify → Book** — `onVerified` must not open the booking sheet in the same tick the verify sheet
   closes (iOS refuses). Set a pending ref, close verify, open booking from `VerifyPhoneSheet`'s
   `onDismissed` (already a prop).
3. **"View my bookings" opens under the still-open listing sheet** — give BookingSheet an
   `onViewBookings` prop: close the booking sheet, and once it is dismissed (iOS `onDismiss`, Android
   immediately) close the listing sheet and push `/bookings`. Never close both on one tick on iOS.
4. **Closing blanks the sheet, then slides an empty page away** — keep the last item while closing
   (`shown` state, render-phase pattern as in BottomSheet), render from `shown`, `visible={!!item}`.
5. **Photo index carries over** between listings — reset `imageIndex` when `item.id` changes.
6. **Opening hours print database keys** ("sunday") in both languages — map to labels (the Arabic
   day names exist in `lib/calendarLocale.ts`), fall back to the raw value.
7. **Call / Directions / Email probably fail on Android 11+ and iOS** — drop the `canOpenURL` pre-check
   (package visibility / `LSApplicationQueriesSchemes`); `await Linking.openURL(url)` in the existing
   try/catch. Same for `app/bookings/[id].tsx` (which also needs spaces stripped from `tel:`).
8. **iOS swipe-down resists, then closes by itself** — RN 0.86 sets `modalInPresentation` unless
   `allowSwipeDismissal` is passed. Pass it on the listing sheet; on BookingSheet only when the form
   is clean and not submitting (dirty → confirm discard). Check the reopen path.
9. **BookingSheet on Android** — header under the status bar (Modals are edge-to-edge): add
   `insets.top` on Android as the listing sheet does.
10. **BookingSheet keyboard** — the notes field and pinned footer go under the keyboard: iOS
    `automaticallyAdjustKeyboardInsets` + `keyboardDismissMode="interactive"`; Android a
    `useKeyboardOverlap` wrapper, `prepare()` on the notes field's focus, scroll to end.
11. **BookingSheet state** — reset when it *opens*, not on close (the success screen flipped back to
    the empty form while sliding away); block closing while submitting; start guests at
    `Math.min(2, maxGuests)`.
12. **Calendar arrows point inward in Arabic** — the library never mirrors its header without
    `I18nManager.isRTL`; remove the manual flip. `useCallback` the day-press and arrow renderers
    (every re-render redrew ~42 day cells).
13. **Counts in words** — "1 Guests", "2 الضيوف", nights always "ليالٍ", "{n} تقييم": proper unit keys
    chosen by count with Arabic plural rules, in `lib/bookingDisplay.ts` with tests.
14. **QuoteFooter** — hint/error/pending note right-aligned in Arabic; the idle hint repeats the line
    under "Select dates"; in USD the rate and total round separately ("3 × $127" beside "$380") —
    make the displayed pieces agree.
15. **Gallery** — dots update while swiping (`onScroll`, throttle 16), not only at momentum end; one
    direction for gallery, dots and thumbnails (the thumbnails are mirrored, the rest is not); the
    thumbnail rail overflows at 6 thumbs → horizontal ScrollView or computed size; sand placeholder.
16. **Listing sheet layout** — price wrapper `flex: 1` so a long price truncates instead of running
    under Book; contact buttons truncate ("الموقع الإلكتروني") → icon-over-label or shorter labels;
    `handleBook` treats a still-loading user as unverified → wait for the user.
17. **Host: "No-show" on one tap** with no undo → destructive confirm (new strings).
18. **Decline flow** — the parent closes the sheet before sending, so its spinner never shows and a
    failure wipes the typed reason: keep it open until the decline succeeds; `run` returns success.
19. **Host screen** — one shared busy slot: acting on two cards re-enables the first mid-request →
    busy per booking id.
20. **Booking lists** — sort upcoming/requests by stay date ascending; per-tab empty states
    (`noUpcomingStays` / `noPastStays` exist); the skeleton no longer matches `BookingRow`; guard a
    double tap from pushing the detail twice; animate a confirmed/declined host card out.
21. **Booking detail** — the "Rate your stay" card flashes while loading (`=== null`, not falsy);
    code/label/note RTL alignment; a spinner while cancelling; `canCancel` must respect
    `viewerRole` (a host saw a Cancel the server rejects).
22. **Reviews** — dates with Latin digits (`ar-SA-u-nu-latn`); the reviews screen needs a loading
    state and one ReportSheet per screen (not per card); star buttons labelled "1 star" … "5 stars";
    ReviewSheet: `maxLength` instead of slicing in `onChangeText` (cursor jump).
23. **Press feedback / targets** across every pressable in these files (see the shell list below:
    ListingDetailSheet Book/actions/Rate/close/Report/See all/thumbnails, BookingSheet, GuestStepper,
    QuoteFooter, HostBookingCard call (40pt), ReviewCard "⋯" (38pt), bookings/[id] pills).
24. **Arabic stack animation** — `slide_from_left` in Arabic in `bookings/_layout.tsx` and
    `reviews/_layout.tsx` (check the back swipe still feels right).

### Slice 3 — Planner, Favorites, Moments removal

Files: `components/screens/PlannerScreenContent.tsx`, `components/planner/*`,
`components/screens/FavoritesScreenContent.tsx`, `hooks/useKeyboardVisible.ts` (keep its exported API —
the tab shell uses it), `types/index.ts` (chat types), `stores/appStore.ts` (chat persistence, moments
removal — leave the favourites code alone), and the Moments files to delete:
`components/screens/MomentsScreenContent.tsx`, `components/moments/`, `hooks/useMoments.ts`,
`app/(tabs)/moments.tsx`, `SkeletonMomentsGrid` (+ its styles) in `components/ui/SkeletonScreens.tsx`
and its export in `components/ui/index.ts`, the export in `components/screens/index.ts`.

1. **Favorites for guests** — `useFavorites()` now returns a guest's favourites too, newest first.
   Use the exported `toLodging` / `toDetails` from `hooks/useConvexData` instead of the local copies.
   Empty state: for guests a Sign in button and an "Explore stays" button (accept an optional
   `onNavigateToTab` prop; the shell will pass it).
2. **A favourited restaurant/attraction opens as "Hotel … per night"** — badge from `listingType`,
   `priceLine` = the price band only, no badge colour, not bookable.
3. **Unfavouriting** — animate the card out (`Animated.FlatList` + `itemLayoutAnimation`); optional
   undo.
4. **Android composer jumps** (from the second keyboard of a session on; also does not ride down):
   the Android branch mixes an animated tracked height with a React-state overlap primed to last
   time's full height by `prepare()`. Use the React-state term only until tracking has been seen
   (`keyboardTrackingSeen` shared value in `useKeyboardVisible.ts`), keep following the tracked height
   down while the keyboard state is CLOSING. The `3d7ea1c` comment's "two useAnimatedKeyboard
   instances disagree" is wrong (one native source) — correct it.
5. **The tab bar can stay hidden** after a keyboard vanishes without animating (backgrounding, focus
   moving to a Modal): on Android treat `keyboardDidHide` as closed when the tracked state is stuck
   OPEN; on iOS `beginOpen()` needs a fallback timer if no will-show follows.
6. **Every send closes the keyboard** — remove `editable={!isLoading}` (`sendDisabled` and the guard
   already stop a double send).
7. **Message fade-in waits longer as the chat grows** — `FadeInUp.duration(250)` with no index delay.
8. **Failed replies** show raw English server strings (one names the vendor) and lose the typed text —
   show `t("somethingWentWrong")`, a Retry chip that re-sends without a second user bubble, put the
   text back in the composer, and leave failed turns out of the history sent to the model.
9. **Plan card** — keep `suggestedDestinations`, `disclaimer` and `planId` on the message; show the
   destinations as chips opening `ListingDetailSheet` for the listing whose name matches; show the
   disclaimer; a Share button (`Share.share`); persist `chatMessages` (cap ~40).
10. **A long plan arrives scrolled to its end** — scroll to the top of the new reply instead.
11. **Composer RTL** — mirror the composer row; the typing bubble's small corner and an avatar
    spacer so the reply does not jump when it replaces the dots; timestamps on the right side and in
    the app's language (`Intl.DateTimeFormat(isRTL ? "ar-SA-u-nu-latn" : "en-GB", …)`, created once).
12. **New chat** — ≥44pt, pressed state, disabled while a reply is pending (a stale reply landed in the
    new chat), space reserved so the header does not reflow.
13. **Send button** — role, label, state, pressed feedback.
14. **Report chip** — hit target and role; the "thank you" is shown twice — once.
15. **Typing indicator** — timers never cleaned up (endless springs after unmount); use `withDelay`
    + `withRepeat` + `cancelAnimation`; a11y label.
16. **Every keystroke re-renders every bubble** — `React.memo(ChatBubble)`, stable callbacks, one
    time formatter.
17. `keyboardDismissMode="on-drag"` (`interactive` does nothing on Android and desyncs on iOS).
18. `useKeyboardVisible.ts` — its docblock says it avoids `useAnimatedKeyboard`; it calls it. Correct
    the comment; the two translucency options are forced on by Reanimated anyway and log a dev
    warning — drop them.
19. **The composer rests under the tab bar's fade** — the shell will fade the fade out on the Plan
    tab; rest the composer at `TAB_BAR_HEIGHT + insets.bottom + 8` instead of the scroll clearance.
20. **Delete Moments** (list above). Keep `api.moments` on the server untouched.

### Slice 4 — Account (profile, sign-in, onboarding)

Files: `components/screens/SettingsScreenContent.tsx`, `app/auth.tsx`, `components/auth/VerifyPhoneSheet.tsx`,
`components/settings/EditNameSheet.tsx`, `components/ReportSheet.tsx`, `lib/auth.ts`, new `lib/authErrors.ts` (+ test),
`lib/phone.ts` (+ test), `app/onboarding.tsx`, `app/notifications.tsx`, `app/blocked-accounts.tsx`,
`components/ErrorBoundary.tsx`, `components/ui/BackButton.tsx`, `hooks/useConvexUser.ts`.

1. **iOS freeze after "Account upgraded → Done"** — the alert inside the upgrade Modal and the
   Modal's close land in one render; UIKit dismisses the child, strands an empty full-screen
   controller that eats every touch. Move the upgrade and delete modals onto `BottomSheet`; on success
   close the sheet and navigate / confirm from `onDismissed`. (The shell is also making alert buttons
   run after their dialog has gone.)
2. **Phone sign-in errors say the wrong thing** ("Incorrect email or password" for a wrong code,
   "An account with this email already exists" for a taken number, "Something went wrong" twice for
   expiry/limits): keep Better Auth's `code` on the thrown error and map INVALID_OTP, OTP_EXPIRED /
   OTP_NOT_FOUND, TOO_MANY_ATTEMPTS, PHONE_NUMBER_EXIST, 429 before the generic regexes; a pure
   mapper in `lib/authErrors.ts` with tests; new strings; the title is not the message again.
3. **Code step** — `loading` stays true while an un-awaited config query runs, so the code field
   mounts disabled and `autoFocus` fails (no keyboard, no SMS autofill): `setLoading(false)` right
   after sending, don't await the demo check; drop `editable={!loading}` (it also drops the keyboard on
   every wrong code); drop `maxLength` (pasted "Your code is 123456" was cut before digits were
   extracted); `toLatinDigits` on the input. Same in `VerifyPhoneSheet` (refocus after a failure).
4. **Navigation after sign-in** — `router.replace("/(tabs)")` stacks a second tabs screen (two pagers
   of five screens) or leaves onboarding under it: onboarding `replace("/auth")`; `finishSignIn` →
   `canGoBack() ? back() : replace("/(tabs)")`; the phone step's back likewise. Android back on the
   code/email steps returns to the phone step (`BackHandler`).
5. **Version** — the string is "Version 1.0.0" with the number baked in: label only, number from
   `Constants.expoConfig.version`.
6. **Signed-in users briefly see the guest "Sign in" profile** — show a neutral header while
   `isUserLoading`.
7. **Phone numbers scramble in Arabic** ("4567 123 50 966+") — an `ltr()` helper (U+202A…U+202C) in
   `lib/phone.ts` with a test, at the three call sites.
8. **Delete account** — the sheet vanishes mid-spinner into the guest view: a full-screen "Deleting…"
   state outside the signed-in branch; the delete button in `colors.signOut` (white on
   `colors.error` is 3.3:1). Upgrade options: spinner + double-tap guard.
9. **Brand in Arabic script** — `appName: "هاسيو"` (footer wordmark, fallback name),
   `reportSubtitle`, `blockedAccountFallbackName`: always "Hasio".
10. **Rate app hidden on iOS** — `IOS_APP_STORE_ID = "6800297588"`.
11. **New phone users are never asked for a name** — a visible "Add your name" affordance on Profile
    when the name is missing, opening `EditNameSheet`. EditNameSheet: disable Save on an empty name
    instead of silently closing.
12. **Settings rows** — values `numberOfLines`/`flexShrink` so they don't crush labels; Language and
    Currency rows switch in place, so no navigation chevron; icon margins → `gap` (they end up on the
    wrong side in `row-reverse`); sign out shows busy and its confirm button says "Sign out", with
    space from "Delete account".
13. **Email sign-in** waits a fixed 1.5s for the user row → poll a few times instead.
14. **Onboarding** — light status bar over the dark poster (a focus-gated `<StatusBar style="light">`);
    check the copy does not cover the poster's wordmark on small phones; Skip pressed state.
15. **Notifications** — unread dot in `primary.deep` (lime on mint is 1.23:1); a list-row skeleton,
    not the photo-card one; an unread count on the Settings row (`api.notifications.queries.unreadCount`).
16. **Blocked accounts** — dates Gregorian with Latin digits (`ar-SA-u-ca-gregory-nu-latn`); 44pt
    back button.
17. **ReportSheet signed out** — say "sign in to report" up front (with a way to sign in) instead of
    after the form is filled.
18. **Press feedback / targets** — auth (back, submits, links, the 20×20 password eye), Settings
    (guest card, hosting card, sign out, options), onboarding Skip, blocked accounts, notifications
    ("Mark all read" is 31pt), `BackButton` (vertical-only hitSlop; margins push it 10pt above the
    title in row headers), ErrorBoundary retry.
19. **RTL** — the password field's padding stays on the right while the eye moves left.
20. **ErrorBoundary** — a friendly message, the technical detail behind a "Details" toggle (kept for
    testers).
21. Lint leftovers in these files (unused imports, `getUserTypeLabel`, `handleContinue`); avatar on
    `expo-image`.

### Slice 5 — Business and provider

Files: `app/business/{_layout,dashboard,my-listings,post-lodging,post-destination,verification}.tsx`,
`app/provider/*`, `components/screens/{BusinessDashboardContent,ProviderDashboardContent,VerificationScreenContent}.tsx`,
`components/VerificationBanner.tsx`, `lib/{convexUpload,submitError,serverError}.ts`, `constants/amenities.ts`.

1. **Editing overwrites the map pin and address** — every save sends `coordinates: cityCoordinates(city)`
   and `address: neighborhood || city`; Neighborhood is prefilled from `region` ("Eastern Province" on
   the seeds). In edit mode send coordinates/address/region only when the city or neighbourhood
   actually changed; don't prefill Neighborhood from a province-wide region. Destination form: send
   coordinates only when the city changed.
2. **Clearing a field doesn't clear it** — edit mode sends `""` for emptied text and `[]` for emptied
   lists (the server skips `undefined`). The nightly price cannot be cleared without a backend change
   (open item) — say so in the UI rather than silently keeping it.
3. **My Listings calls live and suspended listings "Rejected"** and never shows why — normalise
   `status ?? "approved"`, add Suspended, filter on the normalised value, show
   `rejectionReason`/`suspendedReason` with "editing resubmits". Same for My Services.
4. **Provider "Post Service" label is white on lime** — `colors.ink`.
5. **Dashboards double the top inset** — plain View (or edges without top) around the content, and a
   focus-gated light `StatusBar` on the dark bands (dashboards, verification) — never an
   unconditional one, the dashboard stays mounted under the forms.
6. **Leaving a form discards everything; leaving mid-upload later pops an unrelated screen** —
   `useLeaveGuard(dirty && !submitted)`; the success alert's Done only goes back when this screen is
   still focused.
7. **Submitting looks frozen** — `<Button loading>`; upload progress ("Uploading photos 2/5") via an
   `onProgress` callback in `uploadMultipleToConvex`; lock the form while submitting.
8. **Destination: city not enforced**, silently filed under Al Ahsa; a blank address saved as the
   place's own name → validate the city, fall back to the city label.
9. **Arabic neighbourhood/address boxes are never saved** — remove them.
10. **Provider dashboard "0 · demo" stats** — real counts from `getMyServices`; drop Requests/Views.
11. **My Services is a dead end** — Edit (route to post-service with `?id=`, prefill once) and Delete
    (confirmed) using the existing `updateMyService` / `deleteMyService`; Delete on My Listings via
    `deleteMyListing`.
12. **Arabic-Indic digits rejected** in the number and time fields — `toLatinDigits`.
13. **Post-service** — "(comma separated)" hard-coded English in the Arabic label; split languages on
    `/[,،]/`.
14. **Photo picker** — `selectionLimit: 5 - images.length`, disable at 5, a Cover tag + "Make cover",
    mirror the row in Arabic, key by URI, `expo-image`, no library-permission pre-check before the
    system picker.
15. **Remove-photo "X"** — 24pt, no hitSlop/label, stays top-right in Arabic.
16. **Validation** — errors under the field and scroll to it; correct messages (units limit 500,
    price "whole number, 1–100,000"); required Arabic description labelled; email/phone validated.
17. **Keyboard on the forms** — `returnKeyType="next"` chaining via refs, `keyboardDismissMode`,
    `prepare()` on focus (Android jump), `automaticallyAdjustKeyboardInsets` on iOS.
18. **Verification screen** — status bar (5), ink spinner on lime, approved tick in `primary.deep`,
    RTL rows, "Replace document" reuses the picker originally used, readable failure text, an
    "approved — you can post" message, a back button while loading.
19. **Dashboards in Arabic** — mirror stat/action cards; revenue fits on one line; the empty icon
    squares; the permanent "first listing requires approval" line; the "Travelling" chip's size,
    role and feedback.
20. **My Listings / My Services polish** — city label in Arabic; empty states with a call to action
    (`filterNoMatch`, `noServicesYet`, `addFirstService`, `startAddingListings` exist); badge
    colours on-palette with ≥4.5:1; the selected filter chip in ink like `FilterChip`; mirrored badge;
    image placeholder; pull-to-refresh that waits on nothing → remove it.
21. **Press feedback / targets** across these screens; `BackButton` is slice 4's.
22. **Editing an approved listing silently takes it offline** — confirm first; Save disabled until
    something changed; loading and not-found states for the editor.
23. **Arabic stack animation** — `slide_from_left` in Arabic in both layouts.
24. **Shorter entrance animations** on these utility screens (0.7–0.95s before content settles).
25. `lib/submitError.ts` — match "Failed to get storage URL" and network errors to the upload message.

### Slice 6 — App shell (done by the coordinator)

`components/ui/AppDialog.tsx`, `stores/dialogStore.ts`, `app/(tabs)/_layout.tsx`, `app/_layout.tsx`, `app/index.tsx`.

1. **Alerts on iOS**: keep the dialog's Modal mounted and drive `visible`, run a button's action from
   `onDismiss` (iOS) / next frame (Android), queue `show()` while one is visible or dismissing, with
   a fallback timer — an alert raised during a fade-out was refused and left every later alert
   invisible. Dismiss the keyboard on show. Scroll a long message. VoiceOver can reach the buttons.
2. **Tab shell**: memoise the five pages (every swipe/keyboard change re-rendered all of them);
   dismiss the keyboard when a swipe starts; jump without animation to a far tab; `tab` role with
   selected state; inactive label contrast; cap the labels' font scale; fade the bottom fade out on the
   Plan tab; pass `onNavigateToTab` to Favorites.
3. **Launch**: no spinner flash between the splash and the first screen.

## Verification (after merging every slice)

- `npm run typecheck`, `npm run lint` (0 errors; warnings not above the 55 baseline), `npm run test`.
- `node` translation parity check (en/ar key sets identical, no "هاسيو").
- Read every diff; follow the error paths.

## Outcome (2026-09-24)

All six slices landed on `ui-polish` and were merged into `sdk-57`: five fixer branches merged
`--no-ff` (slices 1–5; 11 + 18 + 4 + 14 + 17 commits), the shell done directly, then the seams
between slices (the nested report sheet's sign-in, the host card's phone number, the root drill-ins'
Arabic back swipe, the Favorites "Explore stays" wiring) and a lint cleanup.

- `npm run typecheck`: clean. `npm run lint`: 0 errors, 3 warnings (was 55). `npm run test`: 171
  passed in 11 files (was 39 in 4). Translation parity: 733 keys in each language, no "هاسيو".
- Web build (`expo start --web --no-dev`) driven in headless Chrome at 390×844, as a guest: onboarding,
  all five tabs in English and Arabic, the filter sheet, a place's sheet and its report sheet, a heart
  on Stay appearing in Favorites, a stay's sheet and Book → sign-in — 21 steps, no console errors, no
  page errors. Web is not native: gestures, native Modals, keyboards and iOS presentation are what the
  device checks below are for.
- One web-only fix: the tab icons get a static colour on web (the animated tint threw there).

**New open items found while fixing** (not done — backend or owner decisions):
- `deleteMyListing` deletes a listing even with pending/confirmed bookings; the app now refuses on the
  phone, the server should too.
- Any edit takes a live listing offline until re-approved (the app now warns before saving).
- Reports on AI planner messages are still recorded nowhere.
- The tab bar keeps Stay on the left in Arabic: it follows the pager's swipe order, which is not
  mirrored. Mirroring both (`PagerView layoutDirection`) is a design decision.
- The `appAlert`/BottomSheet sequencing makes iOS modal flows correct by construction, but none of it
  has been exercised on an iPhone.

## Device checks (for the owner — none of this was run on a phone)

Dev client on a real phone (`npx expo start --dev-client`); the `.env` points at production Convex,
so use throwaway accounts for anything destructive.

**iPhone — the modal flows (these were broken on iOS):**
1. Open a priced hotel with an **unverified** number → Book → the phone sheet appears → enter the
   code → it slides away, then the booking sheet appears on top. Pick dates → Request → "View my
   bookings": the booking sheet leaves, then the listing sheet, then My bookings shows; the app still
   responds to touch.
2. On a listing: Rate and Report each open. As a guest, Report shows "Sign in", which leaves the
   listing sheet and opens sign-in.
3. Cancel a booking → the "Booking cancelled" alert shows → then Sign out → its alert shows too.
4. Profile → Upgrade Account → Business Owner → the sheet slides away → "Account upgraded" → "Start
   verification" opens verification → go back → the app still responds to touch.
5. Swipe the listing sheet down: it follows the finger and keeps its content while leaving; reopen →
   first photo. A booking sheet with dates chosen asks "Discard changes?" instead.
6. Delete account (throwaway account): the sheet leaves, "Deleting your account…" shows — never the
   guest card — then onboarding.

**Android:**
7. Plan tab: open and close the keyboard three or more times (tap the field; back / drag to close):
   the composer rides up and down with it every time, no jump; sending keeps the keyboard open.
8. Background the app with the keyboard up, return: within ~⅓s the tab bar eases back.
9. The booking sheet's title clears the status bar; typing a note lifts the form above the keyboard.
10. Call, Directions and Email on a listing open the dialer, maps and mail.
11. Back on the sign-in code step returns to the phone step; the app never closes from there.

**Both, in Arabic:**
12. Home and Stay chip rows and the Featured rail start at the right edge and swipe right-to-left;
    nothing jumps sideways when data lands.
13. No clipped letters in the Home title or card prices; "صباح الخير" / "مختارة لك" letters join.
14. Phone numbers read "+966 50 123 4567"; counts read "ليلة واحدة، ليلتان، 3 ليالٍ"; dates are
    Gregorian ("10 سبتمبر").
15. Type a nightly price "٤٥٠" in the listing editor → saves as 450; type "الاحساء" in Home search →
    finds الأحساء places.
16. Drill into My bookings / Notifications: the screen enters from the left, and the right-edge swipe
    takes it back following the finger.

**Hosting:**
17. Edit a hosted seeded hotel, change only the price, save, confirm: after approval its Directions
    still open the hotel's real spot and its address is unchanged.
18. Leave a half-filled posting form with Back / swipe / Android back → "Discard changes?".
19. Pick five photos → the picker stops at 5, a tapped photo becomes the cover, upload shows
    "Uploading photos 2/5".

**Filters and favourites:**
20. Tap a budget thumb without moving it → the filter count stays 0 and places still show.
21. As a guest, heart a stay → it appears in Favorites → sign in → it is still a favourite.

**From the owner's first Android run (same day, commit `245c311`):**
The owner reported "Send booking request" looking like text, and the upgrade popup offering only
Cancel. Both were controls that did not read as controls: a 45%-opacity lime button, and two choices
drawn in the page's cream on the sheet's white (1.04:1) with no icon. The popup's cause is the
likeliest reading, not a confirmed one — the same sheet drew both choices in a browser — so item 23
is also the test that tells the two apart.
22. Book your stay, before picking dates: "Send booking request" is a solid lime button. Tap it → the
    line above it ("Choose your dates to see the total") shakes and the page scrolls back up to the
    calendar. With dates picked it sends as before.
23. Profile → Upgrade account → Get started: two outlined choices, each with a lime icon and an
    arrow, then "This action cannot be undone" as a small note, then Cancel. **If the two choices are
    missing on Android**, send a screenshot: then they are not being drawn at all, a different bug.
24. Verification: Submit before choosing a document → the two pickers shake. Report: Submit before
    choosing a reason → the reasons shake. Edit name: Save with the field empty → the field shakes.

## Summary

We looked through every screen of the app and listed about 150 things that felt broken, slow or unfinished.
All of them are fixed, checked together, and the app was tried in a browser in both languages without errors.
What is left is trying it on a real iPhone and Android phone with the list above, and a few owner decisions.
