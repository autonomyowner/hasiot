# Homepage UI Refresh — Design Spec

Date: 2026-07-19

## Goal

Modernize the Hasio website homepage (`src/App.jsx` + `src/App.css`) to match the visual direction of a reference mockup: warmer sand/gold-accented palette, tighter card design, and two new sections (Marketplace strip, Testimonials + Stats). Homepage-scoped only — no changes to other pages, admin panel, or mobile app.

## Non-goals

- No new global brand color additions. `--color-gold: #D4AF37` and `--color-sand: #E8DFD4` already exist in `src/index.css` as design tokens and are reused, not added.
- No changes to Convex backend/schema.
- No changes to fonts (Playfair Display / Outfit / Cairo already match the target look).
- No real testimonial data source exists yet — testimonials will be clearly-representative placeholder copy, easily swappable later.

## Palette

- Primary green (`--color-primary` `#005f49`) stays dominant (nav actions, CTAs, section backgrounds).
- Gold (`--color-gold` `#D4AF37`) becomes the visible accent: stat numerals, one hero headline word, waitlist button, category pill highlight.
- Sand (`--color-sand` `#E8DFD4`) used for warmer section backgrounds (Featured Gems / Marketplace sections) instead of the current flat `--color-bg`.

## Section-by-section changes

### 1. Navbar
Float over hero with glass/blur effect (semi-transparent dark bg + `backdrop-filter: blur()`) instead of solid sticky bar. Nav links/logo need light text color while over the hero image.

### 2. Hero
- Background image: `public/hero.png` (already provided by user), replacing current AIDA/Unsplash hero images.
- Headline: one word (e.g. "Al-Ahsa") styled in gold serif, rest in white.
- Search card: restyle to a single-row compact pill (destination / dates / guests fields + green "Search" button), matching reference proportions.
- Category pills row below search: extend from current 5 (Hotels, Restaurants, Attractions, Tours, Services) to include Cafes, Shopping, Local Guides. New categories without a dedicated listing `type` route to `/listings` unfiltered (Shopping, Local Guides) or `/listings?type=cafe` if a matching seeded category exists — verify against `convex/listings/queries.ts` `getCategories` during implementation; fall back to unfiltered `/listings` if no match.

### 3. Featured Gems
Replace current asymmetric bento grid (1 wide + 3 regular) with a uniform 4-across card grid. Each card: image, category pill (top-left), bookmark icon (top-right, decorative/non-functional for now), title, short description, star rating.

### 4. Marketplace (NEW)
Horizontal-scroll strip of compact cards (image + title + rating), below Featured Gems. Content sourced from existing Convex listings/services queries where reasonably available (e.g. a small `useQuery(api.listings.queries.listListings, { limit: 6 })`-style call); if data is sparse or the query shape doesn't support easy limiting, fall back to a curated static array (same pattern as existing `BENTO_CARDS`) rather than blocking on backend changes.

### 5. Oasis Atlas
Keep existing split layout + map embed unchanged structurally. Add three stat callouts (points of interest / heritage sites / routes) rendered in gold numerals on the dark green text panel, matching reference. Numbers are static illustrative values (e.g. "120+", "25+", "10+") consistent with reference, clearly aspirational/marketing copy not tied to live data.

### 6. AI Concierge
Visual polish only — chat bubble color/spacing refinement to match reference tone. No structural or copy changes.

### 7. Testimonials (NEW) — "Loved by Travelers"
3-card row: avatar (placeholder avatar images), name, location, 5-star rating, short quote. Copy is representative placeholder content, written to be swapped for real reviews later — not presented as real user records.

### 8. Stats band (NEW)
Full-width dark green band, 4 stat callouts in gold numerals (e.g. travelers served, experiences, hotels, satisfaction %) placed before the email capture section. Same "illustrative marketing copy" caveat as Atlas stats.

### 9. Email capture & Footer
Visual restyle only (button colors/spacing to match reference tone). No structural changes.

## Technical approach

- All changes in `src/App.jsx` and `src/App.css`. New data arrays (`MARKETPLACE_CARDS`, `TESTIMONIALS`) follow the existing `BENTO_CARDS` pattern.
- New translation keys added to both `en` and `ar` blocks in the `translations` object for every new section's copy.
- No new npm dependencies.
- Verify both LTR (English) and RTL (Arabic) rendering, and existing mobile breakpoints in `App.css`, since the current file already has responsive rules for hero/bento/atlas/concierge sections that the restyle must not break.
- No backend/Convex changes.

## Testing / verification plan

- Run `npm run dev`, visually check homepage in browser at desktop and mobile widths, in both `en` and `ar` language toggle states.
- Confirm no console errors, confirm existing functional behavior (search, category pill navigation, email waitlist submit, language toggle, chat/planner triggers) still works after restyle.
- `npm run lint` clean.
