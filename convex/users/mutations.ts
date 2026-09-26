import { mutation, type MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedAppUser, requireAdmin, authComponent, createAuth } from "../auth";
import { enforceRateLimit } from "../rateLimit";
import { approveBusinessAccountRecord } from "../admin/service";
import { LISTING_ERRORS } from "../listings/queries";
import { notifyBookingEvent } from "../notifications/internal";
import { recomputeReviewTarget } from "../reviews/service";
import { buildSearchTextFrom } from "./search";

/**
 * "Not authenticated" stays English only: the app maps that exact text to
 * "session expired" (contract, "Unchanged refusals"). It is a ConvexError now
 * because production redacts a plain Error to "Server Error", which the app
 * could only answer with "please try again".
 */
const NOT_AUTHENTICATED = "Not authenticated";

// Maximum favorites a single user can hold. Bounds both the user document and
// the Promise.all fan-out in users/queries.ts:getFavorites.
const MAX_FAVORITES = 200;

const USER_ERRORS = {
  ONLY_BUSINESS_UPLOADS:
    "يمكن لحسابات الأعمال فقط رفع الوثائق. / Only business accounts can upload documents.",
  UPLOAD_LIMIT:
    "لقد وصلت إلى الحد اليومي لرفع الملفات. يرجى المحاولة غدًا. / Daily upload limit reached. Please try again tomorrow.",
  PHONE_NEEDS_OTP:
    "لتغيير رقم الجوال يلزم التحقق برمز. / Changing a phone number requires OTP verification.",
  TOO_MANY_FAVORITES: `لا يمكن حفظ أكثر من ${MAX_FAVORITES} مفضلة. / You can save at most ${MAX_FAVORITES} favorites.`,
  INVALID_ROLE: "دور غير صالح. / Invalid role.",
} as const;

/**
 * A person's first or last name as stored: trimmed and at most 50 characters.
 * Names are printed into other people's notifications ("Sara requested…"),
 * so an unbounded one could carry a paragraph of anything onto a stranger's
 * lock screen.
 */
export const MAX_NAME = 50;
export function cleanName(value: string): string {
  return value.trim().slice(0, MAX_NAME);
}

export const UPLOADS_PER_DAY = 50;
export const ADMIN_UPLOADS_PER_DAY = 500;

/**
 * Count one signed upload URL against the caller's daily allowance.
 *
 * Each URL is a write into file storage, so one account cannot be allowed to
 * run up unbounded storage cost. An admin gets ten times the allowance: every
 * photo the panel adds to a listing is one URL, and at 50 an admin filling in
 * the seeded catalogue ran out partway through a morning.
 */
export async function enforceUploadAllowance(ctx: MutationCtx, user: Doc<"users">): Promise<void> {
  await enforceRateLimit(
    ctx,
    `upload:${user._id}`,
    user.role === "admin" ? ADMIN_UPLOADS_PER_DAY : UPLOADS_PER_DAY,
    USER_ERRORS.UPLOAD_LIMIT
  );
}

// Generate an upload URL (business documents, listing and service photos)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new ConvexError(NOT_AUTHENTICATED);
    }
    await enforceUploadAllowance(ctx, user);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Attach the owner's business document for review.
 *
 * A new document also clears an earlier rejection, which is what puts a
 * turned-down account back in the admin's queue: the old verdict was about a
 * file nobody is looking at any more.
 */
export async function saveBusinessDocForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  fileId: Id<"_storage">,
  now: number = Date.now()
): Promise<void> {
  if (user.role !== "business_owner" && user.role !== "service_provider") {
    throw new ConvexError(USER_ERRORS.ONLY_BUSINESS_UPLOADS);
  }

  await ctx.db.patch(user._id, {
    cvFileId: fileId,
    accountRejectionReason: undefined,
    accountRejectedAt: undefined,
    updatedAt: now,
  });
}

// Save business document reference to user record
export const saveBusinessDoc = mutation({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new ConvexError(NOT_AUTHENTICATED);
    }

    await saveBusinessDocForUser(ctx, user, args.fileId);
    return { success: true };
  },
});

// Update user profile
export const updateProfile = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new ConvexError(NOT_AUTHENTICATED);
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    // Bounded: a name is printed into other people's notifications ("Sara
    // requested…"), and unbounded it could carry a paragraph of anything.
    if (args.firstName !== undefined) updates.firstName = cleanName(args.firstName);
    if (args.lastName !== undefined) updates.lastName = cleanName(args.lastName);
    if (args.preferredLanguage !== undefined) updates.preferredLanguage = args.preferredLanguage;
    if (args.city !== undefined) updates.city = args.city;

    // `phone` is accepted for wire compatibility but never written here. The
    // number is owned by Better Auth now and mirrored onto this row by the
    // onUpdate trigger, so writing it directly would produce a row whose phone
    // disagrees with the verified one. Changing a phone goes through the OTP
    // flow (/phone-number/verify with updatePhoneNumber).
    if (args.phone !== undefined && args.phone !== user.phone) {
      throw new ConvexError(USER_ERRORS.PHONE_NEEDS_OTP);
    }

    updates.searchText = buildSearchTextFrom({
      email: user.email,
      phone: user.phone,
      firstName: (updates.firstName as string | undefined) ?? user.firstName,
      lastName: (updates.lastName as string | undefined) ?? user.lastName,
    });

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

