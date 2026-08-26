import { fonts } from "./colors";

// Type ramp — maps the sizes already in use across the app so adopting a
// token is visually a no-op. New / edited styles should use these instead
// of literals.
export const type = {
  display: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, letterSpacing: -0.5 },
  title: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.serif, fontSize: 28, lineHeight: 34 },
  section: { fontFamily: fonts.semibold, fontSize: 18, letterSpacing: -0.2 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 16.5 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  caption: { fontFamily: fonts.regular, fontSize: 13 },
  micro: { fontFamily: fonts.medium, fontSize: 11.5 },
  eyebrow: { fontFamily: fonts.semibold, fontSize: 11, letterSpacing: 2 },
} as const;

// 4-base spacing scale.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

// Corner radii.
export const radii = {
  chip: 14,
  thumb: 18,
  card: 24,
  sheet: 28,
  pill: 999,
} as const;
