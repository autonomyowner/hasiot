import { ConvexError } from "convex/values";
import { addDays, isHHMM, isISODate, riyadhDateTimeToTimestamp } from "../lib/dates";
import { toProvinceCity } from "../lib/cities";
import { BOOKING_ERRORS } from "../bookings/logic";

/**
 * Service rules, as pure functions: what a provider may publish, when a
 * traveller may book it, and what that costs.
 *
 * Same reasoning as bookings/logic.ts — no database, no auth, no clock — so
 * the money and the refusals can be tested exhaustively. The server computes
 * every total from the service; the client sends a day, a start time and a
 * quantity, never an amount (bookings design D5).
 */

export const SERVICE_TYPES = [
  "tour_guide",
  "photographer",
  "driver",
  "translator",
  "event_planner",
  "catering",
  "equipment_rental",
  "other",
] as const;

export const PRICE_UNITS = ["per_hour", "per_day", "per_event", "fixed"] as const;
export type PriceUnit = (typeof PRICE_UNITS)[number];

export const MAX_HOURS = 12;
export const MAX_DAYS = 14;
/** People per booking when the provider has not set a limit. */
export const DEFAULT_MAX_GROUP = 20;
export const MAX_GROUP = 100;
// Above this a price is far likelier to be a typo than a real rate — the same
// ceiling as a nightly price in listings/pricing.ts.
export const MAX_SERVICE_PRICE = 100_000;
export const MAX_SERVICE_IMAGES = 5;
export const MAX_TITLE = 100;
export const MAX_DESCRIPTION = 2000;

/**
 * Refusals, Arabic first then English. The app matches on the English half
 * (lib/serviceBookingError.ts, lib/submitError.ts), so that wording is an API.
 */
export const SERVICE_ERRORS = {
  SERVICE_UNAVAILABLE: "هذه الخدمة غير متاحة حاليًا. / This service is not available right now.",
  NOT_BOOKABLE: "هذه الخدمة لا تقبل الحجز حاليًا. / This service is not available for booking.",
  NO_PRICE: "لم يحدد مقدم الخدمة سعرًا بعد. / The provider has not set a price yet.",
  OWN_SERVICE: "لا يمكنك حجز خدمتك الخاصة. / You cannot book your own service.",
  INVALID_DATE: "اختر تاريخًا صحيحًا. / Choose a valid date.",
  PAST_DATE: "لا يمكن الحجز في تاريخ ماضٍ. / The date cannot be in the past.",
  INVALID_TIME: "اختر وقت بدء صحيحًا. / Choose a valid start time.",
  PAST_TIME: "وقت البدء مضى بالفعل. / That start time has already passed.",
  INVALID_HOURS: `عدد الساعات بين 1 و ${MAX_HOURS}. / Hours must be between 1 and ${MAX_HOURS}.`,
  INVALID_DAYS: `عدد الأيام بين 1 و ${MAX_DAYS}. / Days must be between 1 and ${MAX_DAYS}.`,
  INVALID_PARTY: "عدد الأشخاص غير صحيح. / Invalid number of people.",
  TOO_MANY_PEOPLE: "عدد الأشخاص أكبر من المسموح لهذه الخدمة. / Too many people for this service.",
  DUPLICATE:
    "لديك طلب قائم لهذه الخدمة في هذا اليوم. / You already have an active request for this service on that day.",
  SERVICE_STARTED:
    "لا يمكن الإلغاء بعد بدء الخدمة. تواصل مع مقدم الخدمة. / A service cannot be cancelled after it starts. Contact the provider.",
  NO_RESCHEDULE: BOOKING_ERRORS.SERVICE_NO_RESCHEDULE,
  INVALID_TYPE: "اختر نوع خدمة صحيحًا. / Choose a valid service type.",
  INVALID_UNIT: "اختر وحدة سعر صحيحة. / Choose a valid price unit.",
  INVALID_PRICE: `أدخل سعرًا صحيحًا بين 1 و ${MAX_SERVICE_PRICE} ريال. / Enter a valid price between 1 and ${MAX_SERVICE_PRICE} SAR.`,
  PRICE_NOT_WHOLE: "السعر يجب أن يكون رقمًا صحيحًا. / The price must be a whole number.",
  INVALID_GROUP: `الحد الأقصى للأشخاص بين 1 و ${MAX_GROUP}. / Group size must be between 1 and ${MAX_GROUP}.`,
  TITLE_REQUIRED: "أدخل عنوان الخدمة بالعربية والإنجليزية. / Enter the service title in Arabic and English.",
  TITLE_TOO_LONG: `العنوان طويل جدًا (${MAX_TITLE} حرف كحد أقصى). / The title is too long (${MAX_TITLE} characters max).`,
  DESCRIPTION_TOO_LONG: `الوصف طويل جدًا (${MAX_DESCRIPTION} حرف كحد أقصى). / The description is too long (${MAX_DESCRIPTION} characters max).`,
  INVALID_CITY: "اختر مدينة من القائمة. / Choose a city from the list.",
  TOO_MANY_IMAGES: `الحد الأقصى ${MAX_SERVICE_IMAGES} صور. / Up to ${MAX_SERVICE_IMAGES} photos.`,
  NOT_A_PROVIDER: "هذه الميزة لمقدمي الخدمات فقط. / Only service providers can do this.",
  NOT_APPROVED: "يجب اعتماد حسابك قبل إضافة الخدمات. / Your account must be approved before you add services.",
  NOT_FOUND: "الخدمة غير موجودة. / Service not found.",
  NOT_YOURS: "هذه الخدمة ليست لك. / This is not your service.",
  HAS_OPEN_BOOKINGS: "لا يمكن حذف خدمة لديها حجوزات قائمة. / A service with open bookings cannot be deleted.",
} as const;

