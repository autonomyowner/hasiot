import { query } from "../_generated/server";

// Expose public config values to the frontend
export const getPublicConfig = query({
  args: {},
  handler: async () => {
    return {
      mapboxToken: process.env.MAPBOX_PUBLIC_TOKEN || "",
    };
  },
});
