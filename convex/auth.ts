import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";

const siteUrl = process.env.SITE_URL || "http://localhost:5173";

export const authComponent = createClient<DataModel>(components.betterAuth);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    trustedOrigins: [
      "https://tabra.dz",
      "https://www.tabra.dz",
      "http://localhost:5173",
      "http://localhost:3000",
    ],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    plugins: [convex({ authConfig })],
  });
};

// Get authenticated user from the app's users table (not better-auth's internal table)
// IMPORTANT: Wrap in try-catch — authComponent.getAuthUser throws when unauthenticated
export async function getAuthenticatedAppUser(ctx: QueryCtx | MutationCtx) {
  try {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser || !authUser.email) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", authUser.email))
      .first();
    return user;
  } catch {
    return null;
  }
}