type Owner = { role?: string; isApproved?: boolean; isSuspended?: boolean } | null;

/**
 * Whether travellers may see a service at all: approved, and its owner still
 * exists and is not suspended. Suspending an account hides everything it
 * published without touching each service (design D15).
 */
export function isPublicService(service: { status: string }, owner: Owner): boolean {
  return service.status === "approved" && owner !== null && owner.isSuspended !== true;
}

/**
 * Whether a traveller may book it: public, priced, and offered by an approved
 * provider. A public service that is not bookable shows Contact (design D16).
 */
export function isBookableService(service: { status: string; price?: number }, owner: Owner): boolean {
  return (
    isPublicService(service, owner) &&
    typeof service.price === "number" &&
    service.price > 0 &&
    owner?.role === "service_provider" &&
    owner.isApproved === true
  );
}

export type ServiceQuote = {
  date: string;
  time: string;
  quantity: number;
  priceUnit: PriceUnit;
  unitPrice: number;
  totalAmount: number;
  currency: "SAR";
  partySize: number;
  /** = date. */
  checkIn: string;
  /** The day after the last service day, exclusive — the same meaning as a stay's. */
  checkOut: string;
};

export type ServiceQuoteResult = { ok: true; quote: ServiceQuote } | { ok: false; error: string };

function unitOf(priceUnit: string | undefined): PriceUnit {
  return (PRICE_UNITS as readonly string[]).includes(priceUnit ?? "")
    ? (priceUnit as PriceUnit)
    : "fixed";
}

/**
 * Price a service booking.
 *
 * Returns a result rather than throwing, because the booking sheet quotes live
 * while the traveller is still choosing — half-chosen input is a normal state.
 * `today` is the Riyadh date and `now` the clock, passed in so tests decide.
 */
export function computeServiceQuote(
  service: { price?: number; priceUnit?: string; maxGroupSize?: number },
  args: { date: string; time: string; quantity?: number; partySize?: number },
  today: string,
  now: number
): ServiceQuoteResult {
  const { date, time } = args;

  if (!isISODate(date)) return { ok: false, error: SERVICE_ERRORS.INVALID_DATE };
  if (date < today) return { ok: false, error: SERVICE_ERRORS.PAST_DATE };
  if (!isHHMM(time)) return { ok: false, error: SERVICE_ERRORS.INVALID_TIME };
  if (riyadhDateTimeToTimestamp(date, time) <= now) {
    return { ok: false, error: SERVICE_ERRORS.PAST_TIME };
  }

  const price = service.price;
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return { ok: false, error: SERVICE_ERRORS.NO_PRICE };
  }

  const priceUnit = unitOf(service.priceUnit);
  let quantity = 1;
  if (priceUnit === "per_hour" || priceUnit === "per_day") {
    const max = priceUnit === "per_hour" ? MAX_HOURS : MAX_DAYS;
    const asked = args.quantity ?? 1;
    if (!Number.isInteger(asked) || asked < 1 || asked > max) {
      return {
        ok: false,
        error: priceUnit === "per_hour" ? SERVICE_ERRORS.INVALID_HOURS : SERVICE_ERRORS.INVALID_DAYS,
      };
    }
    quantity = asked;
  }

  const partySize = args.partySize ?? 1;
  if (!Number.isInteger(partySize) || partySize < 1) {
    return { ok: false, error: SERVICE_ERRORS.INVALID_PARTY };
  }
  if (partySize > (service.maxGroupSize ?? DEFAULT_MAX_GROUP)) {
    return { ok: false, error: SERVICE_ERRORS.TOO_MANY_PEOPLE };
  }

  return {
    ok: true,
    quote: {
      date,
      time,
      quantity,
      priceUnit,
      unitPrice: price,
      totalAmount: price * quantity,
      currency: "SAR",
      partySize,
      checkIn: date,
      checkOut: addDays(date, priceUnit === "per_day" ? quantity : 1),
    },
  };
}

