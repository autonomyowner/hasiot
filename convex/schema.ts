import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table - synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()), // "ar" | "en" | "fr"
    favoriteDoctorIds: v.optional(v.array(v.id("doctors"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // Doctors & Clinics
  doctors: defineTable({
    type: v.string(), // "doctor" | "clinic" | "hospital"
    name_en: v.string(),
    name_ar: v.string(),
    name_fr: v.optional(v.string()),
    specialty: v.string(), // e.g., "general", "cardiology", "dentist"
    specialty_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.string(),
    wilaya: v.string(), // Algerian state/province
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    workingHours: v.optional(
      v.array(
        v.object({
          day: v.string(), // "sunday" | "monday" | etc.
          open: v.string(), // "09:00"
          close: v.string(), // "17:00"
          isClosed: v.optional(v.boolean()),
        })
      )
    ),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    consultationFee: v.optional(v.number()),
    languages: v.optional(v.array(v.string())), // ["ar", "fr", "en"]
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_specialty", ["specialty"])
    .index("by_wilaya", ["wilaya"])
    .index("by_type_and_specialty", ["type", "specialty"])
    .index("by_wilaya_and_specialty", ["wilaya", "specialty"])
    .searchIndex("search_doctors", {
      searchField: "name_en",
      filterFields: ["type", "specialty", "wilaya"],
    }),

  // Availability schedules for doctors
  availabilitySchedules: defineTable({
    doctorId: v.id("doctors"),
    date: v.string(), // "2024-01-15"
    slots: v.array(
      v.object({
        time: v.string(), // "09:00"
        isAvailable: v.boolean(),
        appointmentId: v.optional(v.id("appointments")),
      })
    ),
  })
    .index("by_doctorId", ["doctorId"])
    .index("by_doctorId_and_date", ["doctorId", "date"]),

  // Appointments
  appointments: defineTable({
    userId: v.id("users"),
    doctorId: v.id("doctors"),
    date: v.string(), // "2024-01-15"
    time: v.string(), // "09:00"
    status: v.string(), // "pending" | "confirmed" | "completed" | "cancelled" | "no_show"
    type: v.optional(v.string()), // "consultation" | "followup" | "checkup"
    notes: v.optional(v.string()),
    symptomAnalysisId: v.optional(v.id("symptomAnalyses")),
    cancellationReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_doctorId", ["doctorId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_doctorId_and_date", ["doctorId", "date"])
    .index("by_status", ["status"]),

  // Digital Health Cards
  healthCards: defineTable({
    userId: v.id("users"),
    cardNumber: v.string(), // "TBR-XXX-XXX"
    bloodType: v.optional(v.string()), // "A+" | "A-" | "B+" | etc.
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
    emergencyAccessPin: v.optional(v.string()), // Hashed PIN for emergency access
    sharePermissions: v.optional(
      v.array(
        v.object({
          doctorId: v.id("doctors"),
          grantedAt: v.number(),
          expiresAt: v.optional(v.number()),
        })
      )
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_cardNumber", ["cardNumber"]),

  // Medical Records (attached to health cards)
  medicalRecords: defineTable({
    userId: v.id("users"),
    healthCardId: v.id("healthCards"),
    type: v.string(), // "prescription" | "lab_result" | "diagnosis" | "vaccination" | "surgery" | "note"
    title: v.string(),
    title_ar: v.optional(v.string()),
    description: v.optional(v.string()),
    recordDate: v.string(), // "2024-01-15"
    doctorId: v.optional(v.id("doctors")),
    doctorName: v.optional(v.string()),
    // For prescriptions
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
    // For lab results
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
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_healthCardId", ["healthCardId"])
    .index("by_userId_and_type", ["userId", "type"]),

  // AI Symptom Analysis History
  symptomAnalyses: defineTable({
    userId: v.optional(v.id("users")), // Optional for anonymous users
    sessionId: v.optional(v.string()), // For anonymous sessions
    symptoms: v.string(), // User's symptom description
    language: v.string(), // "ar" | "en" | "fr"
    analysis: v.object({
      possibleConditions: v.array(
        v.object({
          name: v.string(),
          name_ar: v.optional(v.string()),
          probability: v.string(), // "high" | "medium" | "low"
          description: v.optional(v.string()),
        })
      ),
      recommendedSpecialty: v.string(),
      recommendedSpecialty_ar: v.optional(v.string()),
      urgencyLevel: v.string(), // "emergency" | "urgent" | "routine" | "self_care"
      generalAdvice: v.optional(v.string()),
      generalAdvice_ar: v.optional(v.string()),
      disclaimer: v.string(),
    }),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  // Doctor Reviews
  reviews: defineTable({
    userId: v.id("users"),
    doctorId: v.id("doctors"),
    appointmentId: v.optional(v.id("appointments")),
    rating: v.number(), // 1-5
    content: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()), // Verified appointment
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_doctorId", ["doctorId"])
    .index("by_userId", ["userId"])
    .index("by_doctorId_and_rating", ["doctorId", "rating"]),

  // AI Training Data - knowledge base for symptom analysis
  aiTrainingData: defineTable({
    category: v.string(), // "symptoms" | "conditions" | "specialties" | "medications" | "general"
    title: v.string(),
    title_ar: v.optional(v.string()),
    content: v.string(), // Main training content
    content_ar: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())), // For search/matching
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      lastReviewed: v.optional(v.string()),
      specialty: v.optional(v.string()),
    })),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_isActive", ["isActive"])
    .searchIndex("search_training", {
      searchField: "content",
      filterFields: ["category", "isActive"],
    }),
});
