# Image CDN for listing photos — Design Spec

Date: 2026-09-12

## Goal

Make listing and service photos load fast for users in Saudi Arabia **without shipping an app
update**, so the fix reaches every install that exists today — including the Android users stranded
on 1.0.0 (versionCode 11, last store update 2026-05-15), who cannot receive an OTA.

Photos are served today straight from Convex file storage in `eu-west-1`. Two measured problems:

1. **Nothing caches them.** Every response carries `Cache-Control: private` and
   `cf-cache-status: DYNAMIC`. No CDN edge holds a copy, so the first view for every user is a round
   trip to Ireland. Cloudflare has PoPs inside Saudi Arabia; Convex storage does not.
2. **No format negotiation.** Every image is JPEG. No AVIF, no WebP.

Measured against the 41 unique photos in production on 2026-09-12:

| | now | after (AVIF @1000px) |
|---|---|---|
| all 41 production photos | **6.2 MB** | ~1.8 MB |
| 15-photo sample | 2.52 MB | 0.72 MB |
| worst single photo | 535 kB | 74 kB |
| one photo, wired connection | 462 kB / 434 ms | — |

Source dimensions are already reasonable (736–2175px wide), so the win is **format conversion plus
edge caching**, not downscaling. Downscaling only matters for the handful of 1920–2175px images and
for the per-use `?w=` variants that a future app version can request.

## Non-goals

- **No app update.** Not a line of `hasio-mobile-app/` changes in this spec. That is the entire
  point — the fix has to reach binaries already on people's phones.
- **No Convex → R2/S3 migration.** Convex storage stays the system of record for bytes.
- **No changes to the two client-side performance problems** found alongside this (all five tabs
  mounting at once in `app/(tabs)/_layout.tsx:236`, and no cold-start cache). Both are real, both are
  client changes, and both are out of scope here — see "Deliberately deferred".
- **No re-encoding or replacing the stored originals.** The originals stay exactly as uploaded; the
  CDN derives from them on the fly.

## Architecture

```
app / admin  ──GET──▶  img.hasio.net/i/<storageId>?w=N   (Cloudflare Worker, edge-cached, AVIF/WebP)
                                    │
                                    └──origin fetch──▶  hearty-ram-74.eu-west-1.convex.cloud
                                                        /api/storage/<storageId>
```

Three pieces. The first two are what make it work without an app update.

### 1. The Worker — `img.hasio.net`

A **new, separate** Worker. The existing `hasio` Worker in `wrangler.jsonc` serves static assets for
`hasio.net` with no `main`; adding a `main` to it would change how the site is served. This gets its
own script and its own route so the site is untouched.

- **Route**: `img.hasio.net/*` (custom domain on the existing `hasio.net` zone, which is already live
  on Cloudflare).
- **Path**: `GET /i/<storageId>`, where `<storageId>` must match a UUID v4 shape. Anything else is a
  404 — this is what stops the Worker from being usable as an open proxy for arbitrary origins.
- **Method**: `GET` and `HEAD` only; everything else is 405.
- **Transform**: fetches the Convex storage URL with `cf.image` set to
  `{ width, format: "auto", fit: "scale-down", quality: 78, onerror: "redirect" }`.
  - `format: "auto"` negotiates AVIF/WebP/JPEG per device from the `Accept` header.
  - `fit: "scale-down"` never upscales — a 736px source asked for at 1000px stays 736px.
  - `onerror: "redirect"` is the fallback: if the transformation fails for any reason, Cloudflare
    serves the untransformed original instead of an error. Broken pipeline degrades to today's
    behaviour, not to a broken image.
- **Width**: `?w=` snapped **up** to the nearest value in a fixed allowlist
  `[200, 400, 600, 800, 1000, 1400]`, defaulting to `1000` when absent or unparseable. The allowlist
  matters for two reasons: each distinct width is a separately billed transformation and a separate
  cache entry, so an unbounded `?w=` is both a cost leak and a cache-hit-rate leak.
- **Response headers**: `Cache-Control: public, max-age=31536000, immutable`. Safe because a Convex
  storage id is immutable — an id can never come to point at different bytes. Also emit
  `x-hasio-img: <width>/<format>` so a `curl -I` can verify what actually happened.

`?w=` ships in v1 even though nothing requests it yet. It is a few lines, and it means the app can
start asking for card-sized images (`?w=400`, ~12× smaller than today) the moment it can ship a
change, without the Worker ever being touched again.

### 2. Write path — new uploads, from binaries already shipped

`getStorageUrl` (`convex/users/queries.ts:56`) has exactly two callers, both upload paths:

- `hasio-mobile-app/lib/convexUpload.ts:55`
- `src/admin/components/ImageUploader.jsx:70`

Nothing inside Convex calls it. It exists only to turn a freshly uploaded file into a URL that gets
written into `listings.images` / `services.images`.

So changing **what that query returns** makes every new upload store a proxied URL — from the
already-shipped mobile binaries and from the admin panel, with no client change on either side.

A shared helper does the mapping:

```ts
// convex/lib/imageUrl.ts
// Maps a Convex storage URL to its CDN form. Returns the input unchanged when
// IMAGE_CDN_URL is unset, so dev deployments and a half-finished rollout both
// behave exactly like today rather than serving broken URLs.
export function toCdnUrl(url: string | null): string | null
```

