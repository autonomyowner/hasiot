import { useCallback, useEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";
import {
  Easing,
  makeMutable,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/**
 * Used when the event carries no usable duration: Android's did-events report
 * 0, because by the time they fire the keyboard has already finished moving.
 */
const DEFAULT_DURATION = Platform.OS === "ios" ? 250 : 180;

/**
 * Both platforms' keyboards leave the ground quickly and take their time
 * settling. A linear ramp against that reads as the bar chasing the keyboard
 * rather than travelling with it, which is the whole thing we are fixing.
 */
export const KEYBOARD_EASING = Easing.bezier(0.17, 0.59, 0.4, 0.77);

/**
 * How long a keyboard takes to arrive, for the callers that start moving before
 * it does. Roughly what both platforms use; being a little out is invisible,
 * being late by the whole animation is not.
 */
export const KEYBOARD_TRAVEL_MS = 250;

/**
 * One timeline, shared by every caller, because there is one keyboard.
 *
 * The tab bar and the screen's own bottom bar have to leave together, and two
 * hook instances each animating their own copy is exactly how they end up a
 * frame apart. Module scope also lets a screen start the transition on focus
 * and have the tab bar follow, without either knowing about the other.
 */
const progress = makeMutable(0);

export interface KeyboardTransition {
  /**
   * True from the moment the keyboard starts arriving to the moment it starts
   * leaving. For the things that have to be a real branch — pointer events,
   * whether a control is in the accessibility tree — where a re-render is the
   * point and one step is the correct shape.
   */
  visible: boolean;
  /**
   * 0 closed, 1 open, animated on the UI thread with the keyboard's own
   * timing. For anything that moves: a boolean can only ever snap, and
   * re-rendering a screen every frame to interpolate one by hand would stutter
   * exactly where it must not.
   */
  progress: SharedValue<number>;
  /**
   * Start the transition now, ahead of the keyboard event.
   *
   * Android has no will-show event — `keyboardDidShow` lands only once the
   * keyboard has finished animating — so anything waiting for it sits still
   * through the animation and then jumps. Call this from a `TextInput`'s
   * `onFocus`, which happens before the keyboard moves at all.
   */
  beginOpen: () => void;
}

/**
 * The software keyboard's arrival and departure, as something to animate with.
 *
 * `will*` on iOS and `did*` on Android is not a style choice: iOS fires the
 * will-events alongside its own animation and hands us its `duration`, so
 * anything driven off them moves with the keyboard rather than after it, and
 * Android has no will-events at all.
 *
 * Deliberately a plain JS-thread subscription rather than Reanimated's
 * `useAnimatedKeyboard`, which on Android switches the window's soft-input
 * mode process-wide — every other screen's keyboard handling would change
 * underneath it, untested.
 *
 * Separate from `useKeyboardOverlap`, which answers a different question (how
 * much of a given view the keyboard covers). This one exists for the callers
 * that only need to get out of the way — the docked tab bar, mainly, which
 * otherwise lands on top of a screen's own bottom bar the moment the window
 * shrinks for the keyboard.
 */
export function useKeyboardTransition(): KeyboardTransition {
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const travel = (to: number, event: KeyboardEvent) => {
      const reported = event.duration;
      const duration =
        typeof reported === "number" && reported > 0 ? reported : DEFAULT_DURATION;
      // Reduced motion gets the instant switch this hook replaced: the
      // transition is a nicety, the clearance it carries is not optional.
      progress.value = withTiming(to, {
        duration: reducedMotion ? 0 : duration,
        easing: KEYBOARD_EASING,
      });
    };

    const show = Keyboard.addListener(showEvent, (event) => {
      setVisible(true);
      travel(1, event);
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      setVisible(false);
      travel(0, event);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [reducedMotion]);

  const beginOpen = useCallback(() => {
    if (progress.value === 1) return;
    progress.value = withTiming(1, {
      duration: reducedMotion ? 0 : KEYBOARD_TRAVEL_MS,
      easing: KEYBOARD_EASING,
    });
  }, [reducedMotion]);

  return { visible, progress, beginOpen };
}
