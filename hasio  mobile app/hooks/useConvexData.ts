import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex";
import { useConvexAuth } from "convex/react";
import type { Lodging, Food, Event } from "@/types";

// Type for Convex listing documents
type ConvexListing = {
  _id: string;
  _creationTime: number;
  type: string;
  name_en: string;
  name_ar: string;
  category: string;
  category_ar?: string;
  description_en?: string;
  description_ar?: string;
  address: string;
  city: string;
  region?: string;
  coordinates: { lat: number; lng: number };
  phone?: string;
  email?: string;
  website?: string;
  priceRange?: string;
  amenities?: string[];
  images?: string[];
  ownerId?: string;
  workingHours?: { day: string; open: string; close: string; isClosed?: boolean }[];
  rating?: number;
  reviewCount?: number;
  isVerified?: boolean;
  isActive?: boolean;
  status?: string;
  createdAt: number;
  updatedAt: number;
};

// Adapters: map Convex listing → mobile app types
function toLodging(l: ConvexListing): Lodging {
  return {
    id: l._id,
    name: l.name_en,
    nameAr: l.name_ar,
    type: (l.category === "luxury_hotel" || l.category === "budget_hotel" || l.category === "boutique_hotel"
      ? "hotel"
      : l.category === "serviced_apartment"
        ? "apartment"
        : l.category === "desert_camp"
          ? "camp"
          : l.category === "homestay"
            ? "homestay"
            : "hotel") as Lodging["type"],
    city: l.city,
    cityAr: l.city, // Convex doesn't have city_ar, use city
    neighborhood: l.region || l.city,
    neighborhoodAr: l.region || l.city,
    priceRange: l.priceRange || "",
    rating: l.rating || 0,
    images: l.images || [],
    amenities: l.amenities || [],
    amenitiesAr: l.amenities || [], // Same for now
    description: l.description_en || "",
    descriptionAr: l.description_ar || "",
    owner_id: l.ownerId || null,
    status: l.status as Lodging["status"],
  };
}

function toFood(l: ConvexListing): Food {
  return {
    id: l._id,
    name: l.name_en,
    nameAr: l.name_ar,
    category: (l.category === "traditional_food" || l.category === "fine_dining" || l.category === "seafood"
      ? "restaurant"
      : l.category === "home_kitchen"
        ? "home_kitchen"
        : l.category === "fast_food" || l.category === "street_food"
          ? "fastfood"
          : l.category === "cafe" || l.category === "drinks"
            ? "drinks"
            : "restaurant") as Food["category"],
    cuisine: l.category_ar || l.category,
    cuisineAr: l.category_ar || l.category,
    avgPrice: l.priceRange || "",
    hours: l.workingHours
      ? `${l.workingHours[0]?.open || ""} - ${l.workingHours[0]?.close || ""}`
      : "",
    images: l.images || [],
    description: l.description_en || "",
    descriptionAr: l.description_ar || "",
    rating: l.rating || 0,
    owner_id: l.ownerId || null,
    status: l.status as Food["status"],
  };
}

function toEvent(l: ConvexListing): Event {
  return {
    id: l._id,
    title: l.name_en,
    titleAr: l.name_ar,
    category: (l.category === "festival"
      ? "festival"
      : l.category === "conference"
        ? "conference"
        : l.category === "outdoor_activity" || l.category === "adventure"
          ? "outdoor"
          : l.category === "exhibition" || l.category === "museum"
            ? "indoor"
            : l.category === "seasonal"
              ? "seasonal"
              : "outdoor") as Event["category"],
    date: "",
    time: l.workingHours
      ? `${l.workingHours[0]?.open || ""} - ${l.workingHours[0]?.close || ""}`
      : "",
    location: l.address,
    locationAr: l.address,
    images: l.images || [],
    description: l.description_en || "",
    descriptionAr: l.description_ar || "",
    owner_id: l.ownerId || null,
    status: l.status as Event["status"],
  };
}

/**
 * Hook to get lodgings from Convex
 */
export function useLodgings(type?: Lodging["type"]) {
  const listings = useQuery(api.listings.queries.listListings, {
    type: "hotel",
  });

  const lodgings = listings
    ? listings.map(toLodging).filter((l) => !type || l.type === type)
    : [];

  return {
    lodgings,
    isLoading: listings === undefined,
    isUsingMockData: false,
  };
}

