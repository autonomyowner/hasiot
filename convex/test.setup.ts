/// <reference types="vite/client" />

// The module map convex-test needs to run the backend in-process.
//
// The glob mirrors the Convex CLI's own rule: it skips any file whose basename
// contains more than one dot, so `foo.test.ts`, `test.setup.ts` and
// `test.utils.ts` are never pushed to a deployment. Matching that here keeps
// the test-time module graph identical to the deployed one — if this glob
// picked up the test files, they would import convex-test and blow up.
export const modules = import.meta.glob("./**/!(*.*.*)*.*s");
