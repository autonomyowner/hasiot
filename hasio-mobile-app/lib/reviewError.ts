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
 */
export function getReviewErrorKey(error: unknown): TranslationKey {
  const message = serverErrorText(error);

  if (/signed in/i.test(message)) return "signInRequired";
  if (/already reviewed/i.test(message)) return "errorAlreadyReviewed";
  if (/own review/i.test(message)) return "errorNotYourReview";
  if (/Review not found|Place not found/i.test(message)) return "errorReviewGone";
  if (/whole number of stars/i.test(message)) return "reviewNeedsStars";
  if (/limited to/i.test(message)) return "errorReviewTooLong";

  return "pleaseTryAgain";
}
