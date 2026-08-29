import { useCallback, useEffect, useRef, useState } from "react";
import { Keyboard, Platform, View } from "react-native";

/**
 * Android keyboard handling.
 *
 * `KeyboardAvoidingView` can't be trusted on Android here: with edge-to-edge
 * (default since Expo SDK 54) Android 15+ ignores `adjustResize`, so the window
 * never shrinks and the keyboard just covers the input. Older Android still
 * resizes, so a fixed `behavior` is wrong on one version or the other.
 *
 * Instead, measure how much of the attached view the keyboard actually covers
 * and pad by exactly that. This is correct on both: if the window did resize,
 * the view's bottom already sits above the keyboard and the overlap is 0.
 * It also stays correct inside a PagerView or above a floating tab bar, where
 * the raw keyboard height overshoots by the distance from the view's bottom to
 * the bottom of the screen.
 *
 * The overlap is recomputed on layout as well as on the keyboard event, and
 * that is load-bearing. Measuring only inside `keyboardDidShow` races the
 * window resize: on the Android versions that do honour `adjustResize`, the
 * event can arrive while the view still reports its full pre-resize height, so
 * the overlap comes back as a whole keyboard height and gets padded on top of a
 * window that then shrinks anyway. The result is a dead band the height of the
 * keyboard sitting over the submit button — the bug this guards against.
 * Recomputing from `onLayout` makes it self-correcting whichever order the
 * resize and the keyboard event happen to arrive in.
 *
 * Callers must attach BOTH returned values to the same view:
 *
 *     const { ref, overlap, onLayout } = useKeyboardOverlap();
 *     <View ref={ref} onLayout={onLayout} style={{ flex: 1, paddingBottom: overlap }}>
 *
 * Returns a no-op ({ overlap: 0 }) on iOS — use KeyboardAvoidingView there.
 */
export function useKeyboardOverlap(onKeyboardShow?: () => void) {
  const ref = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);
  // Top edge of the keyboard in window coordinates, or null while it is hidden.
  const keyboardTopRef = useRef<number | null>(null);
  const onShowRef = useRef(onKeyboardShow);
  onShowRef.current = onKeyboardShow;

  const recompute = useCallback(() => {
    if (Platform.OS !== "android") return;

    const keyboardTop = keyboardTopRef.current;
    if (keyboardTop === null) {
      setOverlap(0);
      return;
    }

    ref.current?.measureInWindow((_x, y, _width, height) => {
      const covered = y + height - keyboardTop;
      setOverlap(covered > 0 ? covered : 0);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      keyboardTopRef.current = e.endCoordinates.screenY;
      recompute();
      onShowRef.current?.();
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTopRef.current = null;
      setOverlap(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [recompute]);

  // Safe to feed straight into onLayout: padding is applied inside the measured
  // view's own box, so it never changes the frame measureInWindow reports and
  // cannot drive a feedback loop.
  return { ref, overlap, onLayout: recompute };
}
