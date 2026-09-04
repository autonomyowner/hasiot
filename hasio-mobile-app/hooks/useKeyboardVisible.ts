import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Whether the software keyboard is on screen.
 *
 * `will*` on iOS and `did*` on Android is not a style choice: iOS fires the
 * will-events alongside its own animation, so anything driven off them moves
 * with the keyboard rather than after it, and Android has no will-events at all.
 *
 * Separate from `useKeyboardOverlap`, which answers a different question (how
 * much of a given view the keyboard covers). This one exists for the callers
 * that only need to get out of the way — the docked tab bar, mainly, which
 * otherwise lands on top of a screen's own bottom bar the moment the window
 * shrinks for the keyboard.
 */
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, () => setVisible(true));
    const hide = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return visible;
}
