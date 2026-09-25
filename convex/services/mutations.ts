import { mutation } from "../_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { AUTH_ERRORS } from "../lib/errors";
import { deleteServiceForUser, submitServiceForUser, updateServiceForUser } from "./service";

/**
 * Thin wrappers: resolve the provider, hand off to the seam. Every rule lives
 * in `service.ts` so it can be tested — convex-test cannot get past
 * `getAuthenticatedAppUser`.
 */

const coordinates = v.optional(v.object({ lat: v.number(), lng: v.number() }));

// Submit a new service (service provider only)
export const submitService = mutation({
  args: {
    serviceType: v.string(),
    title_en: v.string(),
    title_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    priceUnit: v.optional(v.string()),
    // 1.1.0: whole SAR per priceUnit. Without it the service shows Contact.
    price: v.optional(v.number()),
    maxGroupSize: v.optional(v.number()),
    availability_en: v.optional(v.string()),
    availability_ar: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await submitServiceForUser(ctx, user, args);
  },
});

// Update own service (back to review, unless an admin suspended it)
export const updateMyService = mutation({
  args: {
    serviceId: v.id("services"),
    serviceType: v.optional(v.string()),
    title_en: v.optional(v.string()),
    title_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    priceRange: v.optional(v.string()),
    priceUnit: v.optional(v.string()),
    // null clears: a provider who stops taking bookings goes back to Contact.
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
    coordinates,
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await updateServiceForUser(ctx, user, args);
  },
});

// Delete own service, once nothing is booked on it
export const deleteMyService = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await deleteServiceForUser(ctx, user, args.serviceId);
  },
});
