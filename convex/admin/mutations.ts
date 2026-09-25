import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { requireAdmin } from "../auth";
import { logAdminAction, labelFor } from "./activity";
import {
  applyBookingStatusAsAdmin,
  approveBusinessAccountRecord,
  approveListingRecord,
  approveServiceRecord,
  assignListingHostRecord,
  createListingAsAdmin,
  deleteListingAsAdmin,
  deleteServiceAsAdmin,
  reinstateListingRecord,
  reinstateServiceRecord,
  rejectBusinessAccountRecord,
  rejectListingRecord,
  rejectServiceRecord,
  removeReviewRecord,
  setUserRoleRecord,
  suspendListingRecord,
  suspendServiceRecord,
  suspendUserRecord,
  unsuspendUserRecord,
  updateListingAsAdmin,
  updateServiceAsAdmin,
} from "./service";
import { CLEARABLE_PRICING_ARGS, PRICING_ARGS } from "../listings/pricing";
import { LISTING_ERRORS } from "../listings/queries";
import type { Id } from "../_generated/dataModel";

// One bulk call may not touch more documents than this. Convex transactions are
// bounded, and a runaway "approve everything" is exactly the kind of action that
// should happen in reviewable batches.
const MAX_BULK = 50;

const KNOWLEDGE_NOT_FOUND = "المعلومة غير موجودة. / Knowledge data not found.";

// Create a new listing
export const createListing = mutation({
  args: {
    type: v.string(),
    name_en: v.string(),
    name_ar: v.string(),
    category: v.string(),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.string(),
    city: v.string(),
    region: v.optional(v.string()),
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    // The nightly price and stay terms the form has sent since 2449fbf. Until
    // these were accepted every hotel save was rejected by the validator.
    ...PRICING_ARGS,
    amenities: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    // Convex storage URLs in display order — index 0 is the cover. Same shape
    // the mobile app writes through listings/mutations:submitListing.
    images: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return await createListingAsAdmin(ctx, admin, args);
  },
});

// Update a listing. `null` clears a field; a field left out is not touched.
export const updateListing = mutation({
  args: {
    id: v.id("listings"),
    type: v.optional(v.string()),
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    category: v.optional(v.string()),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.union(v.string(), v.null())),
    description_ar: v.optional(v.union(v.string(), v.null())),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    phone: v.optional(v.union(v.string(), v.null())),
    email: v.optional(v.union(v.string(), v.null())),
    website: v.optional(v.union(v.string(), v.null())),
    priceRange: v.optional(v.union(v.string(), v.null())),
    ...CLEARABLE_PRICING_ARGS,
    amenities: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return await updateListingAsAdmin(ctx, admin, args);
  },
});

/**
 * Flip a listing's visibility in the app.
 *
 * Separate from updateListing so the action log reads "deactivated" rather than
 * a generic "edited" — hiding a hotel from every tourist is worth its own line
 * in the history. Deactivating is deliberately not a delete: the listing, its
 * photos, its working hours and its bookings all stay put, so turning it back on
 * restores exactly what was there.
 */
export const setListingActive = mutation({
  args: {
    id: v.id("listings"),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing) {
      throw new ConvexError(LISTING_ERRORS.NOT_FOUND);
    }

    await ctx.db.patch(args.id, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: args.isActive ? "listing.activate" : "listing.deactivate",
      targetType: "listing",
      targetId: args.id,
      summary: labelFor(listing),
    });

    return { success: true, isActive: args.isActive };
  },
});

// Delete a listing — refused while it has open bookings.
export const deleteListing = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await deleteListingAsAdmin(ctx, admin, args.id);
    return { success: true };
  },
});

// Create travel knowledge data
export const createKnowledgeData = mutation({
  args: {
    category: v.string(),
    title: v.string(),
    title_ar: v.optional(v.string()),
    content: v.string(),
    content_ar: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      lastReviewed: v.optional(v.string()),
      region: v.optional(v.string()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();
    const id = await ctx.db.insert("travelKnowledge", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });

    await logAdminAction(ctx, admin, {
      action: "knowledge.create",
      targetType: "knowledge",
      targetId: id,
      summary: args.title_ar || args.title,
    });
    return id;
  },
});

// Update travel knowledge data
export const updateKnowledgeData = mutation({
  args: {
    id: v.id("travelKnowledge"),
    category: v.optional(v.string()),
    title: v.optional(v.string()),
    title_ar: v.optional(v.string()),
    content: v.optional(v.string()),
    content_ar: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      lastReviewed: v.optional(v.string()),
      region: v.optional(v.string()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new ConvexError(KNOWLEDGE_NOT_FOUND);
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: "knowledge.update",
      targetType: "knowledge",
      targetId: id,
      summary: existing.title_ar || existing.title,
    });
    return id;
  },
});

// Delete travel knowledge data
export const deleteKnowledgeData = mutation({
  args: { id: v.id("travelKnowledge") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new ConvexError(KNOWLEDGE_NOT_FOUND);
    }

    await ctx.db.delete(args.id);

    await logAdminAction(ctx, admin, {
      action: "knowledge.delete",
      targetType: "knowledge",
      targetId: args.id,
      summary: existing.title_ar || existing.title,
    });
    return { success: true };
  },
});

