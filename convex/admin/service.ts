import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { logAdminAction, labelFor } from "./activity";
import { isPlaceholderEmail } from "../lib/contact";
import { notifyBookingEvent, notifyUserEvent } from "../notifications/internal";
import { SERVICE_ERRORS, validateServiceInput } from "../services/logic";
import { buildSearchTextFrom } from "../users/search";
import { REVIEW_ERRORS } from "../reviews/logic";
import { recomputeReviewTarget } from "../reviews/service";
import {
  BOOKING_STATUSES,
  canTransition,
  TERMINAL_STATUSES,
  type BookingStatus,
} from "../bookings/logic";
import {
  listingEditPatch,
  pricingToValidate,
  validatePricing,
  withPricingDefaults,
  type PricingArgs,
} from "../listings/pricing";
import { LISTING_ERRORS, listingHasOpenBookings } from "../listings/queries";

/**
 * Admin operations, with the acting admin already resolved.
 *
 * Same reasoning as bookings/service.ts: convex-test cannot reach anything
 * behind requireAdmin, so the rules live here where a test can call them
 * directly and the mutations stay thin.
 *
 * Every refusal is a ConvexError in the house format (Arabic, " / ",
 * English): production redacts a plain Error to "Server Error", and the panel
 * is Arabic, so an admin must be able to read why something was refused.
 */

export const ADMIN_ERRORS = {
  USER_NOT_FOUND: "المستخدم غير موجود. / User not found.",
  BOOKING_NOT_FOUND: "الحجز غير موجود. / Booking not found.",
  SUSPEND_REASON_REQUIRED: "سبب الإيقاف مطلوب. / A suspension reason is required.",
  REJECT_REASON_REQUIRED: "سبب الرفض مطلوب. / A rejection reason is required.",
  CANNOT_SUSPEND_SELF: "لا يمكنك إيقاف حسابك. / You cannot suspend your own account.",
  CANNOT_SUSPEND_ADMIN: "لا يمكن إيقاف حساب مسؤول. / An admin account cannot be suspended.",
  LISTING_NOT_SUSPENDED: "هذا المكان ليس موقوفًا. / This listing is not suspended.",
  SERVICE_NOT_SUSPENDED: "هذه الخدمة ليست موقوفة. / This service is not suspended.",
  NOT_BUSINESS: "هذا الحساب ليس حساب أعمال. / User is not a business account.",
  NO_DOCUMENT: "لا يمكن اعتماد حساب بلا وثيقة. / An account cannot be approved without a document.",
  INVALID_ROLE: "دور غير صالح. / Invalid role.",
  ROLE_LOCKED: "لا يمكن تغيير دور هذا الحساب. / This account's role cannot be changed.",
  REPORT_NOT_FOUND: "البلاغ غير موجود. / Report not found.",
  REPORT_MISMATCH: "هذا البلاغ لا يخص هذا التقييم. / That report is not about this review.",
  // Reinstating sets "approved", so suspending a submission would be a way to
  // publish it unreviewed. A submission is rejected instead.
  LISTING_NOT_LIVE:
    "لا يمكن إيقاف إلا مكان منشور؛ ارفض الطلبات المعلقة بدلًا من ذلك. / Only a live listing can be suspended; reject a pending one instead.",
  SERVICE_NOT_LIVE:
    "لا يمكن إيقاف إلا خدمة منشورة؛ ارفض الطلبات المعلقة بدلًا من ذلك. / Only a live service can be suspended; reject a pending one instead.",
} as const;

/** The roles an admin may give an account. Admin itself is granted from the CLI only (devTools). */
const ASSIGNABLE_ROLES = ["tourist", "business_owner", "service_provider"];

/** The two roles that go through document review before they may post. */
function isBusinessRole(role: string | undefined): boolean {
  return role === "business_owner" || role === "service_provider";
}

function refuse(message: string): never {
  throw new ConvexError(message);
}

