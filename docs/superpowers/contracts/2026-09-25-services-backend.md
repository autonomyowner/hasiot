# Backend contract: bookable services, push, admin (1.1.0)

- **Backend:** `convex/` (one Convex project). Development deployment from `.env.local` (`CONVEX_DEPLOYMENT`); production `hearty-ram-74` (eu-west-1).
- **Branch:** `services-release`. Commits whose subject starts with `contract:` change this document.
- **Design:** `docs/superpowers/specs/2026-09-25-bookable-services-release-design.md` (section 4).
- **Status:** written before implementation. Every function below is built test-first in Part 1 of the plan; clients build against this text in Part 2.
- **Already implemented in the foundation (F, commits `a2e83c1`, `d18fe2f`, `501f291`):**
  - all of section 1 (`services/logic.ts`, `lib/errors.ts`, `toProvinceCity`);
  - all of section 2 (the schema);
  - the compatibility rows of section 3 (`includeServices` and the legacy filters on `getUserBookings` and `getBooking`, the manager check, `rescheduleBooking`);
  - the event texts, `notifyUserEvent` and `data.target` of section 6;
  - `recomputeReviewTarget` / `recomputeServiceRating` for section 5;
  - `enforceRateLimit` as `ConvexError` (section 7).

## Rules for every function

**Refusals.** A refusal a person can cause and fix is thrown as `ConvexError(message)`, where `message` is **one string, Arabic first, then ` / `, then English**, as `BOOKING_ERRORS` in `convex/bookings/logic.ts` does.
- A client reads it from `err.data` (a string) when `err instanceof ConvexError`. `lib/serverError.ts` in the app already does this.
- Production redacts the text of any other error to "Server Error". A plain `Error` is therefore a bug wherever a person can trigger it, and this work converts the ones it touches.
- The app matches on the **English half**, so the English wording below is an API: changing it breaks a client. The exact strings live in code (`SERVICE_ERRORS` and the others below) and are quoted here.

**Unchanged refusals.** `"Not authenticated"` (English only), thrown by the existing booking mutations. The app maps it to "session expired". New functions throw `AUTH_ERRORS.NOT_AUTHENTICATED` (section 1) instead.

**Compatibility** (design 4.1): nothing below removes an argument, adds a required one, or changes an existing return shape. The functions the live 1.0.2 / 1.0.0 apps call (`getUserBookings`, `getBooking`, `getBusinessBookings`, `getOwnerStats`, `quoteStay`, `createStayBooking`, `cancelBooking`, `confirmBooking`, `declineBooking`, `completeBooking`, `markNoShow`, the reviews and notifications functions) behave exactly as before **unless a new optional argument asks otherwise**.

## Changes from the design review (2026-09-25), which override the sections below

1. **Expiry.** A service request expires at `min(createdAt + 48h, its start time)`, so a same-day request cannot sit pending, or be confirmed, after the service has begun.
2. **Cancelling.** `SERVICE_STARTED` applies only to a **confirmed** service booking whose start has passed. A pending request can always be withdrawn.
3. **Duplicates.** `DUPLICATE` is read from the traveller's own pending and confirmed bookings (`by_userId_and_status`), matching `serviceId` and `date`.
4. **City filtering.** `searchServices` filters `city` after merging the two search indexes, with `matchesCity`. An index filter would miss rows stored as "Hofuf".
5. **Completion.** `completeFinishedStays` also completes confirmed service bookings whose `checkOut` equals today, so "How was it?" arrives the morning after the service.
6. **The server never requires `city`.** It is checked only when sent, because the live 1.0.2 and 1.0.0 forms never send it.
7. **A deleted service.** `service` on a booking row is also `null` when the service was deleted.
8. **Admin search** is its own array query, never an argument of a paginated one:
   - `adminListServices({ paginationOpts, status?, serviceType?, city? })` plus `adminSearchServices({ search, status?, serviceType?, city? })`, at most 50;
   - `adminListBookings({ paginationOpts, status?, kind? })` plus `adminSearchBookings({ search })`, at most 50.
9. **`getDashboardStats` is additive.** The panel already in production reads its current fields, and the backend deploys first. New fields such as `capped` are added; nothing is renamed or removed.
10. **Both sign-in refusals map to "session expired".** Clients map the old English-only `"Not authenticated"` and the new `"… / You need to be signed in."` to the same message.

## Changes after the backend merged (2026-09-25, review fixes and the Fable 5.1 security review)

