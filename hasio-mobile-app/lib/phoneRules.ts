/**
 * The app's half of the server's phone rules (convex/lib/phoneRules.ts).
 *
 * Production SMS cannot reach Saudi (+966) numbers yet. The server says so
 * through getPublicConfig — `saudiSmsLive`, and `googleAuth` for the way round
 * it — and says whether this person may book anyway through getCurrentUser's
 * `canBook`. These read those answers the same way on every screen.
 *
 * Pure, so it is tested under plain Node (lib/phoneRules.test.ts).
 */

/** The fields of getPublicConfig these rules read; undefined while it loads. */
export interface PhoneConfig {
  demoAuth?: boolean;
  googleAuth?: boolean;
  saudiSmsLive?: boolean;
}

const SAUDI_MOBILE = /^\+9665\d{8}$/;

/** +9665 and eight digits — the only number setContactPhone accepts. */
export function isSaudiMobile(phone: string | null | undefined): boolean {
  return typeof phone === "string" && SAUDI_MOBILE.test(phone);
}

/**
 * Whether a code sent to a Saudi number would never arrive.
 *
 * Loading counts as "off", as the contract says: a guest who presses Send
 * code in the first half-second is told SMS is not reaching Saudi numbers,
 * rather than waiting for a text that never comes. Demo mode (the dev
 * backend) sends no SMS at all and verifies any code, so the phone path stays
 * open there and remains testable.
 */
export function saudiSmsBlocked(config: PhoneConfig | null | undefined): boolean {
  return config?.saudiSmsLive !== true && config?.demoAuth !== true;
}

/** Whether sending a code to this E.164 number is pointless right now. */
export function smsBlockedFor(
  phone: string | null | undefined,
  config: PhoneConfig | null | undefined
): boolean {
  return typeof phone === "string" && phone.startsWith("+966") && saudiSmsBlocked(config);
}

/**
 * Whether to offer "Continue with Google": only once the server says both
 * Google keys are set, so a deployment without them never shows a button that
 * fails. Never on Expo web, which is a smoke-test surface with no deep link
 * back into the app.
 */
export function googleSignInAvailable(
  config: PhoneConfig | null | undefined,
  platform: string
): boolean {
  return config?.googleAuth === true && platform !== "web";
}

/**
 * Whether the phone rule lets this person book now.
 *
 * `canBook` is the server's answer (a confirmed number, or a Saudi mobile
 * while Saudi SMS is off). A backend from before it existed does not send it;
 * then a confirmed number is the rule, as it always was.
 */
export function userCanBook(
  user: { canBook?: boolean; phoneVerified?: boolean } | null | undefined
): boolean {
  if (!user) return false;
  return user.canBook ?? user.phoneVerified === true;
}