// Toggle favorite listing
export const toggleFavorite = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new ConvexError(NOT_AUTHENTICATED);
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new ConvexError(LISTING_ERRORS.NOT_FOUND);
    }

    const currentFavorites = user.favoriteListingIds || [];
    const isFavorite = currentFavorites.includes(args.listingId);

    let newFavorites: typeof currentFavorites;
    if (isFavorite) {
      newFavorites = currentFavorites.filter((id) => id !== args.listingId);
    } else {
      if (currentFavorites.length >= MAX_FAVORITES) {
        throw new ConvexError(USER_ERRORS.TOO_MANY_FAVORITES);
      }
      newFavorites = [...currentFavorites, args.listingId];
    }

    await ctx.db.patch(user._id, {
      favoriteListingIds: newFavorites,
      updatedAt: Date.now(),
    });

    return { isFavorite: !isFavorite };
  },
});

/**
 * A person choosing what their account is (the app's upgrade to host or
 * provider). A business or provider account starts unapproved.
 *
 * Rebuilds searchText with the names it writes: it used to leave the old blob,
 * so admin search could not find a new host by the name they had just given.
 */
export async function setOwnRoleForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: { role: string; businessType?: string; firstName?: string; lastName?: string },
  now: number = Date.now()
): Promise<void> {
  const updates: Record<string, unknown> = {
    role: args.role,
    updatedAt: now,
  };

  const firstName = args.firstName === undefined ? undefined : cleanName(args.firstName);
  const lastName = args.lastName === undefined ? undefined : cleanName(args.lastName);
  if (firstName !== undefined) updates.firstName = firstName;
  if (lastName !== undefined) updates.lastName = lastName;

  if (args.role === "business_owner" || args.role === "service_provider") {
    updates.businessType = args.businessType;
    updates.isApproved = false;
  }

  updates.searchText = buildSearchTextFrom({
    email: user.email,
    phone: user.phone,
    firstName: firstName ?? user.firstName,
    lastName: lastName ?? user.lastName,
  });

  await ctx.db.patch(user._id, updates);
}

// Set user role after signup
export const setUserRole = mutation({
  args: {
    role: v.string(), // "tourist" | "business_owner" | "service_provider"
    businessType: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ALLOWED_ROLES = ["tourist", "business_owner", "service_provider"];
    if (!ALLOWED_ROLES.includes(args.role)) {
      throw new ConvexError(USER_ERRORS.INVALID_ROLE);
    }

    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new ConvexError(NOT_AUTHENTICATED);
    }

    await setOwnRoleForUser(ctx, user, args);
    return { success: true };
  },
});

/**
 * Admin approves a business account. Refused without an uploaded document;
 * clears any earlier rejection, logs, and tells the owner
 * (approveBusinessAccountRecord).
 */
export const approveBusinessAccount = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await approveBusinessAccountRecord(ctx, admin, args.userId);
    return { success: true };
  },
});

/** Given to each guest whose booking dies with the host's account. */
const HOST_CLOSED_ACCOUNT = "أُغلق حساب المضيف / The host closed their account";

const isOpen = (booking: Doc<"bookings">) =>
  booking.status === "pending" || booking.status === "confirmed";

/**
 * Everything an account leaves behind, removed — the Google Play and App
 * Store deletion requirement. Better Auth's own records and the users row
 * itself are deleted by deleteMyAccount afterwards, in that order, as before.
 *
 * Other people's plans come first. A host's open bookings are cancelled and
 * each guest told why before the listing or service goes; left as they were,
 * the guest kept a confirmed stay at a place that no longer existed and heard
 * nothing. A guest's own open bookings are cancelled and each host told,
 * before those bookings are deleted with the account. Then everything is
 * deleted, and every place or service the account had rated is rescored.
 */
