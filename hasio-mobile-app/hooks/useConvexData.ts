import { useQuery, useMutation } from "convex/react";
import { api } from "@/backend";
import { useConvexAuth } from "convex/react";
import type { Lodging, ListingDetails } from "@/types";

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
  // Stay pricing. A hotel is only bookable once `pricePerNight` is set — the
  // backend's `isBookableStay` gates on exactly this.
  pricePerNight?: number;
  currency?: string;
  maxGuests?: number;
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

/**
 * The contact and location fields the cards don't show.
 *
 * Every key is dropped when empty rather than passed through as "", so the
 * detail sheet can decide what to render by presence alone instead of every
 * caller re-checking for blank strings.
 */
function toDetails(l: ConvexListing): ListingDetails {
  return {
    address: l.address || undefined,
    phone: l.phone || undefined,
    email: l.email || undefined,
    website: l.website || undefined,
    coordinates: l.coordinates,
    workingHours: l.workingHours?.length ? l.workingHours : undefined,
  };
}

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
    // Carried through undefined rather than defaulted: the Book button keys off
    // its absence, so a 0 here would offer a free night.
    pricePerNight: l.pricePerNight,
    currency: l.currency,
    maxGuests: l.maxGuests,
    rating: l.rating || 0,
    images: l.images || [],
    amenities: l.amenities || [],
    amenitiesAr: l.amenities || [], // Same for now
    description: l.description_en || "",
    descriptionAr: l.description_ar || "",
    owner_id: l.ownerId || null,
    status: l.status as Lodging["status"],
    details: toDetails(l),
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
        // Carried so the home filter can narrow destinations by place; the
        // subtitle above is the category, not a location.
        city: l.city,
        image: l.images?.[0] || "",
        featured: (l.rating || 0) >= 4.5,
        // Carried so a tapped destination can open the same detail sheet as a
        // hotel or a restaurant instead of being a dead end.
        images: l.images || [],
        description: l.description_en || "",
        descriptionAr: l.description_ar || "",
        rating: l.rating || 0,
        owner_id: l.ownerId || null,
        details: toDetails(l),
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
  const { destinations, isLoading: destinationsLoading } = useDestinations();

  return {
    lodgings,
    destinations,
    isLoading: lodgingsLoading || destinationsLoading,
  };
}

/**
 * The cities that actually have public listings, with their counts.
 *
 * Driven off the data rather than a hardcoded list on purpose: a filter that
 * offers a city with nothing in it is worse than one that does not offer it.
 */
export function useCities() {
  const cities = useQuery(api.listings.queries.getCities, {});
  return { cities: cities || [], isLoading: cities === undefined };
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
