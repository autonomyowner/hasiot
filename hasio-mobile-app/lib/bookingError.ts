import type { TranslationKey } from "@/constants/translations";
import { serverErrorText } from "./serverError";

/**
 * Map a booking error from the server onto a translation key.
 *
 * The server throws bilingual strings ("عربي / English") because it has no
 * reliable signal for the reader's language. The app does know, so it matches
 * on the English half and shows its own copy — which also means the wording of
 * those English halves in convex/bookings/logic.ts is effectively an API.
 *
 * The same shape as lib/submitError.ts, which does this for listing submission.
 */
export function getBookingErrorKey(error: unknown): TranslationKey {
  const message = serverErrorText(error);

  if (/verified phone/i.test(message)) return "errorPhoneRequired";
  if (/own listing/i.test(message)) return "errorOwnListing";
  if (/No availability/i.test(message)) return "noAvailability";
  if (/already have an active booking/i.test(message)) return "errorDuplicateBooking";
  if (/Too many guests|Invalid number of guests/i.test(message)) return "errorMaxGuests";
  if (
    /Check-out must be after|cannot be in the past|Choose valid dates|Maximum stay/i.test(message)
  ) {
    return "errorInvalidDates";
  }
  if (/not available for booking|not available right now|has not set a nightly price/i.test(message)) {
    return "errorListingUnavailable";
  }
  if (/no longer pending|already closed/i.test(message)) return "errorBookingClosed";
  if (/after it starts/i.test(message)) return "errorStayStarted";
  if (/booking limit/i.test(message)) return "errorDailyLimit";
  if (/Not authenticated/i.test(message)) return "errorSessionExpired";

  return "pleaseTryAgain";
}
