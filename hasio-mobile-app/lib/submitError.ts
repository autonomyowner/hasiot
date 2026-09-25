import type { TranslationKey } from "@/constants/translations";
import { serverErrorText } from "./serverError";

/**
 * A connection that never got through. Convex's own calls wait for the socket
 * rather than throw, so on a posting form an error like this comes from the
 * photo upload (`FileSystem.uploadAsync`), whose message is the platform's:
 * "Network request failed", "The Internet connection appears to be offline",
 * "Unable to resolve host …", a timeout.
 */
const NETWORK =
  /network|internet connection|offline|timed? ?out|unable to resolve host|failed to connect|could not connect|connection (was )?(lost|reset|refused|abort)|ECONN|ENOTFOUND|socket/i;

/**
 * Map a Convex mutation error to a translation key the user can act on.
 *
 * Convex wraps thrown server errors as
 * `[CONVEX M(listings/mutations:submitListing)] Uncaught Error: <message> at ...`
 * so we match on the message substring rather than an exact string. In
 * production a plain `Error`'s message is redacted to "Server Error" — only a
 * ConvexError's text arrives. The service mutations and the rate limit throw
 * ConvexError since 1.1.0, so their refusals below reach the provider; the
 * English half of each (SERVICE_ERRORS in convex/services/logic.ts) is what is
 * matched, which makes that wording an API.
 */
export function getSubmitErrorKey(error: unknown): TranslationKey {
  const message = serverErrorText(error);

  if (/must be approved/i.test(message)) {
    return "errorNotApproved";
  }
  // Both sign-in refusals: the listing mutations' English-only "Not
  // authenticated", and "… / You need to be signed in." from the service
  // mutations (AUTH_ERRORS.NOT_AUTHENTICATED).
  if (/Not authenticated|You need to be signed in/i.test(message)) {
    return "errorSessionExpired";
  }
  // A service's price and group size. The client checks both before sending,
  // so these are the server's word on a value the form let through. Anchored
  // on "a valid price" and "The price": a stay's refusals say "nightly price".
  if (/Enter a valid price between|The price must be a whole number/i.test(message)) {
    return "errorServicePrice";
  }
  if (/Group size must be between/i.test(message)) {
    return "invalidGroupSize";
  }
  if (/Choose a city from the list/i.test(message)) {
    return "errorServiceCity";
  }
  // Deleting a service a traveller still holds a request or a booking for.
  if (/service with open bookings/i.test(message)) {
    return "errorServiceOpenBookings";
  }
  if (/Only (business owners|service providers)/i.test(message)) {
    return "errorWrongRole";
  }
  if (/can post:/i.test(message)) {
    return "errorWrongRole";
  }
  // The daily caps in convex/rateLimit.ts — new listings, new services and
  // uploads — before the upload match below, which "upload limit" would
  // otherwise read as a failed upload.
  if (/today's limit|daily upload limit|limit reached|الحد اليومي/i.test(message)) {
    return "errorDailyPostLimit";
  }
  // Every way the upload itself fails: a storage write that did not answer
  // 2xx, a stored file with no id, and a stored file whose URL could not be
  // read back — "Failed to get storage URL", which the old `storageUrl`
  // pattern missed for the space, so it fell through to "try again later".
  if (/Upload failed|storage ?url|storageId/i.test(message)) {
    return "errorUploadFailed";
  }
  if (NETWORK.test(message)) {
    return "errorUploadFailed";
  }
  // Saving over, or deleting, something that was removed in the meantime.
  if (/not found|Not your (listing|service)/i.test(message)) {
    return "editorNotFound";
  }

  return "pleaseTryAgain";
}
