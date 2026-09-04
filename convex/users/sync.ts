import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { buildSearchTextFrom } from "./search";

/**
 * Keeping the app's `users` row in step with the Better Auth user.
 *
 * Two identities exist for every person: Better Auth owns credentials and
 * sessions inside its component, and this app owns the profile row that
 * everything else references by `Id<"users">`. Before phone sign-in they were
 * joined by email string alone, and the app row was created by the *client*
 * calling `createUser` right after sign-up.
 *
 * That breaks the moment a phone number can create an account: Better Auth
 * creates the user itself during OTP verification, with a synthesised email,
 * and no client code runs in between. So the join is now made by the component's
 * onCreate/onUpdate triggers, which run in the same transaction as the auth
 * write. These functions are that logic, kept out of auth.ts so they can be
 * tested without standing up the auth component.
 */

/** The subset of the Better Auth user document these triggers read. */
export type AuthUserDoc = {
  _id: string;
  email: string;
  name?: string | null;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
};

/**
 * Split a display name into first/last.
 *
 * Phone sign-ups have no name to give, so Better Auth is configured to use the
 * phone number itself. Storing "+966501234567" as someone's first name would
 * then show up as their name all over the app, so anything that looks like a
 * phone number is treated as no name at all.
 */
export function splitName(
  name?: string | null,
  phone?: string | null
): { firstName?: string; lastName?: string } {
  const trimmed = name?.trim();
  if (!trimmed) return {};
  if (phone && trimmed === phone) return {};
  if (/^\+?\d[\d\s-]*$/.test(trimmed)) return {};

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

/**
 * Create or update the app row for a Better Auth user. Idempotent: safe to run
 * on every auth event, and safe to run twice for the same user.
 *
 * Looks up by `authId` first and falls back to email, which is how accounts
 * created before this trigger existed get linked on their owner's next sign-in.
 */
export async function upsertUserFromAuth(
  ctx: MutationCtx,
  doc: AuthUserDoc,
  now: number = Date.now()
): Promise<Id<"users">> {
  const existing =
    (await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", doc._id))
      .first()) ??
    (await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", doc.email))
      .first());

  const names = splitName(doc.name, doc.phoneNumber);

  if (existing) {
    const phone = doc.phoneNumber ?? existing.phone;
    // Verification is one-way: an auth event that happens to carry no phone
    // data must never demote a number the guest has already verified.
    const phoneVerified = existing.phoneVerified || !!doc.phoneNumberVerified;
    // The profile is the app's to own — only fill names in if there are none,
    // so a guest who edited their name in the app does not get it overwritten.
    const fillNames = !existing.firstName && !existing.lastName ? names : {};

    await ctx.db.patch(existing._id, {
      authId: doc._id,
      phone,
      phoneVerified,
      ...fillNames,
      searchText: buildSearchTextFrom({
        email: existing.email,
        phone,
        firstName: fillNames.firstName ?? existing.firstName,
        lastName: fillNames.lastName ?? existing.lastName,
      }),
      updatedAt: now,
    });
    return existing._id;
  }

  return await ctx.db.insert("users", {
    email: doc.email,
    ...names,
    phone: doc.phoneNumber ?? undefined,
    phoneVerified: !!doc.phoneNumberVerified,
    role: "tourist",
    preferredLanguage: "ar",
    favoriteListingIds: [],
    authId: doc._id,
    searchText: buildSearchTextFrom({
      email: doc.email,
      phone: doc.phoneNumber,
      ...names,
    }),
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Mirror a Better Auth user update onto the app row.
 *
 * The case that matters is phone verification: the guest posts a code to
 * Better Auth, which sets phoneNumber/phoneNumberVerified on its own user, and
 * this is what makes `users.phoneVerified` follow — which in turn is what the
 * booking flow gates on.
 */
export async function mirrorAuthUserUpdate(
  ctx: MutationCtx,
  newDoc: AuthUserDoc,
  oldDoc: AuthUserDoc,
  now: number = Date.now()
): Promise<void> {
  const relevantChange =
    newDoc.email !== oldDoc.email ||
    newDoc.name !== oldDoc.name ||
    newDoc.phoneNumber !== oldDoc.phoneNumber ||
    newDoc.phoneNumberVerified !== oldDoc.phoneNumberVerified;
  if (!relevantChange) return;

  const existing =
    (await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", newDoc._id))
      .first()) ??
    (await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", oldDoc.email))
      .first());

  if (!existing) {
    // No row to mirror onto — the account predates the trigger and has never
    // been linked, so treat this as the create it never had.
    await upsertUserFromAuth(ctx, newDoc, now);
    return;
  }

  const phone = newDoc.phoneNumber ?? existing.phone;
  const phoneVerified = existing.phoneVerified || !!newDoc.phoneNumberVerified;
  const names = splitName(newDoc.name, newDoc.phoneNumber);
  const fillNames = !existing.firstName && !existing.lastName ? names : {};
  const email = newDoc.email !== oldDoc.email ? newDoc.email : existing.email;

  await ctx.db.patch(existing._id, {
    authId: newDoc._id,
    email,
    phone,
    phoneVerified,
    ...fillNames,
    searchText: buildSearchTextFrom({
      email,
      phone,
      firstName: fillNames.firstName ?? existing.firstName,
      lastName: fillNames.lastName ?? existing.lastName,
    }),
    updatedAt: now,
  });
}
