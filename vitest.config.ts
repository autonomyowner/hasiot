import { defineConfig } from "vitest/config";

// Deliberately separate from vite.config.js: that file builds the website and
// must not grow a test section. This one only runs the Convex backend tests.
//
// `edge-runtime` is what convex-test expects — the Convex function runtime is
// not Node, and tests that pass under `node` can fail in production.
export default defineConfig({
  test: {
    environment: "edge-runtime",
    include: ["convex/**/*.test.ts"],
    // convex-test ships ESM that Vitest has to transform rather than
    // externalise, or `import.meta.glob` modules never resolve.
    server: { deps: { inline: ["convex-test"] } },
  },
});
