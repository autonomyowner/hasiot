import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { enforceRateLimit } from "../rateLimit";
import { SERVICE_ERRORS, validateServiceInput } from "./logic";

/**
 * A provider's writes to their own services, with the caller already resolved.
 *
 * Same seam as bookings/service.ts: convex-test cannot stand up the Better Auth
 * component, so the public mutations resolve the user and hand off to these,
 * which is what makes every rule below reachable from a test.
 *
 * Every refusal is a ConvexError. These used to be plain Errors, which
 * production redacts to "Server Error", so a provider whose account was not yet
 * approved was told to try again later instead of why.
 */

/** Statuses that still promise a traveller something: the service must stay. */
const OPEN_BOOKING_STATUSES = ["pending", "confirmed"] as const;

// Free-text fields the validator does not own. They are stored as sent, as
// before 1.1.0: the 1.0.2 app clears one by sending "" and relies on that.
type PassThrough = {
  priceRange?: string;
  availability_en?: string;
  availability_ar?: string;
  contactPhone?: string;
  contactEmail?: string;
  languages?: string[];
  region?: string;
  coordinates?: { lat: number; lng: number };
};

type Validated = {
  serviceType?: string;
  title_en?: string;
  title_ar?: string;
  description_en?: string;
  description_ar?: string;
  priceUnit?: string;
  images?: string[];
  city?: string;
};

export type SubmitServiceArgs = Validated &
  PassThrough & {
    serviceType: string;
    title_en: string;
    title_ar: string;
    price?: number;
    maxGroupSize?: number;
  };

export type UpdateServiceArgs = Validated &
  PassThrough & {
    serviceId: Id<"services">;
    price?: number | null;
    maxGroupSize?: number | null;
  };

function passThrough(args: PassThrough): PassThrough {
  const out: Record<string, unknown> = {};
  for (const key of [
    "priceRange",
    "availability_en",
    "availability_ar",
    "contactPhone",
    "contactEmail",
    "languages",
    "region",
    "coordinates",
  ] as const) {
    if (args[key] !== undefined) out[key] = args[key];
  }
  return out as PassThrough;
}

export async function submitServiceForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: SubmitServiceArgs,
  now: number = Date.now()
): Promise<Id<"services">> {
  if (user.role !== "service_provider") throw new ConvexError(SERVICE_ERRORS.NOT_A_PROVIDER);
  if (!user.isApproved) throw new ConvexError(SERVICE_ERRORS.NOT_APPROVED);

  // Before the rate limit, so a typo does not spend one of the day's twenty.
  // The city is checked only when sent: the live apps never send one.
  const checked = validateServiceInput(args, "create");

  await enforceRateLimit(
    ctx,
    `service:${user._id}`,
    20,
    "لقد وصلت إلى الحد اليومي لإضافة الخدمات. يرجى المحاولة غدًا. / You've reached today's limit for new services. Please try again tomorrow."
  );

  // No rating or reviewCount: they appear with the first review. The 0 this
  // used to store would render as a one-star service.
  return await ctx.db.insert("services", {
    ...passThrough(args),
    ...(checked as Validated & { serviceType: string; title_en: string; title_ar: string }),
    ownerId: user._id,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Change a service. Any change sends an approved or rejected service back to
 * review, since what the admin approved is no longer what travellers would see.
 * A suspended service stays suspended: editing is not a way out of a takedown.
 */
export async function updateServiceForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  args: UpdateServiceArgs,
  now: number = Date.now()
): Promise<{ success: true }> {
  const service = await ownService(ctx, user, args.serviceId);

  const { serviceId, ...fields } = args;
  const checked = validateServiceInput(fields, "update");

  await ctx.db.patch(serviceId, {
    ...passThrough(fields),
    // `undefined` under a key is how validateServiceInput says "clear it".
    ...checked,
    ...(service.status === "suspended" ? {} : { status: "pending", rejectionReason: undefined }),
    updatedAt: now,
  });

  return { success: true };
}

export async function deleteServiceForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  serviceId: Id<"services">
): Promise<{ success: true }> {
  const service = await ownService(ctx, user, serviceId);

  // A traveller holding a request or a confirmed day would be left with a
  // booking of nothing and no provider to call. The provider declines or
  // completes those first.
  if (await hasOpenBookings(ctx, service)) {
    throw new ConvexError(SERVICE_ERRORS.HAS_OPEN_BOOKINGS);
  }

  await ctx.db.delete(serviceId);
  return { success: true };
}

async function ownService(
  ctx: MutationCtx,
  user: Doc<"users">,
  serviceId: Id<"services">
): Promise<Doc<"services">> {
  const service = await ctx.db.get(serviceId);
  if (!service) throw new ConvexError(SERVICE_ERRORS.NOT_FOUND);
  if (service.ownerId !== user._id) throw new ConvexError(SERVICE_ERRORS.NOT_YOURS);
  return service;
}

/**
 * Whether any booking of this service is still pending or confirmed.
 *
 * Read through the provider's open bookings rather than `by_serviceId`: that
 * range is the service's whole history and only grows, while a provider's
 * pending and confirmed bookings stay few. A service booking's `ownerId` is the
 * service's owner, written when it is made, and no path moves a service to
 * another owner.
 */
export async function hasOpenBookings(
  ctx: MutationCtx,
  service: Pick<Doc<"services">, "_id" | "ownerId">
): Promise<boolean> {
  for (const status of OPEN_BOOKING_STATUSES) {
    const open = await ctx.db
      .query("bookings")
      .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", service.ownerId).eq("status", status))
      .filter((q) => q.eq(q.field("serviceId"), service._id))
      .first();
    if (open) return true;
  }
  return false;
}
