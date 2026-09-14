const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const globals = require("globals");

// The repo-root config deliberately ignores this directory — "Expo project,
// TypeScript, own eslint entry point". This is that entry point. Without it
// ESLint walks up, finds the website's config, and reports every file here as
// ignored instead of linting anything, which is the state `npm run lint` was
// in: it had never linted the mobile app at all.
module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      "dist/**",
      ".expo/**",
      // A legacy copy of the app kept for reference, already gitignored.
      "hasio v5/**",
    ],
  },
  {
    // Build scripts are Node, not React Native.
    files: ["scripts/**"],
    languageOptions: { globals: globals.node },
  },
  {
    rules: {
      // Reanimated's shared values are mutated by design — `scrollPosition.value
      // = …` on the UI thread is the whole API, and the tab bar, every press
      // animation and the pager tint are built on it. This React Compiler rule
      // has no model of shared values, so it flags all 29 of those assignments
      // as illegal mutation. Every one is a false positive here.
      "react-hooks/immutability": "off",

      // The rest of the React Compiler rules in eslint-plugin-react-hooks 7 do
      // point at real patterns, but all of them predate this config and none
      // are regressions — they are simply the first time this code has been
      // linted. Kept visible as warnings so they can be worked through
      // deliberately, rather than as errors that make the command useless on
      // day one. Two knowingly-intentional cases sit in here: the latest-ref
      // pattern in hooks/useKeyboardOverlap.ts, and the sheets that reset their
      // own state when they open.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
