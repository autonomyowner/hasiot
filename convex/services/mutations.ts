import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

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
    availability_en: v.optional(v.string()),
    availability_ar: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    if (user.role !== "service_provider") {
      throw new Error("Only service providers can submit services");
    }
    if (!user.isApproved) {
      throw new Error("Your account must be approved before submitting services");
    }

    const now = Date.now();
    const serviceId = await ctx.db.insert("services", {
      ...args,
      ownerId: user._id,
      status: "pending",
      rating: 0,
      reviewCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return serviceId;
  },
});

// Update own service (resets status to pending)
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
    availability_en: v.optional(v.string()),
    availability_ar: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");
    if (service.ownerId !== user._id) throw new Error("Not your service");

    const { serviceId, ...updates } = args;
    const filteredUpdates: Record<string, unknown> = {
      updatedAt: Date.now(),
      status: "pending",
      rejectionReason: undefined,
    };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(serviceId, filteredUpdates);
    return { success: true };
  },
});

// Delete own service
export const deleteMyService = mutation({
  args: {
    serviceId: v.id("services"),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Not authenticated");

    const service = await ctx.db.get(args.serviceId);
    if (!service) throw new Error("Service not found");
    if (service.ownerId !== user._id) throw new Error("Not your service");

    await ctx.db.delete(args.serviceId);
    return { success: true };
  },
});
