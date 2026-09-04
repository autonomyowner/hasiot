# Admin Panel for Bookings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Arabic admin panel everything an operator needs to make a hotel bookable — set a nightly rate, put a host behind it, and answer the bookings that follow.

**Architecture:** Most of this is **ported** from the unreleased `phase-1-stays` branch, which already built these tabs. The one genuinely new piece is the **host picker**, because nothing on either branch can assign a listing's owner from the panel. Every tab keeps the panel's existing conventions: `useToast()` for results, `useConfirm()` for anything destructive, never `window.confirm`/`alert`, and an `.admin-page-head` block at the top of each tab.

**Tech Stack:** React 19, Vite 7, Convex React hooks, framer-motion. Arabic-only, RTL.

**Depends on:** `docs/superpowers/plans/2026-09-04-booking-review-backend.md` — every function called here lands there. **Do not start until that plan reaches Task 11b.**

**Design doc:** `docs/superpowers/specs/2026-09-04-bookings-and-ratings-design.md`

---

## Ground rules

1. **Never run `npx convex deploy`, `--prod`, `eas update`, `eas build`, or `npx vercel`.** Pushing this branch to `main` releases the website — that is a step in the release checklist, not in this plan.
2. **Do not port `src/App.jsx` or `src/App.css`.** They differ between the branches, but only because `phase-1-stays` predates this week's landing-page typography. Porting them would silently revert design work. This plan touches `src/admin/` and nothing else.
3. The panel is **Arabic-only and RTL**. Every string you add is Arabic.
4. **Arabic must be written with the Write/Edit tools.** Bash heredocs, `sed` and `perl` corrupt Arabic on this machine. `git show > file` is byte-safe.
5. **No `window.confirm` or `alert`.** Destructive actions go through `useConfirm()` (`src/admin/components/ConfirmDialog.jsx`, which supports `reason: { label, placeholder, required }`); every mutation reports through `useToast()`.
6. Every tab opens with `.admin-page-head` wrapping an `.admin-page-title` and a one-line `.admin-page-subtitle` carrying the count. `.admin-section-title` is for sections *within* a tab.
7. Each task ends with `npm run build` succeeding before you commit.

---

## File structure

| File | Responsibility | Origin |
|---|---|---|
| `src/admin/constants.js` | status vocabularies, Riyadh `todayISO` | port |
| `src/admin/tabs/UsersTab.jsx` | list, search, suspend, unsuspend | port |
| `src/admin/AdminPage.jsx` | one nav entry for the new tab | port |
| `src/admin/tabs/ListingsTab.jsx` | suspend/reinstate, host action | port + edit |
| `src/admin/tabs/ListingForm.jsx` | nightly rate, guests, units, check-in/out | port |
| `src/admin/tabs/BookingsTab.jsx` | stay columns, status filter, owner | port |
| `src/admin/tabs/DashboardTab.jsx` | booking counts that mean something | port |
| `src/admin/tabs/ActivityTab.jsx` | labels for the new admin actions | port |
| `src/admin/admin.css` | styles the above reference | port |
| `src/admin/hooks/useDebounced.js` | shared search debounce | **new** |
| `src/admin/components/HostPickerModal.jsx` | assign a listing's host | **new** |

---

### Task 1: Status vocabularies and Riyadh dates

**Files:**
- Modify: `src/admin/constants.js`
- Modify: `src/admin/admin.css`

Two substantive changes hide in here. Bookings gain `declined` (the host said no) and `expired` (nobody answered in 48 hours), and `pending` is relabelled from "قيد الانتظار" to "بانتظار المالك" — *waiting on the owner*, which is what it now means. And `todayISO` switches from UTC to Riyadh: the panel groups bookings into today / upcoming / past against dates the backend writes in Saudi time, so a UTC `toISOString()` moves a booking into "past" three hours before the day actually ends.

- [ ] **Step 1: Port both files**

```bash
git show phase-1-stays:src/admin/constants.js > src/admin/constants.js
git show phase-1-stays:src/admin/admin.css    > src/admin/admin.css
```

- [ ] **Step 2: Confirm the new vocabularies arrived**

Run: `grep -n "LISTING_STATUSES\|declined\|expired\|Riyadh" src/admin/constants.js`
Expected: `LISTING_STATUSES` exported, `declined` and `expired` present among the booking statuses, and a comment mentioning Riyadh above `todayISO`.

