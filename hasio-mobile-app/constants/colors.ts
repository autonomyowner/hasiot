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

  // v5 redesign tokens
  sand: "#E8DFD4", // image / avatar fallback
  mint: "#E9F2EE", // soft green chip surface
  ink: "#1F1D17", // near-black headings / hosting header band
  warm: "#C77B3B", // star / warm accent
  favorite: "#E0524D", // active favorite heart
  hostingAccent: "#7BC4AC", // green accent on dark ink surfaces
  chip: "#EFEAE0", // segmented-control track
  signOut: "#B0493F", // destructive text

  // Text Colors
  onSurface: {
    DEFAULT: "#1F1D17",
    variant: "#6E6859",
    muted: "#8B8576",
  },

  // Borders
  border: "#E8E3D8",
  divider: "#EDE8DD",

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

// Typography — v5 redesign (Instrument Serif headings + Outfit body).
// The font keys match the names registered via useFonts() in app/_layout.tsx.
//
// Two maps, one shape. Neither Instrument Serif nor Outfit carries a single
// Arabic glyph, so Arabic text used to fall through to whatever the OS
// supplies — SF Arabic on iOS, Noto on Android — which is why the app and the
// website did not look like the same product. `arabicFonts` is the same six
// roles in Cairo, the face the website has always used for Arabic.
//
// Do not read these directly in a component. Go through useAppFonts() (or
// useThemedStyles), which picks the map matching the active language.
export const fonts = {
  serif: "InstrumentSerif_400Regular", // display headings
  light: "Outfit_300Light",
  regular: "Outfit_400Regular",
  medium: "Outfit_500Medium",
  semibold: "Outfit_600SemiBold",
  bold: "Outfit_700Bold",
} as const;

// Cairo has no serif cut, so the display role maps to its heaviest weight —
// the usual substitution when a Latin display serif meets Arabic.
export const arabicFonts: AppFonts = {
  serif: "Cairo_700Bold",
  light: "Cairo_300Light",
  regular: "Cairo_400Regular",
  medium: "Cairo_500Medium",
  semibold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
};

export type AppFonts = { [K in keyof typeof fonts]: string };

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
