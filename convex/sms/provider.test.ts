import { afterEach, describe, expect, it, vi } from "vitest";
import { getSmsProvider, localeFromAcceptLanguage } from "./provider";

const TWILIO_ENV = {
  SMS_PROVIDER: "twilio-verify",
  TWILIO_ACCOUNT_SID: "ACtest",
  TWILIO_AUTH_TOKEN: "secret",
  TWILIO_VERIFY_SERVICE_SID: "VAtest",
};

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getSmsProvider", () => {
  it("defaults to the console provider", () => {
    expect(getSmsProvider({}).name).toBe("console");
    expect(getSmsProvider({ SMS_PROVIDER: "console" }).name).toBe("console");
  });

  it("leaves verification to Better Auth in console mode", () => {
    // No verifyOtp means the plugin checks its own stored code, so expiry and
    // the attempt limit are exercised in development too.
    expect(getSmsProvider({}).verifyOtp).toBeUndefined();
  });

  it("logs the code so it can be read from the dev logs", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await getSmsProvider({}).sendOtp("+966501234567", "123456", "ar");
    expect(log).toHaveBeenCalledWith("[sms:console] OTP for +966501234567: 123456");
    log.mockRestore();
  });

  it("refuses to start twilio-verify without credentials", () => {
    expect(() => getSmsProvider({ SMS_PROVIDER: "twilio-verify" })).toThrow(/requires TWILIO_/);
    expect(() =>
      getSmsProvider({ ...TWILIO_ENV, TWILIO_VERIFY_SERVICE_SID: undefined })
    ).toThrow(/requires TWILIO_/);
  });

  it("rejects an unknown provider rather than falling back", () => {
    expect(() => getSmsProvider({ SMS_PROVIDER: "unifonic" })).toThrow(/Unknown SMS_PROVIDER/);
  });
});

describe("twilio-verify sendOtp", () => {
  it("posts a form-encoded verification with basic auth", async () => {
    const fetchMock = mockFetch(201, { status: "pending" });
    await getSmsProvider(TWILIO_ENV).sendOtp("+966501234567", "ignored", "ar");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/Verifications");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      `Basic ${btoa("ACtest:secret")}`
    );
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );

    const body = new URLSearchParams(init.body as string);
    expect(body.get("To")).toBe("+966501234567");
    expect(body.get("Channel")).toBe("sms");
    expect(body.get("Locale")).toBe("ar");
    // Twilio generates its own code; ours must not leak into the request.
    expect(init.body as string).not.toContain("ignored");
  });

  it("surfaces Twilio's message on failure", async () => {
    mockFetch(400, { message: "Invalid parameter To" });
    await expect(
      getSmsProvider(TWILIO_ENV).sendOtp("+1555", "123456", "en")
    ).rejects.toThrow("Twilio Verify 400: Invalid parameter To");
  });
});

describe("twilio-verify verifyOtp", () => {
  it("accepts an approved check", async () => {
    const fetchMock = mockFetch(200, { status: "approved" });
    const ok = await getSmsProvider(TWILIO_ENV).verifyOtp!("+966501234567", "123456");
    expect(ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/VerificationCheck");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("To")).toBe("+966501234567");
    expect(body.get("Code")).toBe("123456");
  });

  it("rejects a pending check", async () => {
    mockFetch(200, { status: "pending" });
    expect(await getSmsProvider(TWILIO_ENV).verifyOtp!("+966501234567", "000000")).toBe(false);
  });

  it("treats 404 as a wrong code, not an outage", async () => {
    // Twilio 404s once a verification is consumed or has expired. Throwing
    // here would show the guest a server error for a mistyped digit.
    mockFetch(404, { code: 20404, message: "not found" });
    expect(await getSmsProvider(TWILIO_ENV).verifyOtp!("+966501234567", "123456")).toBe(false);
  });

  it("throws on a real server error", async () => {
    mockFetch(500, { message: "Service unavailable" });
    await expect(
      getSmsProvider(TWILIO_ENV).verifyOtp!("+966501234567", "123456")
    ).rejects.toThrow("Twilio Verify check 500: Service unavailable");
  });
});

describe("localeFromAcceptLanguage", () => {
  it("defaults to English and honours an Arabic header", () => {
    expect(localeFromAcceptLanguage("ar")).toBe("ar");
    expect(localeFromAcceptLanguage("ar-SA,ar;q=0.9")).toBe("ar");
    expect(localeFromAcceptLanguage("AR-sa")).toBe("ar");
    expect(localeFromAcceptLanguage("en-GB")).toBe("en");
    expect(localeFromAcceptLanguage(null)).toBe("en");
    expect(localeFromAcceptLanguage(undefined)).toBe("en");
  });
});
