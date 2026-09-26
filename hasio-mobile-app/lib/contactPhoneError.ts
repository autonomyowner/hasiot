import type { TranslationKey } from "@/constants/translations";
import { serverErrorText } from "./serverError";

/**
 * What a refusal of users/mutations:setContactPhone means to the guest.
 *
 * The server writes "عربي / English"; like lib/serviceBookingError.ts this
 * matches the English half (CONTACT_PHONE_ERRORS in
 * convex/users/contactPhone.ts, and the shared daily-limit text in
 * convex/rateLimit.ts), so that wording is an API: the tests beside this file
 * quote it word for word.
 *
 * `field` says where the sheet shows it: under the number (something about the
 * number itself) or in a dialog. `alreadyVerified` is not really a failure —
 * the account has a confirmed number, which is all the booking needed — so the
 * sheet carries on to the booking instead of saying anything.
 */
export interface ContactPhoneRefusal {
  key: TranslationKey;
  field: boolean;
  alreadyVerified: boolean;
}

export function describeContactPhoneError(error: unknown): ContactPhoneRefusal {
  const message = serverErrorText(error);
  const refusal = (key: TranslationKey, field = false): ContactPhoneRefusal => ({
    key,
    field,
    alreadyVerified: false,
  });

  if (/valid Saudi mobile/i.test(message)) return refusal("invalidPhone", true);
  if (/already verified/i.test(message)) {
    return { key: "contactPhoneAlreadyVerified", field: false, alreadyVerified: true };
  }
  if (/confirmed by SMS code now/i.test(message)) return refusal("contactPhoneSmsLive");
  if (/Daily limit reached/i.test(message)) return refusal("contactPhoneDailyLimit");
  if (/Not authenticated|signed in/i.test(message)) return refusal("errorSessionExpired");
  if (/network|fetch|timed? ?out/i.test(message)) return refusal("networkError");
  return refusal("pleaseTryAgain");
}
