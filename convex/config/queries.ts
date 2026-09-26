import { query } from "../_generated/server";
import { googleProvider, saudiSmsLive } from "../lib/phoneRules";

// Expose public config values to the frontend
export const getPublicConfig = query({
  args: {},
  handler: async () => {
    return {
      mapboxToken: process.env.MAPBOX_PUBLIC_TOKEN || "",
      // True only when the SMS provider is the demo one, which verifies any
      // code. The sign-in screen reads this to fill the code itself, so a
      // demo audience sees a phone that appears to auto-fill a real SMS.
      demoAuth: process.env.SMS_PROVIDER === "demo",
      // Whether the "Continue with Google" button can work here: both Google
      // keys are set, so auth.ts registered the provider.
      googleAuth: googleProvider() !== undefined,
      // Whether a code sent to a +966 number arrives. While false the clients
      // do not send one, and say so (lib/phoneRules.ts).
      saudiSmsLive: saudiSmsLive(),
    };
  },
});
