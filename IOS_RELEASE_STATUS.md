# iOS Release Status & Playbook

_Last updated: 2026-08-16. This file is the source of truth for shipping iOS builds.
Read it fully before building — it encodes hard-won fixes. Update it after every build/submission._

## Current state

- **Publishing via a third party's Apple account** (Nabil Hamici, Team ID `W23759GRP4`) because the
  owner's own Apple enrollment is blocked (Apple case 20000130148873). He handles App Store Connect
  metadata; we build + upload from this Windows PC. **Get the app-transfer agreement honored later.**
- App Store Connect app: **"Hasio Travel"**, `com.hasio.travel`, **ascAppId `6800297588`**.
- Last shipped build: **v1.0.1 (build 5)** — uploaded to TestFlight, crash-free after fixes below.
- **v1.0.1 was REJECTED by App Review (Aug 2026): "user generated content settings missing from the
  App Information page."** Nabil has since filled in the UGC declaration in ASC. Remedy: upload a new
  build (bump version) and resubmit. No code change was demanded — the app already has
  report/block/delete-account (guideline 1.2 compliance).
- Support page live: `https://www.hasio.xyz/support.html` (bilingual, support@hasio.xyz).
- Reviewer demo account (verified working, in ASC review notes):
  `applereview@hasio.xyz` / `HasioReview2026!` — pre-approved business_owner, defaults to Arabic.

## How to ship the next build (exact steps)

1. **Bump version** in `hasio-mobile-app/app.json`: `"version": "1.0.1"` → `"1.0.2"` (or next).
   Do NOT touch `ios.buildNumber` — `autoIncrement: true` in eas.json bumps it automatically.
   Version bump is REQUIRED (runtimeVersion policy = appVersion; see OTA trap below).
2. Deploy any backend changes FIRST: `npx convex deploy --yes` from repo root
   (the missing-function crash below came from skipping this).
3. Build:
   ```bash
   cd hasio-mobile-app
   npx eas build -p ios --profile production --non-interactive --no-wait
   # poll: npx eas build:view <build-id>
   ```
4. Submit (uploads to Nabil's ASC via API key — no Apple ID login ever needed):
   ```bash
   npx eas submit -p ios --profile production --id <build-id> --non-interactive
   ```
5. Tell Nabil the new build number; he selects it in ASC and submits for review.
6. Update this file + the versions table below.

## Credentials inventory (ALL LOCAL-ONLY, gitignored — do not delete, cannot be re-downloaded)

| File | What |
|---|---|
| `hasio-mobile-app/appstore-connect-api-key.p8` | ASC API key **UR3PAK97LX** (team key, App Manager). Issuer ID `30cc1bab-a280-4644-8b93-900bcb21b973` |
| `hasio-mobile-app/credentials/hasio_dist.p12` | iOS distribution cert (password: `hasio2026`), legacy-encrypted, expires **2027-08-11**, cert id `5VG6M5UPU4` |
| `hasio-mobile-app/credentials/hasio.mobileprovision` | App Store profile "Hasio App Store", id `5X9G7JR3K5`, expires **2027-08-11** |
| `hasio-mobile-app/credentials.json` | Points EAS at the two files above (`credentialsSource: "local"` in eas.json production profile) |

All four `submit.production.ios` fields in `eas.json` are filled — nothing to ask Nabil for.
Cert + profile were generated **from Windows via the ASC API** (no Mac, no Apple ID):
openssl CSR → `POST /v1/certificates` (IOS_DISTRIBUTION) → `openssl pkcs12 -export -legacy`
(**must use `-legacy`** — OpenSSL 3 default AES encryption fails macOS keychain import = build dies
in PREPARE_CREDENTIALS) → `POST /v1/profiles` (IOS_APP_STORE, bundleId internal id `THCRG443T9`).
At expiry, regenerate the same way (scripts pattern: ES256 JWT, `iss`=IssuerID, kid=KeyID,
`dsaEncoding:"ieee-p1363"`).

## Traps that already burned us (do not repeat)

1. **Directory name must stay `hasio-mobile-app`** — the old double-space name broke every iOS build
   (CocoaPods script phase: `bash: /Users/expo/workingdir/build/hasio: No such file or directory`).
2. **OTA runtime trap**: expo-updates channel `production` serves updates by runtimeVersion
   (= app version). v1.0.0 iOS pulled a stale Android-era bundle and crashed. After shipping a new
   version, any `eas update --channel production` publishes only for the runtime it's built from —
   old-version users keep old bundles. Always bump the version for new binaries.
3. **Backend/app drift**: build 4 crashed because `moments/queries:getMyMoments` existed in the repo
   but was never `convex deploy`ed to prod. Deploy Convex before shipping a client that calls new functions.
4. **ErrorBoundary** now logs + shows the error message on the crash screen — use a screenshot from
   the tester to diagnose, it names the failing function.
5. Simulator builds for screenshots: `eas build -p ios --profile simulator` (profile exists in eas.json);
   send tester the artifact tar.gz — never send source or backend keys.
6. iPad screenshots NOT needed (`supportsTablet: false`). iPhone 6.9"/6.7" only.

## Version history

| Version | Build | Date | Outcome |
|---|---|---|---|
| 1.0.0 | 4 | 2026-08-11 | Crashed on TestFlight (stale OTA bundle + missing Convex fn) |
| 1.0.1 | 5 | 2026-08-13 | Crash fixed, uploaded — **rejected: UGC settings missing in ASC App Information (metadata only)** |
| 1.0.2 | 6 (auto) | pending | Next: rebuild after owner's app updates; UGC section now filled by Nabil |

## ASC listing copy (already delivered to Nabil)

- Support URL `https://www.hasio.xyz/support.html` · Marketing `https://www.hasio.xyz` ·
  Privacy `https://www.hasio.xyz/privacy-policy.html`
- Subtitle EN: `Explore Al-Ahsa like a local` · AR: `دليلك إلى واحة الأحساء`
- Keywords: `Al-Ahsa,Hofuf,Saudi,travel,guide,oasis,hotels,restaurants,attractions,events,trip,tourism,booking`
- Territories: DZ, AU, BH, KW, OM, QA, SA, AE (no EU/UK — deliberate). Privacy labels: email/name +
  user photos, no tracking/location.
