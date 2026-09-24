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
 * ConvexError's text arrives — so the service and rate-limit cases below only
 * match once those throw ConvexError (an open backend item).
 */
export function getSubmitErrorKey(error: unknown): TranslationKey {
  const message = serverErrorText(error);

  if (/must be approved/i.test(message)) {
    return "errorNotApproved";
  }
  if (/Not authenticated/i.test(message)) {
    return "errorSessionExpired";
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
