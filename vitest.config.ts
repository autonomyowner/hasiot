import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.js: that file builds the website and
// must not grow a test section. This one runs the Convex backend tests and the
// partner portal's pure helpers.
//
// `edge-runtime` is what convex-test expects — the Convex function runtime is
// not Node, and tests that pass under `node` can fail in production.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    // The partner portal's pure helpers (phone, gate, errors, bookings) run
    // here too; they touch no DOM, so the same environment serves them.
    include: ["convex/**/*.test.ts", "src/partners/**/*.test.js"],
    // convex-test ships ESM that Vitest has to transform rather than
    // externalise, or `import.meta.glob` modules never resolve.
    server: { deps: { inline: ["convex-test"] } },
  },
});
