import { useEffect, useMemo } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { cityLabel } from "@/constants/cities";
import { categoryLabel } from "@/constants/categories";
import { useAppStore } from "@/stores/appStore";
import {
  filterServicesByQuery,
  localServicesFor,
  mergeById,
  sortServicesForBrowse,
} from "@/lib/serviceDisplay";
import type { Lodging, ListingDetails } from "@/types";
import type { Doc, Id } from "../../convex/_generated/dataModel";

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
export function toDetails(l: ConvexListing): ListingDetails {
  return {
    address: l.address || undefined,
    phone: l.phone || undefined,
    email: l.email || undefined,
    website: l.website || undefined,
    coordinates: l.coordinates,
    workingHours: l.workingHours?.length ? l.workingHours : undefined,
  };
}

/**
 * Which of the four stay kinds a listing's category files it under.
 *
 * The owner's form writes `apartment`, `camp`, `homestay` or `hotel`; the seed
 * writes the longer hotel grades. This used to recognise only
 * `serviced_apartment` and `desert_camp` — which nothing writes — so an owner's
 * apartment or camp was labelled "Hotel" and the Stay tab's Apartments and
 * Camps chips could never show anything.
 */
export function lodgingTypeOf(category: string): Lodging["type"] {
  switch (category) {
    case "apartment":
    case "serviced_apartment":
      return "apartment";
    case "camp":
    case "desert_camp":
      return "camp";
    case "homestay":
      return "homestay";
    default:
      return "hotel";
  }
}

