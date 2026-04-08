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
      "http://localhost:5173",
      "http://localhost:3000",
      "https://www.hasio.xyz",
      "https://hasio.xyz",
      "https://hasio.vercel.app",
      "https://limitless-mockingbird-449.eu-west-1.convex.site", // Mobile app auth (dev)
      "https://hearty-ram-74.convex.site", // Mobile app auth (production)
    ],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
    },
    advanced: {
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },
    plugins: [convex({ authConfig })],
    // Google OAuth removed — using email/password only
  });
};

// Require admin role — throws if not authenticated or not admin
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthenticatedAppUser(ctx);
  if (!user || user.role !== "admin") {
    throw new Error("Unauthorized: admin access required");
  }
  return user;
}

// Get authenticated user from the app's users table (not better-auth's internal table)
// IMPORTANT: Wrap in try-catch — authComponent.getAuthUser throws when unauthenticated
// Returns null if: unauthenticated, no Better-Auth user, or no app users row
// (deleted accounts have no app row even though Better-Auth may still have a record)
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
