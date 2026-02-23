import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Generate an upload URL for CV file
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

// Save CV file reference to user record
export const saveCvFile = mutation({
  args: { fileId: v.id("_storage") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    if (user.role !== "doctor" && user.role !== "clinic") {
      throw new Error("Only doctors/clinics can upload CVs");
    }

    await ctx.db.patch(user._id, {
      cvFileId: args.fileId,
      updatedAt: Date.now(),
    });

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
    wilaya: v.optional(v.string()),
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
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.preferredLanguage !== undefined) updates.preferredLanguage = args.preferredLanguage;
    if (args.wilaya !== undefined) updates.wilaya = args.wilaya;

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

// Toggle favorite doctor
export const toggleFavorite = mutation({
  args: { doctorId: v.id("doctors") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Verify doctor exists
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const currentFavorites = user.favoriteDoctorIds || [];
    const isFavorite = currentFavorites.includes(args.doctorId);

    let newFavorites: typeof currentFavorites;
    if (isFavorite) {
      newFavorites = currentFavorites.filter((id) => id !== args.doctorId);
    } else {
      newFavorites = [...currentFavorites, args.doctorId];
    }

    await ctx.db.patch(user._id, {
      favoriteDoctorIds: newFavorites,
      updatedAt: Date.now(),
    });

    return { isFavorite: !isFavorite };
  },
});

// Set user role after signup — called from frontend after authClient.signUp.email()
export const setUserRole = mutation({
  args: {
    role: v.string(), // "patient" | "doctor" | "clinic"
    specialty: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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

    if (args.role === "doctor" || args.role === "clinic") {
      updates.specialty = args.specialty;
      updates.isApproved = false; // Requires admin approval
    }

    await ctx.db.patch(user._id, updates);

    return { success: true };
  },
});

// Admin approves a doctor/clinic account
export const approveDoctorAccount = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const targetUser = await ctx.db.get(args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (targetUser.role !== "doctor" && targetUser.role !== "clinic") {
      throw new Error("User is not a doctor or clinic");
    }

    await ctx.db.patch(args.userId, {
      isApproved: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Create user record — called after signup to create the app user entry
export const createUser = mutation({
  args: {
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    role: v.string(),
    specialty: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      email: args.email,
      firstName: args.firstName,
      lastName: args.lastName,
      role: args.role,
      specialty: args.role === "doctor" || args.role === "clinic" ? args.specialty : undefined,
      isApproved: args.role === "patient" ? undefined : false,
      preferredLanguage: "ar",
      favoriteDoctorIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return userId;
  },
});
