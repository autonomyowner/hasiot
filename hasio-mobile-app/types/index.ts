// Language
export type Language = "en" | "ar";

// User Types
export type UserType = "user" | "business" | "provider" | "admin";
export type ApprovalStatus = "pending" | "approved" | "rejected";

// Service Types
export type ServiceType =
  | "tour_guide"
  | "photographer"
  | "driver"
  | "translator"
  | "event_planner"
  | "catering"
  | "equipment_rental"
  | "other";

// Destination Categories
export type DestinationCategory =
  | "historical"
  | "natural"
  | "cultural"
  | "recreational"
  | "religious";

// Price Units
export type PriceUnit = "per_hour" | "per_day" | "per_event" | "fixed";

// Profile Interface
export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  language: Language;
  user_type: UserType;
  is_verified: boolean;
  business_name: string | null;
  business_name_ar: string | null;
  phone: string | null;
  bio: string | null;
  bio_ar: string | null;
  created_at: string;
  updated_at: string;
}

// Lodging Types
/**
 * The fields a card doesn't show but a detail view needs.
 *
 * Grouped rather than spread across the three listing types: they come from the
 * same Convex record and are read by one shared detail sheet, so keeping them
 * together means adding a field touches one interface instead of three.
 */
export interface ListingDetails {
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  coordinates?: { lat: number; lng: number };
  workingHours?: {
    day: string;
    open: string;
    close: string;
    isClosed?: boolean;
  }[];
}

export type LodgingType = "hotel" | "apartment" | "camp" | "homestay";

export interface Lodging {
  id: string;
  name: string;
  nameAr: string;
  type: LodgingType;
  city: string;
  cityAr: string;
  neighborhood: string;
  neighborhoodAr: string;
  priceRange: string;
  /**
   * SAR per night. Absent on any listing a host has not priced — and a listing
   * with no nightly rate cannot be booked, only browsed, because `priceRange`
   * is free-text display copy ("$$$") that cannot be multiplied by nights.
   */
  pricePerNight?: number;
  currency?: string;
  maxGuests?: number;
  rating: number;
  images: string[];
  amenities: string[];
  amenitiesAr: string[];
  description: string;
  descriptionAr: string;
  owner_id?: string | null;
  status?: ApprovalStatus;
  details?: ListingDetails;
}

// Food Types
export type FoodCategory = "restaurant" | "home_kitchen" | "fastfood" | "drinks";

export interface Food {
  id: string;
  name: string;
  nameAr: string;
  category: FoodCategory;
  cuisine: string;
  cuisineAr: string;
  avgPrice: string;
  hours: string;
  images: string[];
  description: string;
  descriptionAr: string;
  rating: number;
  owner_id?: string | null;
  status?: ApprovalStatus;
  details?: ListingDetails;
}

// Event Types
export type EventCategory = "festival" | "conference" | "outdoor" | "indoor" | "seasonal";

export interface Event {
  id: string;
  title: string;
  titleAr: string;
  category: EventCategory;
  date: string;
  time: string;
  location: string;
  locationAr: string;
  images: string[];
  description: string;
  descriptionAr: string;
  owner_id?: string | null;
  status?: ApprovalStatus;
  details?: ListingDetails;
}

// Plan Types
export interface PlanItem {
  id: string;
  time: string;
  type: "lodging" | "food" | "event";
  refId: string;
  note: string;
}

export interface DayPlan {
  id: string;
  date: string;
  items: PlanItem[];
}

// Moment Type
export interface Moment {
  id: string;
  // Null when the stored file behind the moment can no longer be resolved. The
  // record still carries its note and date, so the card shows its placeholder
  // rather than the moment disappearing.
  image: string | null;
  note: string;
  location?: string;
  timestamp: string;
}

// User Types
export interface User {
  name: string;
  email: string;
  phone: string;
}

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthState {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AuthUser | null;
}

// Chat Message Type
export interface ChatMessage {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
  /** Set only on a finished plan, and rendered as a PlanCard. `text` keeps the
   *  flattened copy because the conversation history sent back to the AI is
   *  plain text. */
  plan?: { itinerary: string; tips?: string; budget?: string };
}

// Filter Types
export type LodgingFilter = "all" | LodgingType;
export type FoodFilter = "all" | FoodCategory;
export type EventFilter = "all" | EventCategory;
export type DestinationFilter = "all" | DestinationCategory;
export type ServiceFilter = "all" | ServiceType;

// Destination Interface
export interface Destination {
  id: string;
  owner_id: string;
  name: string;
  nameAr: string;
  category: DestinationCategory;
  city: string;
  cityAr: string;
  address: string | null;
  addressAr: string | null;
  latitude: number | null;
  longitude: number | null;
  images: string[];
  description: string | null;
  descriptionAr: string | null;
  rating: number;
  status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}

// Service Interface
export interface Service {
  id: string;
  owner_id: string;
  title: string;
  titleAr: string;
  service_type: ServiceType;
  description: string;
  descriptionAr: string;
  price_range: string;
  price_unit: PriceUnit;
  availability: string | null;
  availabilityAr: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  images: string[];
  languages: string[];
  rating: number;
  status: ApprovalStatus;
  created_at: string;
  updated_at: string;
}