export async function deleteAccountData(
  ctx: MutationCtx,
  user: Doc<"users">,
  now: number = Date.now()
): Promise<void> {
  const listings = await ctx.db
    .query("listings")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
    .collect();
  const services = await ctx.db
    .query("services")
    .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
    .collect();

  // 1. As a host or provider: cancel what guests are still counting on, and
  // tell them, while the listing or service still exists to name it.
  const onTheirPlaces = [
    ...(
      await Promise.all(
        listings.map((listing) =>
          ctx.db
            .query("bookings")
            .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
            .collect()
        )
      )
    ).flat(),
    ...(
      await Promise.all(
        services.map((service) =>
          ctx.db
            .query("bookings")
            .withIndex("by_serviceId", (q) => q.eq("serviceId", service._id))
            .collect()
        )
      )
    ).flat(),
  ].filter(isOpen);
  for (const booking of onTheirPlaces) {
    await ctx.db.patch(booking._id, {
      status: "cancelled",
      cancellationReason: HOST_CLOSED_ACCOUNT,
      updatedAt: now,
    });
    if (booking.userId === user._id) continue;
    const cancelled = await ctx.db.get(booking._id);
    if (cancelled) {
      await notifyBookingEvent(ctx, "booking.cancelled_admin", cancelled, { reason: HOST_CLOSED_ACCOUNT }, now);
    }
  }

  // 2. As a guest: cancel their own open requests and stays, and tell each
  // host, who is holding a room or a slot for someone who is leaving. The
  // bookings themselves are deleted with the account below.
  const theirBookings = await ctx.db
    .query("bookings")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  for (const booking of theirBookings.filter(isOpen)) {
    await ctx.db.patch(booking._id, { status: "cancelled", updatedAt: now });
    // The same notices cancelAsTourist sends: stays and services. A legacy
    // restaurant slot never notified anyone.
    if (booking.kind !== "stay" && booking.kind !== "service") continue;
    const cancelled = await ctx.db.get(booking._id);
    if (cancelled && cancelled.ownerId !== user._id) {
      await notifyBookingEvent(ctx, "booking.cancelled", cancelled, {}, now);
    }
  }

  // 3. Delete, as before.
  for (const listing of listings) {
    // Delete availability schedules for this listing
    const schedules = await ctx.db
      .query("availabilitySchedules")
      .withIndex("by_listingId", (q) => q.eq("listingId", listing._id))
      .collect();
    for (const schedule of schedules) {
      await ctx.db.delete(schedule._id);
    }
    await ctx.db.delete(listing._id);
  }

  for (const service of services) {
    await ctx.db.delete(service._id);
  }

  for (const booking of theirBookings) {
    await ctx.db.delete(booking._id);
  }

  // Delete user's trips
  const trips = await ctx.db
    .query("trips")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  for (const trip of trips) {
    await ctx.db.delete(trip._id);
  }

  // Delete user's travel plans
  const travelPlans = await ctx.db
    .query("travelPlans")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  for (const plan of travelPlans) {
    await ctx.db.delete(plan._id);
  }

  // Delete user's reviews, then rescore what they rated: a deleted one-star
  // review must stop dragging an average, and a place whose only review goes
  // must stop showing a score nobody gave it.
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  for (const review of reviews) {
    await ctx.db.delete(review._id);
  }
  for (const review of reviews) {
    await recomputeReviewTarget(ctx, review);
  }

  // Delete user's moments, and the stored image behind each one
  const moments = await ctx.db
    .query("moments")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  for (const moment of moments) {
    await ctx.storage.delete(moment.storageId);
    await ctx.db.delete(moment._id);
  }

  // Delete uploaded business document from storage
  if (user.cvFileId) {
    await ctx.storage.delete(user.cvFileId);
  }

  // Their devices, so a push meant for this account can never reach a phone.
  const tokens = await ctx.db
    .query("pushTokens")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  for (const token of tokens) await ctx.db.delete(token._id);

  const notifications = await ctx.db
    .query("notifications")
    .withIndex("by_userId", (q) => q.eq("userId", user._id))
    .collect();
  for (const notification of notifications) await ctx.db.delete(notification._id);

  // Blocks in both directions. There is no index on the blocked side, so that
  // half scans the table; it is small (a row per block anyone ever made), and
  // an index `by_blocked` would make this a range read.
  const blocking = await ctx.db
    .query("userBlocks")
    .withIndex("by_blocker", (q) => q.eq("blockerId", user._id))
    .collect();
  const blockedBy = await ctx.db
    .query("userBlocks")
    .withIndex("by_blocked", (q) => q.eq("blockedUserId", user._id))
    .collect();
  for (const block of [...blocking, ...blockedBy]) await ctx.db.delete(block._id);

  // The reports they filed. Reports about their content stay for the admins.
  const reports = await ctx.db
    .query("contentReports")
    .withIndex("by_reporter", (q) => q.eq("reporterId", user._id))
    .collect();
  for (const report of reports) await ctx.db.delete(report._id);

  // Partner CRM notes: those a partner wrote about this person, and those this
  // person wrote as a partner (an index prefix on ownerId).
  const notesAbout = await ctx.db
    .query("partnerGuestNotes")
    .withIndex("by_guestId", (q) => q.eq("guestId", user._id))
    .collect();
  const notesWritten = await ctx.db
    .query("partnerGuestNotes")
    .withIndex("by_ownerId_and_guestId", (q) => q.eq("ownerId", user._id))
    .collect();
  const noteIds = new Set([...notesAbout, ...notesWritten].map((row) => row._id));
  for (const id of noteIds) await ctx.db.delete(id);
}

