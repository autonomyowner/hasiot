import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get authenticated user's own services
export const getMyServices = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const services = await ctx.db
      .query("services")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();

    if (args.status) {
      return services.filter((s) => s.status === args.status);
    }

    return services;
  },
});

// List approved services (public)
export const listServices = query({
  args: {
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const buildQuery = () => {
      if (args.serviceType) {
        return ctx.db.query("services").withIndex("by_serviceType", (q) => q.eq("serviceType", args.serviceType!));
      }
      return ctx.db.query("services");
    };

    const services = await buildQuery().collect();

    let filtered = services.filter((s) => s.status === "approved");

    if (args.city) {
      filtered = filtered.filter((s) => s.city === args.city);
    }

    if (args.limit) {
      return filtered.slice(0, args.limit);
    }

    return filtered;
  },
});

// Get a single service by ID (public — only returns approved services)
export const getService = query({
  args: { serviceId: v.id("services") },
  handler: async (ctx, args) => {
    const service = await ctx.db.get(args.serviceId);
    if (!service || service.status !== "approved") return null;
    return service;
  },
});

// Search services by title (public)
export const searchServices = query({
  args: {
    searchQuery: v.string(),
    serviceType: v.optional(v.string()),
    city: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let searchBuilder = ctx.db
      .query("services")
      .withSearchIndex("search_services", (q) => {
        let search = q.search("title_en", args.searchQuery);
        if (args.serviceType) search = search.eq("serviceType", args.serviceType);
        if (args.city) search = search.eq("city", args.city);
        return search;
      });

    const results = await searchBuilder.collect();

    const approved = results.filter((s) => s.status === "approved");

    if (args.limit) {
      return approved.slice(0, args.limit);
    }

    return approved;
  },
});
