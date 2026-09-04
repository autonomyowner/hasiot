import { addDays, isISODate, nightsBetween } from "../lib/dates";

/**
 * Booking rules, as pure functions.
 *
 * Everything here is decidable from its arguments — no database, no auth, no
 * clock. That is what makes the money and the state machine cheap to test
 * exhaustively, which matters because a wrong total or a booking that can be
 * confirmed twice is the kind of bug a guest notices before we do.
 */

export const BOOKING_STATUSES = [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
  "declined",
  "expired",
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Statuses that hold a unit: these are what an overlap check counts. */
export const ACTIVE_STAY_STATUSES: BookingStatus[] = ["pending", "confirmed"];

/** Nothing moves out of these except by an admin, and that gets logged. */
export const TERMINAL_STATUSES: BookingStatus[] = [
  "completed",
  "cancelled",
  "no_show",
  "declined",
  "expired",
];

/**
 * How long a host has to answer before the request dies.
 *
 * The point is not to punish slow hosts — it is that a guest holding an
 * unanswered request is not free to book elsewhere, because the unit is still
 * counted against inventory. Two days is long enough for a small hotel and
 * short enough that a trip can be re-planned.
 */
export const PENDING_TTL_MS = 48 * 60 * 60 * 1000;

export const MAX_NIGHTS = 30;
export const DEFAULT_MAX_GUESTS = 4;

/**
 * User-facing errors, Arabic first then English.
 *
 * Both halves are in one string because the server has no reliable signal for
 * the reader's language (the mobile client sets its own, the admin panel is
 * Arabic-only). Clients map the English half to a localised key — see
 * lib/bookingError.ts in the app — so these strings are effectively an API:
 * changing the English wording breaks that mapping.
 */
export const BOOKING_ERRORS = {
  PHONE_REQUIRED:
    "يلزم توثيق رقم الجوال قبل الحجز. / A verified phone number is required to book.",
  LISTING_UNAVAILABLE:
    "هذا المكان غير متاح حاليًا. / This listing is not available right now.",
  NOT_BOOKABLE:
    "هذا المكان لا يقبل الحجز حاليًا. / This listing is not available for booking.",
  OWN_LISTING: "لا يمكنك حجز مكانك الخاص. / You cannot book your own listing.",
  INVALID_DATES: "اختر تواريخ صحيحة. / Choose valid dates.",
  PAST_CHECK_IN: "لا يمكن الحجز في تاريخ ماضٍ. / Check-in cannot be in the past.",
  CHECKOUT_BEFORE_CHECKIN:
    "تاريخ المغادرة يجب أن يكون بعد تاريخ الوصول. / Check-out must be after check-in.",
  TOO_MANY_NIGHTS: `الحد الأقصى ${MAX_NIGHTS} ليلة للحجز الواحد. / Maximum stay is ${MAX_NIGHTS} nights.`,
  INVALID_GUESTS: "عدد الضيوف غير صحيح. / Invalid number of guests.",
  TOO_MANY_GUESTS: "عدد الضيوف أكبر من المسموح. / Too many guests for this listing.",
  NO_PRICE: "لم يحدد المضيف سعر الليلة بعد. / The host has not set a nightly price yet.",
  NO_AVAILABILITY:
    "لا توجد وحدات متاحة لهذه التواريخ. / No availability for those dates.",
  DUPLICATE:
    "لديك حجز قائم لهذه التواريخ. / You already have an active booking for those dates.",
  NOT_PENDING: "لم يعد هذا الطلب قيد الانتظار. / This request is no longer pending.",
  ALREADY_CLOSED: "هذا الحجز مغلق بالفعل. / This booking is already closed.",
  STAY_STARTED:
    "لا يمكن الإلغاء بعد بدء الإقامة. تواصل مع المضيف. / A stay cannot be cancelled after it starts. Contact the host.",
  NOT_AUTHORIZED: "غير مصرح لك بهذا الإجراء. / You are not allowed to do that.",
  NOT_A_STAY: "هذا الإجراء متاح لحجوزات الإقامة فقط. / That action applies to stays only.",
  STAY_NO_RESCHEDULE:
    "لتغيير تواريخ الإقامة، ألغِ الحجز واحجز من جديد. / To change stay dates, cancel and book again.",
} as const;

export type StayQuote = {
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  pricePerNight: number;
  totalAmount: number;
  currency: string;
};

type QuotableListing = {
  pricePerNight?: number;
  currency?: string;
  maxGuests?: number;
};

export type QuoteResult =
  | { ok: true; quote: StayQuote }
  | { ok: false; error: string };

/**
 * Price a stay.
 *
 * Returns a result rather than throwing because the quote is also driven by a
 * live query as the guest picks dates — a half-selected range is a normal
 * intermediate state, not an exception. Callers that are committing a booking
 * turn `ok: false` into a thrown error.
 *
 * `today` is passed in rather than read from the clock so the caller decides
 * which timezone "today" means. It is always the Riyadh date.
 */
export function computeStayQuote(
  listing: QuotableListing,
  args: { checkIn: string; checkOut: string; guests: number },
  today: string
): QuoteResult {
  const { checkIn, checkOut, guests } = args;

  if (!isISODate(checkIn) || !isISODate(checkOut)) {
    return { ok: false, error: BOOKING_ERRORS.INVALID_DATES };
  }
  if (checkIn < today) {
    return { ok: false, error: BOOKING_ERRORS.PAST_CHECK_IN };
  }

  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) {
    return { ok: false, error: BOOKING_ERRORS.CHECKOUT_BEFORE_CHECKIN };
  }
  if (nights > MAX_NIGHTS) {
    return { ok: false, error: BOOKING_ERRORS.TOO_MANY_NIGHTS };
  }

  if (!Number.isInteger(guests) || guests < 1) {
    return { ok: false, error: BOOKING_ERRORS.INVALID_GUESTS };
  }
  if (guests > (listing.maxGuests ?? DEFAULT_MAX_GUESTS)) {
    return { ok: false, error: BOOKING_ERRORS.TOO_MANY_GUESTS };
  }

  const pricePerNight = listing.pricePerNight;
  if (typeof pricePerNight !== "number" || pricePerNight <= 0) {
    return { ok: false, error: BOOKING_ERRORS.NO_PRICE };
  }

  return {
    ok: true,
    quote: {
      checkIn,
      checkOut,
      nights,
      guests,
      pricePerNight,
      totalAmount: nights * pricePerNight,
      currency: listing.currency ?? "SAR",
    },
  };
}