/** Marks a decision taken as part of a batch in the log. */
export const IN_BULK = "ضمن إجراء جماعي";

/** The name a notice about a listing or a service shows its owner. */
function listingName(listing: Doc<"listings">) {
  return { name_en: listing.name_en, name_ar: listing.name_ar };
}
function serviceName(service: Doc<"services">) {
  return { name_en: service.title_en, name_ar: service.title_ar };
}

/** A free-text reason as stored: trimmed, bounded, and absent rather than empty. */
function storedReason(reason: string | undefined): string | undefined {
  return reason?.trim().slice(0, 500) || undefined;
}

type ListingText = {
  type: string;
  name_en: string;
  name_ar: string;
  category: string;
  category_ar?: string;
  description_en?: string;
  description_ar?: string;
  address: string;
  city: string;
  region?: string;
  coordinates: { lat: number; lng: number };
  phone?: string;
  email?: string;
  website?: string;
  priceRange?: string;
  amenities?: string[];
  languages?: string[];
  images?: string[];
  isVerified?: boolean;
  isActive?: boolean;
};

export type AdminListingInput = ListingText & PricingArgs;

type Nullable<T> = { [K in keyof T]?: T[K] | null };

/**
 * An admin edit: any subset of the fields, where `null` clears one. Only the
 * fields a person can meaningfully empty are nullable — a listing without a
 * name, an address or a pin is not a listing.
 */
export type AdminListingUpdate = { id: Id<"listings"> } & Partial<
  Omit<
    ListingText,
    "phone" | "email" | "website" | "priceRange" | "description_en" | "description_ar"
  >
> &
  Nullable<
    Pick<ListingText, "phone" | "email" | "website" | "priceRange" | "description_en" | "description_ar">
  > &
  Nullable<PricingArgs>;

/**
 * Create a listing from the panel. Published straight away: the admin is the
 * reviewer, so there is no queue to send it to.
 */
export async function createListingAsAdmin(
  ctx: MutationCtx,
  admin: Doc<"users">,
  args: AdminListingInput,
  now: number = Date.now()
): Promise<Id<"listings">> {
  validatePricing(args);

  const id = await ctx.db.insert("listings", {
    ...withPricingDefaults(args),
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
}

/** Edit a listing from the panel. Its review status is the admin's to keep. */
export async function updateListingAsAdmin(
  ctx: MutationCtx,
  admin: Doc<"users">,
  args: AdminListingUpdate,
  now: number = Date.now()
): Promise<Id<"listings">> {
  const { id, ...updates } = args;
  validatePricing(pricingToValidate(updates));

  const existing = await ctx.db.get(id);
  if (!existing) refuse(LISTING_ERRORS.NOT_FOUND);

  await ctx.db.patch(id, { ...listingEditPatch(updates), updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "listing.update",
    targetType: "listing",
    targetId: id,
    summary: labelFor(existing),
  });
  return id;
}

/**
 * Point a listing at the account that will answer its booking requests, or
 * clear it with `null`.
 *
 * The seeded catalogue has no owner, so nothing in it can be managed from the
 * app, and a stay request against an ownerless listing has no inbox to
 * arrive in. Assigning a Hasio-run account is what makes it bookable.
 *
 * The listing's open bookings move with it. The host inbox reads bookings by
 * their own denormalised `ownerId`, so moving only the listing left every
 * pending request in the old host's inbox — where the person now managing
 * the place would never see it, and it would quietly expire. Closed bookings
 * stay with whoever hosted them: that is their history, not work.
 */
export async function assignListingHostRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  ownerId: Id<"users"> | null,
  now: number = Date.now()
): Promise<{ movedBookings: number }> {
  const listing = await ctx.db.get(listingId);
  if (!listing) refuse(LISTING_ERRORS.NOT_FOUND);

  let owner: Doc<"users"> | null = null;
  if (ownerId !== null) {
    owner = await ctx.db.get(ownerId);
    if (!owner) refuse("الحساب غير موجود. / User not found.");
    // The host inbox is reachable from these two roles only. A tourist would
    // receive requests they cannot answer.
    if (owner.role !== "business_owner" && owner.role !== "admin") {
      refuse("يجب أن يكون الحساب مالك نشاط تجاري. / The host must be a business owner account.");
    }
    // A suspended account reads as signed out everywhere: its inbox is one
    // nobody can open, so every request sent there would expire unanswered.
    if (owner.isSuspended) {
      refuse("لا يمكن تعيين حساب موقوف مضيفًا. / A suspended account cannot host a listing.");
    }
  }

  await ctx.db.patch(listingId, { ownerId: ownerId ?? undefined, updatedAt: now });

  const open = await ctx.db
    .query("bookings")
    .withIndex("by_listingId", (q) => q.eq("listingId", listingId))
    .filter((q) => q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "confirmed")))
    .collect();
  for (const booking of open) {
    await ctx.db.patch(booking._id, { ownerId: ownerId ?? undefined, updatedAt: now });
  }

  await logAdminAction(ctx, admin, {
    action: owner ? "listing.assign_host" : "listing.clear_host",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
    details: owner ? labelFor(owner) : undefined,
  });

  return { movedBookings: open.length };
}