// Adapters: map Convex listing → mobile app types
export function toLodging(l: ConvexListing): Lodging {
  return {
    id: l._id,
    name: l.name_en,
    nameAr: l.name_ar,
    type: lodgingTypeOf(l.category),
    // Folded to the city and written for each reader: stored rows still say
    // "Hofuf", which the filter already calls Al Ahsa, and an Arabic card used
    // to print it in Latin letters because there is no city_ar to fall back on.
    city: cityLabel(l.city, "en"),
    cityAr: cityLabel(l.city, "ar"),
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

function toDestination(l: ConvexListing) {
  return {
    id: l._id,
    name: l.name_en,
    nameAr: l.name_ar,
    // The category as words, not its database key: this is the chip on every
    // Featured and grid card, and it used to read "natural_landmark".
    subtitle: categoryLabel(l.category, "en"),
    subtitleAr: categoryLabel(l.category, "ar", l.category_ar),
    // Which of the three this is, so the home chips can filter locally.
    kind: l.type as "attraction" | "tour" | "event",
    // Folded and localised for display; `canonicalCity` of either label is
    // still the key the home filter compares against.
    city: cityLabel(l.city, "en"),
    cityAr: cityLabel(l.city, "ar"),
    image: l.images?.[0] || "",
    // Carried so a tapped destination can open the same detail sheet as a
    // hotel or a restaurant instead of being a dead end.
    images: l.images || [],
    description: l.description_en || "",
    descriptionAr: l.description_ar || "",
    rating: l.rating || 0,
    // The tie-break behind `rating` when the home screen picks its
    // featured five: 5.0 from one review is not better than 4.8 from forty.
    reviewCount: l.reviewCount || 0,
    owner_id: l.ownerId || null,
    details: toDetails(l),
  };
}

export type Destination = ReturnType<typeof toDestination>;

/**
 * Hook to get lodgings from Convex
 *
 * The mapping is memoised on the query result. Convex hands back the same
 * array until the data changes, so this keeps each card's props stable across
 * renders — every screen's own `useMemo` downstream of it used to recompute on
 * each keystroke, because this built a fresh array every time it ran.
 */
export function useLodgings(type?: Lodging["type"]) {
  const listings = useQuery(api.listings.queries.listListings, {
    type: "hotel",
  });

  const all = useMemo(() => (listings ? listings.map(toLodging) : []), [listings]);
  const lodgings = useMemo(
    () => (type ? all.filter((l) => l.type === type) : all),
    [all, type]
  );

  return {
    lodgings,
    isLoading: listings === undefined,
    isUsingMockData: false,
  };
}

/**
 * Everything on the home screen that is not somewhere to sleep: attractions,
 * tours and events, in one list.
 *
 * One unfiltered query rather than one per type. The public set is ~56 rows and
 * the server already caps and filters it, so three subscriptions to show three
 * kinds side by side would cost more than the whole table. `kind` is carried
 * through so the screen's chips can narrow the pool without another round trip.
 */
export function useDestinations() {
  const listings = useQuery(api.listings.queries.listListings, {});

  const destinations = useMemo(
    () =>
      listings
        ? listings
            .filter(
              (l) => l.type === "attraction" || l.type === "tour" || l.type === "event"
            )
            .map(toDestination)
        : [],
    [listings]
  );

  return {
    destinations,
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
 * A service as the traveller's screens read it.
 *
 * Flattened from the public service queries, which return the stored document
 * plus `bookable` (and, from `getService`, the provider). Blank optional text
 * is dropped rather than passed through as "", so the sheet decides what to
 * show by presence alone, as `toDetails` does for listings.
 */
export interface ServiceItem {
  id: string;
  ownerId: string;
  serviceType: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  /** Whole SAR per `priceUnit`. Absent, the service offers Contact instead of Book. */
  price?: number;
  priceUnit?: string;
  /** People per booking; absent means the server's default of 20. */
  maxGroupSize?: number;
  /** As stored, which may be a sub-area ("Hofuf"): show it through `cityLabel`. */
  city?: string;
  images: string[];
  languages: string[];
  availability: string;
  availabilityAr: string;
  contactPhone?: string;
  contactEmail?: string;
  /** 0 until someone has rated it — never shown as a score. */
  rating: number;
  reviewCount: number;
  /** Approved, priced, and offered by an approved provider (the server's isBookableService). */
  bookable: boolean;
  createdAt: number;
}

type ConvexServiceRow = Doc<"services"> & { bookable: boolean };

export function toServiceItem(s: ConvexServiceRow): ServiceItem {
  return {
    id: s._id,
    ownerId: s.ownerId,
    serviceType: s.serviceType,
    title: s.title_en,
    titleAr: s.title_ar,
    description: s.description_en || "",
    descriptionAr: s.description_ar || "",
    // Carried through undefined rather than defaulted: Book keys off the price
    // being there, so a 0 here would offer a free hour.
    price: s.price,
    priceUnit: s.priceUnit,
    maxGroupSize: s.maxGroupSize,
    city: s.city?.trim() || undefined,
    images: s.images || [],
    languages: (s.languages || []).filter((language) => language.trim()),
    availability: s.availability_en || "",
    availabilityAr: s.availability_ar || "",
    contactPhone: s.contactPhone?.trim() || undefined,
    contactEmail: s.contactEmail?.trim() || undefined,
    rating: s.rating || 0,
    reviewCount: s.reviewCount || 0,
    bookable: s.bookable,
    createdAt: s.createdAt,
  };
}

/**
 * Every public service, in browse order.
 *
 * `listServices({})` exactly — the Book tab's unfiltered list, its type chips
 * and Home's "Local services" row all ask with these same arguments, so Convex
 * holds one subscription for the three. Memoised on the query result, like the
 * listing hooks, so the rows' identities hold between renders.
 */
export function useAllServices() {
  const rows = useQuery(api.services.queries.listServices, {});
  const services = useMemo(
    () => (rows ? sortServicesForBrowse(rows.map(toServiceItem)) : []),
    [rows]
  );
  return { services, isLoading: rows === undefined };
}

/** Home's row: at most ten, the ones that can be booked first. */
export function useLocalServices() {
  const { services, isLoading } = useAllServices();
  const local = useMemo(() => localServicesFor(services), [services]);
  return { services: local, isLoading };
}

/**
 * The Book tab's services, narrowed by type, city and a search.
 *
 * Type and city are filtered on the server, which folds a city's sub-areas
 * ("Hofuf" is Al Ahsa). A search runs two ways at once and is merged: the
 * server's `searchServices` over both titles, and the same folded matching
 * Home uses over the rows already here — the search index does not fold
 * Arabic spelling, so «الاحساء» typed without its hamza finds nothing there,
 * and it cannot match a service by what it is ("photographer", «مصور») or
 * where. Server hits need two characters; the local match starts at one.
 */
export function useServiceList(filters: {
  serviceType: string | null;
  city: string | null;
  search: string;
}) {
  const narrow = {
    ...(filters.serviceType ? { serviceType: filters.serviceType } : {}),
    ...(filters.city ? { city: filters.city } : {}),
  };
  const rows = useQuery(api.services.queries.listServices, narrow);
  const term = filters.search.trim();
  const hits = useQuery(
    api.services.queries.searchServices,
    term.length >= 2 ? { searchQuery: term, ...narrow } : "skip"
  );

  const base = useMemo(() => (rows ? rows.map(toServiceItem) : []), [rows]);
  const found = useMemo(() => (hits ? hits.map(toServiceItem) : []), [hits]);
  const services = useMemo(
    () =>
      sortServicesForBrowse(term ? mergeById(filterServicesByQuery(base, term), found) : base),
    [base, found, term]
  );

  return { services, isLoading: rows === undefined };
}

type Listing = Doc<"listings">;

/**
 * Everything saved, newest first, for the Favorites tab.
 *
 * A signed-in account's favourites live on the server. A guest's live on the
 * device (the heart works without an account), and used to be shown nowhere:
 * this hook skipped the server query for a guest and returned nothing, so the
 * tab said "No favorites yet" under a row of red hearts. A guest's ids are now
 * resolved against the public listings — the same `listListings({})`
 * subscription Home already holds, so it costs no extra round trip.
 */
export function useFavorites() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const serverFavorites = useQuery(
    api.users.queries.getFavorites,
    isAuthenticated ? {} : "skip"
  );
  const localIds = useAppStore((state) => state.favorites);
  const needsPublic = !authLoading && !isAuthenticated && localIds.length > 0;
  const publicListings = useQuery(
    api.listings.queries.listListings,
    needsPublic ? {} : "skip"
  );

  const favorites = useMemo<Listing[]>(() => {
    if (isAuthenticated) {
      // The server keeps them in the order they were added; the newest is
      // the one a guest is most likely looking for.
      return (serverFavorites ?? [])
        .filter((l): l is Listing => l != null)
        .reverse();
    }
    if (!publicListings) return [];
    const byId = new Map(publicListings.map((l) => [l._id as string, l]));
    return localIds
      .map((id) => byId.get(id))
      .filter((l): l is Listing => l != null)
      .reverse();
  }, [isAuthenticated, serverFavorites, publicListings, localIds]);

  // Loading until the answer is known, including while auth itself is still
  // settling — otherwise "No favorites yet" flashed before a signed-in list.
  const isLoading =
    authLoading ||
    (isAuthenticated ? serverFavorites === undefined : needsPublic && publicListings === undefined);

  return { favorites, isLoading };
}

/**
 * The ids of everything saved, for the hearts on the cards: the server's for
 * an account, the device's for a guest.
 */
export function useFavoriteIds(): Set<string> {
  const { isAuthenticated } = useConvexAuth();
  const serverFavorites = useQuery(
    api.users.queries.getFavorites,
    isAuthenticated ? {} : "skip"
  );
  const localIds = useAppStore((state) => state.favorites);

  return useMemo(() => {
    if (isAuthenticated) {
      return new Set(
        (serverFavorites ?? []).filter((l): l is Listing => l != null).map((l) => l._id as string)
      );
    }
    return new Set(localIds);
  }, [isAuthenticated, serverFavorites, localIds]);
}

/**
 * Save or unsave a listing.
 *
 * For an account the change is applied to the local query results at once,
 * then confirmed by the server — the heart used to wait out a network round
 * trip before it turned red, so people tapped it again and the second tap
 * undid the first. The added listing is found in whichever cached listing
 * query already holds it, which is every screen that shows a heart.
 *
 * Rejects when the server refuses (the favourites cap, a deleted listing), so
 * the caller can say so; the optimistic change is rolled back by Convex.
 */
export function useToggleFavorite() {
  const { isAuthenticated } = useConvexAuth();
  const addLocal = useAppStore((state) => state.addFavorite);
  const removeLocal = useAppStore((state) => state.removeFavorite);
  const toggleOnServer = useMutation(api.users.mutations.toggleFavorite).withOptimisticUpdate(
    (localStore, { listingId }) => {
      const current = localStore.getQuery(api.users.queries.getFavorites, {});
      if (current === undefined) return;
      const saved = current.some((l) => l?._id === listingId);
      if (saved) {
        localStore.setQuery(
          api.users.queries.getFavorites,
          {},
          current.filter((l) => l?._id !== listingId)
        );
        return;
      }
      for (const { value } of localStore.getAllQueries(api.listings.queries.listListings)) {
        const listing = value?.find((l) => l._id === listingId);
        if (listing) {
          localStore.setQuery(api.users.queries.getFavorites, {}, [...current, listing]);
          return;
        }
      }
    }
  );

  return async (listingId: string, currentlySaved: boolean) => {
    if (!isAuthenticated) {
      if (currentlySaved) removeLocal(listingId);
      else addLocal(listingId);
      return;
    }
    await toggleOnServer({ listingId: listingId as Id<"listings"> });
  };
}

/**
 * Carry a guest's hearts into the account they sign in to.
 *
 * Without this, signing in made every heart a guest had set disappear: the
 * cards switch to the server's list, which knew nothing of them. Runs once the
 * account's own list has loaded, adds only what is missing — the server's
 * mutation toggles, so re-sending something already saved would remove it —
 * and clears the device's list *first*, so a re-render while the additions are
 * in flight cannot send any of them twice.
 */
export function useMergeGuestFavorites() {
  const { isAuthenticated } = useConvexAuth();
  const serverFavorites = useQuery(
    api.users.queries.getFavorites,
    isAuthenticated ? {} : "skip"
  );
  const localIds = useAppStore((state) => state.favorites);
  const clearLocal = useAppStore((state) => state.clearFavorites);
  const toggleFavorite = useMutation(api.users.mutations.toggleFavorite);

  useEffect(() => {
    if (!isAuthenticated || serverFavorites === undefined || localIds.length === 0) return;
    const saved = new Set(
      serverFavorites.filter((l): l is Listing => l != null).map((l) => l._id as string)
    );
    const missing = localIds.filter((id) => !saved.has(id));
    clearLocal();
    for (const id of missing) {
      // Best effort: a listing deleted since, or the favourites cap, is not
      // worth interrupting a sign-in over.
      toggleFavorite({ listingId: id as Id<"listings"> }).catch(() => {});
    }
  }, [isAuthenticated, serverFavorites, localIds, clearLocal, toggleFavorite]);
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