| # | Rule | Refusal text (English half) |
|---|---|---|
| 11 | Confirming a pending request after its `expiresAt` is refused, for stays and services, even before the hourly job marks it expired. | "This request is no longer pending." (existing) |
| 12 | A host or provider cannot review their own place or service (`REVIEW_ERRORS.OWN_ITEM`). | "You cannot review your own place or service." |
| 13 | A suspended host's listings cannot be booked (stay or slot) or quoted, and the AI planner never recommends them. | "This listing is not available right now." / `quoteStay` → `NOT_BOOKABLE` |
| 14 | Only a live listing or service (approved, or a seed listing with no status) can be suspended. Reinstating sets "approved", so a pending one is rejected instead. | "Only a live listing can be suspended; reject a pending one instead." / "Only a live service can be suspended; reject a pending one instead." |
| 15 | Review lists never carry `bookingId`, so an anonymous author cannot be matched to a booking. Only `getMine` / `getMineForService` return it. | — |
| 16 | Service free-text fields are cut to size: priceRange 60, availability 300, contactPhone 30, contactEmail 120, region 60, languages 10 × 30. Image URLs over 1000 characters are dropped. The public type filter reads the new `by_status_and_serviceType` index. | — (cut, not refused) |
| 17 | `registerPushToken`: 20 a day per user. | "You've reached today's device registration limit. Please try again tomorrow." |
| 18 | Names are trimmed and cut to 50 characters wherever they are written. | — |
| 19 | Every report's `targetId` must be 1–200 characters (`INVALID_TARGET_ID`; `INVALID_MESSAGE_ID` for `ai_message`), and `details` is cut to 2000 characters, for every target type. | "Invalid report target id." |
| 20 | A service booking can be completed by its provider only once it is **confirmed and its start time has passed** (`BOOKING_ERRORS.SERVICE_NOT_STARTED`). Anything else goes through the admin panel. | "A service can only be completed once it is confirmed and has started." |
| 21 | A same-day request that expired at its start time is told "did not respond before the start time", not "within 48 hours" (`expiredAtStart`). | — |
| 22 | `deleteMyAccount` deletes the sign-in too: Better Auth's sessions, linked accounts and user, via the internal adapter. If that fails, the whole deletion rolls back. Verified on development: the email no longer signs in, and the phone returns as a new, empty account. | — |
| 23 | `markNoShow` on a booking that is already closed (cancelled, completed, declined, expired, no-show) is refused as closed, not as forbidden — the race where the guest cancels while the host's inbox still shows the booking confirmed. A pending request keeps `NOT_AUTHORIZED`. Stays and services alike. | "This booking is already closed." (existing) |
| 24 | An admin's status change (`admin.mutations.updateBookingStatus`) drops `declineReason` when the booking leaves "declined" and `cancellationReason` when it leaves "cancelled". Both apps, the live ones included, show a decline reason whenever the field is set. | — |
| 25 | Admin user rows (`adminListUsers`, `adminSearchUsers`, `adminGetUser`) carry `accountRejectionReason`, set while a business or provider account stands rejected. | — |

## 1. Shared constants

`convex/lib/errors.ts` (new):

```ts
export const AUTH_ERRORS = {
  NOT_AUTHENTICATED: "يجب تسجيل الدخول أولاً. / You need to be signed in.",
  NOT_AUTHORIZED: "غير مصرح لك بهذا الإجراء. / You are not allowed to do that.",
} as const;
```

`convex/lib/cities.ts` gains the list the server validates against. The English keys are exactly those of `hasio-mobile-app/constants/cities.ts`:

```ts
export const EASTERN_PROVINCE_CITIES = [
  "Dammam", "Al Khobar", "Al Ahsa", "Qatif", "Jubail", "Hafar Al Batin", "Khafji",
  "Ras Tanura", "Abqaiq", "Nairyah", "Qaryat Al Ulya", "Al Udayd", "Al Bayda",
] as const;
/** The canonical city for a stored or submitted value, or null when it is not one of the 13 (after folding aliases). */
export function toProvinceCity(city: string | undefined | null): string | null;
```

`convex/services/logic.ts` (new, pure):

```ts
export const SERVICE_TYPES = ["tour_guide","photographer","driver","translator","event_planner","catering","equipment_rental","other"] as const;
export const PRICE_UNITS = ["per_hour","per_day","per_event","fixed"] as const;
export const MAX_HOURS = 12;
export const MAX_DAYS = 14;
export const DEFAULT_MAX_GROUP = 20;
export const MAX_GROUP = 100;
export const MAX_SERVICE_PRICE = 100_000;
export const MAX_SERVICE_IMAGES = 5;
export const MAX_TITLE = 100;
export const MAX_DESCRIPTION = 2000;
```

`SERVICE_ERRORS` (exact text):