// === Review decisions ===
//
// Approving, rejecting and taking down a listing or a service each tell the
// owner, in the same transaction as the decision (design 4.4): until 1.1.0 an
// owner learned their place was live, or turned down, only by opening the app
// and looking. `bulk` marks the log row as part of a batch. A seed listing has
// no owner, so there is nobody to tell.

type DecisionOpts = { bulk?: boolean };

export async function approveListingRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  opts: DecisionOpts = {},
  now: number = Date.now()
): Promise<void> {
  const listing = await ctx.db.get(listingId);
  if (!listing) refuse(LISTING_ERRORS.NOT_FOUND);

  await ctx.db.patch(listingId, { status: "approved", rejectionReason: undefined, updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "content.approve",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
    details: opts.bulk ? IN_BULK : undefined,
  });

  if (listing.ownerId) {
    await notifyUserEvent(
      ctx,
      "listing.approved",
      { userId: listing.ownerId, ...listingName(listing), listingId },
      now
    );
  }
}

export async function rejectListingRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  reason: string | undefined,
  opts: DecisionOpts = {},
  now: number = Date.now()
): Promise<void> {
  const listing = await ctx.db.get(listingId);
  if (!listing) refuse(LISTING_ERRORS.NOT_FOUND);
  const stored = storedReason(reason);

  await ctx.db.patch(listingId, { status: "rejected", rejectionReason: stored, updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "content.reject",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
    details: stored ?? (opts.bulk ? IN_BULK : undefined),
  });

  if (listing.ownerId) {
    await notifyUserEvent(
      ctx,
      "listing.rejected",
      { userId: listing.ownerId, ...listingName(listing), reason: stored, listingId },
      now
    );
  }
}

export async function approveServiceRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  serviceId: Id<"services">,
  opts: DecisionOpts = {},
  now: number = Date.now()
): Promise<void> {
  const service = await ctx.db.get(serviceId);
  if (!service) refuse(SERVICE_ERRORS.NOT_FOUND);

  await ctx.db.patch(serviceId, { status: "approved", rejectionReason: undefined, updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "service.approve",
    targetType: "service",
    targetId: serviceId,
    summary: labelFor(service),
    details: opts.bulk ? IN_BULK : undefined,
  });

  await notifyUserEvent(
    ctx,
    "service.approved",
    { userId: service.ownerId, ...serviceName(service), serviceId },
    now
  );
}

