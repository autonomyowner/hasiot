import { categoryColors } from "@/constants/colors";
import type { DetailItem } from "@/components/listing/ListingDetailSheet";
import type { Language, Lodging } from "@/types";

/** What the mapping needs from the screen, so it can stay a pure function. */
export interface DetailLabels {
  language: Language;
  /** The chip for a stay kind or a listing type — `cat_hotel`, `cat_restaurant`… */
  typeLabel: (type: string) => string;
  /** The words after a nightly rate: "per night". */
  perNight: string;
  /** A riyal amount in the viewer's display currency. */
  formatPrice: (amountSar: number) => string;
}

/**
 * Any listing, as the detail sheet shows it — for the screens that hold every
 * kind side by side: Favorites, and the places a finished plan names.
 *
 * `item` has been through `toLodging`, which is shaped for stays and has to
 * file every listing under one of the four stay kinds. On its own that made a
 * favourited restaurant open as "Hotel · $$ per night". `listingType` is the
 * listing's real type, and only a hotel is treated as a stay: its kind for the
 * badge, a nightly rate for the price, and the Book bar once a host has priced
 * it. Anything else wears its own type, shows its price band as a band, and is
 * not bookable.
 *
 * A price band is never "per night", a stay's included: it is the "$$$" a host
 * typed, not a price for a night, and it cannot be multiplied into a quote.
 */
export function listingDetailItem(
  item: Lodging,
  listingType: string,
  labels: DetailLabels
): DetailItem {
  const ar = labels.language === "ar";
  const shared = {
    id: item.id,
    title: ar ? item.nameAr : item.name,
    subtitle: ar ? item.cityAr : item.city,
    rating: item.rating,
    images: item.images,
    description: ar ? item.descriptionAr : item.description,
    amenities: ar ? item.amenitiesAr : item.amenities,
    details: item.details,
    ownerId: item.owner_id,
  };

  if (listingType !== "hotel") {
    return {
      ...shared,
      badge: labels.typeLabel(listingType),
      priceLine: item.priceRange || undefined,
      bookable: false,
    };
  }

  const rate = item.pricePerNight;
  return {
    ...shared,
    badge: labels.typeLabel(item.type),
    badgeColor: categoryColors[item.type],
    priceLine:
      rate != null ? `${labels.formatPrice(rate)} ${labels.perNight}` : item.priceRange || undefined,
    // Only a listing the host has actually priced can be booked: the quote is
    // built from `pricePerNight`, and the band is display copy.
    bookable: rate != null,
    maxGuests: item.maxGuests,
  };
}