- [ ] **Step 3: Verify the site still builds**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/admin/constants.js src/admin/admin.css
git commit -m "feat(admin): booking and listing status vocabularies, on Riyadh dates"
```

---

### Task 2: The users tab

**Files:**
- Create: `src/admin/tabs/UsersTab.jsx`
- Modify: `src/admin/AdminPage.jsx`

- [ ] **Step 1: Port the tab**

```bash
git show phase-1-stays:src/admin/tabs/UsersTab.jsx > src/admin/tabs/UsersTab.jsx
```

- [ ] **Step 2: Wire it into the shell**

`src/admin/AdminPage.jsx` needs exactly three additions. Add the import beside the other tab imports:

```jsx
import UsersTab from './tabs/UsersTab'
```

Add the nav entry to the tab list:

```jsx
  { id: 'users', label: 'المستخدمون' },
```

And the render case beside the others:

```jsx
      case 'users': return <UsersTab />
```

- [ ] **Step 3: Confirm nothing else in the shell changed**

Run: `git diff --stat src/admin/AdminPage.jsx`
Expected: 3 insertions, 0 deletions.

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: exit 0.

```bash
git add src/admin/tabs/UsersTab.jsx src/admin/AdminPage.jsx
git commit -m "feat(admin): a users tab — search, roles, suspend and unsuspend"
```

---

### Task 3: Listing suspension

**Files:**
- Replace: `src/admin/tabs/ListingsTab.jsx`

Adds a `suspended` state to listings and the actions that reach it. A suspended listing stops being public everywhere, because `isPublicListing` already gates on status.

- [ ] **Step 1: Port the tab**

```bash
git show phase-1-stays:src/admin/tabs/ListingsTab.jsx > src/admin/tabs/ListingsTab.jsx
```

- [ ] **Step 2: Confirm the destructive actions use the panel's own dialog**

Run: `grep -n "window.confirm\|alert(" src/admin/tabs/ListingsTab.jsx`
Expected: **no output**. If either appears, STOP and report BLOCKED — the panel forbids both.

- [ ] **Step 3: Verify and commit**

Run: `npm run build`
Expected: exit 0.

```bash
git add src/admin/tabs/ListingsTab.jsx
git commit -m "feat(admin): suspend and reinstate a listing"
```

---

### Task 4: Nightly rate on the listing form

**Files:**
- Replace: `src/admin/tabs/ListingForm.jsx`

Adds nightly rate, maximum guests, unit count and check-in/check-out times. **This is what makes a hotel bookable at all** — the app shows no Book button on a listing with no `pricePerNight`.

- [ ] **Step 1: Port the form**

```bash
git show phase-1-stays:src/admin/tabs/ListingForm.jsx > src/admin/tabs/ListingForm.jsx
```

- [ ] **Step 2: Confirm the pricing fields arrived**

Run: `grep -n "pricePerNight\|maxGuests\|unitCount\|checkInTime\|checkOutTime" src/admin/tabs/ListingForm.jsx | head`
Expected: all five present.

- [ ] **Step 3: Verify and commit**

Run: `npm run build`
Expected: exit 0.

```bash
git add src/admin/tabs/ListingForm.jsx
git commit -m "feat(admin): nightly rate, guests, units and check-in times on a listing"
```

---

### Task 5: A shared search debounce

**Files:**
- Create: `src/admin/hooks/useDebounced.js`
- Modify: `src/admin/tabs/ListingsTab.jsx`

`ListingsTab` defines `useDebounced` privately. The host picker in Task 6 needs the same thing, and copying it would leave two definitions to drift. Extracted now, after the port, so the port itself stayed verbatim.

- [ ] **Step 1: Create the hook**

Create `src/admin/hooks/useDebounced.js`:

```js
import { useEffect, useState } from 'react'

/**
 * Hold a value still until it stops changing.
 *
 * Every search box in the panel drives a Convex query, and Convex re-runs a
 * query on every argument change — so without this, typing "Hofuf" fires five
 * searches and the first four are wasted before their results arrive.
 */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