| Key | Message |
|---|---|
| `SERVICE_UNAVAILABLE` | `هذه الخدمة غير متاحة حاليًا. / This service is not available right now.` |
| `NOT_BOOKABLE` | `هذه الخدمة لا تقبل الحجز حاليًا. / This service is not available for booking.` |
| `NO_PRICE` | `لم يحدد مقدم الخدمة سعرًا بعد. / The provider has not set a price yet.` |
| `OWN_SERVICE` | `لا يمكنك حجز خدمتك الخاصة. / You cannot book your own service.` |
| `INVALID_DATE` | `اختر تاريخًا صحيحًا. / Choose a valid date.` |
| `PAST_DATE` | `لا يمكن الحجز في تاريخ ماضٍ. / The date cannot be in the past.` |
| `INVALID_TIME` | `اختر وقت بدء صحيحًا. / Choose a valid start time.` |
| `PAST_TIME` | `وقت البدء مضى بالفعل. / That start time has already passed.` |
| `INVALID_HOURS` | `عدد الساعات بين 1 و 12. / Hours must be between 1 and 12.` |
| `INVALID_DAYS` | `عدد الأيام بين 1 و 14. / Days must be between 1 and 14.` |
| `INVALID_PARTY` | `عدد الأشخاص غير صحيح. / Invalid number of people.` |
| `TOO_MANY_PEOPLE` | `عدد الأشخاص أكبر من المسموح لهذه الخدمة. / Too many people for this service.` |
| `DUPLICATE` | `لديك طلب قائم لهذه الخدمة في هذا اليوم. / You already have an active request for this service on that day.` |
| `SERVICE_STARTED` | `لا يمكن الإلغاء بعد بدء الخدمة. تواصل مع مقدم الخدمة. / A service cannot be cancelled after it starts. Contact the provider.` |
| `NO_RESCHEDULE` | `لتغيير موعد الخدمة، ألغِ الطلب واحجز من جديد. / To change a service booking, cancel it and book again.` The same string as `BOOKING_ERRORS.SERVICE_NO_RESCHEDULE`, which `rescheduleBooking` throws. |
| `INVALID_TYPE` | `اختر نوع خدمة صحيحًا. / Choose a valid service type.` |
| `INVALID_UNIT` | `اختر وحدة سعر صحيحة. / Choose a valid price unit.` |
| `INVALID_PRICE` | `أدخل سعرًا صحيحًا بين 1 و 100000 ريال. / Enter a valid price between 1 and 100000 SAR.` |
| `PRICE_NOT_WHOLE` | `السعر يجب أن يكون رقمًا صحيحًا. / The price must be a whole number.` |
| `INVALID_GROUP` | `الحد الأقصى للأشخاص بين 1 و 100. / Group size must be between 1 and 100.` |
| `TITLE_REQUIRED` | `أدخل عنوان الخدمة بالعربية والإنجليزية. / Enter the service title in Arabic and English.` |
| `TITLE_TOO_LONG` | `العنوان طويل جدًا (100 حرف كحد أقصى). / The title is too long (100 characters max).` |
| `DESCRIPTION_TOO_LONG` | `الوصف طويل جدًا (2000 حرف كحد أقصى). / The description is too long (2000 characters max).` |
| `INVALID_CITY` | `اختر مدينة من القائمة. / Choose a city from the list.` |
| `TOO_MANY_IMAGES` | `الحد الأقصى 5 صور. / Up to 5 photos.` |
| `NOT_A_PROVIDER` | `هذه الميزة لمقدمي الخدمات فقط. / Only service providers can do this.` |
| `NOT_APPROVED` | `يجب اعتماد حسابك قبل إضافة الخدمات. / Your account must be approved before you add services.` |
| `NOT_FOUND` | `الخدمة غير موجودة. / Service not found.` |
| `NOT_YOURS` | `هذه الخدمة ليست لك. / This is not your service.` |
| `HAS_OPEN_BOOKINGS` | `لا يمكن حذف خدمة لديها حجوزات قائمة. / A service with open bookings cannot be deleted.` |

**Pure functions** in `convex/services/logic.ts`:

