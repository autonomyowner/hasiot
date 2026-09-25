import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { logAdminAction, labelFor } from "./activity";
import { isPlaceholderEmail } from "../lib/contact";
import { notifyBookingEvent } from "../notifications/internal";
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
} as const;

function refuse(message: string): never {
  throw new ConvexError(message);
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
    createdAt: user.createdAt,
  };
}

export async function suspendUserRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  userId: Id<"users">,
  reason: string,
  now: number = Date.now()
): Promise<void> {
  const target = await ctx.db.get(userId);
  if (!target) throw new Error("User not found");

  // Locking yourself out of the panel is unrecoverable without database
  // access, and one admin suspending another is a fight the product should
  // not host.
  if (target._id === admin._id) {
    throw new Error("لا يمكنك إيقاف حسابك. / You cannot suspend your own account.");
  }
  if (target.role === "admin") {
    throw new Error("لا يمكن إيقاف حساب مسؤول. / An admin account cannot be suspended.");
  }

  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("سبب الإيقاف مطلوب. / A suspension reason is required.");
  }

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
  if (!target) throw new Error("User not found");

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
  if (!listing) throw new Error("Listing not found");

  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("سبب الإيقاف مطلوب. / A suspension reason is required.");
  }

  // isPublicListing is an allow-list on "approved", so this alone removes the
  // listing from search, the directory and the booking flow.
  await ctx.db.patch(listingId, {
    status: "suspended",
    suspendedReason: trimmed.slice(0, 500),
    updatedAt: now,
  });

  await logAdminAction(ctx, admin, {
    action: "listing.suspend",
    targetType: "listing",
    targetId: listingId,
    summary: labelFor(listing),
    details: trimmed,
  });
}

export async function reinstateListingRecord(
  ctx: MutationCtx,
  admin: Doc<"users">,
  listingId: Id<"listings">,
  now: number = Date.now()
): Promise<void> {
  const listing = await ctx.db.get(listingId);
  if (!listing) throw new Error("Listing not found");
  if (listing.status !== "suspended") {
    throw new Error("هذا المكان ليس موقوفًا. / This listing is not suspended.");
  }

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
    throw new Error("Invalid booking status: " + args.status);
  }

  const booking = await ctx.db.get(args.bookingId);
  if (!booking) throw new Error("Booking not found");

  const from = booking.status as BookingStatus;
  const to = args.status as BookingStatus;
  const transition = canTransition(from, to, "admin");
  if (!transition.allowed) throw new Error(transition.reason);

  const reason = args.reason?.trim().slice(0, 500) || undefined;

  await ctx.db.patch(args.bookingId, {
    status: to,
    ...(to === "confirmed" || to === "declined" ? { respondedAt: now } : {}),
    ...(to === "declined" ? { declineReason: reason ?? booking.declineReason } : {}),
    ...(to === "cancelled" ? { cancellationReason: reason ?? booking.cancellationReason } : {}),
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