// Delete user account and all associated data (Google Play requirement)
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new ConvexError(NOT_AUTHENTICATED);
    }

    await deleteAccountData(ctx, user);

    // Delete the sign-in itself (Better Auth's user, its sessions and its
    // linked accounts) so the email or phone number starts fresh.
    //
    // This used to call auth.api.deleteUser, which is disabled unless the
    // Better Auth options enable it, and which even then demands a recently
    // created session or a password — a phone sign-in signed in last week has
    // neither. It failed on every call, caught and logged, so every "deleted"
    // account kept its login: the privacy policy promised otherwise, and a
    // returning phone signed into an account whose app row was gone. The
    // internal adapter deletes server-side, with the caller already verified
    // as the account holder above.
    const authUser = await authComponent.safeGetAuthUser(ctx).catch(() => null);
    const authUserId = authUser?._id ?? user.authId;
    if (authUserId) {
      const { internalAdapter } = await createAuth(ctx).$context;
      await internalAdapter.deleteSessions(authUserId);
      await internalAdapter.deleteAccounts(authUserId);
      await internalAdapter.deleteUser(authUserId);
    }

    // Delete the app user record
    await ctx.db.delete(user._id);

    return { success: true };
  },
});

// Create user record
/**
 * Create the app row for a freshly signed-up account.
 *
 * Superseded by the Better Auth onCreate trigger in auth.ts, which does this
 * inside the auth transaction. It stays public and unchanged because the 1.0.2
 * binaries on both app stores still call it after an email sign-up, and those
 * installs cannot be updated without a store release. On a current client the
 * row already exists by the time this runs, so it returns the existing id —
 * which is the behaviour it always had for repeat calls.
 *
 * Do not change the arguments or the return type while 1.0.2 is live.
 */
export const createUser = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    role: v.string(),
    businessType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const ALLOWED_ROLES = ["tourist", "business_owner", "service_provider"];
    const safeRole = ALLOWED_ROLES.includes(args.role) ? args.role : "tourist";

    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return existing._id;
    }

    // This mutation is unauthenticated (it runs as part of signup), so a global
    // daily cap bounds how many rows a script can insert into `users`. Checked
    // only on the insert path so returning existing users is never blocked.
    //
    // The cap is deliberately far above any plausible organic signup day: this
    // is a scripted-abuse ceiling, not a throttle. Better-Auth creates the auth
    // identity BEFORE this mutation runs, so anyone we reject here is left with
    // a login and no `users` row — a broken account, not a deferred one. Raising
    // the ceiling is always cheaper than that failure mode.
    await enforceRateLimit(
      ctx,
      "signup:global",
      2000,
      "تعذّر إنشاء الحساب حاليًا. يرجى المحاولة لاحقًا. / Sign-ups are temporarily unavailable. Please try again later."
    );

    // Link to the Better Auth identity when the caller is the account holder.
    // Reaching this line at all means the trigger did not run (an old client,
    // or an account created before triggers existed), so this is the fallback
    // that keeps the two identities joined by more than an email string.
    const authUser = await authComponent.safeGetAuthUser(ctx).catch(() => null);
    const authId = authUser?.email === args.email ? authUser._id : undefined;

    const userId = await ctx.db.insert("users", {
      email: args.email,
      firstName: args.firstName === undefined ? undefined : cleanName(args.firstName),
      lastName: args.lastName === undefined ? undefined : cleanName(args.lastName),
      phone: args.phone,
      role: safeRole,
      businessType: safeRole === "business_owner" || safeRole === "service_provider" ? args.businessType : undefined,
      isApproved: safeRole === "tourist" ? undefined : false,
      preferredLanguage: "ar",
      favoriteListingIds: [],
      authId,
      searchText: buildSearchTextFrom(args),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return userId;
  },
});

/**
 * Attach the Better Auth id to an app row that only matched by email.
 *
 * Called by the mobile app after an email sign-in. Accounts that predate the
 * triggers work fine without it — getAuthenticatedAppUser falls back to email —
 * but that fallback is a second index read on every authenticated call, and it
 * breaks if the account's email ever changes. Queries cannot write, so the link
 * has to be made by an explicit mutation like this one.
 */
export const ensureAuthLink = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx).catch(() => null);
    if (!authUser?.email) return { linked: false };

    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", authUser.email))
      .first();

    if (!user || user.authId === authUser._id) return { linked: false };

    await ctx.db.patch(user._id, { authId: authUser._id, updatedAt: Date.now() });
    return { linked: true };
  },
});
