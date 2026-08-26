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

// Moments — 2-column grid, wider gap than the home grid.
export const MOMENT_CARD_GAP = 12;
export const MOMENT_CARD_WIDTH =
  (width - LIST_CONTAINER_PADDING * 2 - MOMENT_CARD_GAP) / 2;