export async function rejectServiceRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  serviceId: Id<"services">,
  reason: string | undefined,
  opts: DecisionOpts = {},
  now: number = Date.now()
): Promise<void> {
  const service = await ctx.db.get(serviceId);
  if (!service) refuse(SERVICE_ERRORS.NOT_FOUND);
  const stored = storedReason(reason);

  await ctx.db.patch(serviceId, { status: "rejected", rejectionReason: stored, updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "service.reject",
    targetType: "service",
    targetId: serviceId,
    summary: labelFor(service),
    details: stored ?? (opts.bulk ? IN_BULK : undefined),
  });

  await notifyUserEvent(
    ctx,
    "service.rejected",
    { userId: service.ownerId, ...serviceName(service), reason: stored, serviceId },
    now
  );
}

// === Live services (design 6 "New" 1, D15) ===

/** What an admin may change on a service: the fields of updateMyService. */
export type AdminServiceUpdate = {
  serviceId: Id<"services">;
  serviceType?: string;
  title_en?: string;
  title_ar?: string;
  description_en?: string;
  description_ar?: string;
  priceRange?: string;
  priceUnit?: string;
  price?: number | null;
  maxGroupSize?: number | null;
  availability_en?: string;
  availability_ar?: string;
  contactPhone?: string;
  contactEmail?: string;
  languages?: string[];
  images?: string[];
  city?: string;
  region?: string;
  coordinates?: { lat: number; lng: number };
};

/** Free-form fields validateServiceInput does not own; stored as sent. */
const SERVICE_PASSTHROUGH = [
  "priceRange",
  "availability_en",
  "availability_ar",
  "contactPhone",
  "contactEmail",
  "languages",
  "region",
  "coordinates",
] as const;

/**
 * Edit a service as an admin.
 *
 * Checked by the same validateServiceInput a provider's edit goes through, so
 * support cannot store what the provider could not. Unlike the provider's
 * edit it leaves `status` alone: an admin fixing a typo on a live service must
 * not take it off the app until someone re-approves it.
 */
export async function updateServiceAsAdmin(
  ctx: MutationCtx,
  admin: Doc<"users">,
  args: AdminServiceUpdate,
  now: number = Date.now()
): Promise<void> {
  const { serviceId, ...fields } = args;
  const service = await ctx.db.get(serviceId);
  if (!service) refuse(SERVICE_ERRORS.NOT_FOUND);

  const validated = validateServiceInput(fields, "update");
  const passthrough: Record<string, unknown> = {};
  for (const key of SERVICE_PASSTHROUGH) {
    if (fields[key] !== undefined) passthrough[key] = fields[key];
  }

  await ctx.db.patch(serviceId, { ...passthrough, ...validated, updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "service.update",
    targetType: "service",
    targetId: serviceId,
    summary: labelFor(service),
  });
}

/**
 * Take a live service down. Distinct from rejecting: rejection is a verdict on
 * a submission nobody could book yet; suspension hides something travellers
 * can book now, and the provider is told why.
 */
export async function suspendServiceRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  serviceId: Id<"services">,
  reason: string,
  now: number = Date.now()
): Promise<void> {
  const service = await ctx.db.get(serviceId);
  if (!service) refuse(SERVICE_ERRORS.NOT_FOUND);
  if (service.status !== "approved") refuse(ADMIN_ERRORS.SERVICE_NOT_LIVE);

  const trimmed = reason.trim();
  if (!trimmed) refuse(ADMIN_ERRORS.SUSPEND_REASON_REQUIRED);
  const stored = trimmed.slice(0, 500);

  // isPublicService is an allow-list on "approved", so this alone takes it out
  // of search, the directory and the booking flow.
  await ctx.db.patch(serviceId, { status: "suspended", suspendedReason: stored, updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "service.suspend",
    targetType: "service",
    targetId: serviceId,
    summary: labelFor(service),
    details: trimmed,
  });

  await notifyUserEvent(
    ctx,
    "service.suspended",
    { userId: service.ownerId, ...serviceName(service), reason: stored, serviceId },
    now
  );
}

/**
 * Put a suspended service back. Only a suspended one: otherwise this would be
 * a one-click way to publish a service nobody reviewed.
 */