// The list of valid statuses now lives in bookings/logic.ts, so the panel,
// the guest's app and the host's app cannot drift apart on what a booking may
// be — they did, and "declined" existed in one place and not another.

// Update booking status (admin)
export const updateBookingStatus = mutation({
  args: {
    id: v.id("bookings"),
    status: v.string(),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await applyBookingStatusAsAdmin(ctx, admin, {
      bookingId: args.id,
      status: args.status,
      reason: args.cancellationReason,
    });
    return { success: true };
  },
});

/**
 * Change an account's role: tourist, business_owner or service_provider.
 * Never an admin account (the acting admin's included). Moving to business or
 * provider leaves the account unapproved until its document is reviewed.
 */
export const setUserRoleAsAdmin = mutation({
  args: { userId: v.id("users"), role: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await setUserRoleRecord(ctx, admin, args.userId, args.role);
    return { success: true };
  },
});

/** Block an account. It keeps its session but reads as signed out everywhere. */
export const suspendUser = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await suspendUserRecord(ctx, admin, args.userId, args.reason);
    return { success: true };
  },
});

export const unsuspendUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await unsuspendUserRecord(ctx, admin, args.userId);
    return { success: true };
  },
});

/**
 * Pull a live listing out of the directory.
 *
 * Distinct from rejecting it: rejection is a verdict on a submission that was
 * never public, suspension takes down something guests can currently book.
 */
export const suspendListing = mutation({
  args: { id: v.id("listings"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await suspendListingRecord(ctx, admin, args.id, args.reason);
    return { success: true };
  },
});

export const reinstateListing = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await reinstateListingRecord(ctx, admin, args.id);
    return { success: true };
  },
});

// Approve a pending content listing (and tell its owner)
export const approveContent = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await approveListingRecord(ctx, admin, args.id);
    return { success: true };
  },
});

// Reject a pending content listing (and tell its owner why)
export const rejectContent = mutation({
  args: {
    id: v.id("listings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await rejectListingRecord(ctx, admin, args.id, args.reason);
    return { success: true };
  },
});

// Approve a pending service (and tell its provider)
export const approveService = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await approveServiceRecord(ctx, admin, args.id);
    return { success: true };
  },
});

// Reject a pending service (and tell its provider why)
export const rejectService = mutation({
  args: {
    id: v.id("services"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await rejectServiceRecord(ctx, admin, args.id, args.reason);
    return { success: true };
  },
});

// === Live services (design 6 "New" 1) ===

/**
 * Edit a service as support: the same fields and checks as updateMyService,
 * but the service keeps its status. `null` clears the price or group size.
 */
export const adminUpdateService = mutation({
  args: {
    serviceId: v.id("services"),
    serviceType: v.optional(v.string()),
    title_en: v.optional(v.string()),
    title_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    priceUnit: v.optional(v.string()),
    price: v.optional(v.union(v.number(), v.null())),
    maxGroupSize: v.optional(v.union(v.number(), v.null())),
    availability_en: v.optional(v.string()),
    availability_ar: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(v.object({ lat: v.number(), lng: v.number() })),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await updateServiceAsAdmin(ctx, admin, args);
    return { success: true };
  },
});

/** Take a live service down, with a reason the provider is sent. */
export const suspendService = mutation({
  args: { serviceId: v.id("services"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await suspendServiceRecord(ctx, admin, args.serviceId, args.reason);
    return { success: true };
  },
});

export const reinstateService = mutation({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await reinstateServiceRecord(ctx, admin, args.serviceId);
    return { success: true };
  },
});

/** Delete a service. Refused while it has a pending or confirmed booking. */
export const deleteService = mutation({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await deleteServiceAsAdmin(ctx, admin, args.serviceId);
    return { success: true };
  },
});

/**
 * Take down a review (usually a reported one). The rating it counted towards
 * is recomputed, and the report — with any other open report of the same
 * review — is marked actioned.
 */
