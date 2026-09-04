import { Dimensions } from "react-native";

const { width } = Dimensions.get("window");

/**
 * Geometry that more than one component has to agree on.
 *
 * These used to be duplicated between a screen and the skeleton that stands in
 * for it while its data loads, which is exactly the kind of pair that drifts:
 * change a gutter in one place and the placeholder silently stops lining up
 * with the content it replaces. Anything a skeleton has to match lives here.
 */

// Home screen — 2-column destination grid.
export const HOME_CONTAINER_PADDING = 20;
export const HOME_CARD_GAP = 8;
export const HOME_CARD_WIDTH =
  (width - HOME_CONTAINER_PADDING * 2 - HOME_CARD_GAP) / 2;

// Lodging / food / events / moments all share one list gutter.
export const LIST_CONTAINER_PADDING = 24;

// Docked tab bar. The bar sits flush with the bottom edge (position: absolute,
// bottom: 0, full width) and still overlays the content, so every scrollable
// screen must reserve TAB_BAR_HEIGHT plus the bottom safe-area inset and a
// little breathing room as bottom padding, or its last row hides behind it.
// TAB_BAR_HEIGHT is the bar's own content height; the safe-area inset is added
// as paddingBottom on top of it by the bar itself.
export const TAB_BAR_HEIGHT = 60;
// Kept at 0 for the docked bar (it has no horizontal margin and no gap to the
// screen edge), so callers that still add it are unaffected.
export const TAB_BAR_MARGIN = 0;
// Ready-made bottom padding for scroll content. Prefer the `useTabBarClearance`
// hook, which adds the bottom safe-area inset — this bare constant leaves the
// last row under the gesture bar on any phone that has one.
//
// The 32 is not breathing room for its own sake: `BottomBarFade` is 64pt tall
// and sits directly on the bar, so content that stops 12pt above the bar ends
// inside the opaque half of that fade and reads as cut off, which is exactly
// what it looked like.
export const TAB_BAR_CLEARANCE = TAB_BAR_HEIGHT + 32;

// Home screen featured rail card (shared with SkeletonHomeSections).
export const HOME_RAIL_CARD_WIDTH = 240;
export const HOME_RAIL_CARD_HEIGHT = 300;
// Gap between rail cards, and with the width above the rail's snap stride.
export const HOME_RAIL_GAP = 12;
// The "find your stay" banner that closes the featured rail.
export const HOME_STAY_BANNER_HEIGHT = 120;

// Home screen category rail card (shared with SkeletonHomeSections).
export const CATEGORY_CARD_WIDTH = 300;
export const CATEGORY_CARD_HEIGHT = 180;

// Moments — 2-column grid, wider gap than the home grid.
export const MOMENT_CARD_GAP = 12;
export const MOMENT_CARD_WIDTH =
  (width - LIST_CONTAINER_PADDING * 2 - MOMENT_CARD_GAP) / 2;
