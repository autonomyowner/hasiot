/**
 * The rules that stand in for SMS where SMS cannot reach, and the switch that
 * retires them.
 *
 * Production SMS does not reach Saudi (+966) numbers yet: the provider has not
 * provisioned the country, so a Saudi guest asking for a code waits for a text
 * that never comes. Until it does, two things lean on these rules instead:
 * sign-in (Google, see auth.ts) and the phone a booking needs (a Saudi mobile
 * typed once, unconfirmed — the owner's call, 2026-09-26).
 *
 * `SAUDI_SMS_LIVE=true` in the deployment's environment turns both back to the
 * SMS path with no deploy: set it once a real Saudi phone has received a code.
 */

type Env = Record<string, string | undefined>;

const SAUDI_MOBILE = /^\+9665\d{8}$/;

/** +9665 and eight digits — the number a traveller carries, not a landline. */
export function isSaudiMobile(phone: string | null | undefined): boolean {
  return typeof phone === "string" && SAUDI_MOBILE.test(phone);
}

/** Whether a code sent to a Saudi number arrives today. */
export function saudiSmsLive(env: Env = process.env): boolean {
  return env.SAUDI_SMS_LIVE === "true";
}

/**
 * Whether this person has a number a host can call.
 *
 * A confirmed number always counts. An unconfirmed one counts only if it is a
 * Saudi mobile and Saudi SMS is down — anywhere SMS works, there is no reason
 * to skip the code, and once Saudi SMS works the exception closes by itself.
 */
export function canBookWithPhone(
  user: { phone?: string | null; phoneVerified?: boolean | null },
  saudiLive: boolean = saudiSmsLive()
): boolean {
  if (user.phoneVerified) return true;
  return !saudiLive && isSaudiMobile(user.phone);
}

/**
 * Better Auth's Google provider, or undefined until both keys are set — so a
 * deployment without Google configured never offers a login that cannot work.
 *
 * `redirectURI` is spelled out because Better Auth would otherwise build it
 * from `baseURL`, which is SITE_URL (the website) — and the auth routes live on
 * the Convex site. It must match the redirect URI registered in Google Cloud.
 */
export function googleProvider(env: Env = process.env) {
  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return undefined;
  return {
    clientId,
    clientSecret,
    redirectURI: `${env.CONVEX_SITE_URL}/api/auth/callback/google`,
    // Someone with a work and a personal Google account picks which one,
    // instead of being signed in silently with whichever the browser knows.
    prompt: "select_account" as const,
  };
}
