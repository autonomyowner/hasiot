import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Generate a unique card number
function generateCardNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const part1 = Array.from(
    { length: 3 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  const part2 = Array.from(
    { length: 3 },
    () => chars[Math.floor(Math.random() * chars.length)]
  ).join("");
  return `TBR-${part1}-${part2}`;
}

// Create a health card for the current user
export const createHealthCard = mutation({
  args: {
    bloodType: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    chronicConditions: v.optional(v.array(v.string())),
    currentMedications: v.optional(
      v.array(
        v.object({
          name: v.string(),
          dosage: v.optional(v.string()),
          frequency: v.optional(v.string()),
        })
      )
    ),
    emergencyContact: v.optional(
      v.object({
        name: v.string(),
        phone: v.string(),
        relationship: v.optional(v.string()),
      })
    ),
    emergencyAccessPin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check if user already has a health card
    const existing = await ctx.db
      .query("healthCards")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (existing) {
      throw new Error("User already has a health card");
    }

    // Generate unique card number
    let cardNumber = generateCardNumber();
    let attempts = 0;
    while (attempts < 10) {
      const existingCard = await ctx.db
        .query("healthCards")
        .withIndex("by_cardNumber", (q) => q.eq("cardNumber", cardNumber))
        .unique();

      if (!existingCard) break;
      cardNumber = generateCardNumber();
      attempts++;
    }

    const cardId = await ctx.db.insert("healthCards", {
      userId: user._id,
      cardNumber,
      bloodType: args.bloodType,
      allergies: args.allergies || [],
      chronicConditions: args.chronicConditions || [],
      currentMedications: args.currentMedications || [],
      emergencyContact: args.emergencyContact,
      emergencyAccessPin: args.emergencyAccessPin,
      sharePermissions: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return { cardId, cardNumber };
  },
});

// Update health card
export const updateHealthCard = mutation({
  args: {
    bloodType: v.optional(v.string()),
    allergies: v.optional(v.array(v.string())),
    chronicConditions: v.optional(v.array(v.string())),
    currentMedications: v.optional(
      v.array(
        v.object({
          name: v.string(),
          dosage: v.optional(v.string()),
          frequency: v.optional(v.string()),
        })
      )
    ),
    emergencyContact: v.optional(
      v.object({
        name: v.string(),
        phone: v.string(),
        relationship: v.optional(v.string()),
      })
    ),
    emergencyAccessPin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const card = await ctx.db
      .query("healthCards")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!card) {
      throw new Error("Health card not found");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.bloodType !== undefined) updates.bloodType = args.bloodType;
    if (args.allergies !== undefined) updates.allergies = args.allergies;
    if (args.chronicConditions !== undefined) updates.chronicConditions = args.chronicConditions;
    if (args.currentMedications !== undefined) updates.currentMedications = args.currentMedications;
    if (args.emergencyContact !== undefined) updates.emergencyContact = args.emergencyContact;
    if (args.emergencyAccessPin !== undefined) updates.emergencyAccessPin = args.emergencyAccessPin;

    await ctx.db.patch(card._id, updates);

    return { success: true };
  },
});

// Add a medical record
export const addMedicalRecord = mutation({
  args: {
    type: v.string(),
    title: v.string(),
    title_ar: v.optional(v.string()),
    description: v.optional(v.string()),
    recordDate: v.string(),
    doctorId: v.optional(v.id("doctors")),
    doctorName: v.optional(v.string()),
    prescriptionDetails: v.optional(
      v.object({
        medications: v.array(
          v.object({
            name: v.string(),
            dosage: v.string(),
            frequency: v.string(),
            duration: v.optional(v.string()),
          })
        ),
        instructions: v.optional(v.string()),
      })
    ),
    labResults: v.optional(
      v.array(
        v.object({
          testName: v.string(),
          result: v.string(),
          normalRange: v.optional(v.string()),
          isAbnormal: v.optional(v.boolean()),
        })
      )
    ),
    attachmentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Get or create health card
    let card = await ctx.db
      .query("healthCards")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!card) {
      // Auto-create health card
      const cardNumber = generateCardNumber();
      const cardId = await ctx.db.insert("healthCards", {
        userId: user._id,
        cardNumber,
        allergies: [],
        chronicConditions: [],
        currentMedications: [],
        sharePermissions: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      card = await ctx.db.get(cardId);
    }

    if (!card) {
      throw new Error("Failed to create health card");
    }

    const recordId = await ctx.db.insert("medicalRecords", {
      userId: user._id,
      healthCardId: card._id,
      type: args.type,
      title: args.title,
      title_ar: args.title_ar,
      description: args.description,
      recordDate: args.recordDate,
      doctorId: args.doctorId,
      doctorName: args.doctorName,
      prescriptionDetails: args.prescriptionDetails,
      labResults: args.labResults,
      attachmentUrl: args.attachmentUrl,
      createdAt: Date.now(),
    });

    return recordId;
  },
});

// Delete a medical record
export const deleteMedicalRecord = mutation({
  args: { recordId: v.id("medicalRecords") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const record = await ctx.db.get(args.recordId);

    if (!record || record.userId !== user._id) {
      throw new Error("Record not found");
    }

    await ctx.db.delete(args.recordId);

    return { success: true };
  },
});

// Grant share permission to a doctor
export const grantSharePermission = mutation({
  args: {
    doctorId: v.id("doctors"),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const card = await ctx.db
      .query("healthCards")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!card) {
      throw new Error("Health card not found");
    }

    // Verify doctor exists
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const currentPermissions = card.sharePermissions || [];

    // Remove existing permission for this doctor
    const filteredPermissions = currentPermissions.filter(
      (p) => p.doctorId !== args.doctorId
    );

    // Add new permission
    const expiresAt = args.expiresInDays
      ? Date.now() + args.expiresInDays * 24 * 60 * 60 * 1000
      : undefined;

    filteredPermissions.push({
      doctorId: args.doctorId,
      grantedAt: Date.now(),
      expiresAt,
    });

    await ctx.db.patch(card._id, {
      sharePermissions: filteredPermissions,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Revoke share permission
export const revokeSharePermission = mutation({
  args: { doctorId: v.id("doctors") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const card = await ctx.db
      .query("healthCards")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();

    if (!card) {
      throw new Error("Health card not found");
    }

    const currentPermissions = card.sharePermissions || [];
    const filteredPermissions = currentPermissions.filter(
      (p) => p.doctorId !== args.doctorId
    );

    await ctx.db.patch(card._id, {
      sharePermissions: filteredPermissions,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
