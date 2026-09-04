import { convexTest } from "convex-test";
import schema from "./schema";
import { modules } from "./test.setup";
import type { Id } from "./_generated/dataModel";

/**
 * Shared fixtures for the backend tests.
 *
 * These seed rows directly through `t.run` rather than through the public
 * mutations on purpose: convex-test cannot resolve the Better Auth component,
 * so anything that goes through `getAuthenticatedAppUser` is untestable here.
 * The tests exercise the service seams (`users/sync.ts`) which take an
 * already-resolved document, and the auth path itself is verified by hand
 * against the dev deployment.
 */
export function makeT() {
  return convexTest(schema, modules);
}

export type TestT = ReturnType<typeof makeT>;

/** A fixed "today" in Riyadh so date assertions never depend on the clock. */
export const TODAY = "2026-09-03";
/** 2026-09-03T00:00 Riyadh == 2026-09-02T21:00Z. */
export const NOW = Date.UTC(2026, 8, 2, 21, 0, 0);

export async function seedUser(
  t: TestT,
  opts: {
    email?: string;
    phone?: string;
    phoneVerified?: boolean;
    role?: string;
    isApproved?: boolean;
    firstName?: string;
    lastName?: string;
    authId?: string;
    isSuspended?: boolean;
  } = {}
): Promise<Id<"users">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("users", {
      email: opts.email ?? `user${Math.random().toString(36).slice(2, 8)}@example.com`,
      firstName: opts.firstName ?? "Test",
      lastName: opts.lastName ?? "User",
      phone: opts.phone,
      phoneVerified: opts.phoneVerified,
      role: opts.role ?? "tourist",
      isApproved: opts.isApproved,
      authId: opts.authId,
      isSuspended: opts.isSuspended,
      preferredLanguage: "ar",
      favoriteListingIds: [],
      createdAt: NOW,
      updatedAt: NOW,
    })
  );
}
