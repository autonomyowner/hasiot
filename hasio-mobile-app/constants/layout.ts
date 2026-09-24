import { Dimensions, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");

/**
 * Geometry that more than one component has to agree on.
 *
 * These used to be duplicated between a screen and the skeleton that stands in
 * for it while its data loads, which is exactly the kind of pair that drifts:
 * change a gutter in one place and the placeholder silently stops lining up
 * with the content it replaces. Anything a skeleton has to match lives here.
 */

/** A text style's size and the line box it is set in, before Arabic adjusts it. */
export interface TextMetrics {
  fontSize: number;
  lineHeight: number;
}

/**
 * The line box a text style actually renders at.
 *
 * In Arabic, `useThemedStyles` raises any line height below 1.4× the font size
 * to that floor (Cairo clips its marks when set tighter) — see
 * `adaptForArabic` in hooks/useAppFonts.ts. A skeleton has to reserve the
 * raised height or it is shorter than the Arabic text that replaces it, which
 * is how the Home placeholders came out ~30pt short and the page jumped when
 * the data landed. The rule is repeated here, exactly: keep the two in step.
 */
const ARABIC_MIN_LINE_HEIGHT = 1.4;

export function lineHeightFor(text: TextMetrics, arabic: boolean): number {
  if (arabic && text.lineHeight < text.fontSize * ARABIC_MIN_LINE_HEIGHT) {
    return Math.ceil(text.fontSize * ARABIC_MIN_LINE_HEIGHT);
  }
  return text.lineHeight;
}

// FilterChip. Its label is given a line height rather than left to the font:
// Outfit and Cairo have very different natural line boxes (Cairo's is ~1.9×
// its size), so an unset one made the Arabic chips 8pt taller than the
// skeleton's pills.
export const CHIP_TEXT: TextMetrics = { fontSize: 14, lineHeight: 18 };
export const CHIP_PADDING_VERTICAL = 9;
// The space between chips in a row. The row's own `gap`, never a margin on the
// chip: a trailing margin lands on the wrong side in a mirrored row.
export const CHIP_GAP = 8;
// The transparent band a FilterChip carries above and below its pill, which
// makes the ~37pt pill a 44pt target. A row that wants its pills where they
// would sit without it takes the band back with its own spacing.
export const CHIP_TARGET_INSET = 4;

/**
 * A FilterChip's pill — what a skeleton draws — hairline border included.
 * The chip's box is `CHIP_TARGET_INSET` taller at each end.
 */
export function chipHeight(arabic: boolean): number {
  return (
    CHIP_PADDING_VERTICAL * 2 +
    lineHeightFor(CHIP_TEXT, arabic) +
    StyleSheet.hairlineWidth * 2
  );
}

// Home screen — 2-column destination grid.
export const HOME_CONTAINER_PADDING = 20;
export const HOME_CARD_GAP = 8;
export const HOME_CARD_WIDTH =
  (width - HOME_CONTAINER_PADDING * 2 - HOME_CARD_GAP) / 2;
// The grid's two card heights. Each column alternates them, starting from
// opposite ends, so the columns stay within one step of each other.
export const HOME_GRID_CARD_HEIGHT = 210;
export const HOME_GRID_CARD_TALL_HEIGHT = 260;

// Home screen section heads: an optional eyebrow over a serif title.
export const HOME_SECTION_MARGIN_TOP = 24;
export const HOME_SECTION_MARGIN_BOTTOM = 14;
export const HOME_SECTION_EYEBROW: TextMetrics = { fontSize: 11, lineHeight: 14 };
export const HOME_SECTION_TITLE: TextMetrics = { fontSize: 26, lineHeight: 32 };
// The kind chips' distance below the search bar.
export const HOME_CHIP_ROW_MARGIN_TOP = 18;

// Lodging / food / events / moments all share one list gutter.
export const LIST_CONTAINER_PADDING = 24;

// LodgingCard — the photo is the card, with its caption laid on the bottom.
export const LODGING_CARD_HEIGHT = 240;
export const LODGING_CARD_CHIP_TEXT: TextMetrics = { fontSize: 11, lineHeight: 14 };
export const LODGING_CARD_CHIP_PADDING_VERTICAL = 4;
export const LODGING_CARD_NAME_TEXT: TextMetrics = { fontSize: 20, lineHeight: 28 };
// The meta row is as tall as its taller line: the price, once Arabic has
// raised both.
export const LODGING_CARD_LOCATION_TEXT: TextMetrics = { fontSize: 12.5, lineHeight: 17 };
export const LODGING_CARD_PRICE_TEXT: TextMetrics = { fontSize: 15, lineHeight: 17 };

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

// Moments — 2-column grid, wider gap than the home grid.
export const MOMENT_CARD_GAP = 12;
export const MOMENT_CARD_WIDTH =
  (width - LIST_CONTAINER_PADDING * 2 - MOMENT_CARD_GAP) / 2;
