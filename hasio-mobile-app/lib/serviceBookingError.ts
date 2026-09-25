import type { TranslationKey } from "@/constants/translations";
import { serverErrorText } from "./serverError";

/**
 * Map a refusal of a service booking — or of its live quote — onto a
 * translation key.
 *
 * The server writes one string, Arabic then English ("عربي / English"),
 * because it has no reliable signal for the reader's language; the app does,
 * so it matches the English half and shows its own words. That makes the
 * English wording of SERVICE_ERRORS in convex/services/logic.ts an API: the
 * tests beside this file quote it word for word.
 *
 * Separate from lib/bookingError.ts, which maps the stay refusals: several
 * sentences mean different things for a service ("not available right now"
 * is the service, not a listing), and a stay's own wording must not change
 * under it.
 */
export function getServiceBookingErrorKey(error: unknown): TranslationKey {
  const message = serverErrorText(error);

  if (/verified phone/i.test(message)) return "errorPhoneRequired";
  if (/own service/i.test(message)) return "errorOwnService";
  if (/active request for this service/i.test(message)) return "errorDuplicateServiceRequest";
  if (/Too many people/i.test(message)) return "errorTooManyPeople";
  if (/Hours must be between|Days must be between/i.test(message)) return "errorInvalidQuantity";
  // The day or the start has passed in Riyadh — both are fixed the same way.
  if (/start time has already passed|date cannot be in the past/i.test(message)) {
    return "errorPastTime";
  }
  // The sheet only offers real days and times, so these mean a stale screen.
  if (/Choose a valid date/i.test(message)) return "pickDayFirst";
  if (/Choose a valid start time/i.test(message)) return "pickStartTime";
  // Gone, suspended, unpriced or not bookable: to the traveller, all the same.
  if (
    /not available right now|not available for booking|has not set a price|Service not found/i.test(message)
  ) {
    return "errorServiceUnavailable";
  }
  if (/booking limit/i.test(message)) return "errorDailyLimit";
  // Both sign-in refusals: the older booking mutations' English-only one, and
  // the "… / You need to be signed in." the new functions throw.
  if (/Not authenticated|signed in/i.test(message)) return "errorSessionExpired";

  return "pleaseTryAgain";
}
