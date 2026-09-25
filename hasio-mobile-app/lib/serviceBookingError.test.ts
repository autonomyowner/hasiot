import { describe, expect, it } from "vitest";
import { translations } from "@/constants/translations";
import { getServiceBookingErrorKey } from "./serviceBookingError";

// The server's own strings, word for word (convex/services/logic.ts
// SERVICE_ERRORS, convex/bookings/logic.ts BOOKING_ERRORS, and the daily
// limit in convex/bookings/service.ts). Their English halves are the API.
const SERVER = {
  SERVICE_UNAVAILABLE: "هذه الخدمة غير متاحة حاليًا. / This service is not available right now.",
  NOT_BOOKABLE: "هذه الخدمة لا تقبل الحجز حاليًا. / This service is not available for booking.",
  NO_PRICE: "لم يحدد مقدم الخدمة سعرًا بعد. / The provider has not set a price yet.",
  OWN_SERVICE: "لا يمكنك حجز خدمتك الخاصة. / You cannot book your own service.",
  INVALID_DATE: "اختر تاريخًا صحيحًا. / Choose a valid date.",
  PAST_DATE: "لا يمكن الحجز في تاريخ ماضٍ. / The date cannot be in the past.",
  INVALID_TIME: "اختر وقت بدء صحيحًا. / Choose a valid start time.",
  PAST_TIME: "وقت البدء مضى بالفعل. / That start time has already passed.",
  INVALID_HOURS: "عدد الساعات بين 1 و 12. / Hours must be between 1 and 12.",
  INVALID_DAYS: "عدد الأيام بين 1 و 14. / Days must be between 1 and 14.",
  INVALID_PARTY: "عدد الأشخاص غير صحيح. / Invalid number of people.",
  TOO_MANY_PEOPLE: "عدد الأشخاص أكبر من المسموح لهذه الخدمة. / Too many people for this service.",
  DUPLICATE:
    "لديك طلب قائم لهذه الخدمة في هذا اليوم. / You already have an active request for this service on that day.",
  NOT_FOUND: "الخدمة غير موجودة. / Service not found.",
  PHONE_REQUIRED: "يلزم توثيق رقم الجوال قبل الحجز. / A verified phone number is required to book.",
  DAILY_LIMIT:
    "لقد وصلت إلى الحد اليومي للحجوزات. يرجى المحاولة غدًا. / You've reached today's booking limit. Please try again tomorrow.",
  NOT_AUTHENTICATED_OLD: "Not authenticated",
  NOT_AUTHENTICATED_NEW: "يجب تسجيل الدخول أولاً. / You need to be signed in.",
} as const;

/** A ConvexError, as the client receives it: the text on `data`. */
const convexError = (data: string) => ({ data });

/** A plain server Error, as a development deployment delivers it. */
const convexDev = (message: string) =>
  new Error(
    `[CONVEX M(bookings/mutations:createServiceBooking)] [Request ID: 1a2b] Server Error\nUncaught ConvexError: ${message}\n    at handler (../convex/bookings/service.ts:275:11)`
  );

describe("getServiceBookingErrorKey", () => {
  it("says a service cannot be booked right now, whichever of the three reasons it is", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.SERVICE_UNAVAILABLE))).toBe("errorServiceUnavailable");
    expect(getServiceBookingErrorKey(convexError(SERVER.NOT_BOOKABLE))).toBe("errorServiceUnavailable");
    expect(getServiceBookingErrorKey(convexError(SERVER.NO_PRICE))).toBe("errorServiceUnavailable");
    expect(getServiceBookingErrorKey(convexError(SERVER.NOT_FOUND))).toBe("errorServiceUnavailable");
  });

  it("says a provider cannot book their own service", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.OWN_SERVICE))).toBe("errorOwnService");
  });

  it("says the time has passed, for a past start or a past day", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.PAST_TIME))).toBe("errorPastTime");
    expect(getServiceBookingErrorKey(convexError(SERVER.PAST_DATE))).toBe("errorPastTime");
  });

  it("says there is already a request for that day", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.DUPLICATE))).toBe("errorDuplicateServiceRequest");
  });

  it("says the group is too big", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.TOO_MANY_PEOPLE))).toBe("errorTooManyPeople");
  });

  it("says the hours or days are out of range", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.INVALID_HOURS))).toBe("errorInvalidQuantity");
    expect(getServiceBookingErrorKey(convexError(SERVER.INVALID_DAYS))).toBe("errorInvalidQuantity");
  });

  it("asks for a day or a start time the sheet could not have sent", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.INVALID_DATE))).toBe("pickDayFirst");
    expect(getServiceBookingErrorKey(convexError(SERVER.INVALID_TIME))).toBe("pickStartTime");
  });

  it("falls back to the booking keys the stays already use", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.PHONE_REQUIRED))).toBe("errorPhoneRequired");
    expect(getServiceBookingErrorKey(convexError(SERVER.DAILY_LIMIT))).toBe("errorDailyLimit");
  });

  it("maps both sign-in refusals to the session having expired", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.NOT_AUTHENTICATED_OLD))).toBe("errorSessionExpired");
    expect(getServiceBookingErrorKey(convexError(SERVER.NOT_AUTHENTICATED_NEW))).toBe("errorSessionExpired");
  });

  it("reads the same text from a development deployment's plain error", () => {
    expect(getServiceBookingErrorKey(convexDev(SERVER.DUPLICATE))).toBe("errorDuplicateServiceRequest");
    // A quote's refusal arrives as a bare string, not an error at all.
    expect(getServiceBookingErrorKey(new Error(SERVER.PAST_TIME))).toBe("errorPastTime");
  });

  it("falls back when production has redacted the reason, or there is none", () => {
    expect(getServiceBookingErrorKey(convexError(SERVER.INVALID_PARTY))).toBe("pleaseTryAgain");
    expect(
      getServiceBookingErrorKey(
        new Error("[CONVEX M(bookings/mutations:createServiceBooking)] [Request ID: 9] Server Error")
      )
    ).toBe("pleaseTryAgain");
    expect(getServiceBookingErrorKey(undefined)).toBe("pleaseTryAgain");
  });

  it("only ever answers with a key both languages have", () => {
    for (const text of Object.values(SERVER)) {
      const key = getServiceBookingErrorKey(convexError(text));
      expect(translations.en[key], key).toBeTruthy();
      expect(translations.ar[key], key).toBeTruthy();
    }
  });
});
