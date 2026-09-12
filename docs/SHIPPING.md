# How to ship an update to Hasio

There are **two completely different ways** to get a change to users, and picking
the wrong one is the difference between five minutes and five days.

---

## The one question that decides everything

> **Does this change need new native code?**

**No → OTA update.** Live in minutes. No Apple review, no Google review, nobody
else involved. Users get it the next time they open the app.

**Yes → new build.** Days. Apple review, and for iOS it goes through Nabil, who
owns the developer account and has to submit it by hand.

### What counts as "native"

| Needs a new build | Ships fine over OTA |
|---|---|
| Adding `expo-notifications`, `expo-haptics`, `expo-camera` — anything with native code | Any screen, layout, colour, text, animation |
| Upgrading the Expo SDK or React Native | New business logic, API calls, validation |
| Changing app icon, splash, permissions, bundle id | New **pure-JS** libraries (e.g. `react-native-calendars`) |
| Changing `version` in `app.json` | Anything already in the shipped binary |

The rule of thumb: if it only touches `.ts`/`.tsx` and the packages already
installed in the live build, it's an OTA.

**Phone OTP is an OTA.** It uses `fetch` and `expo-secure-store`, both already in
the shipped app.

---

## Path A — OTA update (the usual case)

```bash
# 1. Backend FIRST, always
npx convex deploy --yes

# 2. Then the app
cd hasio-mobile-app
npx eas update --channel production --message "what changed"
```

That's it. Users pick it up on their next launch.

### The three rules that will bite you

**1. Backend before app. Always.**
An OTA reaches users in minutes. If it calls a Convex function that isn't
deployed yet, the app crashes for everyone. *This already happened once* — build
4 shipped calling a function that only existed in the repo.

**2. Never change `version` in `app.json` for an OTA.**
`runtimeVersion` is set to `appVersion`, so an update only reaches binaries built
from that same version. The live apps are **1.0.2**. Bump it to 1.1.0 and your
update goes to a version nobody has — silently, with no error.

**3. Never add a native module in an OTA.**
The JS will reference something the binary doesn't contain, and the app crashes
on launch. If `npx expo install` adds anything with native code, you're on Path B.

### Rolling back

```bash
npx eas update:list --branch production      # find the previous update
npx eas update:republish --group <id>        # push it back out
```

Minutes, same as shipping. This is why OTA is low-risk.

---

## Path B — new store build (rare)

Only when Path A can't work. Budget **3–7 days**, mostly Apple review.

```bash
cd hasio-mobile-app
# bump "version" in app.json first (buildNumber auto-increments)
npx eas build -p android --profile production
npx eas build -p ios --profile production
npx eas submit -p android --profile production
npx eas submit -p ios --profile production
```

**iOS has a human in the loop.** The app is published under a third party's
Apple account (Nabil Hamici, team `W23759GRP4`) because the owner's enrolment is
blocked. After `eas submit`, **Nabil must select the build in App Store Connect
and submit it for review.** Nothing happens until he does. Message him the same
day you submit.

Also for iOS: `eas.json` sets `EXPO_NO_CAPABILITY_SYNC: "1"` and
`credentialsSource: "local"`, so EAS will **not** add Apple capabilities for you.
Anything needing a new capability (push, for example) requires enabling it on the
App ID and regenerating the provisioning profile by hand.

Full detail: `docs/PHASE1_RELEASE_CHECKLIST.md`.

---

## Current live versions

| | Store binary | Runtime it accepts | Gets the 1.0.2 OTAs? |
|---|---|---|---|
| App Store | 1.0.2 (build 6), live 2026-08-29 | 1.0.2 | **yes** |
| Play Store | **1.0.0 (versionCode 11), live 2026-05-15** | 1.0.0 | **NO** |

**Android is stranded.** `runtimeVersion` policy is `appVersion`, so a 1.0.0
binary only accepts runtime-**1.0.0** updates, and every production OTA since
2026-09-05 targets runtime **1.0.2**. Android users have therefore received
none of bookings, ratings, favourites, the SAR/USD toggle, the redesigned
Home/Planner or the Eastern Province expansion — they are running the
2026-07-19 bundle on a May binary.

1.0.2 AABs already exist on EAS at versionCode **13 and 14** (production
profile, built 2026-08-30) and were never rolled out, because
`hasio-mobile-app/google-service-account.json` is not on disk and
`eas submit -p android` cannot run without it. Upload build 14's AAB by hand
in Play Console and Android catches up on the next launch: the binary becomes
1.0.2, so it immediately pulls the current runtime-1.0.2 OTA.

Keep `main` matching the stores. It drifted once — as of 2026-09-12 the live
OTA bundle and the production Convex deployment were both running
`brand-lime` while `main` sat 15 commits behind, which means a build taken
from `main` would have shipped a regression. `brand-lime` was merged back
into `main` on 2026-09-12. **Before any build, OTA or `convex deploy`, check
that `main` is not behind a feature branch.**

---

## Deploying the website

Vercel deploys automatically on push to `main`. That means **merging to `main`
publishes the website**, including the admin panel.

So: if the admin panel gains a feature that calls a new Convex function, deploy
Convex *before* merging, or the live panel breaks.

---

## Where things live

| | |
|---|---|
| Convex prod | `hearty-ram-74.eu-west-1` — what the store apps talk to |
| Convex dev | `limitless-mockingbird-449.eu-west-1` — for testing |
| Website | Vercel, from `main` → https://www.hasio.xyz |
| Secrets | Convex dashboard env vars — `npx convex env set NAME value [--prod]` |

Dev and prod env vars are **separate stores**. Setting one does not set the other.

---

## Before any release that collects new data

Both stores require an accurate declaration of what you collect. These are
console forms — **no build needed**, and they can be updated any time:

- Play Console → Data Safety (answers tracked in `hasio-mobile-app/docs/DATA_SAFETY_ANSWERS.md`)
- App Store Connect → App Privacy
- The privacy policy at `public/privacy-policy.html` (deploys with the website)

Adding phone-number login means adding "Phone number" to all three.
