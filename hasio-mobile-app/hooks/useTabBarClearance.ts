import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_CLEARANCE } from "@/constants/layout";

/**
 * How much bottom padding a scrolling tab screen owes the docked tab bar.
 *
 * The bar is absolutely positioned over the page and its safe-area padding is
 * its own, so a screen has to reserve the bar's height, the fade above it, and
 * the inset underneath it. Two screens reserved only the constant and lost the
 * last rows of a list behind the gesture bar — which is the whole reason this
 * is a hook and not a number anyone can forget to add to.
 */
export function useTabBarClearance() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_CLEARANCE + insets.bottom;
}
