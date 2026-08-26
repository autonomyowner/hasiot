import type { TranslationKey } from "@/constants/translations";

/**
 * Map a Convex mutation error to a translation key the user can act on.
 *
 * Convex wraps thrown server errors as
 * `[CONVEX M(listings/mutations:submitListing)] Uncaught Error: <message> at ...`
 * so we match on the message substring rather than an exact string.
 */
export function getSubmitErrorKey(error: unknown): TranslationKey {
  const message =
    typeof error === "string"
      ? error
      : (error as { message?: string })?.message ?? "";

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
  if (/Upload failed|storageUrl|storageId/i.test(message)) {
    return "errorUploadFailed";
  }

  return "pleaseTryAgain";
}
