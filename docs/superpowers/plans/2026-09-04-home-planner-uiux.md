# Home and Planner UI/UX redesign — 2026-09-04

Requested as: "the search bar cooler, the filter toggle on top above the hero
image, featured destinations better styling, and a better plan UI."

Ships as an over-the-air update: no native modules, no new dependencies,
`app.json` stays 1.0.2. Mock: `scratchpad/home-plan-redesign.html` (rendered
PNG sent to the user). Executed by two Opus subagents on disjoint files.

## Home (`components/screens/HomeScreenContent.tsx` and friends)

Top to bottom, every row mirrored in RTL by hand as the file already does:

1. **Top bar** above the hero: time-of-day greeting as an uppercase eyebrow,
   `Explore Al-Ahsa` in the serif, and the **filter button** (44 px circle,
   white with a hairline border; lime with the count when filters are set).
   It opens the existing `FilterSheet`. This is the "filter toggle above the
   hero" — it used to live inside the search pill.
2. **Hero** unchanged in content, 190 tall, radius 28.
3. **Search pill** (`components/ui/SearchBar.tsx`, new optional `label`
   prop, old props still work): lime search circle on the left, a two-line
   centre ("WHERE TO?" caption over the input), clear button on the right,
   tap anywhere focuses. No filter button here any more on Home.
4. **Kind chips**: All / Places / Tours / Events, built from the data, driving
   the destinations pool. Tours and events were never shown anywhere in the
   app before; the pool now includes them.
5. **Featured**: eyebrow "Handpicked for you" + serif title, then a snapping
   horizontal rail of 240×300 cards (lime category chip, serif name, city).
   Featured = top five of the pool by rating, then review count, then listing
   order. This replaces `rating >= 4.5` in `useConvexData.ts`, which would
   have emptied the section the moment the fabricated seed ratings are
   cleared (`clearSeededRatings --prod`, held for the release).
6. **Stay banner**: full-width photo card ("Find your stay") that opens the
   Stays tab, replacing the lonely 300×180 category card. Only on "All".
7. **More Destinations**: serif title, the existing 2-column grid over the
   rest of the pool.
8. Search results keep their logic; rows lose the shadow for a hairline.

`SkeletonHomeSections` mirrors the new order at the same sizes; rail and
banner sizes live in `constants/layout.ts` so the two cannot drift.

## Planner (`components/screens/PlannerScreenContent.tsx`, `components/planner/*`)

1. **Header**: lime-deep eyebrow "AI travel planner", serif "Plan your days",
   one-line subtitle, no divider. A **New chat** button appears once there
   are messages (confirm dialog, then `clearChatMessages`).
2. **Empty state**: a welcome card with the surface gradient and a compass
   avatar, then "Quick suggestions" as four mint cards with Feather icons
   (itinerary, heritage day, family weekend, where to eat). All four send a
   message; none navigates away.
3. **One send path** (`sendMessage`) replaces the duplicated input and
   suggestion handlers.
4. **Plan card**: when the AI returns `ready: true`, the message carries
   `plan: { itinerary, tips?, budget? }` (new optional field on
   `ChatMessage`; `text` keeps the flattened copy the conversation history
   needs). `PlanCard` renders a lime header band ("Itinerary" / "Your Al-Ahsa
   plan") over the itinerary, with tips and budget as labelled sections.
5. **Bubbles**: bot bubbles white with a hairline (no shadow), ink user
   bubbles, compass avatar, report button on the chip surface in the
   sign-out red. Send button lime/ink, disabled on the chip surface.
6. Keyboard handling untouched.

## Copy

All new strings live in `constants/translations.ts` (600 keys per language,
balanced): `attractions, tours, whereTo, searchHint, exploreAlAhsa,
handpicked, findYourStay, stayBannerSub, plannerEyebrow, plannerTitle,
newChat, newChatConfirm, yourPlan, itinerary, travelTips, estimatedBudget,
suggestHeritage, suggestFamily, suggestFood`; `plannerSubtitle` and
`quickSuggestions` reworded.

## Verification

`npx tsc --noEmit` (delete `.expo/types/router.d.ts` first — a running dev
server leaves it stale), `npm test`, `npx expo export --platform android`,
and a grep for hardcoded hex in the touched files.