```ts
/** Approved + price > 0 + not suspended; owner approved service_provider, not suspended. */
export function isBookableService(
  service: { status: string; price?: number },
  owner: { role?: string; isApproved?: boolean; isSuspended?: boolean } | null
): boolean;

/** Visible to travellers at all: status "approved", owner exists and is not suspended. */
export function isPublicService(
  service: { status: string },
  owner: { isSuspended?: boolean } | null
): boolean;

export type ServiceQuote = {
  date: string;            // "YYYY-MM-DD", the (first) service day
  time: string;            // "HH:MM", start time, Riyadh
  quantity: number;        // hours (per_hour), days (per_day), 1 otherwise
  priceUnit: "per_hour" | "per_day" | "per_event" | "fixed";
  unitPrice: number;       // SAR
  totalAmount: number;     // unitPrice * quantity
  currency: "SAR";
  partySize: number;
  checkIn: string;         // = date
  checkOut: string;        // date + (per_day ? quantity : 1), exclusive
};

/**
 * Price a service booking. Never throws. `today` is the Riyadh date and `now` the clock,
 * both passed in. Rules, in this order:
 *   INVALID_DATE (not a real YYYY-MM-DD) → PAST_DATE (date < today) →
 *   INVALID_TIME (not HH:MM) → PAST_TIME (date == today and start <= now) →
 *   NO_PRICE (price missing or <= 0) →
 *   INVALID_HOURS / INVALID_DAYS (per_hour 1..12, per_day 1..14; integer; default 1) →
 *   INVALID_PARTY (partySize not an integer >= 1; default 1) →
 *   TOO_MANY_PEOPLE (partySize > (maxGroupSize ?? 20)).
 * An unknown or missing priceUnit is treated as "fixed".
 */
export function computeServiceQuote(
  service: { price?: number; priceUnit?: string; maxGroupSize?: number },
  args: { date: string; time: string; quantity?: number; partySize?: number },
  today: string,
  now: number
): { ok: true; quote: ServiceQuote } | { ok: false; error: string };

/** Provider input check for submit and update; returns the normalised patch or throws ConvexError(SERVICE_ERRORS.*). */
export function validateServiceInput(args: {
  serviceType?: string; priceUnit?: string; price?: number | null; maxGroupSize?: number | null;
  title_en?: string; title_ar?: string; description_en?: string; description_ar?: string;
  images?: string[]; city?: string;
}, mode: "create" | "update"): Record<string, unknown>;
```

`validateServiceInput`:
- In `create` mode, `serviceType`, `title_en` and `title_ar` are required: `INVALID_TYPE` or `TITLE_REQUIRED`.
- Titles are trimmed. Empty → `TITLE_REQUIRED`; over 100 → `TITLE_TOO_LONG`.
- Descriptions are trimmed; over 2000 → `DESCRIPTION_TOO_LONG`.
- `priceUnit` ∉ `PRICE_UNITS` → `INVALID_UNIT`.
- `price`:
  - not finite, or outside 1..100000 → `INVALID_PRICE`;
  - not an integer → `PRICE_NOT_WHOLE`;
  - `null` in update mode clears it.
- `maxGroupSize` outside 1..100, or not an integer → `INVALID_GROUP`; `null` clears it.
- More than 5 `images` → `TOO_MANY_IMAGES`.
- `city`: `toProvinceCity(city) === null` → `INVALID_CITY`; otherwise stored canonical ("Hofuf" is stored as "Al Ahsa").

## 2. Schema changes (`convex/schema.ts`)

All additive or relaxing. Existing documents stay valid.

**`bookings`**
- `listingId: v.optional(v.id("listings"))`. It was required. A service booking has none.
- New optional fields:
  - `serviceId: v.id("services")`
  - `quantity: v.number()`
  - `unitPrice: v.number()`
  - `priceUnit: v.string()`
- `kind` gains `"service"`, and `type` gains `"service"`.
- New index `by_serviceId` `["serviceId"]`.

**`services`**
- New optional fields: `price: v.number()` (whole SAR), `maxGroupSize: v.number()`, `suspendedReason: v.string()`.
- `status` gains `"suspended"`.
- New search index `search_services_ar`: `searchField: "title_ar"`, `filterFields: ["serviceType", "city"]`.

**`reviews`**
- `listingId: v.optional(v.id("listings"))`. It was required.
- New optional field `serviceId: v.id("services")`.
- New index `by_serviceId` `["serviceId"]`.
- Exactly one of `listingId` / `serviceId` is set, enforced in code.

**`users`**
- New optional fields: `accountRejectionReason: v.string()`, `accountRejectedAt: v.number()`.

**`notifications.data`**
- New optional fields: `serviceId: v.id("services")`, `target: v.string()`.

**`pushTokens`** (new table)

```ts
pushTokens: defineTable({
  token: v.string(),                 // "ExponentPushToken[...]"
  userId: v.id("users"),
  platform: v.optional(v.string()),  // "ios" | "android"
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_token", ["token"]).index("by_userId", ["userId"]),
```

`users.pushTokens` stays in the schema but is never written again. Delivery reads the table.

## 3. Bookings

### `bookings.mutations.createServiceBooking` (new, mutation)

Args:

```ts
{ serviceId: Id<"services">, date: string, time: string, quantity?: number, partySize?: number, notes?: string }
```

