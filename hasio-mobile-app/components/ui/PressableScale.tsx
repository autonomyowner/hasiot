import React from "react";
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { pressSpring, PRESS_SCALE_CARD } from "@/constants/motion";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * How long a touch has to rest before a card reacts to it.
 *
 * Cards fill every scrolling list in the app, so most touches that land on one
 * are the start of a scroll, not a press. Pressable reports `onPressIn` the
 * instant a finger lands, so every scroll that began on a card shrank it and
 * sprang it back as the list took the touch — the list twitched under the
 * thumb on every swipe. Waiting this long lets the scroll view claim the touch
 * first; a real tap shorter than this still gets its press-in and press-out,
 * flushed together on release.
 */
export const PRESS_DELAY_MS = 90;

interface PressableScaleProps extends Omit<PressableProps, "style"> {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Scale applied while pressed (default 0.98). */
  scaleTo?: number;
}

/**
 * Pressable with the app's standard spring press-scale feedback.
 * Replaces the per-component sharedValue/withSpring boilerplate.
 */
export function PressableScale({
  children,
  style,
  scaleTo = PRESS_SCALE_CARD,
  onPressIn,
  onPressOut,
  unstable_pressDelay = PRESS_DELAY_MS,
  ...props
}: PressableScaleProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[animatedStyle, style]}
      unstable_pressDelay={unstable_pressDelay}
      onPressIn={(e) => {
        scale.value = withSpring(scaleTo, pressSpring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withSpring(1, pressSpring);
        onPressOut?.(e);
      }}
      {...props}
    >
      {children}
    </AnimatedPressable>
  );
}
