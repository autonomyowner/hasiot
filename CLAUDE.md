# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Hasio is an **Al-Ahsa travel guide platform**. The product is the **React Native (Expo) mobile app** — AI travel planner, hotel/restaurant/attraction directory with map, bookings, trip itinerary builder, local services (guides, drivers, photographers…) that are **booked like hotels since 1.1.0**, push notifications and favourites. The **React + Vite website** in this repo is now only a **marketing landing page plus a hidden admin portal**; the public product pages (map, listings, services, dashboards, signup) were removed 2026-08-29. Both share the same Convex backend, and the backend still serves every feature — only the website's UI for them is gone.

**Eastern Province focus:** Hasio covers Saudi Arabia's Eastern Province, and nothing outside it. It began as an Al-Ahsa-only guide and the oasis is still its heart, but as of 2026-09-04 the city model is the **thirteen** governorates and cities of the province: Dammam, Al Khobar, Al Ahsa, Qatif, Jubail, Hafar Al Batin, Khafji, Ras Tanura, Abqaiq, Nairyah, Qaryat Al Ulya, Al Udayd, Al Bayda.

On 2026-09-05 the rest of the app followed the city list. **App copy** speaks of the province, not the oasis (`constants/translations.ts`; the keys `exploreOasis` and `exploreAlAhsa` became `heroTagline` and `exploreProvince`). **The AI planner prompt** in `convex/travelPlanner/actions.ts` now carries a per-city knowledge base for all thirteen, knows the coast exists — it used to be told outright not to discuss beaches or diving — and is instructed to establish which city the traveller is basing in before planning, because Dammam to Hafar Al Batin is a five-hour drive. **Every seeded listing is still Al-Ahsa**, so filtering by any other city returns nothing until real listings arrive.

`listings.coordinates` is **required** by the schema and neither posting form has a map picker, so both derive a city centre from `cityCoordinates()` in `constants/cities.ts`. They used to hardcode Hofuf, which pointed the detail sheet's directions link (coordinates win over `address`) at the wrong city. Al Udayd and Al Bayda have no confirmed centre and fall back to Dammam.

Al-Ahsa is now **one** entry rather than its villages. Hofuf, Mubarraz and Al Oyoun are sub-areas that belong in an address, and stored listings still carry them, so both clients fold aliases up to the city above: `hasio-mobile-app/constants/cities.ts` (`canonicalCity`, `cityLabel`) and `src/admin/constants.js` (`CITY_ALIASES`, `canonicalCity`). The two lists must be kept in step — the database stores the English key and each side looks up its own label. Dhahran folds into Al Khobar; Saihat, Safwa, Darin and Tarout into Qatif.

Content, city pickers and seed data must stay inside the province — NOT all of Saudi Arabia.

**Coverage is not positioning (changed 2026-09-05).** The rule above governs *data* — cities, listings, seeds, the planner's knowledge base — and is unchanged. The **website's marketing copy** no longer leads with the Eastern Province: it says **Saudi Arabia**, because repeating "Eastern Province" in every heading read as a limit rather than a focus, and the site is shown to investors. "Eastern Province" now appears on the page exactly **twice**, both times as a plain statement of where we operate today — in the hero intro and in the "What's next" note — and both say the rest of the Kingdom follows. Don't reintroduce it into headings, eyebrows, the footer tagline or `<meta>` titles, and don't "correct" `Saudi Arabia,` in the hero back to the old string. The Arabic headline is the short `السعودية،`, not the full formal name, which wraps to three lines at the display size.

Three user roles: tourists (immediate access), business owners (post listings — hotels/restaurants/events/attractions), and service providers (post freelancer services — photographer/driver/guide/etc.). Business and service accounts require document upload + admin approval.

**Brand:** Always use "Hasio" in English — never "هاسيو" in logos or brand display, even in Arabic mode.

**Production:** https://hasio.net (Cloudflare Workers, static assets from `dist/`, `wrangler.jsonc`). **hasio.net is the live site since 2026-09-25 (owner); hasio.xyz is dropped** but must keep serving `privacy-policy.html`, `terms-of-service.html` and `support.html` (or redirect them to hasio.net) until the live 1.0.2 / 1.0.0 binaries, which open those three by absolute hasio.xyz URL, have aged out and both store listings point at hasio.net. `hasio.xyz` is still on Vercel for that reason only; `phone.hasio.xyz` (the phone sign-up placeholder email domain) and the app's `Origin: https://www.hasio.xyz` auth header are identifiers, not links — never change them.
**App Store:** https://apps.apple.com/sa/app/hasio-travel/id6800297588 — published under **Nabil Hamici's** Apple account, not ours (see *Stores, accounts & shipping*)
**Play Store:** https://play.google.com/store/apps/details?id=com.hasio.travel — **stale: still the May 2026 1.0.0 binary** (see the same section)

## The goal right now — polish, fix, ship 1.1.0 to both stores (set 2026-09-14)

The app is live on both stores but Android is four months stale and the owner considers the app
far from what it should be. The job is to **polish and enhance the mobile app, fix every problem
found, and ship it as a production-ready native build to the App Store and Play Store** — the
first release that brings Android up to date. Work happens on branch **`sdk-57`** (Expo SDK 57 /
RN 0.86), which `main` has not absorbed yet.

How to do good work here:

- **Test on a real phone through the dev client, never Expo Go** — Expo Go cannot host this app's
  native modules, so what it shows is not the app. Commands under *Local device testing* below.
  Nothing can be verified on-device from this machine: say so, and hand the owner exactly what to
  look at (which screen, which gesture, what "correct" looks like).
- **Root causes, not symptoms.** This codebase explains *why* in comments and commit messages
  (read `hooks/useKeyboardOverlap.ts` for the house style); a fix that does not say what was
  actually wrong is not finished. When the cause cannot be confirmed, say which alternatives
  remain and what observation would tell them apart.
- **Green before commit:** `npm run typecheck`, `npm run lint`, `npm run test` in
  `hasio-mobile-app/`. Lint has existed only since 2026-09-14; the UI audit took it from 0 errors /
  55 warnings to **0 errors / 3 warnings** (the documented latest-ref in `useKeyboardOverlap`, two
  effects in `BookingSheet`). Don't add errors or warnings. Tests: 366 across 17 files (2026-09-25).
  The backend's own suite (`npm run test` at the root) must stay green too, and
  `npm run typecheck:convex` clean.
- **Bookable services, push and the finished admin panel** (2026-09-25) were built on branch
  `services-release` (from `sdk-57`) to the design `docs/superpowers/specs/2026-09-25-bookable-services-release-design.md`,
  the plan `docs/superpowers/plans/2026-09-25-bookable-services-release.md` and the backend
  contract `docs/superpowers/contracts/2026-09-25-services-backend.md`. Device checks 25–45 in the
  UI-polish plan are the phone checks this work still owes.
- **The 2026-09-24 UI/UX audit** — six reviewers, ~150 findings, all fixed on branch `ui-polish`
  (merged into `sdk-57`). The accepted findings, the defaults taken, the owner's open items and
  the **device checks still owed** are in `docs/superpowers/plans/2026-09-24-mobile-ui-polish.md`.
  Nothing from it has been run on a phone; the web build was smoke-tested at phone size in both
  languages (21 steps, no errors). Read *Mobile App Production Patterns* below before adding UI —
  it lists the shared pieces the audit introduced and the iOS modal rules they exist for.
- **JS-only changes need no rebuild** — Metro hot-reloads into the installed dev client. Rebuild
  the dev client only for a new native module or an SDK change.
- **The release itself is gated** by the pre-flight list in *Stores, accounts & shipping*. Two of
  those items are not optional: `SMS_PROVIDER` is still `demo` in production (anyone signs in as
  anyone), and Android cannot be submitted until the Play service-account key is restored or the
  AAB is uploaded by hand.

## Commands

```bash
npm run dev          # Start Vite development server (port 5173)
npm run dev:convex   # Start Convex backend server (run in separate terminal)
npm run build        # Build for production (outputs to dist/)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint (website + admin; ignores the app, design-assets and .claude worktrees)
npm run test         # Backend tests (vitest + convex-test, convex/**)
npm run typecheck    # Backend tsc, then the mobile app's
npx convex dashboard # Open Convex dashboard
npx convex dev --once            # Push code to dev without watching
npx convex deploy --yes          # Deploy Convex to production
npx convex run <path> --prod     # Run a function against production
```

