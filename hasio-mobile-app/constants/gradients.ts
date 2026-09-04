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

/**
 * The caption scrim on a photo card, where the title, place and price sit
 * directly on the image with no panel behind them.
 *
 * This one is deliberately NOT "felt rather than seen" like `imageScrim`
 * above: that gradient is decorative depth, this one is doing a legibility
 * job, and the job has to hold against the worst photograph a host can
 * upload. The stops put the title's own band at ~0.85, which clears 4.5:1 for
 * white text even over a pure-white image — the case where a subtle scrim
 * would leave the title invisible.
 *
 * The ramp is short and steep rather than long and gentle, and that is the
 * whole design. A gentle gradient tall enough to reach 0.85 by the title has
 * to start halfway up the card, which veils the photograph everywhere; this
 * one is still near-nothing at 58% and does all its work in the ~30px above
 * the caption. The bottom 42% of the image stays clean.
 */
export const cardCaptionGradient = {
  colors: [
    "rgba(31, 29, 23, 0)",
    "rgba(31, 29, 23, 0.3)",
    "rgba(31, 29, 23, 0.86)",
    "rgba(31, 29, 23, 0.94)",
  ] as const,
  locations: [0, 0.18, 0.4, 1] as const,
  ...GRADIENT_VERTICAL,
};

/** How far up the card the caption scrim reaches. */
export const CARD_CAPTION_SCRIM_HEIGHT = "58%";

/**
 * The same scrim on a shorter card, or under a caption that can run to two
 * lines. Both cases push the title further up in proportional terms, and a
 * percentage that is right on a 240px card leaves the first line of a wrapped
 * title sitting in the ramp's weak half. 72% puts it back at ~0.89 on the
 * 180px category card and the 210px grid card alike.
 */
export const CARD_CAPTION_SCRIM_HEIGHT_TALL = "72%";

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
