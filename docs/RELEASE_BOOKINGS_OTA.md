# Releasing bookings and ratings

Everything below ships to **existing users** as an over-the-air update — minutes,
no App Store or Google Play review. That is only possible because nothing in it
adds a native module and `app.json` `version` never changes.

**The order is not negotiable.** Build 4 crashed on the App Store because a
client shipped calling a Convex function that only existed in the repo. The
backend goes first, always.

Related: `docs/SHIPPING.md` (the general OTA-vs-build rule),
`docs/superpowers/specs/2026-09-04-bookings-and-ratings-design.md` (why any of
this is shaped the way it is).

---

## 0. Before anything

- [ ] All four plans in `docs/superpowers/plans/` are executed and green.
- [ ] From the repo root: `npm test` and `npm run typecheck:convex` pass.
- [ ] From `hasio-mobile-app/`: `npx tsc --noEmit`, `npm test`, and
      `npx expo export --platform android` all pass.
- [ ] `git diff main -- hasio-mobile-app/package.json` shows **one** added
      runtime dependency, `react-native-calendars`. Anything native here is a
      crash on launch for every user, with no store review to catch it.
- [ ] `grep '"version"' hasio-mobile-app/app.json` still reads **1.0.2**.
      Over-the-air updates target `runtimeVersion`, which equals `appVersion` —
      bump it and the update reaches a binary nobody has, silently.
- [ ] `hasio-mobile-app/.env.local` is **deleted**. If it exists, the shipped
      bundle talks to the dev backend.

## 1. Phone sign-in must be live first

Booking requires a verified phone, because the host has to be able to call the
guest. That is `docs/plans/2026-09-04-otp-ota-release.md`, and it is blocked on
an SMS provider that can deliver to +966.

- [x] Infobip provider written, tested (7 tests) and **deployed to prod**;
      `SMS_PROVIDER`, `INFOBIP_API_KEY`, `INFOBIP_BASE_URL` set on prod
      (2026-09-04).
- [ ] **The Infobip account is in demo mode.** A live test send reached
      Infobip and was logged with status `REJECTED_DESTINATION_NOT_REGISTERED`
      (`EC_DEST_ADDRESS_NOT_IN_SMS_DEMO`) — the pipeline works end to end, but
      a demo account only delivers to numbers verified in the Infobip
      dashboard. **Either add every reviewer's number there, or take the
      account out of demo.** Then send one code to your own phone.
- [ ] Note: Better-Auth swallows `sendOTP` errors, so the app says "code sent"
      even when Infobip rejected the number. Infobip's own log
      (`GET /sms/1/logs`) is the truth, not the HTTP 200.

Bookings and ratings themselves need no SMS. If phone sign-in slips, they can
still ship — but then decide deliberately whether the phone gate stays, because
email-account users would have no way through it.

## 2. Backend to production

```bash
npx convex deploy --yes
```

- [x] Deployed 2026-09-04 (twice — booking/review functions, then the Infobip
      provider). Additive: new functions, indexes and three crons. Note the
      schema was NOT already live — this deploy carried it, and the new
      `auth.ts` with it; email sign-in was verified working against dev on the
      same code before deploying.
- [ ] Convex dashboard → **Schedules** shows three jobs: expire pending stay
      requests (hourly), check-in reminders (06:00 UTC), complete finished stays
      (01:00 UTC).
- [ ] Backfill owner ids on existing bookings (harmless now — production has
      0 bookings — but run it before the app update so the crons' owner
      lookups are complete):
      `npx convex run bookings/lifecycle:backfillOwnerIds --prod`
- [ ] **Clear the fabricated ratings:**
      `npx convex run admin/devTools:clearSeededRatings --prod`
      Expect roughly 54 cleared. 54 of 55 production listings carry an invented
      3.7–4.9 with `reviewCount: 0` and no reviews behind it; left in place, the
      first honest review turns a fake 4.8 into a real 3.0 and reads as a bug.
      Safe to re-run — a listing with real reviews keeps its real average.
- [ ] Optional email: set `RESEND_API_KEY` and `RESEND_FROM` on prod. Without
      them the in-app inbox still works and no email is sent. With no push in
      this release, email is the only thing that reaches a host who is not
      currently looking at the app — worth doing.

## 3. Website (the admin panel)

Vercel deploys from `main`, so merging releases the panel. **After** step 2,
never before: the panel calls functions that must already exist.

```bash
git checkout main && git merge brand-lime && git push
```

Dry-run on 2026-09-04: `git merge-tree --write-tree main brand-lime` exits 0 —
**no conflicts**, 76 commits. The one `main`-only commit (`e7dd841`, landing
typeface) merges cleanly with its twin on `brand-lime`.

- [ ] `/admin` loads; the Users tab lists accounts; Bookings shows the stay
      columns; a listing row has a host action.
- [ ] `grep -c modulepreload dist/index.html` is **0** — the landing page must
      not start pulling in Convex or Better-Auth for anonymous visitors.

## 4. Make something bookable

**Nothing is visible to a guest until this is done.** Production has 13 hotels:
one has an owner, none has a nightly price, and a hotel with no price shows no
Book button.

- [x] All 12 production hotels priced 2026-09-04 via
      `admin/devTools:setEstimatedRates --prod` (200–850 SAR by class,
      researched estimates — see the mutation's comment). Correct any in
      `/admin` → Listings; the sweep never overwrites a rate that exists.
- [x] All 12 assigned to `autonomy.owner@gmail.com` (the admin account) as the
      concierge host. Reassign per-listing from the row's host picker.
- [ ] Start with three or four. A partial rollout is safe — unpriced hotels
      simply stay browse-only.

## 5. The app

```bash
cd hasio-mobile-app
npx eas update --channel production --message "Book a stay, rate a place"
```

- [ ] Confirm once more that `.env.local` is gone and `version` is 1.0.2.
- [ ] Updated.

## 6. Watch it on a real device

- [ ] Force-close the app, reopen, confirm the update landed.
- [ ] Open a priced hotel → **Book** → pick a Thursday and the Sunday after.
      The footer must read **3 nights**. Four means the date arithmetic is
      wrong and every guest is being overcharged by a night.
- [ ] Submit. It appears under *My bookings* as pending, with a code.
- [ ] Confirm it from the concierge account's inbox. The guest's status changes
      and a notification arrives in their inbox.
- [ ] Rate a place. Check an unrated listing shows **no star at all** rather
      than a zero.
- [ ] Repeat the first two steps in Arabic.

## 7. Compliance

Bookings collect data the current store listings do not declare — guest names
against stays, phone numbers, and booking history.

- [ ] `public/privacy-policy.html` (deploys with the website).
- [ ] Play Console → Data Safety, and
      `hasio-mobile-app/docs/DATA_SAFETY_ANSWERS.md` to match.
- [ ] App Store Connect → App Privacy.

All three can be changed at any time and need no build.

## Rollback

```bash
npx eas update:list --branch production
npx eas update:republish --group <previous id>
```

Minutes, which is what makes an over-the-air release low-risk. The backend is
additive, so an older client keeps working against it and nothing needs undoing
server-side.

The one thing rollback does **not** undo is `clearSeededRatings`. That is
deliberate — those ratings were never real, and restoring them would mean
putting invented numbers back in front of users.

## Still not in this release

Push notifications (needs a native build — the server side is already wired and
dormant), payments, per-unit inventory and availability search, owner replies to
reviews, and booking SMS.
