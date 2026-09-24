import { useCallback } from "react";
import { AccessibilityInfo } from "react-native";
import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * A short sideways shake that says "this first", for a button pressed before
 * its form can be sent.
 *
 * Why the buttons are not simply disabled: the booking sheet's "Send booking
 * request" used to sit at 45% opacity until dates were picked. That is a lime
 * tint most phone screens barely show against white, with an ink label faded
 * to grey on top, and on the owner's Android phone it read as a line of text
 * rather than a button. Now the button is always a button. Pressed too early,
 * it shakes whatever is missing (the hint about the dates, the reason list,
 * the empty field) and a screen reader hears what that is.
 *
 * Spread `style` onto an `Animated.View` around the thing to point at and call
 * `nudge(announcement)`. With reduced motion on, it blinks instead of moving.
 */
export function useNudge() {
  const offset = useSharedValue(0);
  const fade = useSharedValue(1);
  const reducedMotion = useReducedMotion();

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateX: offset.value }],
  }));

  const nudge = useCallback(
    (announcement?: string) => {
      if (reducedMotion) {
        fade.value = withSequence(
          withTiming(0.35, { duration: 120 }),
          withTiming(1, { duration: 220 })
        );
      } else {
        offset.value = withSequence(
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 70 }),
          withTiming(-5, { duration: 60 }),
          withTiming(5, { duration: 60 }),
          withTiming(0, { duration: 50 })
        );
      }
      if (announcement) AccessibilityInfo.announceForAccessibility(announcement);
    },
    [fade, offset, reducedMotion]
  );

  return { style, nudge };
}
