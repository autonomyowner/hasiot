import { useEffect, useRef, useState } from "react";
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
 * Returns a no-op ({ overlap: 0 }) on iOS — use KeyboardAvoidingView there.
 */
export function useKeyboardOverlap(onKeyboardShow?: () => void) {
  const ref = useRef<View>(null);
  const [overlap, setOverlap] = useState(0);
  const onShowRef = useRef(onKeyboardShow);
  onShowRef.current = onKeyboardShow;

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const showSub = Keyboard.addListener("keyboardDidShow", (e) => {
      const keyboardTop = e.endCoordinates.screenY;
      ref.current?.measureInWindow((_x, y, _width, height) => {
        const covered = y + height - keyboardTop;
        setOverlap(covered > 0 ? covered : 0);
        onShowRef.current?.();
      });
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setOverlap(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return { ref, overlap };
}