export async function reinstateServiceRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  serviceId: Id<"services">,
  now: number = Date.now()
): Promise<void> {
  const service = await ctx.db.get(serviceId);
  if (!service) refuse(SERVICE_ERRORS.NOT_FOUND);
  if (service.status !== "suspended") refuse(ADMIN_ERRORS.SERVICE_NOT_SUSPENDED);

  await ctx.db.patch(serviceId, { status: "approved", suspendedReason: undefined, updatedAt: now });

  await logAdminAction(ctx, admin, {
    action: "service.reinstate",
    targetType: "service",
    targetId: serviceId,
    summary: labelFor(service),
  });
}

async function serviceHasOpenBookings(ctx: MutationCtx, serviceId: Id<"services">): Promise<boolean> {
  const open = await ctx.db
    .query("bookings")
    .withIndex("by_serviceId", (q) => q.eq("serviceId", serviceId))
    .filter((q) => q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "confirmed")))
    .first();
  return open !== null;
}

/**
 * Delete a service — not while a traveller still holds a pending or confirmed
 * booking of it, who would be left with a booking for nothing.
 */
export async function deleteServiceAsAdmin(
  ctx: MutationCtx,
  admin: Doc<"users">,
  serviceId: Id<"services">
): Promise<void> {
  const service = await ctx.db.get(serviceId);
  if (!service) refuse(SERVICE_ERRORS.NOT_FOUND);
  if (await serviceHasOpenBookings(ctx, serviceId)) refuse(SERVICE_ERRORS.HAS_OPEN_BOOKINGS);

  await ctx.db.delete(serviceId);

  await logAdminAction(ctx, admin, {
    action: "service.delete",
    targetType: "service",
    targetId: serviceId,
    summary: labelFor(service),
  });
}

// === Reviews (design 4.5 "Moderation") ===

/**
 * Take down a review, usually one somebody reported.
 *
 * The score of the place or service it rated is recomputed from the reviews
 * that remain, so a removed one-star review stops dragging the average. Every
 * open report about the review is closed as actioned — the given one, and any
 * other traveller's report of the same review, which would otherwise sit in
 * the queue pointing at nothing. A `reportId` about some other target is
 * refused rather than silently closed.
 *
 * The author is not notified: there is no notice for a removed review among
 * the account events (notifications/templates.ts).
 */
export async function removeReviewRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  args: { reviewId: Id<"reviews">; reason: string; reportId?: Id<"contentReports"> },
  now: number = Date.now()
): Promise<void> {
  const review = await ctx.db.get(args.reviewId);
  if (!review) refuse(REVIEW_ERRORS.NOT_FOUND);

  if (args.reportId) {
    const report = await ctx.db.get(args.reportId);
    if (!report) refuse(ADMIN_ERRORS.REPORT_NOT_FOUND);
    if (report.targetType !== "review" || report.targetId !== args.reviewId) {
      refuse(ADMIN_ERRORS.REPORT_MISMATCH);
    }
  }

  await ctx.db.delete(args.reviewId);
  await recomputeReviewTarget(ctx, review);

  const open = await ctx.db
    .query("contentReports")
    .withIndex("by_target", (q) => q.eq("targetType", "review").eq("targetId", args.reviewId))
    .filter((q) => q.eq(q.field("status"), "pending"))
    .collect();
  const toClose = new Set<Id<"contentReports">>(open.map((r) => r._id));
  if (args.reportId) toClose.add(args.reportId);
  for (const reportId of toClose) {
    await ctx.db.patch(reportId, { status: "actioned", reviewedByAdminId: admin._id, reviewedAt: now });
  }

  await logAdminAction(ctx, admin, {
    action: "review.remove",
    targetType: "review",
    targetId: args.reviewId,
    summary: review.content ? review.content.slice(0, 80) : `${review.rating}/5`,
    details: storedReason(args.reason),
  });
}

/**
 * Delete a listing from the panel — only once nobody is waiting on it, the
 * same rule as the host's own delete (design 6.7). Support cancels the open
 * bookings first, which also tells each guest.
 */