**Development**: Run `npm run dev` and `npm run dev:convex` in separate terminals simultaneously. `.env.local` points at the **development** deployment `limitless-mockingbird-449`; production is `hearty-ram-74` (both eu-west-1).

**Deploy to production** (only on the owner's "ship it", backend first):
1. `npx convex deploy --yes` — Convex functions to production.
2. The website (landing page + `/admin`) to **hasio.net**: `npm run build -- --mode cloudflare` (reads `.env.cloudflare.local`, the production Convex URLs — `.env.local` would bake in the dev deployment), then `npx wrangler deploy`. Check `(Select-String -Path dist/index.html -Pattern modulepreload).Count` is 0 first.
3. hasio.xyz (Vercel, from `main`) now only needs to keep the three legal pages alive; no feature work goes there.

**End-to-end check on development**: `node scripts/smoke/services-e2e.mjs` — makes an admin, a provider and a traveller, runs the whole service booking path, and deletes them. Refuses to run unless `.env.local` is a `dev:` deployment.

## Architecture

### Authentication (Better-Auth + Convex)

Email/password only (no OAuth). Auth API runs on Convex HTTP backend, requiring cross-origin setup:

- **Server**: `convex/auth.ts` — `createAuth()` with `betterAuth()`, `getAuthenticatedAppUser(ctx)` helper, `requireAdmin(ctx)` guard. Cookies use `SameSite=None; Secure`. `trustedOrigins` must include all frontend domains.
- **HTTP routes**: `convex/http.ts` — `authComponent.registerRoutes(http, createAuth, { cors: true })`
- **Client**: `src/lib/auth-client.js` — `createAuthClient()` with `baseURL` pointing to `VITE_CONVEX_SITE_URL` and `credentials: "include"`
- **Hooks**: `src/hooks/useCurrentUser.js` — `useCurrentUser()` and `useConvexAuth()` combine `authClient.useSession()` with Convex user query
- **Provider**: `src/main.jsx` — `ConvexBetterAuthProvider` wraps all routes (including admin)

**Auth pattern in all Convex functions:**
```ts
import { getAuthenticatedAppUser } from "../auth";
const user = await getAuthenticatedAppUser(ctx); // returns null if not authenticated
```

**Admin-only Convex functions:**
```ts
import { requireAdmin } from "../auth";
await requireAdmin(ctx); // throws if not authenticated or role !== "admin"
```
All admin queries/mutations in `convex/admin/` and `approveBusinessAccount` in `convex/users/mutations.ts` are guarded with `requireAdmin()`.

**CORS gotcha**: When adding a new frontend domain, add it to `trustedOrigins` in `convex/auth.ts` AND redeploy Convex.

### User Roles & Approval Flow

- **Tourists**: Sign up → immediate access. Can upgrade to business owner or service provider from the mobile app. (The website's `/dashboard` upgrade tab was removed 2026-08-29 — sign-up and role upgrade are mobile-only now.)
- **Business Owners**: Post hotels, restaurants, attractions, events. Require doc upload + admin approval.
- **Service Providers**: Post freelancer services (photographer, driver, guide, etc.). Require doc upload + admin approval.
- **Role upgrade**: Tourist → calls `setUserRole` → uploads doc in the app → admin approves at `/admin` on the website
- Business documents stored in Convex file storage (`_storage`), referenced by `cvFileId` on user record.

### Frontend (React + Vite) — landing page + admin only

- `src/main.jsx` — Four routes, all lazy: `/` (landing), `/sign-in`, `/delete-account`, `/admin`. A `*` route redirects everything else to `/` so old links never render blank.
- `src/AuthedLayout.jsx` — Layout route that owns `ConvexReactClient` + `ConvexBetterAuthProvider` + `authClient`. **Only** `/sign-in`, `/delete-account` and `/admin` sit inside it, so the convex and better-auth chunks never load for anonymous visitors on `/`. Keep Convex imports out of `main.jsx` or that isolation breaks.
- `src/App.jsx` — The landing page. Bilingual `content = { en, ar }`, sections: hero → story → places carousel → in-app showcase → concierge → quote → download → footer. Every CTA points at the App Store / Play Store; there are no internal links left except the static legal pages. The header is `position: fixed` and swaps to a solid paper bar (`.is-stuck`) once the hero scrolls under it — driven by an IntersectionObserver on `.hero-wrap`, not a scroll listener. `.home-redesign` sets `overflow: hidden`, which is why the header is fixed rather than sticky. Below **1000px** the section links move into a burger panel — not 850px like the rest of the mobile layout: the nav list outgrew the bar before the layout did, and at 855px six links plus the wordmark, language button and CTA wrapped onto two lines. That swap is its own media query for that reason; the 850px block is about the page body. Below 640px the header's "Get the app" pill is dropped (four controls do not fit a 390px bar — the CTA is in the panel, the hero and its own section).
- **Arrow chips** (`.place-cta span`, `.place-go`, `.rail-nav button`) — all use the shared `Arrow` /
  `Chevron` SVGs in `App.jsx`, never the `&#8594;` / `&#8592;` entities, which render as a hairline in
  Instrument Serif. Two rules keep them crisp, and both were bugs once: **(chip size − icon size) must
  be even**, or `place-items: center` puts the svg on a half pixel and the whole arrow renders at half
  alpha; and `stroke-width` is in viewBox units, so it has to be re-scaled per icon size (2.4@20px,
  2.67@18px) to land on the same 2px rendered weight. The paths are symmetric about `x=12` for the
  same reason. In RTL only the `svg` is mirrored, not its chip.
- `src/components/voice/VoiceSection.jsx` — **"Absher"** (`#voice`), the ElevenLabs voice agent. The SDK is imported dynamically **on first press**, never at module scope, so scrolling past costs nothing; auth is the public agent id alone and the API key is server-side only — it must never appear in `src/`. **Redesigned 2026-09-05** from a WebGL blob (`VoiceBlob.jsx`, 473 lines of shader, deleted) to a lit studio panel: a blurred green ribbon, a floating "Ask anything…" bubble, three suggestion chips, and **one centred waveform**. The band is now **light** — the blob needed a black section to glow in, which punched a hole through an otherwise paper-coloured page. Two things about the waveform: it is **live** (idle it runs a synthetic swell; in session every bar is driven by the SDK's own analyser, output while Absher speaks, input while you do), and it is driven by **one rAF loop writing `--h` straight to the DOM** — never React state, which at 64 bars × 60fps would be ~3,800 re-renders a second — gated on an IntersectionObserver so it does not animate off-screen. Bars must stay **thin**: at `flex: 0 0 3px` they read as a trace, and past ~4px they become a row of pills. One waveform, not two — a pair reads as a stereo meter rather than as one agent listening.
- `src/components/immersive/ImmersiveSection.jsx` — **"What's next"**, the investor-facing AR/VR roadmap band (`#immersive`), between the quote and the download CTA. The promise, and the thing the copy must keep saying plainly, is **"feel a place before you go"** — you pick a hotel from a few photos today and only learn what it is really like on arrival; this removes that guess from your living room. Phone (AR) first, headset (VR) next. Lazy, bilingual, with a **background video**. The video is the reason for every rule in it: the `<video>` renders with **no `src`**, and the sources are attached only when an IntersectionObserver says the band is within 400px — so a visitor who never scrolls that far pays nothing but the ~21 kB poster, and the entry chunk is unchanged. `muted` + `playsInline` + `autoplay` are all three load-bearing; `play()` rejecting is a normal outcome (the poster carries it). Save-Data and `prefers-reduced-motion` skip the download entirely. Assets in `public/immersive/`: **`presence.mp4` is 2.0 MB, cut down from a 100 MB 4K master** (`D:\hasio v1\arsectiom.mp4`) — de-letterboxed (`crop=3840:1720:0:220`, the master is 2.23:1 inside a 16:9 frame), 1440 wide, 25 fps, CRF 33, `+faststart`, audio stripped, started 6s in and faded from/to black so the loop seam is invisible. No webm: VP9 measured *larger* than x264 on this footage. The two scrim gradients **multiply** (`1−(1−a)(1−b)`), so they divide the frame — a heavy inline pass ending at 66% owns the copy column, a light vertical pass lifts the top and bottom edges — rather than both covering it, which is what renders a black rectangle. The component renders **two** bands: the dark video one (`.imx`, which owns the `#immersive` id) and a **paper** one under it (`.imx-device`) holding three renders of the Hasio headset concept. Those renders must stay on the paper band — their own background is within a couple of values of `--paper`, so there they sit *in* the page, while on the dark band each would read as a pasted white tile. They carry a vignette, which is why each gets a rounded, shadowed plate: the frame turns the darker corners into product lighting instead of a mismatched edge. The band is labelled **"Industrial design concept — not a product on sale"**; keep that disclaimer, the site is shown to investors and Hasio is not making hardware. Masters: six views in `design-assets/vr-headset/`, **renamed off their generated `ChatGPT Image ….png` filenames**, which `.gitignore:46` would otherwise swallow — rename anything new dropped in there too.
- `src/hooks/useReveal.js` — IntersectionObserver scroll reveals (replaced framer-motion on the landing page). Elements opt in with `data-reveal`; the hidden start state is scoped to `.reveal-ready` so the page still renders if JS fails. **Takes a `dep`** (`useReveal(lang)`): the landing page keys its lists by translated strings, so a language toggle unmounts every revealed node and mounts new ones — without a re-scan they are never observed and stay at `opacity: 0` forever. It also carries a **MutationObserver**, because `dep` alone does not cover a **lazy** section: a `<Suspense>` chunk resolves *after* the effect runs, so its `data-reveal` nodes miss the scan and stay invisible permanently with no error to point at it. That re-scan is what makes `data-reveal` safe inside a lazy section at all. Stagger a group with `style={{'--d': i}}`.
- `src/admin/` — Arabic RTL admin dashboard, the only real app left on the web. `AdminPage.jsx` is the
  shell (auth gate + nav with live pending badges); one file per tab in `tabs/`; shared primitives in
  `components/` (Modal, ConfirmDialog, ToastProvider + `toast-context`, ImageUploader,
  WorkingHoursModal, States); shared lookups and date helpers in `constants.js`. Auth via Better-Auth
  (`useCurrentUser()` + `role === "admin"`); redirects to `/sign-in?next=/admin` when logged out.
  **Twelve tabs** (2026-09-25): الرئيسية (dashboard, one row per queue), الأماكن (listings),
  الخدمات المنشورة (live services — edit, suspend with a reason, reinstate, delete), المحتوى
  (pending places), طلبات الخدمات (pending services; it was «الخدمات», which read as the same list
  twice next to the live one), الحسابات (accounts: approve, or reject with a reason), التبليغات,
  الحجوزات (stays, slots and services in one paged table, search by code or phone, a
  support-only forced status change behind a confirmation), المعرفة, السجل, البريد (CSV export),
  المستخدمون (a drawer per user, role change). Pending places and services are read in full in a
  **drawer** (`components/Drawer.jsx` + `ListingDrawer` / `ServiceDrawer` / `UserDrawer`) before a
  decision; the row has no approve button. Still uses framer-motion (lazy admin chunk only).
  Three shared hooks: `useQuerySafe` (a `useQuery` that returns its error instead of throwing, so a
  failing count only loses a badge), `usePagedList` (keeps fetching past an empty page, up to 10 in
  a row — a filter can empty a page while more exist, which used to read as "no results") and
  `stats.js` (one dashboard-stats subscription for the whole panel).
  **No `window.confirm`/`alert`** — destructive actions go through `useConfirm()` and every mutation
  reports through `useToast()`; each tab renders explicit loading, empty and error states. A toast
  shows the **Arabic half** of a server refusal (`"عربي / English"`); anything else reads
  «حدث خطأ غير متوقع» and goes to the console. Links from user content render only if `http(s)`.
  **Every tab opens with the same block**: `.admin-page-head` (or `.admin-card-header`, same rule)
  wrapping an `.admin-page-title` and a one-line `.admin-page-subtitle` that carries the count, with
  any primary action pushed to the far end. Four tabs used to open with a small `.admin-section-title`
  plus a count badge instead, which made the panel read as several tools bolted together — don't
  reintroduce that for a new tab. `.admin-section-title` is for sections *within* a tab.
- `src/pages/SignInPage.jsx` — **Unlinked from everywhere.** It exists so the admin portal has a login. Honours `?next=` (relative paths only), defaults to `/admin`. No public sign-up.
- `src/pages/DeleteAccountPage.jsx` — **Do not remove.** App Store guideline 5.1.1(v); linked from `public/support.html`, which is the live App Store Support URL.

**Static pages in `public/` are not routes** — `privacy-policy.html`, `terms-of-service.html`, `support.html`, `download.html`. Vercel's filesystem check beats the SPA rewrite in `vercel.json`, so React routing cannot affect them. **The mobile binaries open two of them by absolute URL**, so their paths are frozen on **both** domains — a redirect is the only safe way to ever move them. The live 1.0.2 / 1.0.0 binaries open the hasio.xyz copies; 1.1.0 opens the hasio.net ones (`PRIVACY_POLICY_URL` / `TERMS_OF_SERVICE_URL` in `hasio-mobile-app/app/auth.tsx` and `components/screens/SettingsScreenContent.tsx`). The four privacy-policy copies (`public/`, and the app's `public/`, `docs/` and `assets/`) are kept byte-identical.

**Landing page assets** (all local, no external image hosts):
- `public/hasio-oasis-hero{,-mobile}.webp` — hero, swapped by media query
- `public/posters/{gate,arch}.webp` — the two art-directed brand posters in the "inside the app" section. **Shown whole, never `object-fit: cover`** — their typography is part of the artwork, so cropping cuts the wordmark, and nothing may be laid over them. `gate.webp` is deliberately cropped short of its master (1085×1335 of 1450): the master's bottom band is portfolio metadata ("Brand Identity / Tourism / Art Direction", "2026") that has no place on a live tourism site. Masters: `design-assets/poster-{gate,arch}.png`.
- The phone-mockup screenshots that used to fill that section were dropped 2026-09-02; they now live in `design-assets/app-screens/` (they are hand-cropped from `hasio-mobile-app/assets/screenshots/` with OS bars removed and the stale voice-assistant mic painted out of `plan.webp`, so they are worth keeping even though nothing references them).
- `public/places/*.webp` — carousel cards, all 520×880. `heritage` and `flavours` are cropped from `hasio-mobile-app/assets/images/generated/`; `nature`, `culture`, `mountains` and `stays` are photographs cropped from the masters in `design-assets/place-sources/` (which the blanket `*.jpg` ignore rule has a narrow exception for). A new card needs four things in step: the path in `places`, an entry in `placeIcons`, and a `places` entry in **both** `content.en` and `content.ar` — a missing translation renders an empty card rather than throwing.
- `public/logo-mark.webp` — trimmed `logo.png`, shown in a white chip so it reads on the dark nav and footer
- PNG masters live in `design-assets/` (outside `public/`) so Vite stops copying ~7 MB into every deploy

### Mobile App (React Native + Expo)

Located in `hasio-mobile-app/`. **Renamed 2026-08-11** from `hasio<SPACE><SPACE>mobile app` (two spaces) — the double space broke iOS builds (CocoaPods script phases over-escape the path, failing with `bash: /Users/expo/workingdir/build/hasio: No such file or directory`). Never reintroduce spaces in this directory name. Shares the same Convex backend.

**Expo SDK 57 / React Native 0.86 / React 19.2 since 2026-09-14, on branch `sdk-57`** (`main` is
still SDK 54 / RN 0.81 until that branch merges). Three things the upgrade taught, so nobody
re-learns them: `sdkVersion` is pinned in `app.json` and must move with the `expo` package or
`expo install --fix` silently keeps resolving the old SDK; `newArchEnabled` is no longer a valid
key (the New Architecture is the only one in 0.86 — leaving it in fails config validation); and
`StyleSheet.absoluteFillObject` is gone from the runtime, `absoluteFill` is now the plain object
and spreads identically. The old `phase-1-stays` branch also carries an SDK 57 bump but is 139
commits stale and bundled with a separate UI redesign — do not merge it for the SDK.

**Lint** (`npm run lint`) works since the same day: `hasio-mobile-app/eslint.config.js` on
`eslint-config-expo`. ESLint is pinned to **9** — 10 breaks `eslint-plugin-react` on every file.
`react-hooks/immutability` is off because it flags every Reanimated shared-value write
(`x.value = …`, which is the whole API); the other React Compiler rules are warnings, not errors.

- `app/business/` — Business owner screens: `post-lodging.tsx`, `post-destination.tsx` (both also edit, via `?id=`), `my-listings.tsx`, `bookings.tsx` (host inbox), `dashboard.tsx`, `verification.tsx`
- `app/provider/` — Service provider screens: `post-service.tsx` (also edits; a numeric price is what makes a service bookable, `isBookableService` in `convex/services/logic.ts` — together with an approved, unsuspended provider), `my-services.tsx`, `bookings.tsx` (the provider's inbox: confirm / decline with a reason / no-show / complete, same statuses as the host inbox), `dashboard.tsx`, `verification.tsx`
- **The Book tab** (1.1.0, design D3) is the old Stay tab — same key `lodging`, label key `tabStay`, now "Book" / «احجز» — with a **Stays | Services** switch at the top (`stores/bookTabStore.ts`, lifted out of the screen because Home's "Local services" row, `components/services/LocalServicesRail.tsx`, opens the tab on services). `components/services/`: `ServicesList`, `ServiceCard`, `ServiceDetailSheet` (nests its booking, review, report and verify-phone sheets — the iOS modal rule below) and `ServiceBookingSheet` (a day, a start time and, for an hourly or daily price, how many hours or days; the server quotes every total). A service **without a price shows Contact instead of Book** (D16), so services posted before 1.1.0 keep working. Service reviews: `app/reviews/service/[serviceId].tsx`. Refusals map through `lib/serviceBookingError.ts`, labels through `lib/serviceDisplay.ts`. "My bookings" (`app/bookings/`) asks for `includeServices: true` — without it the server leaves service bookings out, which is what keeps them away from the 1.0.x apps.
- **Push** (1.1.0, D6/D14): `lib/push.ts` (permission, Expo token, `registerPushToken`, the Android `default` channel), `lib/pushPrompt.ts` → `maybeAskForPush("guest" | "host")`, `lib/pushDecision.ts` (the seven-day rule), `components/PushPrompt.tsx` (the one explanation sheet, in the root layout; it waits until no other sheet is open), `hooks/usePushRegistration.ts`, `lib/notificationRoute.ts` (the server's `data.target` says where a tap lands — the booking, the host or provider inbox, my listings/services, verification; the in-app inbox and a push tap share it). **Asked in context only, never at first launch**: a traveller after sending a booking request, a host or provider on opening their inbox or dashboard, anyone from the Settings row. Whether a build can receive push at all is decided in `app.config.js` (`extra.push`) — see *Stores, accounts & shipping*.
- `components/hosting/` — `PhotoPickerField` (the one photo picker, with cover and limit) and `OwnerStatus` (status badge + review note), shared by those screens; `lib/listingForm.ts` holds what an edit writes (an edit must never overwrite a listing's pin, address or capacity with form defaults — see its tests)
- `app/(tabs)/` — Main tab navigation (a PagerView shell; the route files are placeholders)
- **Moments is gone from the client** (2026-09-24): it had no tab since Favorites replaced it. The server's `api.moments` and account deletion still handle any stored moments.
- Images uploaded via Convex storage (`lib/convexUpload.ts`, with an `onProgress` callback), stored as URL strings

**Mobile API import**: The Convex `api` object is exported from `backend/index.ts` (NOT `convex/`). All mobile app files import it as `import { api } from "@/backend"`. The directory was renamed from `convex/` to `backend/` because Metro bundler resolves `@/convex` to the `convex` npm package instead of the local directory. **Never rename `backend/` back to `convex/`** — it will break all API calls at runtime with "Cannot read property of undefined" errors.

**Mobile → Backend mapping**: Mobile business forms use `api.listings.mutations.submitListing` (auto-sets ownerId + pending status). Service provider forms use `api.services.mutations.submitService`. A traveller books a service with `api.bookings.mutations.createServiceBooking` (quote first with `quoteService`); providers read `getProviderBookings` / `getProviderStats`.

**Expo web is a smoke-test surface, not the app.** Two things learned 2026-09-25: Metro caches inlined `EXPO_PUBLIC_*` values, so after pointing `.env.local` at another backend start with `npx expo start --web --clear` and check the URL baked into the bundle before writing anything; and `expo-secure-store` has no web implementation (`ExpoSecureStore.web.js` is `export default {}`), so a web session does not survive a reload — sign in and finish the flow on the same page.

### Backend (Convex)

The pattern everywhere: rules live in **seams** — plain functions taking `ctx` and an already-resolved
user (`*/service.ts`, `admin/views.ts`) — because `convex-test` cannot resolve the Better Auth component;
the public `query`/`mutation` wrappers only authenticate and call them. Refusals a person can meet are
`ConvexError("عربي / English")`; the app matches the English half, so that wording is an API.
The 1.1.0 backend contract (every function, shape and refusal) is
`docs/superpowers/contracts/2026-09-25-services-backend.md`.

```
convex/
├── schema.ts              # Database schema (pushTokens, service bookings/reviews added 2026-09-25)
├── convex.config.ts       # Registers betterAuth component
├── auth.config.ts         # getAuthConfigProvider()
├── auth.ts                # Better-Auth instance + getAuthenticatedAppUser, requireAdmin
├── http.ts                # Auth routes with CORS
├── crons.ts               # expire pending (hourly), reminders 09:00, complete 04:00 (Riyadh) — stays and services
├── rateLimit.ts           # enforceRateLimit (ConvexError), fixed 24h windows
├── lib/                   # dates (Riyadh), cities (13 + aliases, toProvinceCity), contact, errors (AUTH_ERRORS)
├── config/queries.ts      # getPublicConfig
├── admin/
│   ├── queries.ts         # getDashboardStats (+queues, capped), adminList/SearchListings, adminList/SearchServices,
│   │                     # adminGetService, adminList/SearchBookings, adminGetUser, listPending*, listAdminActivity
│   ├── mutations.ts       # listing CRUD (pricing, null clears), approvals (+ owner notices), services admin
│   │                     # (update/suspend/reinstate/delete), rejectBusinessAccount, setUserRoleAsAdmin, removeReview
│   ├── service.ts         # write seams + ADMIN_ERRORS;  views.ts — read seams
│   ├── users.ts           # adminListUsers, adminSearchUsers
│   ├── activity.ts        # logAdminAction() — called by every admin write, same transaction
│   └── devTools.ts        # internalMutation grantAdmin/revokeAdmin/listAdmins/grantVerifiedPhone (CLI only)
├── users/
│   ├── queries.ts         # getCurrentUser, getFavorites, isFavorite, getBusinessDocUrl, getStorageUrl
│   ├── mutations.ts       # updateProfile, toggleFavorite, setUserRole, approveBusinessAccount, saveBusinessDoc,
│   │                     # deleteMyAccount (deleteAccountData seam + Better Auth sign-in deletion), createUser (1.0.2)
│   ├── push.ts            # registerPushToken / unregisterPushToken (pushTokens table, token moves with the phone)
│   └── sync.ts, search.ts # Better Auth triggers → users row; admin search text
├── listings/
│   ├── queries.ts         # public listing queries (suspended owners hidden), getMyListings
│   ├── mutations.ts       # submitListing, updateMyListing (pricePerNight null clears), deleteMyListing (refuses open bookings)
│   └── pricing.ts         # PRICING_ARGS, validatePricing, isBookableStay
├── services/
│   ├── logic.ts           # SERVICE_ERRORS, computeServiceQuote, isPublicService/isBookableService, validateServiceInput
│   ├── service.ts         # submit/update/delete seams
│   ├── queries.ts         # listServices(+Paginated), searchServices (en+ar), getService (+provider, bookable), getMyServices
│   └── mutations.ts       # submitService, updateMyService, deleteMyService
├── bookings/
│   ├── logic.ts           # statuses, BOOKING_ERRORS, computeStayQuote, canTransition, confirmation codes
│   ├── service.ts         # createStay/Slot/ServiceForUser, confirm/decline/complete/cancel seams
│   ├── queries.ts         # getUserBookings/getBooking (includeServices), getBusinessBookings, getProviderBookings,
│   │                     # getOwnerStats, getProviderStats, quoteStay, quoteService
│   ├── mutations.ts       # createBooking (1.0.2 slots), createStayBooking, createServiceBooking, cancel/confirm/
│   │                     # decline/complete/markNoShow
│   └── lifecycle.ts       # the three cron jobs
├── reviews/               # listings and services: add/update/delete (verified by a completed booking), summaries
├── notifications/         # templates (booking + account events, en/ar), internal (notify*, data.target), deliver (push/email)
├── moderation/            # reportContent (listing/service/review/ai_message), blocks, resolveReport
├── trips/
│   ├── queries.ts         # getMyTrips (hydrated stops), getTrip, getMyTripSummaries
│   └── mutations.ts       # createTrip, addStopToTrip, updateStop, removeStop, reorderStops, updateTrip, deleteTrip, convertPlanToTrip
└── travelPlanner/
    ├── actions.ts         # planTravel (OpenRouter, anthropic/claude-haiku-4.5)
    ├── queries.ts         # getMyPlans, getPlan
    └── mutations.ts       # storePlan
```

### Database Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles with role (tourist/business_owner/service_provider/admin), isApproved, cvFileId, account rejection reason, suspension |
| `listings` | Hotels, restaurants, attractions, events, tours with geolocation (56 seeded Al-Ahsa entries); hotel pricing (`pricePerNight` …) |
| `services` | Freelancer services (photographer, driver, guide, etc.) with ownerId, serviceType, `price` + `priceUnit` (per_hour / per_day / per_event / fixed), `maxGroupSize`, rating, portfolio images |
| `availabilitySchedules` | Time slots per listing |
| `bookings` | One table for every kind: `kind` stay / slot / **service** (`serviceId`, `quantity`, `unitPrice`, `priceUnit`; `listingId` optional). Status pending → confirmed → completed, or declined / cancelled / expired / no-show |
| `notifications` | The in-app inbox; `data.target` says where a tap lands |
| `pushTokens` | Expo push tokens, one row per phone; a token moves to whoever signs in on that phone |
| `travelPlans` | AI travel plan history |
| `trips` | User-created itineraries with embedded stops array (listing + date/time/notes/order) — no client since 1.1.0 (D7) |
| `reviews` | Ratings & reviews of a listing **or** a service; verified when tied to the reviewer's completed booking |
| `contentReports`, `userBlocks` | Moderation: reports (listing / service / review / AI message) and blocks |
| `moments` | Legacy; no client since 2026-09-24, still handled by account deletion |
| `rateLimits` | Fixed 24h windows (`convex/rateLimit.ts`) |
| `emailCaptures` | Early access signups |
| `travelKnowledge` | Knowledge base for AI travel planner |
| `adminActivity` | Append-only log of every admin action (who / what / when), read by the السجل tab |

### Listings vs Services

**Listings** (`listings` table): Physical places — hotels, restaurants, attractions, events, tours. Created by business owners via `submitListing` (auth-protected, sets ownerId + status "pending"). Admin creates via `createListing` (`requireAdmin`, status "approved"). Seed data has no ownerId or status (treated as approved).

**Services** (`services` table): Freelancer offerings — tour_guide, photographer, driver, translator, event_planner, catering, equipment_rental, other. Created only by service providers via `submitService`. All start as "pending" and require admin approval. **Since 1.1.0 a priced service is booked like a hotel** (design D4): the traveller sends a request for a day and a start time, the provider confirms or declines within 48 hours (or before the start, whichever is sooner), nothing is paid in the app. There is no availability calendar (D10) — two requests for the same time are not blocked, so group tours work. A traveller can cancel until the start time (D11).

Both follow the same approval flow: pending → admin approves/rejects → approved/rejected. Editing resets status to "pending". A live listing or service can also be **suspended** by an admin (with a reason) and reinstated; suspending an **account** hides all of that owner's listings and services from travellers.

### Content Approval Flow

1. Business owner/service provider submits listing or service → status: "pending"
2. Admin sees it in `/admin` under «المحتوى» (places) or «طلبات الخدمات» (services), and opens it in the drawer
3. Admin approves → status: "approved", visible publicly; the owner is notified
4. Admin rejects → status: "rejected" with optional reason, visible only to owner
5. Owner edits → status reset to "pending"

### Image Upload Pattern

Convex file storage: `generateUploadUrl()` → POST file → get storageId → resolve URL via `getStorageUrl` query. Used by the admin panel and by the mobile app (`lib/convexUpload.ts`). The website's uploader lived in the business dashboard, which was removed 2026-08-29.

**Seed listing images**: `convex/listings/seedImages.ts` contains curated Unsplash URLs for all 56 Al-Ahsa seeded listings. Run `npx convex run listings/seedImages:addImagesToListings --prod` to populate images on listings that don't have any.

### Trip Itinerary Builder

Trips have embedded `stops` arrays (not a separate table). Each stop references a listing by ID with optional date, time, notes, and order.

- **Status flow**: `planning` → `active` → `completed`
- **"Save to Trip" modal** (`SaveToTripModal.jsx`): reusable across MapPage, FavoritesSection, and TravelPlanner
- **AI plan conversion**: `convertPlanToTrip` mutation best-effort matches destination names to listings via `search_listings` search index

### Seeding Data

Seed data contains **56 Al-Ahsa-only listings** (12 hotels, 16 restaurants, 18 attractions, 10 events/tours) across Hofuf, Mubarraz, Al Oyoun, and Al Omran. No listings from other Saudi cities. After seeding, run `addImagesToListings` to assign Unsplash images.

```bash
npx convex run listings/mutations:seedListings          # dev
npx convex run listings/mutations:seedListings --prod    # production
npx convex run listings/seedImages:addImagesToListings --prod  # add images
```

### AI Travel Planner

`convex/travelPlanner/actions.ts` — multi-turn conversational action using OpenRouter with `anthropic/claude-haiku-4.5`. Asks follow-up questions before generating a full itinerary. Responds in the user's language. Returns JSON with `ready: false` (follow-up) or `ready: true` (full plan).

### Internationalization Pattern

Each component defines its own `translations` object with `ar` and `en` keys. No global i18n library — keep translations co-located with the component that uses them.

### Bundle & Code Splitting

All routes in `src/main.jsx` are lazy-loaded with `React.lazy()` + `<Suspense>`. `vite.config.js` has **no `manualChunks`** — it used to, and it forced `convex` and `better-auth` into the entry's `modulepreload` list so every anonymous visitor downloaded them. Rollup's automatic splitting follows the real dynamic-import graph instead; don't reintroduce `manualChunks` without re-checking `dist/index.html`.

The landing page loads only the entry chunk (~234 kB raw / ~75 kB gzip: React + react-dom + react-router) plus an ~18 kB / ~7 kB gzip `App` chunk. No convex, no better-auth, no framer-motion, no admin. Verify with: `grep modulepreload dist/index.html` (expect zero matches).

The Google Fonts stylesheet is a `<link>` in `index.html`, **not** an `@import` in `src/index.css`. An `@import` inside the bundled CSS cannot begin downloading until that file has itself downloaded and parsed, which puts two serial round trips in front of first paint; the `<link>` races the bundle instead. Don't move it back.

## Key Technologies

- **React 19** with Vite 7 (website)
- **React Native** with Expo (mobile app)
- **Convex** — Serverless backend with real-time subscriptions
- **Better-Auth** (`@convex-dev/better-auth`) — Email/password authentication
- **OpenRouter** — AI API (`anthropic/claude-haiku-4.5` for travel planning)
- **Mapbox GL JS** — Interactive maps and geocoding (mobile app only; `mapbox-gl` was removed from the website's dependencies 2026-08-29)
- **Framer Motion** — Animations (website: admin panel only — the landing page uses `useReveal`)
- **React Router DOM 7** — Client-side routing

## Environment Variables

### Frontend (.env.local)
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

### Convex Dashboard (Settings > Environment Variables)
```
BETTER_AUTH_SECRET=<random-base64-string>
SITE_URL=https://www.hasio.xyz
OPENROUTER_API_KEY=sk-or-xxx
MAPBOX_PUBLIC_TOKEN=pk.xxx
```

**Note:** `SITE_URL` in Convex must point to the production frontend domain (not the Convex site URL) — used by Better-Auth for cookie domain and redirect handling.

### Vercel Environment Variables
```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CONVEX_SITE_URL=https://your-deployment.convex.site
```

### Mobile App Environment (.env, .env.local, eas.json)
```
EXPO_PUBLIC_CONVEX_URL=https://hearty-ram-74.eu-west-1.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://hearty-ram-74.eu-west-1.convex.site
```

**CRITICAL — EU region prefix:** The production Convex deployment is in `eu-west-1`. All Convex URLs **must** include the region: `hearty-ram-74.eu-west-1.convex.cloud` (NOT `hearty-ram-74.convex.cloud`). Missing the region causes auth requests to hit the wrong endpoint → 401 errors. This applies to three files:
- `hasio-mobile-app/.env`
- `hasio-mobile-app/.env.local`
- `hasio-mobile-app/eas.json` (in `build.production.env`)

**`.env.local` overrides `.env`** in Expo — if both exist, `.env.local` wins. Always keep them in sync or remove `.env.local` if not needed.

## Admin Panel

- **URL**: `/admin`
- **Auth**: Better-Auth role-based — user must have `role: "admin"` in `users` table. Set via Convex Dashboard Data tab.
- **Backend**: All admin queries/mutations require `requireAdmin(ctx)` — throws if not admin. No unauthenticated access possible.
- **Frontend**: `useCurrentUser()` checks role client-side. Not logged in → redirect to `/sign-in`. Logged in but not admin → "access denied" page.
- **URL in production**: https://hasio.net/admin (Cloudflare; deploy steps under *Commands*).
- **Features**: dashboard built around pending work (one row per queue, linking into the filtered
  tab that clears it), listing CRUD **with photo upload** (multi-image, reorder, cover = index 0),
  hotel **pricing** (an emptied field is sent as `null` and clears it), coordinates checked against
  the Saudi bounds with a warning past 150 km from the chosen city's centre, a **working-hours
  editor** (overnight hours allowed), the host picker, **live services** (edit, suspend with a
  reason, reinstate, delete — refused while a booking is open), **booking management** for stays,
  slots and services (confirm / complete / cancel-with-reason / no-show, plus a forced status change
  logged as `booking.force`), content + service approval in a drawer with **bulk approve/reject**,
  account approval or rejection with a reason, reports (remove a review — the rating is
  recomputed; suspend what is live, reject what is pending), users (drawer, role change), knowledge
  base, **admin activity log**, email captures with CSV export.
- **Listing search**: Arabic *and* English names, via two search indexes (`search_listings` on
  `name_en`, `search_listings_ar` on `name_ar`) merged in `adminSearchListings`. Browsing uses
  `adminListListings` with cursor pagination; filters for type/city/review-status/has-photos/has-hours.
- **Audit trail**: every admin write appends to `adminActivity` via `logAdminAction()` in the same
  transaction, so the log cannot record something that did not commit. Add a call there when adding
  any new admin mutation.
- **Setup**: To grant admin access, either edit the user's `role` field to `"admin"` in Convex
  Dashboard → Data → `users`, or run
  `npx convex run admin/devTools:grantAdmin '{"email":"..."}' --prod`. The user must have signed in
  at least once (they need a `users` row). No redeploy needed.

## Mobile App Production Patterns

The mobile app (`hasio-mobile-app/`) is built on a few shared pieces; new code uses them rather
than re-solving the same problems. Most were set by the 2026-09-24 UI audit
(`docs/superpowers/plans/2026-09-24-mobile-ui-polish.md`).

- **The iOS modal rules** (RN 0.86 Fabric, read in `RCTModalHostViewComponentView.mm`): a `<Modal>`
  presents from the *nearest* view controller, and UIKit refuses to present from one that is
  already presenting or mid-dismissal — RN has already marked it presented and never retries, so
  the sheet silently never appears (and an alert host stranded that way swallows every later
  alert). So: (1) a sheet opened from inside another Modal is rendered **inside** that Modal —
  `ListingDetailSheet` nests its Book/Rate/Report/phone sheets; (2) "close A, then open B / alert /
  navigate" waits for A's dismissal (`BottomSheet onDismissed`; a native Modal's `onDismiss` on
  iOS, immediately on Android); (3) never take down a Modal that is still presenting something —
  iOS dismisses the child instead and strands an empty full-screen controller that eats every
  touch (the old "Account upgraded → Done" freeze). A `pageSheet` needs `allowSwipeDismissal` or a
  swipe-down only rubber-bands. Android is unaffected: each Modal is its own window.
- **Bottom sheets: `components/ui/BottomSheet.tsx`**, for every sheet. The backdrop fades and the
  panel slides on the UI thread (the native Modal never animates — a `transparent` +
  `animationType="slide"` Modal slides the dim backdrop up as a slab); keyboard handling built in
  (KeyboardAvoidingView on iOS, `useKeyboardOverlap` on Android); its own `AppDialogHost`; the
  home-indicator inset; a drag handle (PanResponder — there is no `GestureHandlerRootView`);
  `onDismissed`; and it never takes its Modal down while an alert is up inside it.
- **Alerts: `appAlert()`** (`stores/dialogStore.ts`, drawn by `AppDialogHost`). A button's
  `onPress` runs only after its dialog has fully left; alerts raised meanwhile queue (an immediate
  repeat is dropped); the keyboard is dismissed on show. One host at the root and one inside every
  Modal that raises alerts (BottomSheet has its own). Never `Alert.alert`.
- **Arabic typography is automatic**: `useThemedStyles` builds each stylesheet twice, and in Arabic
  it zeroes `letterSpacing` (tracking pulls joined letters apart) and raises any `lineHeight` below
  1.4× `fontSize` (Cairo's marks clip). Don't add per-style Arabic fixes; do build text styles with
  `useThemedStyles(makeStyles)`. Rows still mirror by hand (`isRTL`); horizontal lists use
  `FlatList inverted={isRTL}` — never `.reverse()` inside a `row-reverse` container, the two cancel.
  Phone numbers in Arabic lines go through `ltr()` (`lib/phone.ts`).
- **Numbers people type** go through `toLatinDigits()` (`lib/digits.ts`) before `Number()` or a
  `\d` regex — an Arabic keypad types ٠١٢…
- **Unsaved forms**: `useLeaveGuard(active)` (`hooks/useLeaveGuard.ts`; `usePreventRemove` from
  `expo-router/react-navigation`, which also blocks the iOS back swipe natively).
- **Buttons**: `<Button loading>` shows a spinner at its resting size; every pressable gets pressed
  feedback (`PressableScale` for cards — it has a 90ms press delay so a scroll doesn't shrink them —
  or a `pressed` opacity) and a ≥44pt target with an `accessibilityLabel` when icon-only.
- **A primary button is never faded out to wait for input.** At 45–60% opacity the lime fill is a
  tint an Android screen barely shows on white, and its label fades to grey: on the owner's phone
  "Send booking request" read as text (2026-09-24). It stays the lime fill; pressed too early it
  calls `nudge(reason)` from `hooks/useNudge.ts` on whatever is missing (the booking footer also
  scrolls the calendar back into view). Fading is for "busy" only, a request in flight. Choices in
  a sheet are outlined cards with an icon and a chevron (`components/settings/UpgradeSheet.tsx`),
  never the page's cream on the sheet's white — 1.04:1, invisible on a phone.
- **Favourites**: a guest's live on the device (`appStore.favorites`), are shown by `useFavorites()`
  and merged into the account at sign-in (`useMergeGuestFavorites`, mounted in the tab shell);
  hearts read `useFavoriteIds()`; `useToggleFavorite` is optimistic for accounts.
- **Listing data**: adapters in `hooks/useConvexData.ts` are exported and memoised on the query
  result; category keys read through `constants/categories.ts`, cities through `cityLabel`;
  `lib/listingDetail.ts` turns any listing into the detail sheet's item.
- **Search**: `lib/searchText.ts` folds Arabic spelling variants (hamza, taa marbuta, alef maqsura,
  tashkeel) and counts results in real plural forms (`countForm`).
- **Tab shell** (`app/(tabs)/_layout.tsx`): the five pages are memoised elements — keep them stable,
  or every swipe and keyboard change re-renders all five screens. A drag dismisses the keyboard; a
  tap two or more tabs away jumps without animation.
- **Keyboard**: `useKeyboardTransition` (`hooks/useKeyboardVisible.ts`) drives the tab bar and the
  planner composer from Reanimated's tracked height on Android and the will-events on iOS, and
  recovers a keyboard that vanished without animating. `useKeyboardOverlap` pads a view by exactly
  what the keyboard covers (Android 15 edge-to-edge ignores `adjustResize`).
- **Error Boundary**: `components/ErrorBoundary.tsx` wraps the root layout — a friendly message
  first, the technical detail behind "Show details" for testers.
- **ThemedTextInput**: focus border and caret in `primary.deep` (the dark lime).
- **Image fallbacks**: image containers use the warm sand (`colors.sand`) and safe access
  (`images?.[0] ? { uri } : undefined`).
- **Double-submit guard**: every submit starts with a busy check (a ref where two taps can land in
  one frame).
- **Dark mode**: the app is light-only, system bars included. `app.config.js` sets
  `userInterfaceStyle: "light"` (top level and Android) and adds `expo-system-ui`, without which
  Android ignores it — a phone in dark mode used to style the status and navigation bars for dark
  over the app's cream. `app.json` still says `"automatic"`; `app.config.js` wins. Ships with the
  first 1.1.0 build (a native change, not an OTA).
- **`app.config.js` is where build-time decisions live** (app.json is read first and passed in):
  the push switches, the splash and adaptive-icon backgrounds, the notification icon and colour,
  the photo-permission text, and no Face ID string. Read its header before adding a plugin —
  `./plugins/withoutPushEntitlement` must stay **first** in `plugins`.
- **Push prompt**: call `maybeAskForPush(context)` at the moment the reason is on screen, never on
  launch; it decides and hands off to the one `PushPrompt` sheet, which waits for any other sheet
  to close (the iOS modal rule). On iOS a "no" is final, which is why the app explains first and
  shows the system prompt only on "Turn on".

## Stores, accounts & shipping — read before any build, submit or OTA

Two companion documents hold the exact procedures and must be updated after every release:
`IOS_RELEASE_STATUS.md` (iOS playbook + credentials recipe + version history) and
`docs/SHIPPING.md` (OTA-vs-build decision table, rollback, compliance forms). This section is the
map of *who owns what and what is broken*, verified live on 2026-09-14.

### iOS — published under Nabil's Apple account

- **Why:** the owner's own Apple Developer enrolment is blocked (Apple case `20000130148873`; the
  Developer app answers "enrollment is not available for this Apple Account" after a failed web
  enrolment, and the card cannot pay Apple). So Hasio ships under **Nabil Hamici's** account,
  **Team ID `W23759GRP4`**. He owns the App Store Connect record and its metadata; we build and
  upload from this Windows PC over EAS with an ASC API key. **After every `eas submit` Nabil must
  select the build in ASC and press submit himself — nothing happens until he does.** Message him
  the build number the same day.
- **Live:** "Hasio Travel", `com.hasio.travel`, https://apps.apple.com/sa/app/hasio-travel/id6800297588,
  seller shown as Nabil Hamici. v1.0.2 build 6, approved 2026-08-29, minimum iOS 15.1. The public
  listing reports version "1.0" while the shipped build is `app.json` 1.0.2 — ask Nabil what the
  ASC release is labelled before the next one so the two agree.
- **ASC identifiers** (all already filled in `eas.json → submit.production.ios`): ascAppId
  **`6800297588`**, bundle-id internal id `THCRG443T9`, team `W23759GRP4`.
- **Keys and signing files** — all in `hasio-mobile-app/`, all gitignored (both `.gitignore`s block
  `*.p8 *.p12 *.mobileprovision credentials.json credentials/ google-service-account.json`),
  **none can be re-downloaded — keep a backup off this machine**:

  | File | What it is |
  |---|---|
  | `appstore-connect-api-key.p8` | ASC API key **`UR3PAK97LX`**, Issuer ID `30cc1bab-a280-4644-8b93-900bcb21b973`. A *team* key at App Manager level: enough to upload builds, not to manage certificates. This is what lets us ship to Nabil's account without ever logging in as him. |
  | `credentials/hasio_dist.p12` | iOS distribution certificate `5VG6M5UPU4`, **expires 2027-08-11**. Password is in `IOS_RELEASE_STATUS.md`. |
  | `credentials/hasio.mobileprovision` | App Store provisioning profile `5X9G7JR3K5`, **expires 2027-08-11**. |
  | `credentials.json` | Points EAS at the two files above; `credentialsSource: "local"` in the eas.json production profile. |

  The cert and profile were generated **from Windows through the ASC API** — no Mac, no Apple ID —
  and expire together on **2027-08-11**; after that every iOS build dies in `PREPARE_CREDENTIALS`
  until they are regenerated the same way (recipe in `IOS_RELEASE_STATUS.md`; `openssl pkcs12
  -export -legacy` is mandatory). `EXPO_NO_CAPABILITY_SYNC=1` in eas.json means EAS will never add
  an Apple capability: push notifications would need the capability enabled on the App ID and the
  profile regenerated by hand first.
- **Still open with Nabil:** the **app-transfer agreement in writing** — ownership stays with
  him otherwise; the build has no iCloud entitlement so a transfer is not blocked. (`IOS_APP_STORE_ID`
  in `components/screens/SettingsScreenContent.tsx` is wired to `6800297588` since 2026-09-24, so
  the "Rate app" row shows on iOS from 1.1.0.)
- **App Review:** a pre-approved business-owner demo account is in the ASC review notes
  (credentials in `IOS_RELEASE_STATUS.md`). Business/provider features are approval-gated, so a
  review without it is rejected for incomplete access. Listing copy, territories and privacy
  labels are in the same file.

### Android — our own Google Play account, but the listing is stale

- **Live:** https://play.google.com/store/apps/details?id=com.hasio.travel — **verified
  2026-09-14: "Updated on May 15, 2026", version 1.0.0 (versionCode 11)**, listing still named
  "Hasio - Al-Ahsa Guide". Production track, the 8 countries below. Passed the 14-day closed test
  (12 testers) and was promoted on 2026-05-15; nothing has reached the store since.
- **Why stale:** a 1.0.2 production AAB (versionCode 14, EAS build
  `b56c9f78-8537-49b0-bcbd-26ca25fd69cc`, 2026-08-30) was built the day after iOS 1.0.2 was
  approved and **never uploaded**, because `hasio-mobile-app/google-service-account.json` is **not
  on disk** and `eas submit -p android` cannot run without it. The May release was a manual Play
  Console upload for the same reason.
- **Consequence:** `runtimeVersion` policy is `appVersion`, so the 1.0.0 binary only accepts
  runtime-1.0.0 OTAs, and every production OTA since 2026-09-05 is runtime 1.0.2 (`eas update:list
  --branch production`). **No Android user has bookings, ratings, favourites, the SAR/USD toggle,
  the redesigned Home/Planner or the Eastern Province expansion** — they run the July bundle on a
  May binary.
- **What has to happen for Android:**
  1. Restore the submit path: Play Console → *Setup → API access* names the service account;
     in Google Cloud Console create a new JSON key for it and save it as
     `hasio-mobile-app/google-service-account.json` (gitignored). Then
     `eas submit -p android --profile production --id <build-id>` works. **Or** upload by hand
     once: download the AAB from the EAS build page → Play Console → Production → Create release.
  2. Do **not** ship build 14 — it predates the bookings merge and the SDK 57 branch. The next
     Android binary is the 1.1.0 built from `sdk-57` after polish.
  3. Update the listing with it: name (the app covers the whole Eastern Province now — the
     *Coverage is not positioning* rule above applies), screenshots, and the **Data Safety form**
     (`hasio-mobile-app/docs/DATA_SAFETY_ANSWERS.md`) — phone-number sign-in is new data.
- **Signing:** the Android keystore is **EAS-managed** (Build Credentials `GDSrtB1EXC`); nothing
  local is needed to build.

### Shared release facts

- EAS project `8859775e-cedf-45b7-aa94-3c7cbfb7be12`, owner `autonomy`, login `autonomy.owner`
  (`npx eas whoami`). Channels: `production` for store builds, `development` for the dev client.
- **Next store release is 1.1.0 on SDK 57**, from `sdk-57`. Live binaries are 1.0.2 (iOS) and
  1.0.0 (Android). **Never publish an OTA from `sdk-57` to the 1.0.2 runtime**: RN 0.86 JS on an
  RN 0.81 binary crashes at launch. The `version` bump is the safety catch — leave it in place.
  (It was missing on `sdk-57` until 2026-09-24, commit `a80c559`: the SDK 57 move landed with
  `version` still 1.0.2, so an OTA from that branch would have reached the live binaries.)
- **Release order:** `npx convex deploy --yes` → `eas build` both platforms → submit Android
  (service account or manual upload) → `eas submit -p ios` → tell Nabil → after approval update
  `IOS_RELEASE_STATUS.md`, `docs/SHIPPING.md` ("Current live versions") and this section.
- **Pre-flight for 1.1.0** — every line, no exceptions:
  - [ ] `SMS_PROVIDER` off `demo` in prod — **still `demoAuth: true` on 2026-09-14**; any six digits
        sign in as any phone number. `npx convex env set SMS_PROVIDER console --prod` is the
        stopgap (phone sign-in stops; email unaffected), `infobip` once a Saudi route works.
  - [ ] `main` is not behind any feature branch; `services-release` merged into `sdk-57`, `sdk-57` merged.
  - [ ] **The backend goes first** (`npx convex deploy --yes`): besides the 1.1.0 functions it
        carries two fixes for bugs live in production today — the admin panel's hotel save was
        rejected by the validator, and deleting an account left its Better Auth sign-in behind.
  - [x] `version` is `1.1.0` in `app.json` (since 2026-09-24); leave `buildNumber`/`versionCode` to `autoIncrement`.
  - [ ] **Push, iOS:** Nabil enables *Push Notifications* on the `com.hasio.travel` App ID, creates
        an APNs key (.p8) for EAS, and the provisioning profile is regenerated (EAS won't add the
        capability — `EXPO_NO_CAPABILITY_SYNC=1`). Only then remove `HASIO_IOS_PUSH: "off"` from
        the preview and production profiles in `eas.json`. Until then iOS 1.1.0 ships without push
        and never asks for permission — acceptable, not a blocker.
  - [ ] **Push, Android:** a Firebase project for `com.hasio.travel`, its `google-services.json` in
        `hasio-mobile-app/` (gitignored), and its FCM V1 service-account key uploaded to EAS
        (`npx eas credentials`). A production Android build **stops with an error** without the
        file unless `HASIO_ANDROID_PUSH=off` is set — deliberate, so push is never lost by accident.
  - [ ] The device checks at the end of `docs/superpowers/plans/2026-09-24-mobile-ui-polish.md`
        (iPhone modal flows, Android keyboard, Arabic, and 25–45 for services, provider inbox and
        push) — none of the UI audit's or the services work's fixes ran on a phone.
  - [ ] Play Data Safety, ASC App Privacy and the privacy policy mention phone number **and push
        tokens** (the policy copies and `DATA_SAFETY_ANSWERS.md` do since 2026-09-25; the two store
        forms are filled in by hand).
  - [ ] The admin panel deployed to hasio.net (`npm run build -- --mode cloudflare`, `npx wrangler deploy`).
  - [ ] `google-service-account.json` present, or the manual upload planned.
  - [ ] `eas update:list --branch production` shows no update already tagged for runtime 1.1.0
        (the stale-bundle trap that crashed iOS build 4).
  - [ ] Nabil told the iOS build number the day it is submitted.

### Local device testing (dev client, set up 2026-09-14)

```bash
cd hasio-mobile-app
npx expo start --dev-client       # add --tunnel when phone and PC are on different networks
```

The phone runs a **development build** of the app, not Expo Go: `npx eas build -p android
--profile development` (profile in eas.json, ~20 min on EAS). Rebuild it only when a native
module or the SDK changes. Current SDK 57 dev APK: EAS build `af661805-cc1b-4b28-a669-941eeee026ec`
— **built before `expo-notifications`, `expo-device` and `expo-system-ui` were added (2026-09-25)**.
The root layout imports the first two at start-up, so the JS from `services-release` onward needs a
**new dev client** (`npx eas build -p android --profile development`) before it can be tested on
the phone; the old APK is fine for older branches only.
`.env` points at **production** Convex, so anything created from the phone is real data — and the
EAS development and preview profiles point at production too (design D17, flagged, not changed).

**Testing a branch whose backend is not in production yet** (e.g. `services-release` before the
owner's "ship it"): create `hasio-mobile-app/.env.local` (gitignored, wins over `.env`) with
`EXPO_PUBLIC_CONVEX_URL=https://limitless-mockingbird-449.eu-west-1.convex.cloud` and
`EXPO_PUBLIC_CONVEX_SITE_URL=https://limitless-mockingbird-449.eu-west-1.convex.site`, push the
backend with `npx convex dev --once`, and start Metro with `--clear` (it caches the inlined URLs).
Development runs `SMS_PROVIDER=demo`, so any six digits sign in — a second phone number is how
one phone books a service it did not post. Delete `.env.local` afterwards. Admin approvals for
that test happen in `npm run dev` → http://localhost:5173/admin, which also talks to development.

### Production Target Countries (8)
Algeria, Australia, Bahrain, Kuwait, Oman, Qatar, Saudi Arabia, United Arab Emirates.

**No EU/UK distribution** — intentionally skipped to avoid EU Digital Services Act (DSA) trader status requirements, GDPR data-controller obligations, and UK Online Safety Act compliance overhead. Same 8 countries used in both closed testing and production tracks.

### Key Decisions (v1)
- **Voice assistant disabled** — removed `expo-av`, `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` permissions, VoiceAssistant component, voiceService, and ElevenLabs/Groq integrations. Text-based AI planner remains fully functional via Convex `planTravel` action.
- **Images use Convex storage (not R2)** — `lib/convexUpload.ts` uploads via `generateUploadUrl` → `FileSystem.uploadAsync` → `getStorageUrl`. The three posting screens (`post-lodging`, `post-destination`, `post-service`) use `uploadMultipleToConvex()` with progress. The old `lib/r2Upload.ts` is unused.
- **Auth env var is strict** — `lib/auth.ts` throws if `EXPO_PUBLIC_CONVEX_SITE_URL` is missing (no silent fallback).

### EAS Build & Submit
```bash
cd "hasio-mobile-app"
npx eas build -p android --profile production   # Builds AAB, auto-increments versionCode
npx eas submit -p android --profile production   # Uploads to Play Store (track set in eas.json)
npx eas update --channel production --environment production --message "description"  # OTA (JS-only, no review); --environment is mandatory since SDK 55
```

- `eas.json` production profile has `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL` env vars baked in.
- Submit track is `"production"` (changed from `"internal"` on 2026-05-13 once the closed test passed).
- Service account key: `google-service-account.json` (gitignored) — **currently missing from disk**, which is the reason Android is stale; see *Stores, accounts & shipping* above.

### Legal Documents (in `hasio-mobile-app/`, plus the website's `public/`)
- `docs/terms-of-service.html` — Terms of Service
- `docs/privacy-policy.html`, `assets/privacy-policy.html` (bundled in app), `public/privacy-policy.html`
  and the website's `public/privacy-policy.html` — **four byte-identical copies**; change all four.
- `docs/DATA_SAFETY_ANSWERS.md` — Google Play Data Safety form answers
- Updated 2026-09-25 for phone-number sign-in and push tokens; no voice/audio references, no
  Groq/ElevenLabs. The support address is still `support@hasio.xyz` (in the policies and
  `SUPPORT_EMAIL` in `SettingsScreenContent.tsx`) — whether it moves to hasio.net is an open
  decision; the mailbox must keep working either way.

## Design Constraints

- Green (#0D7A5F) primary color with generous white space
- Instrument Serif for headings, Outfit for body text, Cairo for Arabic
- Bilingual: Arabic (RTL) and English (LTR) with language toggle on all pages
- All translatable text in `translations` objects at component level
- Admin panel is Arabic-only with full RTL support
- Brand name always displayed as "Hasio" (English) in UI — never Arabic script for the logo
- Icons must be monochrome/neutral — never use colored icons
