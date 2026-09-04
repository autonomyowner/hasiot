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

- [ ] An SMS provider is working against **production** and one real Saudi
      number has received a code.
- [ ] If it is Infobip rather than Twilio, `convex/sms/provider.ts` has the new
      provider and its env vars are set on prod.

Bookings and ratings themselves need no SMS. If phone sign-in slips, they can
still ship — but then decide deliberately whether the phone gate stays, because
email-account users would have no way through it.

## 2. Backend to production

```bash
npx convex deploy --yes
```

- [ ] Deployed. This is additive — new functions and three crons; the schema was
      already live from the phone-sign-in release.
- [ ] Convex dashboard → **Schedules** shows three jobs: expire pending stay
      requests (hourly), check-in reminders (06:00 UTC), complete finished stays
      (01:00 UTC).
- [ ] Backfill owner ids on existing bookings:
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

- [ ] `/admin` loads; the Users tab lists accounts; Bookings shows the stay
      columns; a listing row has a host action.
- [ ] `grep -c modulepreload dist/index.html` is **0** — the landing page must
      not start pulling in Convex or Better-Auth for anonymous visitors.

## 4. Make something bookable

**Nothing is visible to a guest until this is done.** Production has 13 hotels:
one has an owner, none has a nightly price, and a hotel with no price shows no
Book button.

- [ ] Create or nominate the **Hasio concierge** account — an approved
      `business_owner`. Its inbox is where seeded-hotel requests land, and a
      person has to watch it.
- [ ] For each hotel to be bookable, in `/admin` → Listings → edit:
      nightly rate, max guests, unit count, check-in and check-out times.
- [ ] Then, on the same row, use the host action to assign it to the concierge
      account.
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
