import { mutation, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";

// Create a new doctor (admin only - for now, anyone can create for development)
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
    workingHours: v.optional(
      v.array(
        v.object({
          day: v.string(),
          open: v.string(),
          close: v.string(),
          isClosed: v.optional(v.boolean()),
        })
      )
    ),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const doctorId = await ctx.db.insert("doctors", {
      ...args,
      rating: 0,
      reviewCount: 0,
      isVerified: false,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return doctorId;
  },
});

// Update a doctor
export const updateDoctor = mutation({
  args: {
    doctorId: v.id("doctors"),
    name_en: v.optional(v.string()),
    name_ar: v.optional(v.string()),
    name_fr: v.optional(v.string()),
    specialty: v.optional(v.string()),
    specialty_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.optional(v.string()),
    wilaya: v.optional(v.string()),
    coordinates: v.optional(
      v.object({
        lat: v.number(),
        lng: v.number(),
      })
    ),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    workingHours: v.optional(
      v.array(
        v.object({
          day: v.string(),
          open: v.string(),
          close: v.string(),
          isClosed: v.optional(v.boolean()),
        })
      )
    ),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { doctorId, ...updates } = args;

    const doctor = await ctx.db.get(doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    // Filter out undefined values
    const filteredUpdates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        filteredUpdates[key] = value;
      }
    }

    await ctx.db.patch(doctorId, filteredUpdates);

    return { success: true };
  },
});

// Add a review for a doctor
export const addReview = mutation({
  args: {
    doctorId: v.id("doctors"),
    appointmentId: v.optional(v.id("appointments")),
    rating: v.number(),
    content: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
  },
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

    // Validate rating
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }

    // Check if user has a verified appointment (optional)
    let isVerified = false;
    if (args.appointmentId) {
      const appointment = await ctx.db.get(args.appointmentId);
      if (appointment && appointment.userId === user._id && appointment.status === "completed") {
        isVerified = true;
      }
    }

    // Create the review
    const reviewId = await ctx.db.insert("reviews", {
      userId: user._id,
      doctorId: args.doctorId,
      appointmentId: args.appointmentId,
      rating: args.rating,
      content: args.content,
      isAnonymous: args.isAnonymous || false,
      isVerified,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Update doctor's rating
    await updateDoctorRating(ctx, args.doctorId);

    return reviewId;
  },
});

// Internal function to update doctor's average rating
async function updateDoctorRating(ctx: { db: any }, doctorId: string) {
  const reviews = await ctx.db
    .query("reviews")
    .withIndex("by_doctorId", (q: any) => q.eq("doctorId", doctorId))
    .collect();

  if (reviews.length === 0) {
    return;
  }

  const totalRating = reviews.reduce((sum: number, r: { rating: number }) => sum + r.rating, 0);
  const avgRating = totalRating / reviews.length;

  await ctx.db.patch(doctorId, {
    rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
    reviewCount: reviews.length,
    updatedAt: Date.now(),
  });
}

// Save doctor's working hours schedule
export const saveWorkingHours = mutation({
  args: {
    doctorId: v.id("doctors"),
    workingHours: v.array(
      v.object({
        day: v.string(),
        open: v.string(),
        close: v.string(),
        isClosed: v.optional(v.boolean()),
      })
    ),
    consultationFee: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || (user.role !== "doctor" && user.role !== "clinic")) {
      throw new Error("Not authorized");
    }

    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const updates: Record<string, unknown> = {
      workingHours: args.workingHours,
      updatedAt: Date.now(),
    };

    if (args.consultationFee !== undefined) {
      updates.consultationFee = args.consultationFee;
    }

    await ctx.db.patch(args.doctorId, updates);

    return { success: true };
  },
});

