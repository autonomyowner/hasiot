import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get current user's health card
export const getMyHealthCard = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return null;
    }

    return await ctx.db
      .query("healthCards")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
  },
});

// Get health card by card number (for emergency access)
export const getHealthCardByNumber = query({
  args: {
    cardNumber: v.string(),
    emergencyPin: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const card = await ctx.db
      .query("healthCards")
      .withIndex("by_cardNumber", (q) => q.eq("cardNumber", args.cardNumber))
      .unique();

    if (!card) {
      return null;
    }

    // For emergency access, verify PIN
    if (args.emergencyPin) {
      if (card.emergencyAccessPin !== args.emergencyPin) {
        return null; // Invalid PIN
      }

      // Return limited emergency info
      const user = await ctx.db.get(card.userId);
      return {
        cardNumber: card.cardNumber,
        bloodType: card.bloodType,
        allergies: card.allergies,
        chronicConditions: card.chronicConditions,
        currentMedications: card.currentMedications,
        emergencyContact: card.emergencyContact,
        userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
      };
    }

    // Without PIN, check if requester has permission
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return null;
    }

    // Check if this is the owner
    if (card.userId === user._id) {
      return card;
    }

    // Check share permissions - would need to link doctors to users
    // For now, only owner can access without emergency PIN
    return null;
  },
});

// Get current user's medical records
export const getMyMedicalRecords = query({
  args: {
    type: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return [];
    }

    let records;
    if (args.type) {
      records = await ctx.db
        .query("medicalRecords")
        .withIndex("by_userId_and_type", (q) =>
          q.eq("userId", user._id).eq("type", args.type!)
        )
        .order("desc")
        .collect();
    } else {
      records = await ctx.db
        .query("medicalRecords")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
    }

    // Enrich with doctor info
    const enrichedRecords = await Promise.all(
      records.map(async (record) => {
        let doctor = null;
        if (record.doctorId) {
          const doctorDoc = await ctx.db.get(record.doctorId);
          if (doctorDoc) {
            doctor = {
              name_en: doctorDoc.name_en,
              name_ar: doctorDoc.name_ar,
              specialty: doctorDoc.specialty,
            };
          }
        }
        return { ...record, doctor };
      })
    );

    if (args.limit) {
      return enrichedRecords.slice(0, args.limit);
    }

    return enrichedRecords;
  },
});

// Get a single medical record
export const getMedicalRecord = query({
  args: { recordId: v.id("medicalRecords") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return null;
    }

    const record = await ctx.db.get(args.recordId);

    if (!record || record.userId !== user._id) {
      return null;
    }

    // Enrich with doctor info
    let doctor = null;
    if (record.doctorId) {
      const doctorDoc = await ctx.db.get(record.doctorId);
      if (doctorDoc) {
        doctor = {
          name_en: doctorDoc.name_en,
          name_ar: doctorDoc.name_ar,
          specialty: doctorDoc.specialty,
        };
      }
    }

    return { ...record, doctor };
  },
});

// Get records count by type for dashboard
export const getRecordsCounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return {};
    }

    const records = await ctx.db
      .query("medicalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const counts: Record<string, number> = {};
    for (const record of records) {
      counts[record.type] = (counts[record.type] || 0) + 1;
    }

    return counts;
  },
});
