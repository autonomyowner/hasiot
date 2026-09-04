import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // This config lints the website. Everything else here has its own toolchain
  // or none, and running these rules over them produced ~2450 errors that
  // nobody could act on — which made `npm run lint` useless as a signal.
  //
  // hasio-mobile-app: Expo project, TypeScript, own eslint entry point.
  // convex/_generated: machine-written.
  // hasio v5: a legacy copy, already gitignored.
  globalIgnores([
    'dist',
    'hasio-mobile-app/**',
    'convex/_generated/**',
    'hasio v5/**',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // ESLint core resolves <Component /> but not JSX member expressions like
      // <motion.div />, so framer-motion's lowercase `motion` import reads as
      // unused in every file that animates anything. Allow it by name rather
      // than pulling in eslint-plugin-react for one rule.
      'no-unused-vars': ['error', { varsIgnorePattern: '^([A-Z_]|motion$)' }],
    },
  },
  {
    // shadcn generates these; they export their cva variants next to the
    // component by design. Restructuring vendor files to satisfy a fast-refresh
    // rule would just make `npx shadcn add` overwrite the fix.
    files: ['src/admin/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
])
