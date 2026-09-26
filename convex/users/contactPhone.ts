import { ConvexError } from "convex/values";
import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { enforceRateLimit } from "../rateLimit";
import { canBookWithPhone, isSaudiMobile, saudiSmsLive } from "../lib/phoneRules";
import { buildSearchTextFrom } from "./search";

/**
 * A phone number given without a code, for booking — the stand-in for SMS
 * while Saudi numbers cannot receive one (see lib/phoneRules.ts).
 *
 * It lives on the app row only. Better Auth never hears of it, so it is not a
 * sign-in: it is a number the host can call. If the guest later confirms a
 * number by SMS, Better Auth's update trigger overwrites it with the verified
 * one (users/sync.ts).
 */

export const CONTACT_PHONE_ERRORS = {
  INVALID_SAUDI_MOBILE: "أدخل رقم جوال سعودي صحيح. / Enter a valid Saudi mobile number.",
  SMS_IS_LIVE: "أرقام السعودية تُوثَّق برمز SMS الآن. / Saudi numbers are confirmed by SMS code now.",
  ALREADY_VERIFIED: "رقم جوالك موثّق بالفعل. / Your phone number is already verified.",
} as const;

/** Enough to fix a typo or two; not enough to churn through strangers' numbers. */
export const CONTACT_PHONE_CHANGES_PER_DAY = 10;

export async function setContactPhoneForUser(
  ctx: MutationCtx,
  user: Doc<"users">,
  phone: string
): Promise<{ phone: string; phoneVerified: false }> {
  if (!isSaudiMobile(phone)) throw new ConvexError(CONTACT_PHONE_ERRORS.INVALID_SAUDI_MOBILE);
  if (saudiSmsLive()) throw new ConvexError(CONTACT_PHONE_ERRORS.SMS_IS_LIVE);
  // A confirmed number is worth more to the host than whatever is typed next.
  if (user.phoneVerified) throw new ConvexError(CONTACT_PHONE_ERRORS.ALREADY_VERIFIED);

  await enforceRateLimit(ctx, `contactPhone:${user._id}`, CONTACT_PHONE_CHANGES_PER_DAY);

  await ctx.db.patch(user._id, {
    phone,
    phoneVerified: false,
    searchText: buildSearchTextFrom({
      email: user.email,
      phone,
      firstName: user.firstName,
      lastName: user.lastName,
    }),
    updatedAt: Date.now(),
  });
  return { phone, phoneVerified: false };
}

/** The users row as getCurrentUser returns it: plus whether the phone rule lets them book. */
export function withBookingReadiness<T extends Doc<"users">>(user: T | null) {
  if (!user) return null;
  return { ...user, canBook: canBookWithPhone(user) };
}
