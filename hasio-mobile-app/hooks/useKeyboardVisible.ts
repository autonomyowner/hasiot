import { useCallback, useEffect, useState } from "react";
import { Keyboard, Platform, type KeyboardEvent } from "react-native";
import {
  Easing,
  KeyboardState,
  makeMutable,
  useAnimatedKeyboard,
  useAnimatedReaction,
  useReducedMotion,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

const IS_ANDROID = Platform.OS === "android";

/**
 * How far the keyboard rises before the tab bar is considered gone.
 *
 * Roughly a bar's own height: by the time the keyboard has come up that far it
 * is already covering the bar, so there is nothing left for the bar to be in
 * the way of.
 */
const BAR_EXIT_SPAN = 120;

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

/** Reanimated's "up and still", as a plain number for the worklets to capture. */
const STATE_OPEN: number = KeyboardState.OPEN;

/**
 * Android: how long after `keyboardDidHide` a keyboard that has not started
 * animating away is declared gone (see `declaredGone`). A real hide has sent
 * several frames by then; an animation that never started never will.
 */
const HIDE_CONFIRM_MS = 300;

/**
 * iOS: how long `beginOpen()` waits for the keyboard to announce itself before
 * handing the tab bar back.
 */
const OPEN_CONFIRM_MS = KEYBOARD_TRAVEL_MS + 400;

/**
 * One timeline, shared by every caller, because there is one keyboard.
 *
 * The tab bar and the screen's own bottom bar have to leave together, and two
 * hook instances each animating their own copy is exactly how they end up a
 * frame apart. Module scope also lets a screen start the transition on focus
 * and have the tab bar follow, without either knowing about the other.
 */
const progress = makeMutable(0);

/** The keyboard's height as the callers should use it — see `height` below. */
const trackedHeight = makeMutable(0);

/** Whether Android's frame-by-frame tracking has ever reported a keyboard. */
const trackingSeen = makeMutable(false);

/**
 * Set when the keyboard has gone without Reanimated seeing it go.
 *
 * Reanimated ignores a zero-height inset while it believes the keyboard is
 * OPEN — `Keyboard.updateHeight` in its Android sources, guarding against a
 * one-frame flicker when an animation is cancelled. So a keyboard that
 * disappears without animating — the app sent to the background, focus moving
 * into a Modal's own window — leaves the tracked height at a full keyboard and
 * the state at OPEN, and nothing ever corrects them: the tab bar stayed below
 * the screen edge and the planner's composer stayed lifted over nothing.
 * React Native's own `keyboardDidHide` does notice, because it reads the IME's
 * visibility on every layout, so a hide that no animation follows within
 * HIDE_CONFIRM_MS declares the keyboard gone.
 *
 * The next keyboard animation clears it. Reanimated starts that one from its
 * stale height, so its state reads CLOSING while the keyboard rises — but the
 * heights it reports from then on are real again.
 */
const declaredGone = makeMutable(false);

// Timers and flags shared by every instance, behind module-level functions so
// no component code reassigns a module variable itself.
let hideConfirmTimer: ReturnType<typeof setTimeout> | null = null;
let openConfirmTimer: ReturnType<typeof setTimeout> | null = null;
let iosKeyboardUp = false;

type TrackedKeyboard = ReturnType<typeof useAnimatedKeyboard>;

function cancelHideConfirm() {
  if (hideConfirmTimer) clearTimeout(hideConfirmTimer);
  hideConfirmTimer = null;
}

function confirmHideLater(keyboard: TrackedKeyboard) {
  cancelHideConfirm();
  hideConfirmTimer = setTimeout(() => {
    hideConfirmTimer = null;
    // Read once, off the render path: a synchronous read of the UI thread's
    // values is exactly what this check needs and costs nothing at this rate.
    if (keyboard.state.value === STATE_OPEN && keyboard.height.value > 0) {
      declaredGone.value = true;
    }
  }, HIDE_CONFIRM_MS);
}

function cancelOpenConfirm() {
  if (openConfirmTimer) clearTimeout(openConfirmTimer);
  openConfirmTimer = null;
}

function setIosKeyboardUp(up: boolean) {
  iosKeyboardUp = up;
  if (up) cancelOpenConfirm();
}

function confirmOpenLater(duration: number) {
  cancelOpenConfirm();
  openConfirmTimer = setTimeout(() => {
    openConfirmTimer = null;
    if (iosKeyboardUp) return;
    progress.value = withTiming(0, { duration, easing: KEYBOARD_EASING });
  }, OPEN_CONFIRM_MS);
}

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
   * iOS only. Call it from a `TextInput`'s `onFocus`, which comes before the
   * keyboard moves at all. If no keyboard follows — a hardware keyboard is
   * attached, or focus went straight on somewhere else — the bar is handed
   * back after a moment; it used to stay hidden until the next keyboard.
   * Android follows the keyboard's real height instead, so this does nothing
   * there.
   */
  beginOpen: () => void;
  /**
   * The keyboard's height, in points, tracked frame by frame, on the way up
   * and on the way down.
   *
   * Only meaningful on Android, and only there does anything read it. iOS gets
   * its lift from `KeyboardAvoidingView`, which is driven by the will-events
   * and Apple's own curve — a second source there would only fight it. Zero
   * once a keyboard that vanished without animating has been declared gone.
   */
  height: SharedValue<number>;
  /**
   * Whether `height` has ever reported a keyboard on this device. Until it
   * has, callers need a fallback; once it has, the fallback only gets in the
   * way. Android only.
   */
  trackingSeen: SharedValue<boolean>;
}

