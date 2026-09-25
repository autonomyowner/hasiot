import { mutation, type MutationCtx } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { getAuthenticatedAppUser, requireAdmin, authComponent, createAuth } from "../auth";
import { enforceRateLimit } from "../rateLimit";
import { approveBusinessAccountRecord } from "../admin/service";
import { buildSearchTextFrom } from "./search";

/**
 * "Not authenticated" stays English only: the app maps that exact text to
 * "session expired" (contract, "Unchanged refusals"). It is a ConvexError now
 * because production redacts a plain Error to "Server Error", which the app
 * could only answer with "please try again".
 */
const NOT_AUTHENTICATED = "Not authenticated";

const USER_ERRORS = {
  ONLY_BUSINESS_UPLOADS:
    "يمكن لحسابات الأعمال فقط رفع الوثائق. / Only business accounts can upload documents.",
} as const;

// Maximum favorites a single user can hold. Bounds both the user document and
// the Promise.all fan-out in users/queries.ts:getFavorites.
const MAX_FAVORITES = 200;

// Generate an upload URL for business document
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    // Each URL is a signed write into file storage — cap them per user per day
    // so one account cannot run up unbounded storage cost.
    await enforceRateLimit(
      ctx,
      `upload:${user._id}`,
      50,
      "لقد وصلت إلى الحد اليومي لرفع الملفات. يرجى المحاولة غدًا. / Daily upload limit reached. Please try again tomorrow."
    );
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
      throw new Error("Not authenticated");
    }

    const updates: Record<string, unknown> = {
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;
    if (args.preferredLanguage !== undefined) updates.preferredLanguage = args.preferredLanguage;
    if (args.city !== undefined) updates.city = args.city;

    // `phone` is accepted for wire compatibility but never written here. The
    // number is owned by Better Auth now and mirrored onto this row by the
    // onUpdate trigger, so writing it directly would produce a row whose phone
    // disagrees with the verified one. Changing a phone goes through the OTP
    // flow (/phone-number/verify with updatePhoneNumber).
    if (args.phone !== undefined && args.phone !== user.phone) {
      throw new Error(
        "لتغيير رقم الجوال يلزم التحقق برمز. / Changing a phone number requires OTP verification."
      );
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
      throw new Error("Not authenticated");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    const currentFavorites = user.favoriteListingIds || [];
    const isFavorite = currentFavorites.includes(args.listingId);

    let newFavorites: typeof currentFavorites;
    if (isFavorite) {
      newFavorites = currentFavorites.filter((id) => id !== args.listingId);
    } else {
      if (currentFavorites.length >= MAX_FAVORITES) {
        throw new Error(
          `لا يمكن حفظ أكثر من ${MAX_FAVORITES} مفضلة. / You can save at most ${MAX_FAVORITES} favorites.`
        );
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
      throw new Error("Invalid role");
    }

    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const updates: Record<string, unknown> = {
      role: args.role,
      updatedAt: Date.now(),
    };

    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) updates.lastName = args.lastName;

    if (args.role === "business_owner" || args.role === "service_provider") {
      updates.businessType = args.businessType;
      updates.isApproved = false;
    }

    await ctx.db.patch(user._id, updates);

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

// Delete user account and all associated data (Google Play requirement)
export const deleteMyAccount = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Delete user's listings
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();
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

    // Delete user's services
    const services = await ctx.db
      .query("services")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();
    for (const service of services) {
      await ctx.db.delete(service._id);
    }

    // Delete user's bookings
    const bookings = await ctx.db
      .query("bookings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const booking of bookings) {
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

    // Delete user's reviews
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    for (const review of reviews) {
      await ctx.db.delete(review._id);
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

    // Delete from Better-Auth internal tables (user, session, account)
    // so the email can be re-registered
    try {
      const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
      await auth.api.deleteUser({ body: {}, headers });
    } catch (e) {
      console.error("Failed to delete Better-Auth user (continuing):", e);
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
      firstName: args.firstName,
      lastName: args.lastName,
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
