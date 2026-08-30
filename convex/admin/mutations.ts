import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../auth";
import { logAdminAction, labelFor } from "./activity";
import type { Id } from "../_generated/dataModel";

// One bulk call may not touch more documents than this. Convex transactions are
// bounded, and a runaway "approve everything" is exactly the kind of action that
// should happen in reviewable batches.
const MAX_BULK = 50;

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
    const now = Date.now();
    const id = await ctx.db.insert("listings", {
      ...args,
      status: "approved",
      rating: 0,
      reviewCount: 0,
      isActive: args.isActive ?? true,
      isVerified: args.isVerified ?? false,
      createdAt: now,
      updatedAt: now,
    });

    await logAdminAction(ctx, admin, {
      action: "listing.create",
      targetType: "listing",
      targetId: id,
      summary: args.name_ar || args.name_en,
    });
    return id;
  },
});

// Update a listing
export const updateListing = mutation({
  args: {
    id: v.id("listings"),
    type: v.optional(v.string()),
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    category: v.optional(v.string()),
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    amenities: v.optional(v.array(v.string())),
    languages: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Listing not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: "listing.update",
      targetType: "listing",
      targetId: id,
      summary: labelFor(existing),
    });
    return id;
  },
});

// Delete a listing
export const deleteListing = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    // Read before deleting so the log row can name what went, and so deleting a
    // listing that is already gone reports it instead of silently succeeding.
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Listing not found");
    }

    await ctx.db.delete(args.id);

    await logAdminAction(ctx, admin, {
      action: "listing.delete",
      targetType: "listing",
      targetId: args.id,
      summary: labelFor(existing),
    });
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
      throw new Error("Knowledge data not found");
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
      throw new Error("Knowledge data not found");
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

// The statuses a booking is allowed to hold. The mutation below used to write
// whatever string it was handed, so a typo in a client could park a booking in
// a status no query filters on and no UI can display.
const BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled", "no_show"];

// Update booking status (admin)
export const updateBookingStatus = mutation({
  args: {
    id: v.id("bookings"),
    status: v.string(),
    cancellationReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (!BOOKING_STATUSES.includes(args.status)) {
      throw new Error("Invalid booking status: " + args.status);
    }

    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Booking not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      // Only carry a reason onto a cancellation, and never blank an existing one
      // when the status is being changed for some other purpose.
      cancellationReason:
        args.status === "cancelled"
          ? args.cancellationReason ?? existing.cancellationReason
          : existing.cancellationReason,
      updatedAt: Date.now(),
    });

    const listing = await ctx.db.get(existing.listingId);
    await logAdminAction(ctx, admin, {
      action: "booking." + args.status,
      targetType: "booking",
      targetId: args.id,
      summary: `${labelFor(listing) ?? "booking"} - ${existing.date} ${existing.time}`,
      details: args.status === "cancelled" ? args.cancellationReason : undefined,
    });
    return { success: true };
  },
});

// Approve a pending content listing
export const approveContent = mutation({
  args: { id: v.id("listings") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");

    await ctx.db.patch(args.id, {
      status: "approved",
      rejectionReason: undefined,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: "content.approve",
      targetType: "listing",
      targetId: args.id,
      summary: labelFor(listing),
    });
    return { success: true };
  },
});

// Reject a pending content listing
export const rejectContent = mutation({
  args: {
    id: v.id("listings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const listing = await ctx.db.get(args.id);
    if (!listing) throw new Error("Listing not found");

    await ctx.db.patch(args.id, {
      status: "rejected",
      rejectionReason: args.reason,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: "content.reject",
      targetType: "listing",
      targetId: args.id,
      summary: labelFor(listing),
      details: args.reason,
    });
    return { success: true };
  },
});

// Approve a pending service
export const approveService = mutation({
  args: { id: v.id("services") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");

    await ctx.db.patch(args.id, {
      status: "approved",
      rejectionReason: undefined,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: "service.approve",
      targetType: "service",
      targetId: args.id,
      summary: labelFor(service),
    });
    return { success: true };
  },
});

// Reject a pending service
export const rejectService = mutation({
  args: {
    id: v.id("services"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const service = await ctx.db.get(args.id);
    if (!service) throw new Error("Service not found");

    await ctx.db.patch(args.id, {
      status: "rejected",
      rejectionReason: args.reason,
      updatedAt: Date.now(),
    });

    await logAdminAction(ctx, admin, {
      action: "service.reject",
      targetType: "service",
      targetId: args.id,
      summary: labelFor(service),
      details: args.reason,
    });
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
  if (ids.length === 0) throw new Error("No items selected");
  if (ids.length > MAX_BULK) {
    throw new Error(`Too many items in one batch (max ${MAX_BULK})`);
  }
}

const GONE_LISTING = "لم يعد هذا العنصر موجوداً";
const GONE_SERVICE = "لم تعد هذه الخدمة موجودة";
const GONE_ACCOUNT = "لم يعد هذا الحساب موجوداً";
const NOT_BUSINESS = "ليس حساب أعمال";
const NO_DOCUMENT = "لم يتم رفع وثيقة العمل";
const IN_BULK = "ضمن إجراء جماعي";

export const bulkApproveContent = mutation({
  args: { ids: v.array(v.id("listings")) },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    assertBulkSize(args.ids);

    const failed: BulkFailure[] = [];
    let succeeded = 0;

    for (const id of args.ids) {
      const listing = await ctx.db.get(id);
      if (!listing) {
        failed.push({ id, error: GONE_LISTING });
        continue;
      }
      await ctx.db.patch(id, {
        status: "approved",
        rejectionReason: undefined,
        updatedAt: Date.now(),
      });
      await logAdminAction(ctx, admin, {
        action: "content.approve",
        targetType: "listing",
        targetId: id,
        summary: labelFor(listing),
        details: IN_BULK,
      });
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
      const listing = await ctx.db.get(id);
      if (!listing) {
        failed.push({ id, error: GONE_LISTING });
        continue;
      }
      await ctx.db.patch(id, {
        status: "rejected",
        rejectionReason: args.reason,
        updatedAt: Date.now(),
      });
      await logAdminAction(ctx, admin, {
        action: "content.reject",
        targetType: "listing",
        targetId: id,
        summary: labelFor(listing),
        details: args.reason || IN_BULK,
      });
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
      const service = await ctx.db.get(id);
      if (!service) {
        failed.push({ id, error: GONE_SERVICE });
        continue;
      }
      await ctx.db.patch(id, {
        status: "approved",
        rejectionReason: undefined,
        updatedAt: Date.now(),
      });
      await logAdminAction(ctx, admin, {
        action: "service.approve",
        targetType: "service",
        targetId: id,
        summary: labelFor(service),
        details: IN_BULK,
      });
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
      const service = await ctx.db.get(id);
      if (!service) {
        failed.push({ id, error: GONE_SERVICE });
        continue;
      }
      await ctx.db.patch(id, {
        status: "rejected",
        rejectionReason: args.reason,
        updatedAt: Date.now(),
      });
      await logAdminAction(ctx, admin, {
        action: "service.reject",
        targetType: "service",
        targetId: id,
        summary: labelFor(service),
        details: args.reason || IN_BULK,
      });
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

      await ctx.db.patch(userId, { isApproved: true, updatedAt: Date.now() });
      await logAdminAction(ctx, admin, {
        action: "account.approve",
        targetType: "user",
        targetId: userId,
        summary: labelFor(user),
        details: IN_BULK,
      });
      succeeded++;
    }

    return { succeeded, failed };
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