/**
 * The software keyboard's arrival and departure, as something to animate with.
 *
 * iOS moves on the will-events, which fire alongside the keyboard's own
 * animation and hand over its duration. Android has no will-events, and its
 * did-events cannot be trusted to arrive before the keyboard has moved, so
 * there the transition follows the keyboard's height frame by frame from
 * Reanimated's `useAnimatedKeyboard`.
 *
 * What that costs, since it is process-wide: while any instance is mounted,
 * Reanimated owns the activity decor view's insets listener and its
 * WindowInsetsAnimation callback, and turns `decorFitsSystemWindows` off. The
 * app already draws edge to edge, so that last part changes nothing — and
 * with edge-to-edge on, Reanimated treats both system bars as translucent
 * whatever it is told, which is why no options are passed: they are ignored,
 * and only log a warning in development. It does not touch the soft-input
 * mode. (This comment used to say the hook avoided `useAnimatedKeyboard` for
 * that reason, directly above a call to it.) Every instance reads one native
 * keyboard model, updated in one loop, so two instances cannot disagree.
 *
 * Separate from `useKeyboardOverlap`, which answers a different question (how
 * much of a given view the keyboard covers). This one exists for the callers
 * that only need to get out of the way — the docked tab bar, mainly, which
 * otherwise lands on top of a screen's own bottom bar the moment the window
 * shrinks for the keyboard — and for the planner's composer, which rides it.
 */
export function useKeyboardTransition(): KeyboardTransition {
  const [visible, setVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  const keyboard = useAnimatedKeyboard();

  // Android: the tracked height drives everything, so the tab bar leaves and
  // returns in step with the keyboard, not after it. Every instance runs this
  // on the same notification and writes the same values.
  useAnimatedReaction(
    () => ({
      height: keyboard.height.value,
      state: keyboard.state.value as number,
      gone: declaredGone.value,
    }),
    (current, previous) => {
      if (!IS_ANDROID) return;
      if (current.gone) {
        if (current.state !== STATE_OPEN) {
          // A new animation has started; its heights are real again.
          declaredGone.value = false;
          return;
        }
        if (!previous?.gone) {
          // Just declared gone: ease back rather than snap.
          const settle = { duration: KEYBOARD_TRAVEL_MS, easing: KEYBOARD_EASING };
          trackedHeight.value = withTiming(0, settle);
          progress.value = withTiming(0, settle);
        }
        return;
      }
      if (current.height > 0) trackingSeen.value = true;
      trackedHeight.value = current.height;
      progress.value = current.height > 0 ? Math.min(1, current.height / BAR_EXIT_SPAN) : 0;
    },
    []
  );

  useEffect(() => {
    const showEvent = IS_ANDROID ? "keyboardDidShow" : "keyboardWillShow";
    const hideEvent = IS_ANDROID ? "keyboardDidHide" : "keyboardWillHide";

    // iOS: move with the keyboard, on its own duration. Reduced motion gets the
    // instant switch this hook replaced: the transition is a nicety, the
    // clearance it carries is not optional.
    const travel = (to: number, event: KeyboardEvent) => {
      const reported = event.duration;
      const duration =
        typeof reported === "number" && reported > 0 ? reported : DEFAULT_DURATION;
      progress.value = withTiming(to, {
        duration: reducedMotion ? 0 : duration,
        easing: KEYBOARD_EASING,
      });
    };

    // Android, on a device where tracking has never reported: the did-events
    // are all there is. Late, but the bar still gets out of the way. Once
    // tracking has been seen it owns `progress`, and this would only fight it.
    const fallback = (to: number) => {
      if (trackingSeen.value) return;
      progress.value = withTiming(to, {
        duration: reducedMotion ? 0 : DEFAULT_DURATION,
        easing: KEYBOARD_EASING,
      });
    };

    const show = Keyboard.addListener(showEvent, (event) => {
      setVisible(true);
      if (IS_ANDROID) {
        cancelHideConfirm();
        declaredGone.value = false;
        fallback(1);
        return;
      }
      setIosKeyboardUp(true);
      travel(1, event);
    });
    const hide = Keyboard.addListener(hideEvent, (event) => {
      setVisible(false);
      if (IS_ANDROID) {
        confirmHideLater(keyboard);
        fallback(0);
        return;
      }
      setIosKeyboardUp(false);
      travel(0, event);
    });

    return () => {
      show.remove();
      hide.remove();
    };
  }, [keyboard, reducedMotion]);

  const beginOpen = useCallback(() => {
    if (IS_ANDROID || progress.value === 1) return;
    const duration = reducedMotion ? 0 : KEYBOARD_TRAVEL_MS;
    progress.value = withTiming(1, { duration, easing: KEYBOARD_EASING });
    confirmOpenLater(duration);
  }, [reducedMotion]);

  return { visible, progress, beginOpen, height: trackedHeight, trackingSeen };
}