export async function deleteListingAsAdmin(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">
): Promise<void> {
  // Read first so the log can name what went, and so deleting something
  // already gone says so instead of silently succeeding.
  const existing = await ctx.db.get(listingId);
  if (!existing) refuse(LISTING_ERRORS.NOT_FOUND);
  if (await listingHasOpenBookings(ctx, listingId)) refuse(LISTING_ERRORS.HAS_OPEN_BOOKINGS);

  await ctx.db.delete(listingId);

  await logAdminAction(ctx, admin, {
    action: "listing.delete",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(existing),
  });
}

/** Shape the admin panel's user table renders. */
export function toAdminUserRow(user: Doc<"users">) {
  return {
    _id: user._id,
    email: user.email,
    // The panel shows "signed up by phone" instead of a synthesised address
    // that would look like a real inbox somebody could write to.
    isPlaceholderEmail: isPlaceholderEmail(user.email),
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    phoneVerified: user.phoneVerified ?? false,
    role: user.role ?? "tourist",
    isApproved: user.isApproved,
    isSuspended: user.isSuspended ?? false,
    suspendedReason: user.suspendedReason,
    suspendedAt: user.suspendedAt,
    // Set while a business or provider account stands rejected (cleared on
    // approval and on a new document), as the drawer reads it: without it the
    // table called a rejected account "awaiting approval".
    accountRejectionReason: user.accountRejectionReason,
    createdAt: user.createdAt,
  };
}

// === Business accounts (design 4.5 "Accounts") ===

/**
 * Approve a business or provider account.
 *
 * Checks for the uploaded document on the server. Bulk approve always did;
 * the single approve relied on the panel greying out its button, so the one
 * thing the queue exists to check could be skipped by any client that sent
 * the call anyway. Approving also clears an earlier rejection, so the owner's
 * verification screen stops showing a verdict that no longer applies.
 */
export async function approveBusinessAccountRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  opts: DecisionOpts = {},
  now: number = Date.now()
): Promise<void> {
  const target = await ctx.db.get(userId);
  if (!target) refuse(ADMIN_ERRORS.USER_NOT_FOUND);
  if (!isBusinessRole(target.role)) refuse(ADMIN_ERRORS.NOT_BUSINESS);
  if (!target.cvFileId) refuse(ADMIN_ERRORS.NO_DOCUMENT);

  await ctx.db.patch(userId, {
    isApproved: true,
    accountRejectionReason: undefined,
    accountRejectedAt: undefined,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "account.approve",
    targetType: "user",
    targetId: userId,
    summary: labelFor(target),
    details: opts.bulk ? IN_BULK : undefined,
  });

  await notifyUserEvent(ctx, "account.approved", { userId }, now);
}

/**
 * Turn a business or provider account down, with the reason the owner sees on
 * their verification screen. Before this an account the admin would not
 * approve sat in the queue forever with its owner told nothing. Uploading a
 * new document (saveBusinessDoc) clears the rejection and puts it back.
 */
export async function rejectBusinessAccountRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  reason: string,
  now: number = Date.now()
): Promise<void> {
  const target = await ctx.db.get(userId);
  if (!target) refuse(ADMIN_ERRORS.USER_NOT_FOUND);
  if (!isBusinessRole(target.role)) refuse(ADMIN_ERRORS.NOT_BUSINESS);

  const trimmed = reason.trim();
  if (!trimmed) refuse(ADMIN_ERRORS.REJECT_REASON_REQUIRED);
  const stored = trimmed.slice(0, 500);

  await ctx.db.patch(userId, {
    isApproved: false,
    accountRejectionReason: stored,
    accountRejectedAt: now,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "account.reject",
    targetType: "user",
    targetId: userId,
    summary: labelFor(target),
    details: stored,
  });

  await notifyUserEvent(ctx, "account.rejected", { userId, reason: stored }, now);
}