Returns `{ bookingId: Id<"bookings">, confirmationCode: string }`. The code has the same `HSO-XXXXX` form as stays, unique across all bookings.

**Checks, in this order:**
1. Signed in, else `"Not authenticated"`.
2. `user.phoneVerified`, else `BOOKING_ERRORS.PHONE_REQUIRED`.
3. Rate limit `booking:<userId>` (30 a day, shared with stays). The existing message, thrown as `ConvexError`.
4. The service exists and `isPublicService`, else `SERVICE_ERRORS.SERVICE_UNAVAILABLE`.
5. `isBookableService`, else `NOT_BOOKABLE` (or `NO_PRICE` when the only missing piece is the price).
6. `service.ownerId !== user._id`, else `OWN_SERVICE`.
7. `computeServiceQuote(service, args, todayRiyadhISO(now), now)`. Its `error` is thrown as is.
8. No booking by this user for this service on this `date` with status `pending` or `confirmed`, else `DUPLICATE`.

**The row it inserts:**
- `kind: "service"`, `type: "service"`
- `serviceId`, `ownerId: service.ownerId`, `userId`
- `date`, `time`, `checkIn`, `checkOut`, `quantity`, `unitPrice`, `priceUnit`, `totalAmount`, `currency: "SAR"`
- `guests` and `partySize` = partySize
- `notes`: trimmed and limited to 500 characters, or undefined
- `status: "pending"`, `expiresAt: now + 48h`, `confirmationCode`, `createdAt`, `updatedAt`

Then it notifies the provider with `booking.requested`.

### `bookings.queries.quoteService` (new, public query, never throws)

Args:

```ts
{ serviceId: Id<"services">, date: string, time: string, quantity?: number, partySize?: number }
```

Returns `{ ok: true, quote: ServiceQuote } | { ok: false, error: string }`.
- A missing service, or one that is not public: `{ ok: false, error: SERVICE_ERRORS.SERVICE_UNAVAILABLE }`.
- Not bookable: `{ ok: false, error: SERVICE_ERRORS.NOT_BOOKABLE }`.
- Otherwise the result of `computeServiceQuote`.

### Changed booking functions

| Function | Change |
|---|---|
| `cancelBooking` | For a service booking, refuses `SERVICE_ERRORS.SERVICE_STARTED` once `riyadhDateTimeToTimestamp(date, time) <= now`. Notifies the provider (`booking.cancelled`) for service bookings as it does for stays. |
| `confirmBooking`, `declineBooking`, `completeBooking`, `markNoShow` | The manager check allows an admin, or the **current** owner of the booking's service (service bookings) or listing (the others), read from that document, not from `booking.ownerId`. A host an admin moved off a listing can no longer act on its bookings. Otherwise `"Not authorized to manage this booking"` (unchanged text). *Implemented in F.* |
| `rescheduleBooking` | Refuses a service booking with `SERVICE_ERRORS.NO_RESCHEDULE`. |
| `getUserBookings` | New optional `includeServices?: boolean`. Without it, rows with `kind === "service"` are skipped. With it, every row also has `service` (below). |
| `getBooking` | New optional `includeServices?: boolean`. Without it, a service booking returns `null`. With it, see the shape below. |
| `getBusinessBookings` | Unchanged (listing owners). Rows with `kind === "service"` are skipped always. |
| `getOwnerStats` | Unchanged. Service bookings are excluded from its counts. |

**Service summary on a row** (`getUserBookings` with `includeServices`, `getProviderBookings`):

```ts
service: {
  _id, title_en, title_ar, serviceType, city,
  images: string[],          // first image only
  priceUnit, contactPhone,
} | null                     // null on listing bookings
```

**`getBooking` with `includeServices`, for a service booking:** the stay shape (`...booking`, `listing: null`, `guest`), plus:

```ts
service: Doc<"services"> | null,
provider: { firstName?: string, lastName?: string, phone?: string } | null,
viewerRole: "guest" | "host" | "provider" | "admin"
```

- `provider.phone` is `service.contactPhone` when it is set. Otherwise the owner's `phone`, only when the status is `confirmed` or `completed`.
- `viewerRole` is `"provider"` when `booking.kind === "service"` and the viewer owns it.
- For listing bookings, `service` and `provider` are `null`, and `viewerRole` keeps its old values.

### `bookings.queries.getProviderBookings` (new)

Args: `{ status?: string }`.

Returns `[]` unless the caller is a `service_provider`. Otherwise it returns their service bookings, newest first, at most 200: each booking row plus the `service` summary, plus:

```ts
tourist: { _id, firstName, lastName, email: string | null, phone, phoneVerified }
```

