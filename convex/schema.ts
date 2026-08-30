import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users table
  users: defineTable({
    email: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phone: v.optional(v.string()),
    preferredLanguage: v.optional(v.string()), // "ar" | "en"
    role: v.optional(v.string()), // "tourist" | "business_owner" | "service_provider" | "admin"
    businessType: v.optional(v.string()), // for business_owner/service_provider
    isApproved: v.optional(v.boolean()), // for business accounts — default false, requires admin approval
    cvFileId: v.optional(v.id("_storage")), // Business license/doc uploaded for admin review
    city: v.optional(v.string()), // Saudi city
    favoriteListingIds: v.optional(v.array(v.id("listings"))),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"])
    .index("by_role_and_approval", ["role", "isApproved"]),

  // Listings (hotels, restaurants, attractions, events, tours)
  listings: defineTable({
    type: v.string(), // "hotel" | "restaurant" | "attraction" | "event" | "tour"
    name_en: v.string(),
    name_ar: v.string(),
    category: v.string(), // e.g., "luxury_hotel", "traditional_food", "historical_site"
    category_ar: v.optional(v.string()),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    address: v.string(),
    city: v.string(), // Saudi city
    region: v.optional(v.string()), // Saudi region
    coordinates: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    priceRange: v.optional(v.string()), // "$" | "$$" | "$$$" | "$$$$"
    amenities: v.optional(v.array(v.string())), // e.g., ["wifi", "parking", "pool"]
    images: v.optional(v.array(v.string())), // image URLs
    ownerId: v.optional(v.id("users")), // linked business owner
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
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    languages: v.optional(v.array(v.string())),
    isVerified: v.optional(v.boolean()),
    isActive: v.optional(v.boolean()),
    status: v.optional(v.string()), // "pending" | "approved" | "rejected" — undefined = approved (seed data)
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_type", ["type"])
    .index("by_category", ["category"])
    .index("by_city", ["city"])
    .index("by_type_and_category", ["type", "category"])
    .index("by_city_and_category", ["city", "category"])
    .index("by_ownerId", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_owner_and_status", ["ownerId", "status"])
    .searchIndex("search_listings", {
      searchField: "name_en",
      filterFields: ["type", "category", "city"],
    })
    // The admin panel searches by the Arabic name too, and a Convex search index
    // covers exactly one field. The public app keeps using search_listings.
    .searchIndex("search_listings_ar", {
      searchField: "name_ar",
      filterFields: ["type", "city", "status"],
    }),

  // Freelancer services (photographers, drivers, guides, etc.)
  services: defineTable({
    ownerId: v.id("users"),
    serviceType: v.string(), // "tour_guide" | "photographer" | "driver" | "translator" | "event_planner" | "catering" | "equipment_rental" | "other"
    title_en: v.string(),
    title_ar: v.string(),
    description_en: v.optional(v.string()),
    description_ar: v.optional(v.string()),
    priceRange: v.optional(v.string()), // e.g., "100-200 SAR"
    priceUnit: v.optional(v.string()), // "per_hour" | "per_day" | "per_event" | "fixed"
    availability_en: v.optional(v.string()),
    availability_ar: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    languages: v.optional(v.array(v.string())),
    images: v.optional(v.array(v.string())),
    city: v.optional(v.string()),
    region: v.optional(v.string()),
    coordinates: v.optional(v.object({
      lat: v.number(),
      lng: v.number(),
    })),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    status: v.string(), // "pending" | "approved" | "rejected"
    rejectionReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_status", ["status"])
    .index("by_serviceType", ["serviceType"])
    .index("by_owner_and_status", ["ownerId", "status"])
    .searchIndex("search_services", {
      searchField: "title_en",
      filterFields: ["serviceType", "city"],
    }),

  // Availability schedules for listings
  availabilitySchedules: defineTable({
    listingId: v.id("listings"),
    date: v.string(), // "2024-01-15"
    slots: v.array(
      v.object({
        time: v.string(),
        isAvailable: v.boolean(),
        bookingId: v.optional(v.id("bookings")),
      })
    ),
  })
    .index("by_listingId", ["listingId"])
    .index("by_listingId_and_date", ["listingId", "date"]),

  // Bookings
  bookings: defineTable({
    userId: v.id("users"),
    listingId: v.id("listings"),
    date: v.string(),
    time: v.string(),
    status: v.string(), // "pending" | "confirmed" | "completed" | "cancelled"
    type: v.optional(v.string()), // "reservation" | "tour_booking" | "event_ticket"
    partySize: v.optional(v.number()),
    notes: v.optional(v.string()),
    travelPlanId: v.optional(v.id("travelPlans")),
    cancellationReason: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_listingId", ["listingId"])
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_listingId_and_date", ["listingId", "date"])
    .index("by_status", ["status"]),

  // AI Travel Plans
  travelPlans: defineTable({
    userId: v.optional(v.id("users")),
    sessionId: v.optional(v.string()),
    userInput: v.string(), // User's travel query
    language: v.string(), // "ar" | "en"
    plan: v.object({
      suggestedDestinations: v.array(
        v.object({
          name: v.string(),
          name_ar: v.optional(v.string()),
          type: v.string(), // "city" | "attraction" | "hotel" | "restaurant"
          description: v.optional(v.string()),
        })
      ),
      itinerary: v.optional(v.string()),
      travelTips: v.optional(v.string()),
      travelTips_ar: v.optional(v.string()),
      estimatedBudget: v.optional(v.string()),
      estimatedBudget_ar: v.optional(v.string()),
      disclaimer: v.string(),
    }),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_sessionId", ["sessionId"]),

  // Trips (user-created itineraries)
  trips: defineTable({
    userId: v.id("users"),
    title: v.string(),
    title_ar: v.optional(v.string()),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
    status: v.string(), // "planning" | "active" | "completed"
    sourcePlanId: v.optional(v.id("travelPlans")),
    stops: v.array(v.object({
      listingId: v.id("listings"),
      date: v.optional(v.string()),
      time: v.optional(v.string()),
      notes: v.optional(v.string()),
      order: v.number(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_and_status", ["userId", "status"]),

  // Reviews
  reviews: defineTable({
    userId: v.id("users"),
    listingId: v.id("listings"),
    bookingId: v.optional(v.id("bookings")),
    rating: v.number(), // 1-5
    content: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    isVerified: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listingId", ["listingId"])
    .index("by_userId", ["userId"])
    .index("by_listingId_and_rating", ["listingId", "rating"]),

  // Email captures (early access signups)
  emailCaptures: defineTable({
    email: v.string(),
    source: v.optional(v.string()), // "home_banner", "footer", etc.
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),

  // Personal travel moments — private to their author, never a public feed.
  // The image is a Convex storage id rather than a device path: the previous
  // AsyncStorage-only version stored the raw picker URI, which points into the
  // app's cache directory and is purged by iOS, so saved moments went blank.
  moments: defineTable({
    userId: v.id("users"),
    storageId: v.id("_storage"),
    note: v.optional(v.string()),
    location: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"]),

  // User-submitted content reports (UGC compliance)
  contentReports: defineTable({
    reporterId: v.id("users"),
    targetType: v.string(), // "listing" | "service" | "review"
    targetId: v.string(), // polymorphic — id of listing/service/review
    reason: v.string(), // "spam" | "inappropriate" | "offensive" | "fraud" | "other"
    details: v.optional(v.string()),
    status: v.string(), // "pending" | "reviewed" | "dismissed" | "actioned"
    reviewedByAdminId: v.optional(v.id("users")),
    reviewedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_reporter", ["reporterId"])
    .index("by_status", ["status"]),

  // User blocks — user-to-user hiding (UGC compliance)
  userBlocks: defineTable({
    blockerId: v.id("users"),
    blockedUserId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_blocker", ["blockerId"])
    .index("by_blocker_and_blocked", ["blockerId", "blockedUserId"]),

  // Admin action log. Every write an admin makes through /admin lands here, so
  // "who approved this listing, and when" has an answer. Append-only: nothing in
  // the app or the panel updates or deletes a row.
  adminActivity: defineTable({
    adminId: v.id("users"),
    adminEmail: v.string(),
    action: v.string(), // "listing.create" | "content.approve" | "booking.cancel" | …
    targetType: v.string(), // "listing" | "service" | "user" | "booking" | "knowledge" | "report"
    targetId: v.optional(v.string()), // polymorphic, so stored as a plain string
    summary: v.optional(v.string()), // human label for the target, e.g. the listing name
    details: v.optional(v.string()), // e.g. a rejection reason
    createdAt: v.number(),
  })
    .index("by_target", ["targetType", "targetId"])
    .index("by_admin", ["adminId"])
    .index("by_action", ["action"]),

  // Rate limiting — one row per key (user, session, or global), fixed 24h window
  rateLimits: defineTable({
    key: v.string(), // "user:<id>" | "session:<id>" | "anon:unkeyed" | "global"
    windowStart: v.number(),
    count: v.number(),
  })
    .index("by_key", ["key"]),

  // Travel Knowledge Base — for AI travel planner
  travelKnowledge: defineTable({
    category: v.string(), // "destinations" | "hotels" | "restaurants" | "culture" | "transport" | "tips" | "events" | "general"
    title: v.string(),
    title_ar: v.optional(v.string()),
    content: v.string(),
    content_ar: v.optional(v.string()),
    keywords: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      lastReviewed: v.optional(v.string()),
      region: v.optional(v.string()),
    })),
    isActive: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_category", ["category"])
    .index("by_isActive", ["isActive"])
    .searchIndex("search_knowledge", {
      searchField: "content",
      filterFields: ["category", "isActive"],
    }),
});
