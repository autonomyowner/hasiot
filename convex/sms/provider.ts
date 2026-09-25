/**
 * SMS delivery, behind an interface with one implementation per route.
 *
 * Why an interface: the sender ID is the constraint, not the API. An
 * unregistered alphanumeric sender is silently dropped by STC and Mobily, so
 * the first route that worked was Twilio Verify — it sends through Twilio's
 * own sender IDs, already registered with the Saudi carriers, which let sign-in
 * work before "HASIO" was registered to us.
 *
 * Taqnyat is the intended production route: a Saudi provider registers the
 * sender as part of onboarding, prices a message at a fraction of what routing
 * in from outside the Kingdom costs, and answers to the CITC rules directly.
 * The interface is what made that swap one new object in this file rather than
 * surgery on the auth config, which was the point of building it this way.
 *
 * Why `fetch` and not the Twilio SDK: the Convex default runtime is not Node,
 * and this module is imported by auth.ts -> http.ts. Adding `"use node"` here
 * would move those into the Node runtime and break bundling. `fetch` and
 * `btoa` are both available in the default runtime, which is all Twilio's REST
 * API needs.
 */

export type SmsLocale = "ar" | "en";

export interface SmsProvider {
  name: "console" | "twilio-verify" | "infobip" | "taqnyat" | "demo";
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
 * Infobip, plain SMS.
 *
 * Deliberately their messaging API rather than their 2FA product. The 2FA API
 * returns a `pinId` on send that the verify call then needs, which does not fit
 * an interface keyed on phone number and would mean storing the id between
 * the two requests. Plain SMS only carries the text: Better Auth generates the
 * code, Better Auth checks it, and there is no `verifyOtp` here — so its own
 * expiry and attempt limiting run, exactly as in console mode.
 *
 * Numbers go out without the leading plus; that is the form Infobip documents.
 * `from` is omitted when unset so the account's default sender applies — an
 * empty string would be sent literally and rejected.
 */
function infobipProvider(apiKey: string, baseUrl: string, from?: string): SmsProvider {
  const url = `https://${baseUrl}/sms/2/text/advanced`;

  return {
    name: "infobip",

    async sendOtp(phone, code, locale) {
      const text =
        locale === "ar"
          ? `رمز التحقق الخاص بك في Hasio هو ${code}`
          : `Your Hasio verification code is ${code}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `App ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              ...(from ? { from } : {}),
              destinations: [{ to: phone.replace(/^\+/, "") }],
              text,
            },
          ],
        }),
      });

      const raw = await res.text();
      let json: Record<string, any> = {};
      try {
        json = JSON.parse(raw);
      } catch {
        // Non-JSON means an infrastructure error; `raw` is the only detail.
      }

      if (!res.ok) {
        const detail = json?.requestError?.serviceException?.text ?? raw;
        throw new Error(`Infobip ${res.status}: ${detail}`);
      }

      // Infobip answers 200 to a well-formed request and reports each
      // message's fate in the body. A rejected destination is a failure that
      // must surface, or the guest is told a code is on its way when it is not.
      const status = json?.messages?.[0]?.status;
      if (status?.groupName === "REJECTED") {
        throw new Error(`Infobip rejected: ${status.name ?? "unknown"} — ${status.description ?? ""}`);
      }
    },
  };
}

/**
 * Taqnyat (تقنيات), plain SMS — the Saudi route.
 *
 * Why this one: an alphanumeric sender has to be registered with the Saudi
 * carriers before STC and Mobily will carry it, and a local provider does that
 * registration as part of onboarding rather than leaving us to it. Per-message
 * cost is a fraction of routing in from outside the Kingdom, which matters when
 * every sign-in is an SMS.
 *
 * Their Verify product is deliberately not used. It owns the code, which would
 * fit `verifyOtp` — but generate and check are tied together by a `requestId`
 * that the caller has to carry between the two requests, and this interface is
 * keyed on the phone number alone, so there is nowhere to keep it. That is the
 * same reason Infobip's 2FA API was passed over for their plain messaging one.
 * Plain SMS keeps Better Auth as the one that generates and checks the code,
 * so its expiry and attempt limiting still run.
 *
 * `sender` is required, unlike Infobip's optional `from`: Taqnyat has no
 * account-default sender to fall back on, so a missing one is a startup error
 * rather than something to discover on the first send.
 */