That is the same `tourist` shape as `getBusinessBookings`. `email` is `null` for placeholder addresses.

### `bookings.queries.getProviderStats` (new)

Args: `{}`.

Returns `null` unless the caller is a `service_provider`. Otherwise:

```ts
{
  pending: number,
  upcoming: number,          // confirmed with checkOut >= today (Riyadh)
  completedMonth: number,    // completed with checkIn in this Riyadh month
  revenueMonth: number,      // sum of totalAmount, confirmed + completed, checkIn in this month
  services: number,          // the provider's services, any status
  currency: "SAR"
}
```

### Lifecycle (crons unchanged)

All three existing jobs act on service bookings through the mirrored fields:
- `expirePendingRequests` keys on `expiresAt`;
- `sendCheckInReminders` sends reminders for `checkIn` = tomorrow;
- `completeFinishedStays` completes bookings with `checkOut` < today.

Their names stay. Tests cover a service booking through each.

## 4. Services

| Function | Contract |
|---|---|
| `services.queries.listServices({ serviceType?, city?, limit? })` | Same arguments. Returns only `isPublicService` rows, drops owners the viewer blocked, and filters `city` with `matchesCity`. Each row gains `bookable: boolean`. |
| `services.queries.listServicesPaginated(...)` | Same filters, applied inside the query (`.filter()` before `.paginate()` where expressible), so a page is not short because of them. Rows gain `bookable`. |
| `services.queries.searchServices({ searchQuery, serviceType?, city?, limit? })` | Searches `search_services` (title_en) **and** `search_services_ar` (title_ar). Merges them, removes duplicates, applies the same filters. Rows gain `bookable`. |
| `services.queries.getService({ serviceId })` | `null` unless `isPublicService` and the viewer has not blocked the owner. Otherwise the service document plus `bookable: boolean` and `provider: { firstName?: string, lastName?: string, memberSince: number } \| null`. `memberSince` is the owner's `createdAt`. |
| `services.queries.getServiceCities()` | Unchanged shape. Counts public services only, by canonical city. |
| `services.queries.getMyServices({ status? })` | Unchanged. Suspended services appear with `status: "suspended"` and their `suspendedReason`. |
| `services.mutations.submitService(args)` | Adds optional `price?: number` and `maxGroupSize?: number`. Validates with `validateServiceInput(…, "create")`. Refuses with `AUTH_ERRORS.NOT_AUTHENTICATED`, `SERVICE_ERRORS.NOT_A_PROVIDER` or `SERVICE_ERRORS.NOT_APPROVED`, and the rate-limit message, all as `ConvexError`. Stores the canonical city. Returns `Id<"services">`. |
| `services.mutations.updateMyService(args)` | Adds optional `price?: number \| null` and `maxGroupSize?: number \| null` (`null` clears). Validates in update mode. `NOT_FOUND` / `NOT_YOURS`. Any change sends an `approved` or `rejected` service back to `pending`, but a **suspended service stays suspended**. Returns `{ success: true }`. |
| `services.mutations.deleteMyService({ serviceId })` | Refuses `HAS_OPEN_BOOKINGS` while a pending or confirmed booking exists for it. Returns `{ success: true }`. |

## 5. Reviews

| Function | Contract |
|---|---|
| `reviews.mutations.addReview` | Args: `{ listingId?, serviceId?, rating, content?, bookingId?, isAnonymous? }`, with **exactly one** of `listingId` / `serviceId`, otherwise `REVIEW_ERRORS.TARGET_REQUIRED`.<br>A missing service → `REVIEW_ERRORS.SERVICE_NOT_FOUND`; a second review of the same service → `REVIEW_ERRORS.DUPLICATE_SERVICE`.<br>Verified only when `bookingId` is this user's completed service booking of that `serviceId`.<br>Recomputes `services.rating` / `reviewCount`, both cleared at zero reviews. The listing path is unchanged. |
| `reviews.mutations.updateMyReview`, `deleteMyReview` | Unchanged arguments. Recompute whichever target the review has. |
| `reviews.queries.listForService({ serviceId, limit? })` | Same shape as `listForListing`. |
| `reviews.queries.getServiceSummary({ serviceId })` | The same `RatingSummary` as `getSummary`. |
| `reviews.queries.getMineForService({ serviceId })` | The same shape as `getMine`. |
| `reviews.queries.listMyReviewableServices()` | `Array<{ bookingId, serviceId, date: string, title_en, title_ar, image?: string }>`: completed service bookings not yet reviewed, at most 50. |
| `reviews.queries.listMyReviewablePlaces()` | Unchanged shape. Skips bookings without a `listingId`. |

