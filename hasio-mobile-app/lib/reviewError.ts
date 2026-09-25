import type { TranslationKey } from "@/constants/translations";
import { serverErrorText } from "./serverError";

/**
 * Map a review error from the server onto a translation key.
 *
 * The server throws bilingual strings ("عربي / English") because it has no
 * reliable signal for the reader's language. The app does know, so it matches
 * on the English half and shows its own copy — which makes the wording of
 * those halves in `convex/reviews/logic.ts` effectively an API.
 *
 * The same shape as `lib/bookingError.ts`. Showing the server's own string was
 * the alternative, and it fails twice over: half of it is in the wrong
 * language, and a production deployment redacts anything but a ConvexError.
 *
 * A review is of a place or, since 1.1.0, of a service, and the two refusals
 * that name what was reviewed are told apart here: "already rated this place"
 * under a service would be wrong.
 */
export function getReviewErrorKey(error: unknown): TranslationKey {
  const message = serverErrorText(error);

  // Both sign-in refusals. Every way into the review sheet is gated on being
  // signed in, so reaching the server without a session means it lapsed on
  // the way — "sign in to continue" read as if the guest had never been.
  if (/Not authenticated|signed in/i.test(message)) return "errorSessionExpired";
  // A host or provider rating their own place or service.
  if (/own place or service/i.test(message)) return "errorRateOwnItem";
  if (/already reviewed this service/i.test(message)) return "errorAlreadyReviewedService";
  if (/already reviewed/i.test(message)) return "errorAlreadyReviewed";
  if (/own review/i.test(message)) return "errorNotYourReview";
  if (/Service not found/i.test(message)) return "errorServiceUnavailable";
  if (/Review not found|Place not found/i.test(message)) return "errorReviewGone";
  if (/whole number of stars/i.test(message)) return "reviewNeedsStars";
  if (/limited to/i.test(message)) return "errorReviewTooLong";
  // enforceRateLimit's default wording, which the review limit uses.
  if (/Daily limit reached/i.test(message)) return "errorDailyPostLimit";

  return "pleaseTryAgain";
}
