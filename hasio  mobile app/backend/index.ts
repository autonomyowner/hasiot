// Create API reference using anyApi proxy from convex/server.
// Directory renamed from "convex/" to "backend/" to avoid collision with the "convex" npm package.
import { anyApi } from "convex/server";

// Re-export with proper typing from the shared backend
import type { api as FullApi } from "../../convex/_generated/api";

export const api: typeof FullApi = anyApi as unknown as typeof FullApi;
