/**
 * Refusals shared across modules, in the house format: Arabic, " / ",
 * English, in one string (see BOOKING_ERRORS in bookings/logic.ts). Thrown as
 * ConvexError so production shows the text rather than "Server Error".
 *
 * The existing booking mutations still throw the English-only
 * "Not authenticated", which the app already maps; new functions use these.
 */
export const AUTH_ERRORS = {
  NOT_AUTHENTICATED: "يجب تسجيل الدخول أولاً. / You need to be signed in.",
  NOT_AUTHORIZED: "غير مصرح لك بهذا الإجراء. / You are not allowed to do that.",
} as const;