```

- [ ] **Step 2: Point `ListingsTab` at it**

In `src/admin/tabs/ListingsTab.jsx`, delete the local `useDebounced` function definition and add the import beside the other local imports:

```jsx
import { useDebounced } from '../hooks/useDebounced'
```

- [ ] **Step 3: Confirm there is now exactly one definition**

Run: `grep -rn "function useDebounced" src/admin/`
Expected: exactly one hit, in `src/admin/hooks/useDebounced.js`.

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: exit 0.

```bash
git add src/admin/hooks/useDebounced.js src/admin/tabs/ListingsTab.jsx
git commit -m "refactor(admin): one search debounce, shared"
```

---

### Task 6: The host picker (new)

**Files:**
- Create: `src/admin/components/HostPickerModal.jsx`
- Modify: `src/admin/tabs/ListingsTab.jsx`

This is the piece nothing on either branch has. The seeded Al-Ahsa catalogue has no owner, so a booking request against one of those hotels has no inbox to arrive in — the host inbox reads `by_ownerId_and_status`. Assigning a Hasio-run account is what makes the seeded hotels bookable before any real hotel signs up.

It is a separate modal launched from a listing's row rather than a field on `ListingForm`, matching how `WorkingHoursModal` already works: assignment is its own audited mutation, not part of saving a listing.

- [ ] **Step 1: Write the modal**

Create `src/admin/components/HostPickerModal.jsx`:

```jsx
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import Modal from './Modal'
import { useToast } from './toast-context'
import { useDebounced } from '../hooks/useDebounced'
import { EmptyState } from './States'

// Only these two can answer a booking: the host inbox is keyed on ownerId, and
// a tourist would receive requests they have no screen to act on. The server
// enforces this too — this is only so an operator is not offered a dead end.
const CAN_HOST = ['business_owner', 'admin']

const ROLE_LABELS = {
  tourist: 'سائح',
  business_owner: 'مالك نشاط',
  service_provider: 'مزود خدمة',
  admin: 'مشرف',
}

function displayName(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  return name || user.email || user.phone || '—'
}