function taqnyatProvider(token: string, sender: string): SmsProvider {
  const url = "https://api.taqnyat.sa/v1/messages";

  return {
    name: "taqnyat",

    async sendOtp(phone, code, locale) {
      const text =
        locale === "ar"
          ? `رمز التحقق الخاص بك في Hasio هو ${code}`
          : `Your Hasio verification code is ${code}`;

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          // International form with neither a leading plus nor the 00 trunk
          // prefix — both are rejected.
          recipients: [phone.replace(/^\+/, "").replace(/^00/, "")],
          body: text,
          sender,
        }),
      });

      const raw = await res.text();
      let json: Record<string, any> = {};
      try {
        json = JSON.parse(raw);
      } catch {
        // Non-JSON means an infrastructure error; `raw` is the only detail.
      }

      if (!res.ok) {
        throw new Error(`Taqnyat ${res.status}: ${json?.message ?? raw}`);
      }

      // A well-formed request is a 201 whatever happened to the number itself;
      // the per-recipient outcome is in the body. Reporting "code sent" for a
      // rejected number leaves the guest waiting for a text that never comes.
      // The published schema types `rejected` loosely, so accept either an
      // array or a bare value and treat anything non-empty as a failure.
      const rejected = json?.rejected;
      const isRejected = Array.isArray(rejected) ? rejected.length > 0 : Boolean(rejected);
      if (isRejected) {
        throw new Error(`Taqnyat rejected: ${JSON.stringify(rejected)}`);
      }
    },
  };
}

/**
 * DEMO MODE — every code verifies. Nothing is sent.
 *
 * Exists for one reason: a stage demo where the audience signs in on their own
 * phones and no SMS route to their country is open yet. The app, when the
 * backend reports demo mode, fills the code field itself after a beat, so the
 * flow looks like a phone auto-filling a real SMS.
 *
 * This is a complete authentication bypass: anyone can sign in as any number.
 * It must never be the provider on a deployment real users reach — switch
 * `SMS_PROVIDER` away from "demo" the moment a real route works. The console
 * line on every send is deliberate noise in the logs so it cannot be forgotten.
 */
const demoProvider: SmsProvider = {
  name: "demo",
  async sendOtp(phone) {
    console.warn(`[sms:DEMO] no SMS sent to ${phone}; any 6-digit code will verify`);
  },
  // Owning verification is what makes Better Auth skip its own stored code.
  async verifyOtp(_phone, code) {
    return /^\d{6}$/.test(code);
  },
};

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
  if (configured === "demo") return demoProvider;

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

  if (configured === "infobip") {
    const apiKey = env.INFOBIP_API_KEY;
    const baseUrl = env.INFOBIP_BASE_URL;
    if (!apiKey || !baseUrl) {
      throw new Error("SMS_PROVIDER=infobip requires INFOBIP_API_KEY and INFOBIP_BASE_URL");
    }
    return infobipProvider(apiKey, baseUrl, env.INFOBIP_FROM);
  }

  if (configured === "taqnyat") {
    const token = env.TAQNYAT_BEARER_TOKEN;
    const sender = env.TAQNYAT_SENDER;
    if (!token || !sender) {
      throw new Error("SMS_PROVIDER=taqnyat requires TAQNYAT_BEARER_TOKEN and TAQNYAT_SENDER");
    }
    return taqnyatProvider(token, sender);
  }

  throw new Error(`Unknown SMS_PROVIDER: ${configured}`);
}

/** Pick the SMS language from the request's Accept-Language, defaulting to Arabic. */
export function localeFromAcceptLanguage(header?: string | null): SmsLocale {
  return typeof header === "string" && header.trim().toLowerCase().startsWith("ar") ? "ar" : "en";
}
