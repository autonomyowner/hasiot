/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#0D7A5F",
          hover: "#0F8B6E",
          light: "#10966D",
          dark: "#0A6650",
        },
        accent: {
          DEFAULT: "#2563EB",
          light: "#3B82F6",
        },
        attention: "#DC6B5A",
        secondary: {
          DEFAULT: "#7C3AED",
          dark: "#6D28D9",
        },
        background: "#FAF7F2",
        surface: {
          DEFAULT: "#FFFFFF",
          variant: "#F5F1EB",
          elevated: "#FFFFFF",
        },
        onSurface: {
          DEFAULT: "#1A1A1A",
          variant: "#737373",
          muted: "#A3A3A3",
        },
        border: "#E8E5E0",
        divider: "#F0EDE8",
        success: "#0D7A5F",
        error: "#DC6B5A",
        warning: "#D97706",
        info: "#2563EB",
        gold: "#D97706",
      },
      fontFamily: {
        display: ["Playfair Display", "serif"],
        body: ["Plus Jakarta Sans", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 8px rgba(0, 0, 0, 0.06)",
        elevated: "0 4px 16px rgba(0, 0, 0, 0.08)",
        heavy: "0 8px 24px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
