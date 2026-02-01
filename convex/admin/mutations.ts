import { mutation } from "../_generated/server";
import { v } from "convex/values";

// Create a new doctor/clinic/hospital
export const createDoctor = mutation({
  args: {
    type: v.string(),
    name_en: v.string(),
    name_ar: v.string(),
    name_fr: v.optional(v.string()),
    specialty: v.string(),
    specialty_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.string(),
    wilaya: v.string(),
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("doctors", {
      ...args,
      rating: 0,
      reviewCount: 0,
      isActive: args.isActive ?? true,
      isVerified: args.isVerified ?? false,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Update a doctor
export const updateDoctor = mutation({
  args: {
    id: v.id("doctors"),
    type: v.optional(v.string()),
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    name_fr: v.optional(v.string()),
    specialty: v.optional(v.string()),
    specialty_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.optional(v.string()),
    wilaya: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Doctor not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Delete a doctor
export const deleteDoctor = mutation({
  args: { id: v.id("doctors") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Create AI training data
export const createTrainingData = mutation({
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
      specialty: v.optional(v.string()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("aiTrainingData", {
      ...args,
      isActive: args.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

// Update AI training data
export const updateTrainingData = mutation({
  args: {
    id: v.id("aiTrainingData"),
    category: v.optional(v.string()),
    title: v.optional(v.string()),
    title_ar: v.optional(v.string()),
    content: v.optional(v.string()),
    content_ar: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      lastReviewed: v.optional(v.string()),
      specialty: v.optional(v.string()),
    })),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const existing = await ctx.db.get(id);
    if (!existing) {
      throw new Error("Training data not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
    return id;
  },
});

// Delete AI training data
export const deleteTrainingData = mutation({
  args: { id: v.id("aiTrainingData") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

// Update appointment status (admin)
export const updateAppointmentStatus = mutation({
  args: {
    id: v.id("appointments"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id);
    if (!existing) {
      throw new Error("Appointment not found");
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// Bulk import doctors
export const bulkImportDoctors = mutation({
  args: {
    doctors: v.array(v.object({
      type: v.string(),
      name_en: v.string(),
      name_ar: v.string(),
      specialty: v.string(),
      specialty_ar: v.optional(v.string()),
      address: v.string(),
      wilaya: v.string(),
      coordinates: v.object({
        lat: v.number(),
        lng: v.number(),
      }),
      phone: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const ids = [];

    for (const doctor of args.doctors) {
      const id = await ctx.db.insert("doctors", {
        ...doctor,
        rating: 0,
        reviewCount: 0,
        isActive: true,
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      ids.push(id);
    }

    return { imported: ids.length, ids };
  },
});
