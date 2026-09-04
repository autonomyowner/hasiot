import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  BOTTOM_FADE_HEIGHT,
  bottomFadeGradient,
  imageScrimGradient,
  screenGradient,
  surfaceGradient,
} from "@/constants/gradients";

/**
 * The four gradient layers, as components rather than raw style objects, so a
 * screen never has to know the stops or remember `pointerEvents="none"`.
 *
 * Each of these is an absolutely positioned sibling, not a wrapper. A
 * LinearGradient that wrapped its content would take over that content's
 * layout; as a fill behind or above it, the surrounding layout is untouched
 * and these can be dropped into an existing screen without moving anything.
 */

type FillProps = { style?: StyleProp<ViewStyle> };

/**
 * The page background. Render as the first child of a screen's root view —
 * everything after it paints on top.
 *
 * The container still needs its own solid `backgroundColor`: this paints only
 * as far as the view's bounds, and an overscroll bounce on iOS reveals
 * whatever is behind it.
 */
export function ScreenGradient({ style }: FillProps) {
  return (
    <LinearGradient
      {...screenGradient}
      colors={[...screenGradient.colors]}
      locations={[...screenGradient.locations]}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    />
  );
}

/**
 * The lit-from-above wash inside a card. Render as the card's first child; the
 * card keeps its own `borderRadius` and `overflow: "hidden"` so this cannot
 * square off a rounded corner.
 */
export function SurfaceGradient({ style }: FillProps) {
  return (
    <LinearGradient
      {...surfaceGradient}
      colors={[...surfaceGradient.colors]}
      locations={[...surfaceGradient.locations]}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    />
  );
}

/**
 * Sheen and legibility scrim over a photograph. Render as the LAST child of
 * the image container, so it sits above the image and below any caption.
 */
export function ImageScrim({ style }: FillProps) {
  return (
    <LinearGradient
      {...imageScrimGradient}
      colors={[...imageScrimGradient.colors]}
      locations={[...imageScrimGradient.locations]}
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
    />
  );
}

/**
 * The dissolve above a fixed bottom bar.
 *
 * `bottom` is the gap between the screen edge and the bar — pass the same
 * value the bar itself uses, so the fade always ends exactly where the bar
 * begins. It never intercepts touches, so the content scrolling under it stays
 * scrollable.
 */
export function BottomBarFade({
  bottom,
  style,
}: FillProps & { bottom: number }) {
  return (
    <View
      style={[styles.bottomFade, { bottom, height: BOTTOM_FADE_HEIGHT }, style]}
      pointerEvents="none"
    >
      <LinearGradient
        {...bottomFadeGradient}
        colors={[...bottomFadeGradient.colors]}
        locations={[...bottomFadeGradient.locations]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