// Block specific dates (create availability schedule entries with all slots unavailable)
export const blockDate = mutation({
  args: {
    doctorId: v.id("doctors"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || (user.role !== "doctor" && user.role !== "clinic")) {
      throw new Error("Not authorized");
    }

    // Check if schedule already exists for this date
    const existing = await ctx.db
      .query("availabilitySchedules")
      .withIndex("by_doctorId_and_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date)
      )
      .unique();

    if (existing) {
      // Mark all slots as unavailable
      await ctx.db.patch(existing._id, {
        slots: existing.slots.map((s) => ({ ...s, isAvailable: false })),
      });
    } else {
      // Create empty schedule (no slots = day off)
      await ctx.db.insert("availabilitySchedules", {
        doctorId: args.doctorId,
        date: args.date,
        slots: [],
      });
    }

    return { success: true };
  },
});

// Unblock a date
export const unblockDate = mutation({
  args: {
    doctorId: v.id("doctors"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user || (user.role !== "doctor" && user.role !== "clinic")) {
      throw new Error("Not authorized");
    }

    const existing = await ctx.db
      .query("availabilitySchedules")
      .withIndex("by_doctorId_and_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("date", args.date)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }

    return { success: true };
  },
});

// Seed doctors (for development)
export const seedDoctors = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sampleDoctors = [
      {
        type: "doctor",
        name_en: "Dr. Ahmed Benali",
        name_ar: "د. أحمد بن علي",
        specialty: "general",
        specialty_ar: "طب عام",
        address: "123 Rue Didouche Mourad, Alger",
        wilaya: "Alger",
        coordinates: { lat: 36.7538, lng: 3.0588 },
        phone: "+213 21 123 456",
        consultationFee: 2000,
        languages: ["ar", "fr"],
      },
      {
        type: "doctor",
        name_en: "Dr. Fatima Zohra",
        name_ar: "د. فاطمة الزهراء",
        specialty: "cardiology",
        specialty_ar: "أمراض القلب",
        address: "45 Boulevard Mohamed V, Oran",
        wilaya: "Oran",
        coordinates: { lat: 35.6969, lng: -0.6331 },
        phone: "+213 41 234 567",
        consultationFee: 3000,
        languages: ["ar", "fr", "en"],
      },
      {
        type: "clinic",
        name_en: "Clinique El Azhar",
        name_ar: "عيادة الأزهر",
        specialty: "multi-specialty",
        specialty_ar: "متعددة التخصصات",
        address: "78 Rue des Frères Bouadou, Constantine",
        wilaya: "Constantine",
        coordinates: { lat: 36.3650, lng: 6.6147 },
        phone: "+213 31 345 678",
        consultationFee: 2500,
        languages: ["ar", "fr"],
      },
      {
        type: "clinic",
        name_en: "Etablissement Hospitalier Privé Naila",
        name_ar: "المؤسسة الاستشفائية الخاصة نائلة",
        specialty: "multi-specialty",
        specialty_ar: "متعددة التخصصات",
        address: "Cité Berbih Bd N°06 Lots 164, Propriété 99, Djelfa",
        wilaya: "Djelfa",
        coordinates: { lat: 34.6725, lng: 3.2500 },
        phone: "027 93 93 46 / 0550 93 74 05",
        languages: ["ar", "fr"],
      },
      {
        type: "hospital",
        name_en: "Hôpital d'Ophtalmologie (Algérie-Cuba)",
        name_ar: "مستشفى طب العيون (الجزائر-كوبا)",
        specialty: "ophthalmology",
        specialty_ar: "طب العيون",
        address: "Rue Administrative, Djelfa 17000",
        wilaya: "Djelfa",
        coordinates: { lat: 34.6740, lng: 3.2560 },
        phone: "027 93 66 74",
        languages: ["ar", "fr"],
      },
    ];

    for (const doctor of sampleDoctors) {
      await ctx.db.insert("doctors", {
        ...doctor,
        rating: Math.round((3 + Math.random() * 2) * 10) / 10,
        reviewCount: Math.floor(Math.random() * 50),
        isVerified: true,
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return { success: true, count: sampleDoctors.length }; // Now 5 establishments
  },
});
