import { colors } from "./colors";

/**
 * The app's vertical gradient system. Four layers, all top-to-bottom, all at
 * contrast low enough to be felt rather than seen.
 *
 * Every gradient here is decorative depth, never a signal. Nothing reads a
 * gradient to tell what something is or whether it can be pressed, which is
 * why interactive surfaces — buttons, chips, the tab puck, accents — stay
 * flat and solid: a control that shades is a control whose state is harder to
 * read, and the lime fill is doing that job already.
 *
 * `expo-linear-gradient` takes a unit vector rather than an angle. 180deg —
 * straight down — is `start {x:0,y:0}` to `end {x:0,y:1}`, which is the
 * default, but it is spelled out on each token so a future horizontal variant
 * cannot be introduced by accident.
 */

export const GRADIENT_VERTICAL = {
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
} as const;

/**
 * The page itself. An accent-tinted near-white at the top, through the
 * existing neutral background at about a third of the way down, to a slightly
 * deeper neutral at the bottom.
 *
 * The top stop is the lime hue at 4% saturation, which at this lightness is
 * about one 8-bit step of colour — deliberately at the edge of what the
 * display can even represent. What is actually perceived is the travel from
 * cool near-white to warm cream over the full height, not any single stop.
 */
export const screenGradient = {
  colors: ["#F9F9F8", colors.background, "#F6F1E8"] as const,
  locations: [0, 0.34, 1] as const,
  ...GRADIENT_VERTICAL,
};

/**
 * Cards and raised surfaces: pure white at the top edge falling to a barely
 * off-white at the bottom, so a card reads as lit from above and lifts off the
 * page instead of dissolving into it. The whole range is seven 8-bit steps.
 */
export const surfaceGradient = {
  colors: ["#FFFFFF", "#FCFBF8"] as const,
  locations: [0, 1] as const,
  ...GRADIENT_VERTICAL,
};

/**
 * Laid over photography. Two effects in one pass: a white sheen across the top
 * that is gone by 30%, then a dark tint of the brand's darkest colour weighing
 * the bottom so captions and titles stay legible over a bright image.
 *
 * The 60% stop is the scrim colour at zero alpha, not transparent white. A
 * gradient interpolates the colour channels as well as alpha, so running
 * straight from transparent white to the dark tint would drag a grey cast
 * through the middle of every image.
 */
export const imageScrimGradient = {
  colors: [
    "rgba(255, 255, 255, 0.16)",
    "rgba(255, 255, 255, 0)",
    "rgba(79, 94, 16, 0)",
    "rgba(79, 94, 16, 0.24)",
  ] as const,
  locations: [0, 0.3, 0.6, 1] as const,
  ...GRADIENT_VERTICAL,
};

/** Height of the fade that sits above a fixed bottom bar. */
export const BOTTOM_FADE_HEIGHT = 64;

/**
 * Above any fixed bottom bar. Content scrolling underneath dissolves into the
 * page instead of being cut off by a hard edge.
 *
 * It stops at 92% rather than reaching the full background: a completely
 * opaque band would read as a second, lower bar sitting under the real one.
 */
export const bottomFadeGradient = {
  colors: ["rgba(250, 247, 242, 0)", "rgba(250, 247, 242, 0.92)"] as const,
  locations: [0, 1] as const,
  ...GRADIENT_VERTICAL,
};