/**
 * Change what an account is, from the panel.
 *
 * Never an admin account, the acting admin's included: demoting yourself
 * locks you out of the panel with no way back but the database, and one admin
 * demoting another is a fight the product should not host. Making someone a
 * business owner or provider does not approve them — they still upload a
 * document and go through the queue. Asking for the role an account already
 * has changes nothing, so re-saving cannot quietly revoke an approval.
 */
export async function setUserRoleRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  role: string,
  now: number = Date.now()
): Promise<void> {
  if (!ASSIGNABLE_ROLES.includes(role)) refuse(ADMIN_ERRORS.INVALID_ROLE);

  const target = await ctx.db.get(userId);
  if (!target) refuse(ADMIN_ERRORS.USER_NOT_FOUND);
  if (target._id === admin._id || target.role === "admin") refuse(ADMIN_ERRORS.ROLE_LOCKED);

  const from = target.role ?? "tourist";
  if (from === role) return;

  await ctx.db.patch(userId, {
    role,
    ...(isBusinessRole(role) ? { isApproved: false } : {}),
    // Every write to a user row keeps the admin search blob current, and an
    // account created before search existed gets one here.
    searchText: buildSearchTextFrom(target),
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "user.role",
    targetType: "user",
    targetId: userId,
    summary: labelFor(target),
    details: `${from} → ${role}`,
  });
}

export async function suspendUserRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  reason: string,
  now: number = Date.now()
): Promise<void> {
  const target = await ctx.db.get(userId);
  if (!target) refuse(ADMIN_ERRORS.USER_NOT_FOUND);

  // Locking yourself out of the panel is unrecoverable without database
  // access, and one admin suspending another is a fight the product should
  // not host.
  if (target._id === admin._id) refuse(ADMIN_ERRORS.CANNOT_SUSPEND_SELF);
  if (target.role === "admin") refuse(ADMIN_ERRORS.CANNOT_SUSPEND_ADMIN);

  const trimmed = reason.trim();
  if (!trimmed) refuse(ADMIN_ERRORS.SUSPEND_REASON_REQUIRED);

  await ctx.db.patch(userId, {
    isSuspended: true,
    suspendedReason: trimmed.slice(0, 500),
    suspendedAt: now,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "user.suspend",
    targetType: "user",
    targetId: userId,
    summary: labelFor(target),
    details: trimmed,
  });
}

export async function unsuspendUserRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  now: number = Date.now()
): Promise<void> {
  const target = await ctx.db.get(userId);
  if (!target) refuse(ADMIN_ERRORS.USER_NOT_FOUND);

  await ctx.db.patch(userId, {
    isSuspended: false,
    suspendedReason: undefined,
    suspendedAt: undefined,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "user.unsuspend",
    targetType: "user",
    targetId: userId,
    summary: labelFor(target),
  });
}

export async function suspendListingRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  reason: string,
  now: number = Date.now()
): Promise<void> {
  const listing = await ctx.db.get(listingId);
  if (!listing) refuse(LISTING_ERRORS.NOT_FOUND);
  // Live means approved, or no status at all (seed rows predate approval).
  if (listing.status !== undefined && listing.status !== "approved") {
    refuse(ADMIN_ERRORS.LISTING_NOT_LIVE);
  }

  const trimmed = reason.trim();
  if (!trimmed) refuse(ADMIN_ERRORS.SUSPEND_REASON_REQUIRED);
  const stored = trimmed.slice(0, 500);

  // isPublicListing is an allow-list on "approved", so this alone removes the
  // listing from search, the directory and the booking flow.
  await ctx.db.patch(listingId, {
    status: "suspended",
    suspendedReason: stored,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "listing.suspend",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
    details: trimmed,
  });

  // The host finds out from us, with the reason, rather than from a guest who
  // can no longer find the place.
  if (listing.ownerId) {
    await notifyUserEvent(
      ctx,
      "listing.suspended",
      { userId: listing.ownerId, ...listingName(listing), reason: stored, listingId },
      now
    );
  }
}