New `REVIEW_ERRORS` entries:
- `TARGET_REQUIRED`: `اختر ما تريد تقييمه. / Choose what to review.`
- `SERVICE_NOT_FOUND`: `الخدمة غير موجودة. / Service not found.`
- `DUPLICATE_SERVICE`: `لقد قيّمت هذه الخدمة من قبل. / You have already reviewed this service.`

The existing `DUPLICATE` stays the place wording.

## 6. Notifications and push

**Events**
- Existing booking events keep their names, and `NotificationEvent` stays the union of booking events. When the booking's `kind` is `"service"`, the text names the service and shows the date, the start time and the quantity instead of nights. *Implemented and tested in F* (`renderServiceNotification`).
- New events, typed `AccountEvent` (separate from `NotificationEvent`) and rendered by `renderAccountNotification(event, input)` in `notifications/templates.ts` (*implemented in F*):
  - `listing.approved`, `listing.rejected`, `listing.suspended`
  - `service.approved`, `service.rejected`, `service.suspended`
  - `account.approved`, `account.rejected`

**The helper that sends them** (`notifications/internal.ts`, new):

```ts
export async function notifyUserEvent(
  ctx: MutationCtx,
  event: AccountEvent,
  input: {
    userId: Id<"users">;
    name_en?: string; name_ar?: string;     // the listing/service title; absent for account.*
    reason?: string;
    listingId?: Id<"listings">; serviceId?: Id<"services">;
  },
  now?: number
): Promise<void>;
```

**`data.target`** says where a tap lands:

| Event | `target` |
|---|---|
| Booking event, audience `tourist` | `"booking"` |
| Booking event, audience `owner`, listing booking | `"host-inbox"` |
| Booking event, audience `owner`, service booking | `"provider-inbox"` |
| `listing.*` | `"my-listings"` |
| `service.*` | `"my-services"` |
| `account.*` | `"verification"` |

`data` also carries `bookingId`, `listingId`, `serviceId` and `audience` when they apply.

**Push**
- `users.push.registerPushToken({ token: string, platform?: "ios" | "android" })` returns `{ ok: true }`.
  - Signed in, else `AUTH_ERRORS.NOT_AUTHENTICATED`.
  - The token must match `/^Expo(nent)?PushToken\[[^\]]{1,200}\]$/`, else `ConvexError("رمز الإشعارات غير صالح. / Invalid push token.")`.
  - A token already registered to **another** user is moved to this one, so a shared phone never receives someone else's bookings.
  - The user keeps their newest 5 tokens.
- `users.push.unregisterPushToken({ token: string })` returns `{ ok: true }`. It deletes the row when it belongs to the caller. Signed out, or not found, is a no-op that still returns `{ ok: true }`.
- `notifications.deliver.send`:
  - reads tokens from `pushTokens`;
  - sends `priority: "high"` and `channelId: "default"`;
  - prunes `DeviceNotRegistered` tokens from the table;
  - emails only when `RESEND_API_KEY` is set and the address is real (unchanged), but no longer requires a listing.

## 7. Accounts, listings, moderation

| Function | Contract |
|---|---|
| `users.mutations.saveBusinessDoc` | Unchanged arguments. Also clears `accountRejectionReason` / `accountRejectedAt`, so the account returns to the queue. |
| `users.mutations.approveBusinessAccount({ userId })` | Admin only. Refuses without a document on the server: `ConvexError("لا يمكن اعتماد حساب بلا وثيقة. / An account cannot be approved without a document.")`. Clears any rejection, logs, sends `account.approved`. |
| `admin.mutations.rejectBusinessAccount({ userId, reason })` (new) | Admin only. `reason` is required after trimming, else `ConvexError("سبب الرفض مطلوب. / A rejection reason is required.")`. Sets `isApproved: false`, `accountRejectionReason` (500 characters max) and `accountRejectedAt`. Logs `account.reject`, sends `account.rejected`. Returns `{ success: true }`. |
| `users.queries.getCurrentUser` | Unchanged; the new fields ride along on the document. |
| `listings.mutations.deleteMyListing` | Refuses while a pending or confirmed booking exists: `ConvexError("لا يمكن حذف مكان لديه حجوزات قائمة. / A listing with open bookings cannot be deleted.")`. |
| `listings.mutations.updateMyListing` | `pricePerNight` also accepts `null`, which clears it and the currency. Editing a **suspended** listing keeps it suspended. |
| `listings.queries.*` (public) | Listings whose owner is suspended are hidden, as with services. |
| `listings/pricing.ts` `validatePricing` | Throws `ConvexError` with the same text as today. |
| `rateLimit.ts` `enforceRateLimit` | Throws `ConvexError` with the same text as today. |
| `moderation.mutations.reportContent` | `targetType` also accepts `"ai_message"`. `targetId` is the client's message id, at most 200 characters. `details` holds the message text, at most 2000 characters. Everything else is unchanged. |

