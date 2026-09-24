import { canonicalCity, cityCoordinates } from "@/constants/cities";
import type { TranslationKey } from "@/constants/translations";
import { toLatinDigits } from "./digits";

/**
 * The rules behind the host posting forms (stay, destination, service), kept
 * out of the screens so they can be tested.
 *
 * Most of what is here decides what an *edit* writes to a listing that is
 * already live. The forms used to rebuild every field from what the form could
 * show, which is not the same as what was stored: a seeded hotel's real street
 * address and exact map pin were replaced by "Eastern Province" and a city
 * centre the first time its host changed the price.
 */

// ── Numbers and times a host types ──────────────────────────────────────────

/**
 * A whole number the way a host types it: Arabic-Indic digits, a grouping
 * comma and stray spaces are all fine. Empty means "not given" (`undefined`);
 * anything else that is not a whole number is NaN, which no range passes.
 */
export function parseWholeNumber(raw: string): number | undefined {
  const value = toLatinDigits(raw).replace(/[\s,]/g, "");
  if (value === "") return undefined;
  return /^\d+$/.test(value) ? Number(value) : NaN;
}

export function isWholeInRange(
  value: number | undefined,
  min: number,
  max: number
): boolean {
  return value !== undefined && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * A time as the server stores it. "9:00" becomes "09:00" and an Arabic keypad's
 * "١٥:٠٠" becomes "15:00" — both used to be turned away as "not HH:MM".
 * Anything else comes back trimmed, for `isHHMM` to reject.
 */
export function normaliseTime(raw: string): string {
  const value = toLatinDigits(raw).trim();
  const short = /^(\d):([0-5]\d)$/.exec(value);
  return short ? `0${short[1]}:${short[2]}` : value;
}

export function isHHMM(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

// ── Where a listing is ──────────────────────────────────────────────────────

const PROVINCE_WIDE = [
  /^(the\s+)?eastern(\s+(province|region))?$/i,
  /^ash[\s-]?sharqiy(y)?ah$/i,
  /^(ال)?منطقة\s+الشرقية$/,
  /^الشرقية$/,
];

/**
 * A `region` that names the whole province rather than a neighbourhood in it.
 *
 * Every seeded and admin-made listing stores "Eastern Province" there, and the
 * stay form reads `region` as its Neighborhood field — so a host editing a
 * seeded hotel was shown "Eastern Province" as the neighbourhood, and saving
 * wrote it into the address. Such a region is not prefilled.
 */
export function isProvinceWideRegion(region?: string | null): boolean {
  const value = (region ?? "").trim();
  if (!value) return false;
  return PROVINCE_WIDE.some((pattern) => pattern.test(value));
}

export interface StayLocation {
  city: string;
  neighborhood: string;
}

/** A new listing's location: all three fields, which the schema requires. */
export interface NewLocation {
  address: string;
  region?: string;
  coordinates: { lat: number; lng: number };
}

/** An edit's location: only what changed; `undefined` keeps what is stored. */
export interface LocationFields {
  address?: string;
  region?: string;
  coordinates?: { lat: number; lng: number };
}

/**
 * A new stay's location, derived from the form as it always has been: the
 * neighbourhood (or else the city) as the address, and the city centre as the
 * pin, since there is no map picker.
 */
export function newStayLocation(form: StayLocation): NewLocation {
  const city = form.city.trim();
  const neighborhood = form.neighborhood.trim();
  return {
    address: neighborhood || city,
    region: neighborhood || undefined,
    coordinates: cityCoordinates(city),
  };
}

/**
 * What saving an edited stay writes to its location. `saved` is what the form
 * was filled with when it opened.
 *
 * Only what the host actually changed. Neither form has a map picker, so the
 * only pin a form can produce is a city centre: it replaces the stored pin only
 * when the city itself changes — a neighbourhood edit is no reason to move a
 * precise pin to the middle of town, and the pin is what the detail sheet's
 * Directions button uses. The address and the region follow the city and the
 * neighbourhood, because that is what the form derives them from. An emptied
 * neighbourhood is sent as "" so the stored one is cleared rather than
 * silently kept (the server skips `undefined`).
 */
export function editedStayLocation(saved: StayLocation, form: StayLocation): LocationFields {
  const city = form.city.trim();
  const neighborhood = form.neighborhood.trim();
  // Canonical on both sides: a stored "Hofuf" prefills as "Al Ahsa", which is
  // the same place, not a move.
  const cityChanged = canonicalCity(saved.city) !== canonicalCity(city);
  const neighborhoodChanged = saved.neighborhood.trim() !== neighborhood;

  return {
    address: cityChanged || neighborhoodChanged ? neighborhood || city : undefined,
    region: neighborhoodChanged ? neighborhood : undefined,
    coordinates: cityChanged ? cityCoordinates(city) : undefined,
  };
}

/**
 * A new destination's location. It has an address field of its own rather
 * than a neighbourhood, and a blank one falls back to the city — it used to
 * fall back to the place's own name, so "Ibrahim Palace" was its own address.
 */
export function newPlaceLocation(form: { city: string; address: string }): NewLocation {
  const city = form.city.trim();
  return { address: form.address.trim() || city, coordinates: cityCoordinates(city) };
}

/** An edited destination: the pin moves only with the city, as for a stay. */
export function editedPlaceLocation(
  saved: { city: string },
  form: { city: string; address: string }
): LocationFields {
  const city = form.city.trim();
  const cityChanged = canonicalCity(saved.city) !== canonicalCity(city);
  return {
    address: form.address.trim() || city,
    coordinates: cityChanged ? cityCoordinates(city) : undefined,
  };
}

// ── Photos ──────────────────────────────────────────────────────────────────

/** A photo still on the phone, as opposed to one already in storage. */
export function isLocalPhoto(uri: string): boolean {
  return !/^https?:\/\//i.test(uri);
}

/**
 * The photos to save, in the order the host arranged them, with each local
 * pick swapped for its uploaded URL.
 *
 * The forms used to save "everything already stored, then everything just
 * uploaded", which quietly undid a new photo chosen as the cover.
 * `uploaded` holds one URL per local photo, in the order they appear.
 */
export function withUploadedPhotos(images: string[], uploaded: string[]): string[] {
  let next = 0;
  return images
    .map((uri) => (isLocalPhoto(uri) ? uploaded[next++] : uri))
    .filter((uri): uri is string => typeof uri === "string" && uri.length > 0);
}

/** Add what the picker returned, skipping repeats, up to `max`. */
export function addPhotos(images: string[], picked: string[], max: number): string[] {
  const fresh = picked.filter(
    (uri, index) => !images.includes(uri) && picked.indexOf(uri) === index
  );
  return [...images, ...fresh].slice(0, max);
}

/** Move a photo to the front, which is the cover everywhere it is shown. */
export function makeCover(images: string[], uri: string): string[] {
  if (images[0] === uri || !images.includes(uri)) return images;
  return [uri, ...images.filter((item) => item !== uri)];
}

// ── Text lists and contact details ──────────────────────────────────────────

/**
 * "Arabic، English, French" → three languages. An Arabic keyboard types the
 * Arabic comma (،), which a split on "," alone left inside one long entry.
 */
export function splitList(raw: string): string[] {
  const items = raw
    .split(/[,،]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.filter((item, index) => items.indexOf(item) === index);
}

export function isPlausibleEmail(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());
}

/**
 * Loose on purpose: a provider's contact number may be a landline or a
 * foreign mobile, so this only catches what cannot be dialled at all.
 */
export function isPlausiblePhone(raw: string): boolean {
  const compact = toLatinDigits(raw).replace(/[\s\-().]/g, "");
  return /^\+?\d{7,15}$/.test(compact);
}

// ── Review status ───────────────────────────────────────────────────────────

/**
 * A listing's review status. Seed rows predate the approval flow and carry no
 * status at all, and they are live: treating "no status" as rejected is how
 * a host's live hotel came to be badged "Rejected".
 */
export function ownerStatusOf(status?: string | null): string {
  return status ?? "approved";
}

/** Live now, so an edit — which always goes back to review — takes it down. */
export function isLive(status?: string | null): boolean {
  return ownerStatusOf(status) === "approved";
}

// ── Validation ──────────────────────────────────────────────────────────────

export type FieldErrors<K extends string> = Partial<Record<K, TranslationKey>>;

// The same limits the server enforces (convex/listings/pricing.ts). Checked
// here first so a host hears about them before their photos upload, not after.
export const MAX_PRICE_PER_NIGHT = 100_000;
export const MAX_GUESTS = 20;
export const MAX_UNITS = 500;
export const MAX_PHOTOS = 5;

export interface StayFormValues {
  /** A category key; seeded stays carry finer ones such as "luxury_hotel". */
  type: string;
  name: string;
  nameAr: string;
  city: string;
  neighborhood: string;
  priceRange: string;
  pricePerNight: string;
  maxGuests: string;
  unitCount: string;
  checkInTime: string;
  checkOutTime: string;
  description: string;
  descriptionAr: string;
  amenities: string[];
  images: string[];
}

/**
 * A new stay's form. Two guests and one unit are offered filled in, because a
 * new host is choosing them; an edit never is (see `stayFormFromListing`).
 */
export const EMPTY_STAY_FORM: StayFormValues = {
  type: "hotel",
  name: "",
  nameAr: "",
  city: "",
  neighborhood: "",
  priceRange: "",
  pricePerNight: "",
  maxGuests: "2",
  unitCount: "1",
  checkInTime: "15:00",
  checkOutTime: "12:00",
  description: "",
  descriptionAr: "",
  amenities: [],
  images: [],
};

/** The fields of a stored listing the stay form reads. */
export interface StoredStay {
  category: string;
  name_en?: string;
  name_ar?: string;
  city?: string;
  region?: string;
  priceRange?: string;
  pricePerNight?: number;
  maxGuests?: number;
  unitCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
  description_en?: string;
  description_ar?: string;
  amenities?: string[];
  images?: string[];
}

/**
 * The stay form, filled from what is stored.
 *
 * Unset counts stay empty rather than taking the new-listing defaults: a seed
 * hotel with no `maxGuests` takes four guests and one with no `unitCount` has
 * no availability cap, and prefilling "2" and "1" meant any save — a price
 * change — quietly halved the first and limited the hotel to one booking at a
 * time. The category is kept as stored ("luxury_hotel" stays itself) for the
 * same reason. The stored city is folded to its canonical key.
 */
export function stayFormFromListing(listing: StoredStay): StayFormValues {
  const count = (value: number | undefined) => (value != null ? String(value) : "");
  return {
    type: listing.category || "hotel",
    name: listing.name_en ?? "",
    nameAr: listing.name_ar ?? "",
    city: canonicalCity(listing.city ?? ""),
    neighborhood: isProvinceWideRegion(listing.region) ? "" : (listing.region ?? ""),
    priceRange: listing.priceRange ?? "",
    pricePerNight: count(listing.pricePerNight),
    maxGuests: count(listing.maxGuests),
    unitCount: count(listing.unitCount),
    checkInTime: listing.checkInTime ?? "15:00",
    checkOutTime: listing.checkOutTime ?? "12:00",
    description: listing.description_en ?? "",
    descriptionAr: listing.description_ar ?? "",
    amenities: listing.amenities ?? [],
    images: listing.images ?? [],
  };
}

export type StayField =
  | "name"
  | "nameAr"
  | "city"
  | "pricePerNight"
  | "maxGuests"
  | "unitCount"
  | "checkInTime"
  | "checkOutTime";

export function validateStayForm(form: StayFormValues): FieldErrors<StayField> {
  const errors: FieldErrors<StayField> = {};
  if (!form.name.trim()) errors.name = "fieldRequired";
  if (!form.nameAr.trim()) errors.nameAr = "fieldRequired";
  if (!form.city.trim()) errors.city = "chooseCity";

  // Optional as a group — without a nightly price the stay is listed but not
  // bookable — but whatever is filled in has to be usable.
  const price = parseWholeNumber(form.pricePerNight);
  if (price !== undefined && !isWholeInRange(price, 1, MAX_PRICE_PER_NIGHT)) {
    errors.pricePerNight = "invalidPriceRange";
  }
  const guests = parseWholeNumber(form.maxGuests);
  if (guests !== undefined && !isWholeInRange(guests, 1, MAX_GUESTS)) {
    errors.maxGuests = "invalidGuestCount";
  }
  const units = parseWholeNumber(form.unitCount);
  if (units !== undefined && !isWholeInRange(units, 1, MAX_UNITS)) {
    errors.unitCount = "invalidUnitCountRange";
  }
  if (!isHHMM(normaliseTime(form.checkInTime))) errors.checkInTime = "invalidTime";
  if (!isHHMM(normaliseTime(form.checkOutTime))) errors.checkOutTime = "invalidTime";
  return errors;
}

export interface PlaceFormValues {
  /** A category key; seeded places carry others such as "natural_landmark". */
  category: string;
  name: string;
  nameAr: string;
  city: string;
  address: string;
  description: string;
  descriptionAr: string;
  images: string[];
}

export const EMPTY_PLACE_FORM: PlaceFormValues = {
  category: "historical",
  name: "",
  nameAr: "",
  city: "",
  address: "",
  description: "",
  descriptionAr: "",
  images: [],
};

export interface StoredPlace {
  category: string;
  name_en?: string;
  name_ar?: string;
  city?: string;
  address?: string;
  description_en?: string;
  description_ar?: string;
  images?: string[];
}

export function placeFormFromListing(listing: StoredPlace): PlaceFormValues {
  return {
    category: listing.category || "historical",
    name: listing.name_en ?? "",
    nameAr: listing.name_ar ?? "",
    city: canonicalCity(listing.city ?? ""),
    address: listing.address ?? "",
    description: listing.description_en ?? "",
    descriptionAr: listing.description_ar ?? "",
    images: listing.images ?? [],
  };
}

export type PlaceField = "name" | "nameAr" | "city";

export function validatePlaceForm(form: PlaceFormValues): FieldErrors<PlaceField> {
  const errors: FieldErrors<PlaceField> = {};
  if (!form.name.trim()) errors.name = "fieldRequired";
  if (!form.nameAr.trim()) errors.nameAr = "fieldRequired";
  // Required, not defaulted: a place with no city chosen used to be filed
  // under Al Ahsa without a word, wherever it actually was.
  if (!form.city.trim()) errors.city = "chooseCity";
  return errors;
}

export interface ServiceFormValues {
  serviceType: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  priceRange: string;
  priceUnit: string;
  availability: string;
  availabilityAr: string;
  contactPhone: string;
  contactEmail: string;
  languages: string;
  images: string[];
}

export const EMPTY_SERVICE_FORM: ServiceFormValues = {
  serviceType: "tour_guide",
  title: "",
  titleAr: "",
  description: "",
  descriptionAr: "",
  priceRange: "",
  priceUnit: "per_hour",
  availability: "",
  availabilityAr: "",
  contactPhone: "",
  contactEmail: "",
  languages: "",
  images: [],
};

export interface StoredService {
  serviceType: string;
  title_en?: string;
  title_ar?: string;
  description_en?: string;
  description_ar?: string;
  priceRange?: string;
  priceUnit?: string;
  availability_en?: string;
  availability_ar?: string;
  contactPhone?: string;
  contactEmail?: string;
  languages?: string[];
  images?: string[];
}

export function serviceFormFromService(service: StoredService): ServiceFormValues {
  return {
    serviceType: service.serviceType || "other",
    title: service.title_en ?? "",
    titleAr: service.title_ar ?? "",
    description: service.description_en ?? "",
    descriptionAr: service.description_ar ?? "",
    priceRange: service.priceRange ?? "",
    priceUnit: service.priceUnit ?? "per_hour",
    availability: service.availability_en ?? "",
    availabilityAr: service.availability_ar ?? "",
    contactPhone: service.contactPhone ?? "",
    contactEmail: service.contactEmail ?? "",
    languages: (service.languages ?? []).join(", "),
    images: service.images ?? [],
  };
}

export type ServiceField =
  | "title"
  | "titleAr"
  | "description"
  | "descriptionAr"
  | "contactPhone"
  | "contactEmail";

export function validateServiceForm(form: ServiceFormValues): FieldErrors<ServiceField> {
  const errors: FieldErrors<ServiceField> = {};
  if (!form.title.trim()) errors.title = "fieldRequired";
  if (!form.titleAr.trim()) errors.titleAr = "fieldRequired";
  if (!form.description.trim()) errors.description = "fieldRequired";
  if (!form.descriptionAr.trim()) errors.descriptionAr = "fieldRequired";
  if (form.contactPhone.trim() && !isPlausiblePhone(form.contactPhone)) {
    errors.contactPhone = "invalidContactPhone";
  }
  if (form.contactEmail.trim() && !isPlausibleEmail(form.contactEmail)) {
    errors.contactEmail = "invalidEmail";
  }
  return errors;
}

/** The first field, in the order they appear on screen, that has an error. */
export function firstError<K extends string>(
  errors: FieldErrors<K>,
  order: readonly K[]
): K | undefined {
  return order.find((field) => errors[field] !== undefined);
}

/** Same values, for "has the host changed anything?" */
export function sameValues(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