/**
 * Hook to get foods from Convex
 */
export function useFoods(category?: Food["category"]) {
  const listings = useQuery(api.listings.queries.listListings, {
    type: "restaurant",
  });

  const foods = listings
    ? listings.map(toFood).filter((f) => !category || f.category === category)
    : [];

  return {
    foods,
    isLoading: listings === undefined,
    isUsingMockData: false,
  };
}

/**
 * Hook to get events from Convex
 */
export function useEvents(category?: Event["category"]) {
  const listings = useQuery(api.listings.queries.listListings, {
    type: "event",
  });

  const events = listings
    ? listings.map(toEvent).filter((e) => !category || e.category === category)
    : [];

  return {
    events,
    isLoading: listings === undefined,
    isUsingMockData: false,
  };
}

/**
 * Hook to get destinations (attractions) from Convex
 */
export function useDestinations(featured?: boolean) {
  const listings = useQuery(api.listings.queries.listListings, {
    type: "attraction",
  });

  const destinations = listings
    ? listings.map((l) => ({
        id: l._id,
        name: l.name_en,
        nameAr: l.name_ar,
        subtitle: l.category,
        subtitleAr: l.category_ar || l.category,
        image: l.images?.[0] || "",
        featured: (l.rating || 0) >= 4.5,
      }))
    : [];

  const filtered =
    featured !== undefined
      ? destinations.filter((d) => d.featured === featured)
      : destinations;

  return {
    destinations: filtered,
    isLoading: listings === undefined,
    isUsingMockData: false,
  };
}

/**
 * Hook to get all data for home screen
 */
export function useHomeData() {
  const { lodgings, isLoading: lodgingsLoading } = useLodgings();
  const { foods, isLoading: foodsLoading } = useFoods();
  const { events, isLoading: eventsLoading } = useEvents();
  const { destinations, isLoading: destinationsLoading } = useDestinations();

  return {
    lodgings,
    foods,
    events,
    destinations,
    isLoading: lodgingsLoading || foodsLoading || eventsLoading || destinationsLoading,
  };
}

/**
 * Hook to search listings
 */
export function useSearchListings(query: string, type?: string) {
  const results = useQuery(
    api.listings.queries.searchListings,
    query.length >= 2 ? { searchQuery: query, type } : "skip"
  );

  return {
    results: results || [],
    isLoading: query.length >= 2 && results === undefined,
  };
}

/**
 * Hook to get user's favorites from Convex
 */
export function useFavorites() {
  const { isAuthenticated } = useConvexAuth();
  const favorites = useQuery(
    api.users.queries.getFavorites,
    isAuthenticated ? {} : "skip"
  );

  return {
    favorites: favorites || [],
    isLoading: isAuthenticated && favorites === undefined,
  };
}

/**
 * Hook to toggle a favorite
 */
export function useToggleFavorite() {
  const toggleFavorite = useMutation(api.users.mutations.toggleFavorite);

  return async (listingId: string) => {
    try {
      // listingId from Convex is already the right type
      await toggleFavorite({ listingId: listingId as any });
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
    }
  };
}

/**
 * Hook to get user's bookings
 */
export function useBookings() {
  const { isAuthenticated } = useConvexAuth();
  const bookings = useQuery(
    api.bookings.queries.getUserBookings,
    isAuthenticated ? {} : "skip"
  );

  return {
    bookings: bookings || [],
    isLoading: isAuthenticated && bookings === undefined,
  };
}

/**
 * Hook to get user's trips
 */
export function useTrips() {
  const { isAuthenticated } = useConvexAuth();
  const trips = useQuery(
    api.trips.queries.getMyTrips,
    isAuthenticated ? {} : "skip"
  );

  return {
    trips: trips || [],
    isLoading: isAuthenticated && trips === undefined,
  };
}

/**
 * Hook to get user's travel plans
 */
export function useTravelPlans() {
  const { isAuthenticated } = useConvexAuth();
  const plans = useQuery(
    api.travelPlanner.queries.getMyPlans,
    isAuthenticated ? {} : "skip"
  );

  return {
    plans: plans || [],
    isLoading: isAuthenticated && plans === undefined,
  };
}
