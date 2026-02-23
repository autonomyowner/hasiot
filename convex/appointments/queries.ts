import { query } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Get current user's appointments
export const getUserAppointments = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return [];
    }

    let appointments;
    if (args.status) {
      appointments = await ctx.db
        .query("appointments")
        .withIndex("by_userId_and_status", (q) =>
          q.eq("userId", user._id).eq("status", args.status!)
        )
        .order("desc")
        .collect();
    } else {
      appointments = await ctx.db
        .query("appointments")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect();
    }

    // Enrich with doctor info
    const enrichedAppointments = await Promise.all(
      appointments.map(async (apt) => {
        const doctor = await ctx.db.get(apt.doctorId);
        return {
          ...apt,
          doctor: doctor
            ? {
                _id: doctor._id,
                name_en: doctor.name_en,
                name_ar: doctor.name_ar,
                specialty: doctor.specialty,
                specialty_ar: doctor.specialty_ar,
                address: doctor.address,
                phone: doctor.phone,
              }
            : null,
        };
      })
    );

    if (args.limit) {
      return enrichedAppointments.slice(0, args.limit);
    }

    return enrichedAppointments;
  },
});

// Get a single appointment
export const getAppointment = query({
  args: { appointmentId: v.id("appointments") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return null;
    }

    const appointment = await ctx.db.get(args.appointmentId);

    if (!appointment || appointment.userId !== user._id) {
      return null;
    }

    const doctor = await ctx.db.get(appointment.doctorId);

    return {
      ...appointment,
      doctor,
    };
  },
});

// Get available slots for a doctor on a specific date
export const getAvailableSlots = query({
  args: {
    doctorId: v.id("doctors"),
    date: v.string(), // "2024-01-15"
  },
  handler: async (ctx, args) => {
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) {
      return { slots: [], workingHours: null };
    }

    // Check if there's a custom schedule for this date
    const schedule = await ctx.db
      .query("availabilitySchedules")
      .withIndex("by_doctorId_and_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date)
      )
      .unique();

    if (schedule) {
      return {
        slots: schedule.slots.filter((s) => s.isAvailable),
        workingHours: doctor.workingHours,
      };
    }

    // Generate default slots based on working hours
    const dayOfWeek = getDayOfWeek(args.date);
    const daySchedule = doctor.workingHours?.find(
      (wh) => wh.day.toLowerCase() === dayOfWeek.toLowerCase()
    );

    if (!daySchedule || daySchedule.isClosed) {
      return { slots: [], workingHours: doctor.workingHours };
    }

    // Generate 30-minute slots
    const slots = generateTimeSlots(daySchedule.open, daySchedule.close, 30);

    // Get existing appointments for this doctor on this date
    const existingAppointments = await ctx.db
      .query("appointments")
      .withIndex("by_doctorId_and_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date)
      )
      .collect();

    const bookedTimes = new Set(
      existingAppointments
        .filter((apt) => apt.status !== "cancelled")
        .map((apt) => apt.time)
    );

    return {
      slots: slots.map((time) => ({
        time,
        isAvailable: !bookedTimes.has(time),
      })),
      workingHours: doctor.workingHours,
    };
  },
});

// Get upcoming appointments count for dashboard
export const getUpcomingCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) {
      return 0;
    }

    const today = new Date().toISOString().split("T")[0];

    const appointments = await ctx.db
      .query("appointments")
      .withIndex("by_userId_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "confirmed")
      )
      .collect();

    return appointments.filter((apt) => apt.date >= today).length;
  },
});

// Helper function to get day of week from date string
function getDayOfWeek(dateStr: string): string {
  const days = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

// Helper function to generate time slots
function generateTimeSlots(
  openTime: string,
  closeTime: string,
  intervalMinutes: number
): string[] {
  const slots: string[] = [];

  const [openHour, openMin] = openTime.split(":").map(Number);
  const [closeHour, closeMin] = closeTime.split(":").map(Number);

  let currentMinutes = openHour * 60 + openMin;
  const endMinutes = closeHour * 60 + closeMin;

  while (currentMinutes < endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const mins = currentMinutes % 60;
    slots.push(
      `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`
    );
    currentMinutes += intervalMinutes;
  }

  return slots;
}
