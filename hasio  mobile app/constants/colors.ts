export const colors = {
  // Primary Colors (Deep Teal - Oasis Water)
  primary: {
    DEFAULT: "#0D7A5F",
    hover: "#0F8B6E",
    light: "#10966D",
    dark: "#0A6650",
  },

  // Accent Colors
  accent: {
    DEFAULT: "#2563EB",
    light: "#3B82F6",
  },
  attention: "#DC6B5A",
  secondary: {
    DEFAULT: "#7C3AED",
    dark: "#6D28D9",
  },

  // Backgrounds (Warm Desert Sand)
  background: "#FAF7F2",
  surface: {
    DEFAULT: "#FFFFFF",
    variant: "#F5F1EB",
    elevated: "#FFFFFF",
  },

  // Text Colors
  onSurface: {
    DEFAULT: "#1A1A1A",
    variant: "#737373",
    muted: "#A3A3A3",
  },

  // Borders
  border: "#E8E5E0",
  divider: "#F0EDE8",

  // System Colors
  success: "#0D7A5F",
  error: "#DC6B5A",
  warning: "#D97706",
  info: "#2563EB",
  gold: "#D97706",

  // Shadows
  shadow: {
    light: "rgba(0, 0, 0, 0.04)",
    medium: "rgba(0, 0, 0, 0.08)",
    heavy: "rgba(0, 0, 0, 0.12)",
  },

  // Overlays
  overlay: {
    light: "rgba(0, 0, 0, 0.3)",
    medium: "rgba(0, 0, 0, 0.5)",
    heavy: "rgba(0, 0, 0, 0.7)",
  },

  // Glass Effect
  glass: {
    background: "rgba(255, 255, 255, 0.85)",
    border: "rgba(255, 255, 255, 0.2)",
  },
} as const;

// Category Badge Colors
export const categoryColors = {
  hotel: colors.primary.DEFAULT,
  apartment: colors.accent.DEFAULT,
  camp: colors.attention,
  homestay: colors.secondary.DEFAULT,
  restaurant: colors.accent.DEFAULT,
  home_kitchen: colors.attention,
  fastfood: colors.primary.DEFAULT,
  drinks: colors.gold,
  festival: colors.secondary.DEFAULT,
  conference: colors.accent.DEFAULT,
  outdoor: colors.primary.DEFAULT,
  indoor: colors.attention,
  seasonal: colors.gold,
} as const;

export type CategoryType = keyof typeof categoryColors;