export const removeReview = mutation({
  args: {
    reviewId: v.id("reviews"),
    reason: v.string(),
    reportId: v.optional(v.id("contentReports")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await removeReviewRecord(ctx, admin, args);
    return { success: true };
  },
});

// === Bulk moderation ===
//
// Each of these settles per item and reports failures rather than aborting the
// batch. The common failure is one stale row in a queue the operator has had
// open for a while, and that should not block the other 29 approvals. A thrown
// error would roll the whole transaction back, so failures are collected.

type BulkFailure = { id: string; error: string };

function assertBulkSize(ids: string[]) {
  if (ids.length === 0) {
    throw new ConvexError("لم يتم اختيار أي عنصر. / No items selected.");
  }
  if (ids.length > MAX_BULK) {
    throw new ConvexError(
      `لا يمكن معالجة أكثر من ${MAX_BULK} عنصرًا دفعة واحدة. / Too many items in one batch (max ${MAX_BULK}).`
    );
  }
}

const GONE_LISTING = "لم يعد هذا العنصر موجوداً";
const GONE_SERVICE = "لم تعد هذه الخدمة موجودة";
const GONE_ACCOUNT = "لم يعد هذا الحساب موجوداً";
const NOT_BUSINESS = "ليس حساب أعمال";
const NO_DOCUMENT = "لم يتم رفع وثيقة العمل";

export const bulkApproveContent = mutation({
  args: { ids: v.array(v.id("listings")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.ids);

    const failed: BulkFailure[] = [];
    let succeeded = 0;

    for (const id of args.ids) {
      if (!(await ctx.db.get(id))) {
        failed.push({ id, error: GONE_LISTING });
        continue;
      }
      await approveListingRecord(ctx, admin, id, { bulk: true });
      succeeded++;
    }

    return { succeeded, failed };
  },
});

export const bulkRejectContent = mutation({
  args: { ids: v.array(v.id("listings")), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.ids);

    const failed: BulkFailure[] = [];
    let succeeded = 0;

    for (const id of args.ids) {
      if (!(await ctx.db.get(id))) {
        failed.push({ id, error: GONE_LISTING });
        continue;
      }
      await rejectListingRecord(ctx, admin, id, args.reason, { bulk: true });
      succeeded++;
    }

    return { succeeded, failed };
  },
});

export const bulkApproveServices = mutation({
  args: { ids: v.array(v.id("services")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.ids);

    const failed: BulkFailure[] = [];
    let succeeded = 0;

    for (const id of args.ids) {
      if (!(await ctx.db.get(id))) {
        failed.push({ id, error: GONE_SERVICE });
        continue;
      }
      await approveServiceRecord(ctx, admin, id, { bulk: true });
      succeeded++;
    }

    return { succeeded, failed };
  },
});

export const bulkRejectServices = mutation({
  args: { ids: v.array(v.id("services")), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.ids);

    const failed: BulkFailure[] = [];
    let succeeded = 0;

    for (const id of args.ids) {
      if (!(await ctx.db.get(id))) {
        failed.push({ id, error: GONE_SERVICE });
        continue;
      }
      await rejectServiceRecord(ctx, admin, id, args.reason, { bulk: true });
      succeeded++;
    }

    return { succeeded, failed };
  },
});

export const bulkApproveBusinesses = mutation({
  args: { userIds: v.array(v.id("users")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.userIds);

    const failed: BulkFailure[] = [];
    let succeeded = 0;

    for (const userId of args.userIds) {
      const user = await ctx.db.get(userId);
      if (!user) {
        failed.push({ id: userId, error: GONE_ACCOUNT });
        continue;
      }
      if (user.role !== "business_owner" && user.role !== "service_provider") {
        failed.push({ id: userId, error: NOT_BUSINESS });
        continue;
      }
      // Reviewing the uploaded document is the whole point of this queue;
      // approving an account that never uploaded one would defeat it.
      if (!user.cvFileId) {
        failed.push({ id: userId, error: NO_DOCUMENT });
        continue;
      }

      // Clears any earlier rejection, logs, and sends account.approved.
      await approveBusinessAccountRecord(ctx, admin, userId, { bulk: true });
      succeeded++;
    }

    return { succeeded, failed };
  },
});

/**
 * Turn down a business or provider account with a reason (contract section 8).
 * The owner sees it on their verification screen and is sent account.rejected;
 * uploading a new document puts the account back in the queue.
 */
export const rejectBusinessAccount = mutation({
  args: { userId: v.id("users"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    await rejectBusinessAccountRecord(ctx, admin, args.userId, args.reason);
    return { success: true };
  },
});

/**
 * Point a listing at the account that will answer its booking requests, and
 * move its open bookings to that account's inbox (assignListingHostRecord).
 *
 * `ownerId: null` clears it, which is how a listing is handed back after a real
 * host claims it.
 */
export const assignListingHost = mutation({
  args: {
    listingId: v.id("listings"),
    ownerId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { movedBookings } = await assignListingHostRecord(ctx, admin, args.listingId, args.ownerId);
    return { success: true, movedBookings };
  },
});

// Bulk import listings
export const bulkImportListings = mutation({
  args: {
    listings: v.array(v.object({
      type: v.string(),
      name_en: v.string(),
      name_ar: v.string(),
      category: v.string(),
      category_ar: v.optional(v.string()),
      address: v.string(),
      city: v.string(),
      region: v.optional(v.string()),
      coordinates: v.object({
        lat: v.number(),
        lng: v.number(),
      }),
      phone: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const now = Date.now();
    const ids: Id<"listings">[] = [];

    for (const listing of args.listings) {
      const id = await ctx.db.insert("listings", {
        ...listing,
        rating: 0,
        reviewCount: 0,
        isActive: true,
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }

    await logAdminAction(ctx, admin, {
      action: "listing.import",
      targetType: "listing",
      summary: `${ids.length} listings imported`,
    });

    return { imported: ids.length, ids };
  },
});
