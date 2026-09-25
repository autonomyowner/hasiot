import { describe, expect, it } from "vitest";

/**
 * Production redacts a plain Error's message to "Server Error", so a refusal a
 * person can cause must be a ConvexError or they are told nothing useful
 * (contract, "Rules for every function"). This pins that for the modules a
 * client can reach in admin, users and listings.
 *
 * devTools.ts and internalOps.ts are left out on purpose: they hold only
 * internalMutations, run from the CLI, whose errors are not redacted.
 */
const sources = import.meta.glob(
  [
    "./mutations.ts",
    "./queries.ts",
    "./service.ts",
    "./users.ts",
    "./views.ts",
    "./activity.ts",
    "../users/mutations.ts",
    "../users/queries.ts",
    "../listings/mutations.ts",
    "../listings/queries.ts",
    "../listings/pricing.ts",
  ],
  { query: "?raw", import: "default", eager: true }
) as Record<string, string>;

describe("refusals a person can meet", () => {
  it("covers every module it names", () => {
    expect(Object.keys(sources)).toHaveLength(11);
  });

  it.each(Object.entries(sources))("%s throws no plain Error", (_path, source) => {
    const offending = source
      .split("\n")
      .map((line, i) => ({ line: line.trim(), number: i + 1 }))
      .filter(({ line }) => /throw new Error\(/.test(line));
    expect(offending).toEqual([]);
  });
});
