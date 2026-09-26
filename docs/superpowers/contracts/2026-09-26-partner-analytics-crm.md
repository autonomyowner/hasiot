# Contract — partner analytics + guest CRM (2026-09-26)

Backend module `convex/partners/`. Public wrappers only authenticate and call seams in
`convex/partners/service.ts` (house pattern: seams take `ctx` + resolved user). Web imports via
`api.partners.queries.*` / `api.partners.mutations.*`.

## Refusals (ConvexError, exact text — the web shows the half for its language)

| Key | Text |
|---|---|
| NOT_AUTHENTICATED | existing `NOT_AUTHENTICATED` from `convex/lib/errors` |
| NOT_PARTNER | `هذه الصفحة للشركاء المعتمدين فقط. / This page is for approved partners only.` |
| GUEST_NOT_FOUND | `لم نجد هذا الضيف. / We could not find this guest.` |
| NOTE_TOO_LONG | `الملاحظة طويلة جدًا (2000 حرف كحد أقصى). / The note is too long (2000 characters at most).` |
| BAD_TAGS | `الوسوم غير صالحة: 10 كحد أقصى، و24 حرفًا لكل وسم. / Invalid tags: at most 10, each up to 24 characters.` |

NOT_PARTNER: role not business_owner/service_provider, or not `isApproved`, or suspended.

## Queries

### `partners/queries:getAnalytics({ period: "30d" | "90d" | "12m" })`
Returns:
```ts
{
  period: "30d" | "90d" | "12m",
  from: string, to: string,            // Riyadh "YYYY-MM-DD", inclusive
  bucket: "day" | "week" | "month",
  truncated: boolean,
  currency: "SAR",
  totals: Totals, previous: Totals,    // previous = same-length window just before
  series: { key: string, label: string, requests: number, confirmed: number, revenue: number }[],
  outcomes: { pending, confirmed, completed, declined, expired, cancelled, no_show: number },
  items: { id: string, kind: "listing" | "service", name_en: string, name_ar: string,
           requests: number, confirmed: number, revenue: number,
           rating: number | null, reviewCount: number }[],   // every owned item, even with 0
  ratings: { average: number | null, count: number, distribution: [n1, n2, n3, n4, n5],
             latest: { rating: number, content: string | null, guestName: string | null,
                       createdAt: number, itemName_en: string, itemName_ar: string }[] }, // ≤5
}
Totals = { requests, confirmed, declined, revenue, avgBookingValue: number | null,
           acceptanceRate: number | null,        // confirmed / (confirmed + declined + expired), 0..1
           medianResponseMinutes: number | null, // over bookings with respondedAt
           nightsSold: number,                   // stays only; 0 for providers
           repeatGuestShare: number | null }     // guests in window with an earlier booking / guests in window
```
`confirmed` counts confirmed + completed. Ratings are all-time (not period-bound). Week keys are the
Riyadh Monday `YYYY-MM-DD`; month keys `YYYY-MM`; `label` is left to the client (send key only as label).

### `partners/queries:listGuests({ search?: string, tag?: string, sort?: "recent" | "spent" | "bookings" })`
```ts
{ truncated: boolean, guests: {
    guestId: Id<"users">, name: string | null, phone: string | null,
    bookings: number, completed: number, spent: number,     // spent = confirmed+completed totalAmount
    firstAt: number, lastAt: number,                         // createdAt of first/last request
    lastVisit: string | null,                                // latest checkIn ?? date of a confirmed/completed booking
    tags: string[], hasNote: boolean }[] }
```
Search folds case and matches name or phone digits. At most 500 guests returned.

### `partners/queries:getGuest({ guestId })`
```ts
{ guestId, name, phone, email: string | null,   // email null for phone placeholder addresses
  note: string, tags: string[], noteUpdatedAt: number | null,
  bookings: { _id, confirmationCode, kind, status, itemName_en, itemName_ar,
              checkIn, checkOut, date, time, nights, quantity, guests, totalAmount, createdAt }[] } // newest first
```
Throws GUEST_NOT_FOUND unless the guest has ≥1 booking with this partner (in their kind split).

## Mutations

### `partners/mutations:saveGuestNote({ guestId, note: string, tags: string[] })` → `{ ok: true }`
Trims; tags trimmed, de-duplicated case-insensitively, empty dropped. Refusals: GUEST_NOT_FOUND,
NOTE_TOO_LONG, BAD_TAGS. Empty note + no tags deletes the row.

## Schema

```ts
partnerGuestNotes: defineTable({
  ownerId: v.id("users"), guestId: v.id("users"),
  note: v.string(), tags: v.array(v.string()), updatedAt: v.number(),
}).index("by_ownerId_and_guestId", ["ownerId", "guestId"])
  .index("by_guestId", ["guestId"])
```
`deleteAccountData` removes rows by both `ownerId` (index prefix) and `guestId`.