export default function HostPickerModal({ listing, onClose }) {
  const toast = useToast()
  const [term, setTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const debounced = useDebounced(term)

  const assignHost = useMutation(api.admin.mutations.assignListingHost)

  // The backend returns nothing under two characters, so there is no point
  // asking. "skip" also keeps the query from running on an empty box.
  const results = useQuery(
    api.admin.users.adminSearchUsers,
    debounced.trim().length >= 2 ? { searchQuery: debounced.trim() } : 'skip'
  )

  const assign = async (ownerId, label) => {
    setSaving(true)
    try {
      await assignHost({ listingId: listing._id, ownerId })
      toast.success(ownerId ? `تم تعيين ${label} مضيفًا` : 'تم إلغاء تعيين المضيف')
      onClose()
    } catch (error) {
      toast.error(error?.message || 'تعذر حفظ التغيير')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="تعيين مضيف"
      subtitle={listing.name_ar || listing.name_en}
    >
      <div className="admin-form-section">
        <label className="admin-form-label">ابحث بالاسم أو الهاتف أو البريد</label>
        <input
          className="admin-input"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="حرفان على الأقل"
          autoFocus
        />
      </div>

      {listing.ownerId && (
        <button
          type="button"
          className="admin-btn ghost"
          disabled={saving}
          onClick={() => assign(null, '')}
        >
          إزالة المضيف الحالي
        </button>
      )}

      <div className="admin-host-results">
        {debounced.trim().length < 2 ? null : results === undefined ? (
          <p className="admin-page-subtitle">جارٍ البحث…</p>
        ) : results.length === 0 ? (
          <EmptyState title="لا توجد نتائج" message="جرّب اسمًا أو رقمًا آخر" />
        ) : (
          results.map((user) => {
            const eligible = CAN_HOST.includes(user.role)
            return (
              <button
                key={user._id}
                type="button"
                className="admin-host-row"
                disabled={!eligible || saving}
                title={eligible ? undefined : 'هذا الحساب لا يمكنه استقبال الحجوزات'}
                onClick={() => assign(user._id, displayName(user))}
              >
                <span className="admin-host-name">{displayName(user)}</span>
                <span className="admin-badge gray">{ROLE_LABELS[user.role] || user.role}</span>
              </button>
            )
          })
        )}
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Style the results list**

Append to `src/admin/admin.css`:

```css
/* Host picker results. A row is a button because the whole row is the target —
   a click anywhere on it assigns that person. */
.admin-host-results {
  margin-top: 12px;
  max-height: 320px;
  overflow-y: auto;
}

.admin-host-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--admin-border);
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
  margin-bottom: 8px;
  text-align: right;
}

.admin-host-row:hover:not(:disabled) {
  border-color: var(--admin-accent);
}

.admin-host-row:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-host-name {
  font-weight: 600;
}
```

- [ ] **Step 3: Launch it from a listing row**

In `src/admin/tabs/ListingsTab.jsx`, add the import:

```jsx
import HostPickerModal from '../components/HostPickerModal'
```

Add state beside the other modal state in the component:

```jsx
  const [hostFor, setHostFor] = useState(null)
```

Add an action button in the row's action group, beside the existing working-hours button:

```jsx
                      <button
                        type="button"
                        className="admin-btn ghost sm"
                        onClick={() => setHostFor(listing)}
                      >
                        المضيف
                      </button>
```

And render the modal beside the other modals near the end of the component's JSX:

```jsx
      {hostFor && (
        <HostPickerModal listing={hostFor} onClose={() => setHostFor(null)} />
      )}
```

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/admin/components/HostPickerModal.jsx src/admin/admin.css src/admin/tabs/ListingsTab.jsx
git commit -m "feat(admin): assign a host, so a seeded hotel has someone to answer it"
```

---

### Task 7: Bookings, dashboard and activity

**Files:**
- Replace: `src/admin/tabs/BookingsTab.jsx`, `src/admin/tabs/DashboardTab.jsx`, `src/admin/tabs/ActivityTab.jsx`

`BookingsTab` gains the stay columns — dates, nights, guests, total, confirmation code, host — and a status filter that knows about `declined` and `expired`. `DashboardTab` gets counts that come from real bookings instead of the hardcoded placeholders. `ActivityTab` gets labels for the new admin actions, so the audit log reads as sentences rather than raw keys.

- [ ] **Step 1: Port all three**

```bash
git show phase-1-stays:src/admin/tabs/BookingsTab.jsx  > src/admin/tabs/BookingsTab.jsx
git show phase-1-stays:src/admin/tabs/DashboardTab.jsx > src/admin/tabs/DashboardTab.jsx
git show phase-1-stays:src/admin/tabs/ActivityTab.jsx  > src/admin/tabs/ActivityTab.jsx
```

- [ ] **Step 2: Confirm the activity log labels the new actions**

The backend writes `listing.assign_host` and `listing.clear_host` (added in the backend plan's Task 11b, after this branch was cut), so they will not be in the ported file. Add them to the label map in `src/admin/tabs/ActivityTab.jsx` beside the other `listing.*` entries:

```jsx
  'listing.assign_host': 'تعيين مضيف',
  'listing.clear_host': 'إزالة مضيف',
```

- [ ] **Step 3: Confirm no forbidden dialogs crept in**

Run: `grep -n "window.confirm\|alert(" src/admin/tabs/BookingsTab.jsx src/admin/tabs/DashboardTab.jsx src/admin/tabs/ActivityTab.jsx`
Expected: **no output**.

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: exit 0.

```bash
git add src/admin/tabs/BookingsTab.jsx src/admin/tabs/DashboardTab.jsx src/admin/tabs/ActivityTab.jsx
git commit -m "feat(admin): stay columns on bookings, real dashboard counts, named actions"
```

---

### Task 8: Confirm the landing page is untouched

**Files:** none — verification only.

The landing page and the admin panel ship from the same build. The panel must not start pulling its weight onto the public page.

- [ ] **Step 1: Confirm no landing-page files were changed**

Run: `git diff --stat main -- src/App.jsx src/App.css src/main.jsx`
Expected: **no output**. If anything appears, it came from a port that reached too far — revert those three files to `main`.

- [ ] **Step 2: Build and check the entry has no preloads**

Run: `npm run build && grep -c modulepreload dist/index.html`
Expected: `0`.

This is the one that catches a real regression: an accidental static import of Convex or Better-Auth from `main.jsx` puts them in every anonymous visitor's download.

- [ ] **Step 3: Commit only if something needed fixing**

If Steps 1 and 2 both passed, there is nothing to commit — say so and finish.

---

## Done when

| | |
|---|---|
| `npm run build` | exit 0 |
| `dist/index.html` | zero `modulepreload` entries |
| Users tab | lists, searches, suspends and unsuspends |
| Listing form | takes a nightly rate, guests, units and check-in/out times |
| Listing row | has a host action that assigns a real account |
| Bookings tab | shows dates, nights, total, code and host |
| `src/App.jsx`, `src/App.css` | unchanged from `main` |
| `window.confirm` / `alert` | absent from `src/admin/` |

## Next

Two mobile plans follow, both depending on the backend plan rather than this one:

1. **Mobile booking** — the calendar sheet, my bookings, booking detail, the host inbox.
2. **Mobile ratings** — star input, rating summary, review cards, and the "How was your stay?" prompt.
