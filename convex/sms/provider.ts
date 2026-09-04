/**
 * SMS delivery, behind an interface with two implementations.
 *
 * Why an interface: Twilio Verify is the right choice *today* because it sends
 * through Twilio's own sender IDs, which are already registered with Saudi
 * carriers — an unregistered alphanumeric sender is silently dropped by STC and
 * Mobily, and registering "HASIO" needs the operating company's CR and takes
 * days. Once that registration exists, a local provider (Unifonic, Msegat) is
 * roughly a fifth of the price per message, and swapping it in should be one
 * new object in this file rather than surgery on the auth config.
 *
 * Why `fetch` and not the Twilio SDK: the Convex default runtime is not Node,
 * and this module is imported by auth.ts -> http.ts. Adding `"use node"` here
 * would move those into the Node runtime and break bundling. `fetch` and
 * `btoa` are both available in the default runtime, which is all Twilio's REST
 * API needs.
 */

export type SmsLocale = "ar" | "en";

export interface SmsProvider {
  name: "console" | "twilio-verify";
  /**
   * Deliver `code` to `phone`.
   *
   * Note that a Verify-style provider generates and stores its own code, so it
   * ignores the argument. Better Auth always generates one regardless (it has
   * to, to support providers that don't) — which is exactly why `verifyOtp`
   * exists below: whoever generated the code must be the one to check it.
   */
  sendOtp(phone: string, code: string, locale: SmsLocale): Promise<void>;
  /**
   * Present only when the provider owns verification. When absent, Better Auth
   * checks its own stored code, including expiry and the attempt counter.
   */
  verifyOtp?(phone: string, code: string): Promise<boolean>;
}

/**
 * Local development. The code goes to the Convex logs (`npx convex logs`),
 * which is also the demo fallback if SMS delivery is slow on the day.
 *
 * Deliberately has no `verifyOtp`, so Better Auth's own expiry and
 * attempt-limiting run — otherwise the dev path would exercise none of the
 * checks the production path relies on.
 */
const consoleProvider: SmsProvider = {
  name: "console",
  async sendOtp(phone, code) {
    console.log(`[sms:console] OTP for ${phone}: ${code}`);
  },
};

function twilioVerifyProvider(
  accountSid: string,
  authToken: string,
  serviceSid: string
): SmsProvider {
  const base = `https://verify.twilio.com/v2/Services/${serviceSid}`;
  const auth = `Basic ${btoa(`${accountSid}:${authToken}`)}`;

  async function post(path: string, form: Record<string, string>) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form).toString(),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text);
    } catch {
      // Twilio returns JSON for every documented response; a non-JSON body is
      // an infrastructure error and `text` is the only useful detail.
    }
    return { res, json, text };
  }

  return {
    name: "twilio-verify",

    async sendOtp(phone, _code, locale) {
      const { res, json, text } = await post("/Verifications", {
        To: phone,
        Channel: "sms",
        Locale: locale,
      });
      if (!res.ok) {
        throw new Error(`Twilio Verify ${res.status}: ${json.message ?? text}`);
      }
    },

    async verifyOtp(phone, code) {
      const { res, json, text } = await post("/VerificationCheck", { To: phone, Code: code });
      // 404 means there is no pending verification for this number — the code
      // expired, or it was already consumed. That is a wrong code from the
      // caller's point of view, not a server fault.
      if (res.status === 404) return false;
      if (!res.ok) {
        throw new Error(`Twilio Verify check ${res.status}: ${json.message ?? text}`);
      }
      return json.status === "approved";
    },
  };
}

/**
 * Resolve the provider from the environment. `env` is injectable for tests.
 *
 * Throws on a misconfigured twilio-verify rather than silently falling back to
 * the console provider: a deployment that thinks it is sending SMS but is only
 * writing to a log would hand every caller a code they never receive.
 */
export function getSmsProvider(
  env: Record<string, string | undefined> = process.env
): SmsProvider {
  const configured = env.SMS_PROVIDER ?? "console";

  if (configured === "console") return consoleProvider;

  if (configured === "twilio-verify") {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const serviceSid = env.TWILIO_VERIFY_SERVICE_SID;
    if (!accountSid || !authToken || !serviceSid) {
      throw new Error(
        "SMS_PROVIDER=twilio-verify requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID"
      );
    }
    return twilioVerifyProvider(accountSid, authToken, serviceSid);
  }

  throw new Error(`Unknown SMS_PROVIDER: ${configured}`);
}

/** Pick the SMS language from the request's Accept-Language, defaulting to Arabic. */
export function localeFromAcceptLanguage(header?: string | null): SmsLocale {
  return typeof header === "string" && header.trim().toLowerCase().startsWith("ar") ? "ar" : "en";
}
