import { query } from "../_generated/server";
import { v } from "convex/values";

// Get dashboard statistics
export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const doctors = await ctx.db.query("doctors").collect();
    const appointments = await ctx.db.query("appointments").collect();
    const users = await ctx.db.query("users").collect();
    const trainingData = await ctx.db.query("aiTrainingData").collect();
    const symptomAnalyses = await ctx.db.query("symptomAnalyses").collect();

    // Count by status
    const appointmentsByStatus = {
      pending: appointments.filter(a => a.status === "pending").length,
      confirmed: appointments.filter(a => a.status === "confirmed").length,
      completed: appointments.filter(a => a.status === "completed").length,
      cancelled: appointments.filter(a => a.status === "cancelled").length,
    };

    // Count doctors by type
    const doctorsByType = {
      doctor: doctors.filter(d => d.type === "doctor").length,
      clinic: doctors.filter(d => d.type === "clinic").length,
      hospital: doctors.filter(d => d.type === "hospital").length,
    };

    return {
      totalDoctors: doctors.length,
      totalAppointments: appointments.length,
      totalUsers: users.length,
      totalTrainingData: trainingData.length,
      totalSymptomAnalyses: symptomAnalyses.length,
      appointmentsByStatus,
      doctorsByType,
      activeDoctors: doctors.filter(d => d.isActive !== false).length,
      verifiedDoctors: doctors.filter(d => d.isVerified === true).length,
    };
  },
});

// List all doctors for admin management
export const listAllDoctors = query({
  args: {
    type: v.optional(v.string()),
    wilaya: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("doctors");

    if (args.type) {
      q = q.withIndex("by_type", (q) => q.eq("type", args.type!));
    }

    const doctors = await q.order("desc").collect();

    if (args.wilaya) {
      return doctors.filter(d => d.wilaya === args.wilaya);
    }

    return doctors;
  },
});

// List all AI training data
export const listTrainingData = query({
  args: {
    category: v.optional(v.string()),
    activeOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("aiTrainingData");

    if (args.category) {
      q = q.withIndex("by_category", (q) => q.eq("category", args.category!));
    }

    const data = await q.order("desc").collect();

    if (args.activeOnly) {
      return data.filter(d => d.isActive);
    }

    return data;
  },
});

// Get single training data item
export const getTrainingData = query({
  args: { id: v.id("aiTrainingData") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// Get single doctor
export const getDoctor = query({
  args: { id: v.id("doctors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// List all appointments for admin
export const listAllAppointments = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let appointments = await ctx.db
      .query("appointments")
      .order("desc")
      .collect();

    if (args.status) {
      appointments = appointments.filter(a => a.status === args.status);
    }

    // Get doctor and user details for each appointment
    const enrichedAppointments = await Promise.all(
      appointments.slice(0, args.limit || 50).map(async (apt) => {
        const doctor = await ctx.db.get(apt.doctorId);
        const user = await ctx.db.get(apt.userId);
        return {
          ...apt,
          doctorName: doctor?.name_en || "Unknown",
          doctorName_ar: doctor?.name_ar || "غير معروف",
          userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown",
          userEmail: user?.email,
        };
      })
    );

    return enrichedAppointments;
  },
});

// Get all wilayas (for dropdown)
export const getWilayas = query({
  args: {},
  handler: async (ctx) => {
    const doctors = await ctx.db.query("doctors").collect();
    const wilayas = [...new Set(doctors.map(d => d.wilaya))].sort();
    return wilayas;
  },
});

// Get all specialties (for dropdown)
export const getSpecialties = query({
  args: {},
  handler: async (ctx) => {
    const doctors = await ctx.db.query("doctors").collect();
    const specialties = [...new Set(doctors.map(d => d.specialty))].sort();
    return specialties;
  },
});