## 8. Admin (all `requireAdmin` + `logAdminAction` in the same transaction; refusals are `ConvexError`)

| Function | Contract |
|---|---|
| `admin.mutations.createListing` / `updateListing` | Accept `PRICING_ARGS`, validated by `validatePricing` with the currency defaulted. `updateListing` also accepts `null` for the clearable fields: `phone`, `email`, `website`, `priceRange`, `description_en`, `description_ar`, `pricePerNight`, `maxGuests`, `unitCount`, `checkInTime`, `checkOutTime`. `null` clears. |
| `admin.queries.adminListServices({ paginationOpts, status?, serviceType?, city?, search? })` (new) | Paginated `{ page, isDone, continueCursor }`. A row is the service document plus `owner: { _id, firstName, lastName, phone, email: string \| null, isSuspended } \| null`. `search` matches `title_en` / `title_ar` through the search indexes, in which case the result is one non-paginated page with `isDone: true`. |
| `admin.queries.adminGetService({ serviceId })` (new) | The service, `owner`, `recentBookings` (last 10, with guest name and status) and `openReports` (count). `null` when missing. |
| `admin.mutations.adminUpdateService({ serviceId, ...fields })` (new) | The same fields as `updateMyService`, validated by `validateServiceInput(…, "update")`. Does **not** change `status`. Logs `service.update`. Returns `{ success: true }`. |
| `admin.mutations.suspendService({ serviceId, reason })` (new) | `reason` is required after trimming: `"سبب الإيقاف مطلوب. / A suspension reason is required."`. Sets `status: "suspended"` and `suspendedReason`. Logs `service.suspend`, sends `service.suspended`. |
| `admin.mutations.reinstateService({ serviceId })` (new) | Refuses unless suspended: `"هذه الخدمة ليست موقوفة. / This service is not suspended."`. Sets `status: "approved"` and clears the reason. Logs `service.reinstate`. |
| `admin.mutations.deleteService({ serviceId })` (new) | Refuses `SERVICE_ERRORS.HAS_OPEN_BOOKINGS`. Deletes, logs `service.delete`. |
| `admin.mutations.approveService` / `rejectService` / bulk | Unchanged arguments. Also send `service.approved` / `service.rejected` to the owner. |
| `admin.mutations.approveContent` / `rejectContent` / bulk | Unchanged arguments. Also send `listing.approved` / `listing.rejected`. |
| `admin.mutations.suspendListing` | Unchanged arguments. Also sends `listing.suspended`. |
| `admin.mutations.bulkApproveBusinesses` | Unchanged arguments. Also sends `account.approved`. |
| `admin.mutations.setUserRoleAsAdmin({ userId, role })` (new) | `role` ∈ `tourist`, `business_owner`, `service_provider`, else `"دور غير صالح. / Invalid role."`. Refuses the admin's own account and any admin account: `"لا يمكن تغيير دور هذا الحساب. / This account's role cannot be changed."`. Moving to business or provider sets `isApproved: false`. Updates `searchText`, logs `user.role` with `details` "from → to". |
| `admin.queries.adminGetUser({ userId })` (new) | `toAdminUserRow(user)` plus `accountRejectionReason`, `bookings` (as guest, last 20), `listings` (owned, up to 50), `services` (owned, up to 50) and `reports` (filed against their content, last 20). `null` when missing. |
| `admin.queries.adminListBookings({ paginationOpts, status?, kind?, search? })` (new) | `kind` is `"stay"`, `"service"` or `"slot"`; `"slot"` means legacy rows with `kind` undefined or `"slot"`. `search` is a confirmation code (exact, case-insensitive) or a phone number (`users.by_phone`, then that user's bookings); a search returns one page with `isDone: true`. A row is the booking plus `listing: { _id, name_ar, name_en } \| null`, `service: { _id, title_ar, title_en } \| null`, `guest: { _id, name, phone, phoneVerified }` and `owner: { _id, name } \| null`. `listAllBookings` stays for the dashboard, with service bookings labelled. |
| `admin.mutations.removeReview({ reviewId, reason, reportId? })` (new) | Deletes the review and recomputes its target's rating. When `reportId` is given, marks that report `actioned`. Logs `review.remove` (details: reason). Returns `{ success: true }`. |
| `admin.queries.listPendingBusinesses` | Rows gain `hasDocument: boolean` and `accountRejectionReason?: string`. |
| `users.mutations.generateUploadUrl` | Admins get 500 a day. Everyone else keeps 50. |