export async function reinstateListingRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  now: number = Date.now()
): Promise<void> {
  const listing = await ctx.db.get(listingId);
  if (!listing) refuse(LISTING_ERRORS.NOT_FOUND);
  if (listing.status !== "suspended") refuse(ADMIN_ERRORS.LISTING_NOT_SUSPENDED);

  await ctx.db.patch(listingId, {
    status: "approved",
    suspendedReason: undefined,
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "listing.reinstate",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
  });
}

/**
 * Move a booking to any status, as support.
 *
 * Deliberately unconstrained — the whole point of an admin override is fixing
 * a booking that reached a state the normal flow cannot get it out of. What it
 * does insist on is that the status is real, that something actually changes,
 * and that reopening a closed booking is logged as the exceptional act it is.
 */
export async function applyBookingStatusAsAdmin(
  ctx: MutationCtx,
  admin: Doc<"users">,
  args: { bookingId: Id<"bookings">; status: string; reason?: string },
  now: number = Date.now()
): Promise<void> {
  if (!BOOKING_STATUSES.includes(args.status as BookingStatus)) {
    refuse(`حالة الحجز غير صالحة. / Invalid booking status: ${args.status}`);
  }

  const booking = await ctx.db.get(args.bookingId);
  if (!booking) refuse(ADMIN_ERRORS.BOOKING_NOT_FOUND);

  const from = booking.status as BookingStatus;
  const to = args.status as BookingStatus;
  const transition = canTransition(from, to, "admin");
  if (!transition.allowed) refuse(transition.reason);

  const reason = args.reason?.trim().slice(0, 500) || undefined;

  await ctx.db.patch(args.bookingId, {
    status: to,
    ...(to === "confirmed" || to === "declined" ? { respondedAt: now } : {}),
    // A reason explains the status it came with, and goes when the booking
    // leaves it. Both apps — the live 1.0.x ones too — show a decline reason
    // whenever the field is set, so a declined booking support reopened read
    // "Decline reason: …" beside "Confirmed". (Undefined removes the field.)
    declineReason: to === "declined" ? (reason ?? booking.declineReason) : undefined,
    cancellationReason: to === "cancelled" ? (reason ?? booking.cancellationReason) : undefined,
    ...(to === "completed" ? { completedAt: now } : {}),
    updatedAt: now,
  });

  const bookedThing = booking.serviceId
    ? await ctx.db.get(booking.serviceId)
    : booking.listingId
      ? await ctx.db.get(booking.listingId)
      : null;
  await logAdminAction(ctx, admin, {
    action: transition.forced ? "booking.force" : `booking.${to}`,
    targetType: "booking",
    targetId: args.bookingId,
    summary: `${labelFor(bookedThing) ?? "booking"} - ${booking.checkIn ?? booking.date}`,
    details: `${from} → ${to}${reason ? ` — ${reason}` : ""}`,
  });

  await notifyAdminBookingChange(ctx, args.bookingId, to, reason, now);
}

/**
 * Tell whoever is affected that support changed their booking.
 *
 * A cancellation reaches both sides, because a host who has blocked a room and
 * a guest who thinks they have one both need to know.
 */
async function notifyAdminBookingChange(
  ctx: MutationCtx,
  bookingId: Id<"bookings">,
  status: BookingStatus,
  reason: string | undefined,
  now: number
): Promise<void> {
  const booking = await ctx.db.get(bookingId);
  if (!booking) return;

  if (status === "cancelled") {
    await notifyBookingEvent(ctx, "booking.cancelled_admin", booking, { reason }, now);
    if (booking.ownerId) {
      await notifyBookingEvent(ctx, "booking.cancelled", booking, { reason }, now);
    }
    return;
  }

  if (status === "confirmed" || status === "declined" || status === "expired") {
    await notifyBookingEvent(ctx, `booking.${status}` as const, booking, { reason }, now);
  }
  // completed and no_show are bookkeeping, not news the guest needs pushed.
}

export { TERMINAL_STATUSES };
