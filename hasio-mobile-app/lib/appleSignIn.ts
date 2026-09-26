/**
 * Sign in with Apple — the decisions that are plain logic, kept pure so they
 * are tested under Node (lib/appleSignIn.test.ts). The flow itself is
 * lib/auth.ts signInWithApple.
 *
 * iOS only: App Store guideline 4.8 asks for it on iOS wherever Google is
 * offered; Android and the website do not get it (design A1).
 */

/**
 * Whether to show the Apple button: iOS, a backend that verifies Apple's
 * tokens (`getPublicConfig().appleAuth`), and a build that carries the
 * entitlement (`extra.appleSignIn`, off in eas.json until Nabil's team has
 * enabled the capability — see plugins/withAppleSignInSwitch.js). Without the
 * entitlement Apple's sheet fails with an error, so the button would too.
 */
export function appleSignInAvailable(
  config: { appleAuth?: boolean } | null | undefined,
  platform: string,
  buildHasEntitlement: boolean | undefined
): boolean {
  return platform === "ios" && config?.appleAuth === true && buildHasEntitlement === true;
}

/** The part of Apple's credential that carries a name. */
export interface AppleFullName {
  givenName?: string | null;
  familyName?: string | null;
}

/**
 * The name to save on the profile, or null when there is none.
 *
 * Apple hands the name over on the first sign-in only, and never puts it in
 * the identity token — so the server cannot see it, and it is saved from here
 * straight after, or lost.
 */
export function appleProfileName(
  fullName: AppleFullName | null | undefined
): { firstName?: string; lastName?: string } | null {
  const firstName = fullName?.givenName?.trim() || undefined;
  const lastName = fullName?.familyName?.trim() || undefined;
  if (!firstName && !lastName) return null;
  return { ...(firstName ? { firstName } : {}), ...(lastName ? { lastName } : {}) };
}

/** The person closed Apple's sheet: a choice, not a failure. */
export function isAppleCancel(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "ERR_REQUEST_CANCELED"
  );
}