type ServiceInput = {
  serviceType?: string;
  priceUnit?: string;
  price?: number | null;
  maxGroupSize?: number | null;
  title_en?: string;
  title_ar?: string;
  description_en?: string;
  description_ar?: string;
  images?: string[];
  city?: string;
};

function refuse(message: string): never {
  throw new ConvexError(message);
}

/**
 * Check what a provider (or an admin editing for them) submits, and return the
 * fields to store — trimmed, with the city folded to one of the thirteen.
 *
 * Only fields that were sent appear in the result, so an update never blanks
 * something it did not mention. `null` clears `price` or `maxGroupSize`, and
 * an emptied description clears it; both come back as `undefined` under their
 * key, which a Convex patch treats as "remove".
 */
export function validateServiceInput(
  args: ServiceInput,
  mode: "create" | "update"
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  if (mode === "create" || args.serviceType !== undefined) {
    if (!(SERVICE_TYPES as readonly string[]).includes(args.serviceType ?? "")) {
      refuse(SERVICE_ERRORS.INVALID_TYPE);
    }
    out.serviceType = args.serviceType;
  }

  for (const key of ["title_en", "title_ar"] as const) {
    if (mode === "create" || args[key] !== undefined) {
      const value = args[key]?.trim() ?? "";
      if (!value) refuse(SERVICE_ERRORS.TITLE_REQUIRED);
      if (value.length > MAX_TITLE) refuse(SERVICE_ERRORS.TITLE_TOO_LONG);
      out[key] = value;
    }
  }

  for (const key of ["description_en", "description_ar"] as const) {
    if (args[key] !== undefined) {
      const value = args[key]!.trim();
      if (value.length > MAX_DESCRIPTION) refuse(SERVICE_ERRORS.DESCRIPTION_TOO_LONG);
      if (value) out[key] = value;
      else if (mode === "update") out[key] = undefined;
    }
  }

  if (args.priceUnit !== undefined) {
    if (!(PRICE_UNITS as readonly string[]).includes(args.priceUnit)) refuse(SERVICE_ERRORS.INVALID_UNIT);
    out.priceUnit = args.priceUnit;
  }

  if (args.price === null) {
    if (mode === "update") out.price = undefined;
  } else if (args.price !== undefined) {
    if (!Number.isFinite(args.price) || args.price < 1 || args.price > MAX_SERVICE_PRICE) {
      refuse(SERVICE_ERRORS.INVALID_PRICE);
    }
    if (!Number.isInteger(args.price)) refuse(SERVICE_ERRORS.PRICE_NOT_WHOLE);
    out.price = args.price;
  }

  if (args.maxGroupSize === null) {
    if (mode === "update") out.maxGroupSize = undefined;
  } else if (args.maxGroupSize !== undefined) {
    if (!Number.isInteger(args.maxGroupSize) || args.maxGroupSize < 1 || args.maxGroupSize > MAX_GROUP) {
      refuse(SERVICE_ERRORS.INVALID_GROUP);
    }
    out.maxGroupSize = args.maxGroupSize;
  }

  if (args.images !== undefined) {
    if (args.images.length > MAX_SERVICE_IMAGES) refuse(SERVICE_ERRORS.TOO_MANY_IMAGES);
    out.images = args.images;
  }

  if (args.city !== undefined) {
    const city = toProvinceCity(args.city);
    if (!city) refuse(SERVICE_ERRORS.INVALID_CITY);
    out.city = city;
  }

  return out;
}
