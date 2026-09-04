import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Only `lib/**` is tested. Nothing importing react-native runs under plain
 * Node, and a React Native test renderer is not worth its weight for a handful
 * of pure functions.
 */
export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
