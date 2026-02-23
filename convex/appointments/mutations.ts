import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Book an appointment
export const bookAppointment = mutation({
  args: {
    doctorId: v.id("doctors"),
    date: v.string(),
    time: v.string(),
    type: v.optional(v.string()),
    notes: v.optional(v.string()),
    symptomAnalysisId: v.optional(v.id("symptomAnalyses")),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Verify doctor exists and is active
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor || doctor.isActive === false) {
      throw new Error("Doctor not found or inactive");
    }

    // Check if slot is available
    const existingAppointment = await ctx.db
      .query("appointments")
      .withIndex("by_doctorId_and_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("time"), args.time),
          q.neq(q.field("status"), "cancelled")
        )
      )
      .first();

    if (existingAppointment) {
      throw new Error("This time slot is no longer available");
    }

    // Validate date is not in the past
    const appointmentDate = new Date(`${args.date}T${args.time}`);
    if (appointmentDate < new Date()) {
      throw new Error("Cannot book appointments in the past");
    }

    // Create the appointment
    const appointmentId = await ctx.db.insert("appointments", {
      userId: user._id,
      doctorId: args.doctorId,
      date: args.date,
      time: args.time,
      status: "pending",
      type: args.type || "consultation",
      notes: args.notes,
      symptomAnalysisId: args.symptomAnalysisId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return appointmentId;
  },
});

// Cancel an appointment
export const cancelAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const appointment = await ctx.db.get(args.appointmentId);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.userId !== user._id) {
      throw new Error("Not authorized to cancel this appointment");
    }

    if (appointment.status === "cancelled") {
      throw new Error("Appointment is already cancelled");
    }

    if (appointment.status === "completed") {
      throw new Error("Cannot cancel a completed appointment");
    }

    await ctx.db.patch(args.appointmentId, {
      status: "cancelled",
      cancellationReason: args.reason,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Reschedule an appointment
export const rescheduleAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
    newDate: v.string(),
    newTime: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      throw new Error("Not authenticated");
    }

    const appointment = await ctx.db.get(args.appointmentId);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.userId !== user._id) {
      throw new Error("Not authorized to reschedule this appointment");
    }

    if (appointment.status === "cancelled" || appointment.status === "completed") {
      throw new Error("Cannot reschedule this appointment");
    }

    // Check if new slot is available
    const existingAppointment = await ctx.db
      .query("appointments")
      .withIndex("by_doctorId_and_date", (q) =>
        q.eq("doctorId", appointment.doctorId).eq("date", args.newDate)
      )
      .filter((q) =>
        q.and(
          q.eq(q.field("time"), args.newTime),
          q.neq(q.field("status"), "cancelled"),
          q.neq(q.field("_id"), args.appointmentId)
        )
      )
      .first();

    if (existingAppointment) {
      throw new Error("This time slot is not available");
    }

    // Validate date is not in the past
    const appointmentDate = new Date(`${args.newDate}T${args.newTime}`);
    if (appointmentDate < new Date()) {
      throw new Error("Cannot reschedule to a past date");
    }

    await ctx.db.patch(args.appointmentId, {
      date: args.newDate,
      time: args.newTime,
      status: "pending", // Reset to pending after reschedule
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Confirm an appointment (doctor/admin action)
export const confirmAppointment = mutation({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.status !== "pending") {
      throw new Error("Can only confirm pending appointments");
    }

    await ctx.db.patch(args.appointmentId, {
      status: "confirmed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// Mark appointment as completed (doctor/admin action)
export const completeAppointment = mutation({
  args: {
    appointmentId: v.id("appointments"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const appointment = await ctx.db.get(args.appointmentId);

    if (!appointment) {
      throw new Error("Appointment not found");
    }

    if (appointment.status === "cancelled") {
      throw new Error("Cannot complete a cancelled appointment");
    }

    await ctx.db.patch(args.appointmentId, {
      status: "completed",
      notes: args.notes || appointment.notes,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
