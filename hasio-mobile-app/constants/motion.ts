import { FadeInDown } from "react-native-reanimated";

// Shared spring for press feedback — matches the feel used across the app.
export const pressSpring = { damping: 15, stiffness: 400 } as const;

export const PRESS_SCALE_CARD = 0.98;
export const PRESS_SCALE_CHIP = 0.95;
export const PRESS_SCALE_ICON = 0.9;

// Staggered entrance for list items / sections. Delay is capped so long
// lists don't keep staggering forever.
export const enterFade = (index = 0) =>
  FadeInDown.duration(360).delay(Math.min(index, 6) * 55);