/**
 * Do two stays collide?
 *
 * Check-out is exclusive, so one guest leaving on the 12th and another
 * arriving on the 12th do not overlap — that is a normal same-day turnover,
 * and treating it as a clash would lose the host a night's revenue.
 */
export function overlaps(
  a: { checkIn: string; checkOut: string },
  b: { checkIn: string; checkOut: string }
): boolean {
  return a.checkIn < b.checkOut && b.checkIn < a.checkOut;
}

// No 0/O or 1/I: the code gets read aloud over the phone and copied off a
// screen, and those pairs are the ones people get wrong.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateConfirmationCode(rand: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  }
  return `HSO-${out}`;
}

export type Actor = "tourist" | "owner" | "admin";

export type TransitionResult =
  | { allowed: true; forced?: boolean }
  | { allowed: false; reason: string };

/**
 * Who may move a booking from one status to another.
 *
 * Written as data rather than scattered `if` statements because the same rules
 * are enforced in three places — the guest's app, the host's app and the admin
 * panel — and they drifted apart the last time they were expressed as
 * conditionals in each mutation.
 */
const ALLOWED: Record<Actor, Partial<Record<BookingStatus, BookingStatus[]>>> = {
  tourist: {
    pending: ["cancelled"],
    confirmed: ["cancelled"],
  },
  owner: {
    pending: ["confirmed", "declined", "completed"],
    confirmed: ["completed", "no_show"],
  },
  // Admin is intentionally unconstrained: support has to be able to fix a
  // booking that reached a wrong state. Leaving a terminal state is flagged
  // `forced` so the caller can log it as the exceptional act it is.
  admin: {},
};

export function canTransition(from: BookingStatus, to: BookingStatus, actor: Actor): TransitionResult {
  if (from === to) {
    return { allowed: false, reason: BOOKING_ERRORS.ALREADY_CLOSED };
  }

  if (actor === "admin") {
    if (!BOOKING_STATUSES.includes(to)) {
      return { allowed: false, reason: `Invalid booking status: ${to}` };
    }
    return { allowed: true, forced: TERMINAL_STATUSES.includes(from) };
  }

  const permitted = ALLOWED[actor][from] ?? [];
  if (!permitted.includes(to)) {
    return {
      allowed: false,
      reason: TERMINAL_STATUSES.includes(from)
        ? BOOKING_ERRORS.ALREADY_CLOSED
        : BOOKING_ERRORS.NOT_AUTHORIZED,
    };
  }
  return { allowed: true };
}

/** When a pending request created at `createdAt` stops holding its unit. */
export function expiryFor(createdAt: number): number {
  return createdAt + PENDING_TTL_MS;
}

/** The date a check-in reminder should go out for: the day before arrival. */
export function reminderTargetDate(today: string): string {
  return addDays(today, 1);
}
