import React from "react";
import Svg, { Path } from "react-native-svg";

/**
 * Google's "G", in one colour.
 *
 * The app's icons are monochrome (design constraints), so this is the G's
 * outline filled with a single colour rather than the four-colour logo. It is
 * drawn rather than taken from an icon font: every icon on screen is Feather,
 * and a second font family would load asynchronously and show a blank square
 * for its first frame on the one screen where the button is the first thing
 * a new person sees.
 */
export function GoogleMark({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no">
      <Path
        fill={color}
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
    </Svg>
  );
}
