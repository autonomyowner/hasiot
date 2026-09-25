/**
 * The decisions behind push notifications, kept out of `lib/push.ts` so they
 * run under plain Node in the tests: that file imports expo-notifications,
 * which does not load outside a phone.
 *
 * Push is a promise the app makes when it asks for permission — "we'll tell
 * you the moment your request is confirmed" — so every answer here leans
 * towards not asking. A refusal on iOS is final (the system never shows its
 * prompt twice), and a prompt for notifications that can never arrive is
 * worse than none.
 */

/** Seven days between two in-context asks (design D14). */
export const ASK_AGAIN_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * How long an ask may wait for the screen to clear before it is let go.
 *
 * The prompt is asked for as a sheet closes, and shows once nothing else is
 * presented. A guest who keeps the listing open after booking is asked when
 * they close it — but not an hour later, when "your request" means nothing.
 */
export const PROMPT_REQUEST_TTL_MS = 5 * 60 * 1000;

/**
 * Whether this build, on this device, can receive a remote push at all.
 *
 * `flags` is `extra.push` from the app config, `{ ios, android }`, set by
 * app.config.js from the same switches that decide the native build: an iOS
 * binary made with HASIO_IOS_PUSH=off has no aps-environment entitlement, and
 * an Android one made without google-services.json has no Firebase, so in
 * either the token request can only fail. Missing flags count as "no".
 * Simulators, emulators and the web never get a push token.
 */
export function pushAvailableFor(input: {
  os: string;
  isDevice: boolean | null | undefined;
  flags: unknown;
}): boolean {
  if (input.os !== "ios" && input.os !== "android") return false;
  if (input.isDevice !== true) return false;
  if (!input.flags || typeof input.flags !== "object") return false;
  return (input.flags as Record<string, unknown>)[input.os] === true;
}

/** The system's notification permission, as the decisions below need it. */
export type PermissionSnapshot = {
  status: "granted" | "denied" | "undetermined";
  /** False once only the system settings can change the answer. */
  canAskAgain: boolean;
};

/** iOS UNAuthorizationStatus values that let notifications through. */
const IOS_ALLOWED_STATUSES = new Set([2, 3, 4]); // authorized, provisional, ephemeral

/**
 * The part of expo-notifications' permission response the app uses.
 *
 * iOS reports a provisional authorisation (quiet delivery to Notification
 * Centre) apart from `granted`; it still delivers, so it counts as granted.
 * The app never asks for provisional itself, but a person can choose it.
 */
export function snapshotOf(response: {
  status: string;
  granted: boolean;
  canAskAgain: boolean;
  ios?: { status?: number } | null;
}): PermissionSnapshot {
  const iosAllows = response.ios?.status !== undefined && IOS_ALLOWED_STATUSES.has(response.ios.status);
  const status: PermissionSnapshot["status"] =
    response.granted || iosAllows
      ? "granted"
      : response.status === "denied"
        ? "denied"
        : "undetermined";
  return { status, canAskAgain: response.canAskAgain };
}

export function permissionGranted(permission: PermissionSnapshot): boolean {
  return permission.status === "granted";
}

/**
 * Whether to show the "Get booking updates?" sheet now.
 *
 * Never when push cannot arrive, when nobody is signed in (the token is
 * registered to an account), when permission is already granted, or when the
 * system will not ask again — then only the system settings can help, and the
 * Settings row says so instead. Otherwise at most once in seven days, unless
 * the person asked for it from the Settings row (`manual`).
 *
 * A last ask in the future means the clock was set back; waiting for it to
 * come round again would silence the prompt for as long as the clock moved.
 */
export function shouldOfferPush(input: {
  available: boolean;
  signedIn: boolean;
  permission: PermissionSnapshot;
  lastAskedAt: number | null;
  now: number;
  manual?: boolean;
}): boolean {
  const { available, signedIn, permission, lastAskedAt, now, manual } = input;
  if (!available || !signedIn) return false;
  if (permissionGranted(permission) || !permission.canAskAgain) return false;
  if (manual || lastAskedAt === null) return true;
  const since = now - lastAskedAt;
  return since < 0 || since >= ASK_AGAIN_AFTER_MS;
}

export type PushRowState = "on" | "off" | "blocked";

/**
 * What the Settings row shows: on; off, where a tap asks; or blocked, where a
 * tap can only open the system settings.
 */
export function pushRowState(permission: PermissionSnapshot): PushRowState {
  if (permissionGranted(permission)) return "on";
  return permission.canAskAgain ? "off" : "blocked";
}

/** Whether an ask that has been waiting since `requestedAt` may still show. */
export function isPromptRequestFresh(requestedAt: number, now: number): boolean {
  return now - requestedAt <= PROMPT_REQUEST_TTL_MS;
}

/**
 * Token failures caused by how the app was built or by the phone itself,
 * which no retry will fix:
 * - iOS without the aps-environment entitlement (a HASIO_IOS_PUSH=off build);
 * - Android without Firebase (no google-services.json in the build);
 * - an Android phone without Google Play services.
 *
 * Anything else — no network, a timeout, Expo's service down — is transient,
 * and the next launch tries again.
 */
export function isPushUnsupportedError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /aps-environment|FirebaseApp is not initialized|google-services|MISSING_INSTANCEID_SERVICE/i.test(
    message
  );
}