The unset-env passthrough is deliberate: it means deploying the Convex half before the Worker exists
is a no-op rather than an outage.

**`getBusinessDocUrl` is explicitly excluded.** It resolves private business licences and ID
documents uploaded for admin review. Serving those from a public, `immutable`, edge-cached URL would
be a data leak. Only `getStorageUrl` — public listing and service photos — is remapped.

### 3. Existing photos — one-time rewrite

An `internalMutation` that walks `listings.images` and `services.images` and rewrites
`https://hearty-ram-74.eu-west-1.convex.cloud/api/storage/<id>` → `https://img.hasio.net/i/<id>`.

- **Idempotent** — an already-rewritten URL is left alone, so re-running is harmless.
- **Selective** — non-Convex URLs (the 7 Unsplash seed images, 3 others) are left untouched. They are
  already on a CDN.
- **Reversible** — the storage id survives in the new URL, so the inverse mutation restores the exact
  original strings. This is the rollback.
- **Refuses to run** when `IMAGE_CDN_URL` is unset, rather than silently doing nothing.
- Paired with a **dry-run query** that reports how many URLs in each table would change, so the
  blast radius is known before anything is written.

Scale is small — 41 unique photos across ~56 listings plus services — so a single pass is enough. It
still takes an optional cursor so it cannot run away if the catalogue grows before it is run.

## Deliberately deferred

**Moments** (`convex/moments/queries.ts:33`) resolve `ctx.storage.getUrl()` per query, so they could
be proxied with no migration at all. They are left out of v1 anyway: the schema comment describes
them as "private to their author, never a public feed," the performance win is small (a user views
their own handful of photos), and routing private content through a public edge cache raises a
question not worth answering for that payoff. The security model would still be an unguessable UUID,
but "unguessable" and "public, immutable, cached at the edge" is a combination that deserves a
deliberate decision, not a side effect of a performance change.

**The two client-side problems** found while measuring, both out of scope and both worth their own
work later:

1. `app/(tabs)/_layout.tsx:236` renders all five tab screens as PagerView children, so cold start
   boots Home, Lodging, Planner, Favourites and Settings simultaneously — five screens' Convex
   queries and image loads competing during launch.
2. Convex caches in memory only, so every cold start shows skeletons on every screen; there is no
   persisted snapshot to paint from.

Neither can reach Android users until a build is submitted, which is why images went first.

## Risks

| Risk | Mitigation |
|---|---|
| **`img.hasio.net` is a permanent commitment.** Once proxied URLs are in the database, binaries already shipped will request that host forever. | Accepted explicitly. The domain is owned, the Worker is ~40 lines and stateless. The rollback mutation restores direct Convex URLs, but only helps clients that re-read the data — it cannot fix a binary that cached a URL. |
| Worker outage breaks images for everyone, old binaries included. | `onerror: "redirect"` degrades to the untransformed original. The Worker has no state, no dependencies, and no build step beyond `wrangler deploy`. |
| **Transformation quota.** Cloudflare's free tier covers 5,000 unique transformations/month; past that, new transformations return a **9422 error** rather than a charge — so overage breaks images, it does not cost money. | 41 photos × 6 allowed widths = 246 worst case, ~5% of the free tier. `format: "auto"` does not multiply this: per Cloudflare's pricing, serving one transformation in several formats counts once. `onerror: "redirect"` covers a 9422 by falling back to the original. Revisit the allowlist if the catalogue reaches thousands of photos — it is what keeps this bounded. |
| Private documents accidentally proxied. | `getBusinessDocUrl` explicitly untouched; moments explicitly deferred. Only `getStorageUrl` is remapped. |
| Deploying the Convex half before the Worker exists. | `toCdnUrl` passes through unchanged when `IMAGE_CDN_URL` is unset. |

## Verification

Evidence required before calling this done — each of these is a command with an expected output, not
an inspection:

1. `curl -I https://img.hasio.net/i/<id>` → `200`, `cache-control: public, max-age=31536000, immutable`.
2. Same request with `Accept: image/avif` → `content-type: image/avif`, and `content-length`
   materially below the origin's.
3. Second request to the same URL → `cf-cache-status: HIT`.
4. `curl -I 'https://img.hasio.net/i/<id>?w=400'` → smaller again than `?w=1000`.
5. `curl -I https://img.hasio.net/i/not-a-uuid` → `404`.
6. Total bytes across all 41 production URLs, before vs after, measured the same way as the table
   above — expect roughly 6.2 MB → under 2 MB.
7. Dry-run query output matches the row counts the migration then reports.
8. Admin panel: upload a photo, confirm the stored URL is the `img.hasio.net` form.
9. Open the shipped app against production, confirm listing photos still render.

Step 9 is the one that actually matters, because it is the only one that proves an already-shipped
binary is happy with the new URLs.

## Rollback

1. Run the inverse mutation — exact restoration, since storage ids survive in the proxied URLs.
2. Unset `IMAGE_CDN_URL` in the Convex dashboard — new uploads immediately revert to direct Convex
   URLs.
3. Leave the Worker deployed regardless. Any binary that cached a proxied URL still needs it to
   answer.
