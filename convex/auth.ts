import { createClient, type AuthFunctions, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { phoneNumber } from "better-auth/plugins/phone-number";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { components, internal } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";
import { QueryCtx, MutationCtx } from "./_generated/server";
import { betterAuth } from "better-auth";
import authConfig from "./auth.config";
import { getSmsProvider, localeFromAcceptLanguage } from "./sms/provider";
import { tempEmailForPhone } from "./lib/contact";
import { mirrorAuthUserUpdate, upsertUserFromAuth } from "./users/sync";

const siteUrl = process.env.SITE_URL || "http://localhost:5173";

// The annotation is load-bearing, not decoration. `internal.auth` contains the
// trigger mutations exported at the bottom of this file, which are produced by
// the very client being constructed here — TypeScript cannot resolve that cycle
// on its own and infers `any`, which then silently drops the trigger types.
const authFunctions: AuthFunctions = internal.auth;

export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      // Runs in the same transaction as the Better Auth write, which is what
      // makes phone sign-up work: the plugin creates the auth user during OTP
      // verification, with no client code in between to create the app row.
      onCreate: async (ctx, doc) => {
        await upsertUserFromAuth(ctx, doc);
      },
      // Carries phone verification across: /phone-number/verify sets
      // phoneNumber + phoneNumberVerified on the auth user, and this is what
      // makes users.phoneVerified follow — which is what booking gates on.
      onUpdate: async (ctx, newDoc, oldDoc) => {
        await mirrorAuthUserUpdate(ctx, newDoc, oldDoc);
      },
      // Deliberately empty. deleteMyAccount cascades the app's own tables and
      // deletes the users row itself *after* calling auth.api.deleteUser; a
      // trigger that deleted it here would make that final delete throw on a
      // row that no longer exists.
      onDelete: async () => {},
    },
  },
});

export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const sms = getSmsProvider();

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
      "https://hearty-ram-74.eu-west-1.convex.site", // Mobile app auth (production)
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
    plugins: [
      // Phone is the primary sign-in for guests: a Saudi traveller expects a
      // number and a code, not an email and a password. Email sign-in stays
      // enabled above for accounts that predate this and for the admin portal.
      phoneNumber({
        otpLength: 6,
        expiresIn: 300, // seconds
        allowedAttempts: 3,
        // The client normalises 05xxxxxxxx to E.164 before sending, so anything
        // arriving in another shape is a bug or a probe.
        phoneNumberValidator: (phone) => /^\+[1-9]\d{7,14}$/.test(phone),
        // Better Auth's user model requires an email. A phone-only guest has
        // none, so one is synthesised on a domain that accepts no mail — see
        // lib/contact.ts. Everything that sends email must skip these.
        signUpOnVerification: {
          getTempEmail: tempEmailForPhone,
          getTempName: (phone) => phone,
        },
        sendOTP: async ({ phoneNumber: phone, code }, endpoint) => {
          // The spend guard is in the `hooks.before` middleware below, not
          // here: Better Auth runs sendOTP through runInBackgroundOrAwait,
          // which catches and logs every error, so a throw from inside this
          // callback can never reach the caller. Rate limiting here would still
          // block the SMS, but the guest would get "code sent" and then wait
          // for a message that was never going to arrive.
          await sms.sendOtp(
            phone,
            code,
            localeFromAcceptLanguage(endpoint?.headers?.get("accept-language"))
          );
        },
        // Only when the provider owns the code. Better Auth always generates
        // and stores one of its own, so whoever generated it must check it:
        // with Twilio Verify that is Twilio, and in console mode it is Better
        // Auth itself (which also gives us its expiry and attempt limiting).
        ...(sms.verifyOtp
          ? { verifyOTP: ({ phoneNumber: phone, code }) => sms.verifyOtp!(phone, code) }
          : {}),
      }),
      convex({ authConfig }),
    ],
    hooks: {
      // Runs as middleware in front of the matched route, so unlike a throw
      // inside sendOTP, an error raised here actually reaches the caller.
      before: createAuthMiddleware(async (hookCtx) => {
        if (hookCtx.path !== "/phone-number/send-otp") return;

        // Every SMS costs money and this endpoint is unauthenticated — anyone
        // can request a code for any number in the world. Two buckets: one per
        // number so a single person cannot be flooded with texts, and a global
        // one that caps the daily spend however the requests are spread.
        //
        // `ctx` is createAuth's argument: a query, mutation or action context
        // depending on the caller. Auth routes run as HTTP actions, so
        // runMutation is there, but the static type is a union.
        if (!("runMutation" in ctx)) return;

        const phone = (hookCtx.body as { phoneNumber?: unknown } | undefined)?.phoneNumber;
        if (typeof phone !== "string") return; // let the route's own validation answer

        const perPhone = await ctx.runMutation(internal.rateLimit.checkAndIncrement, {
          key: `otp:${phone}`,
          limit: 5,
        });
        const global = await ctx.runMutation(internal.rateLimit.checkAndIncrement, {
          key: "otp:global",
          limit: 300,
        });

        if (!perPhone.allowed || !global.allowed) {
          throw new APIError("TOO_MANY_REQUESTS", {
            code: "OTP_RATE_LIMITED",
            message:
              "طلبت رموزًا كثيرة اليوم. حاول لاحقًا. / Too many codes requested today. Please try again later.",
          });
        }
      }),
    },
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
// Returns null if: unauthenticated, no Better-Auth user, no app users row
// (deleted accounts have no app row even though Better-Auth may still have a
// record), or the account is suspended.
export async function getAuthenticatedAppUser(ctx: QueryCtx | MutationCtx) {
  try {
    const authUser = await authComponent.getAuthUser(ctx);
    if (!authUser) return null;

    // authId is the real join. Email is the fallback for rows created before
    // the triggers existed: they get an authId on their owner's next auth
    // event, and until then only the email matches.
    const user =
      (await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
        .first()) ??
      (authUser.email
        ? await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", authUser.email))
            .first()
        : null);

    // A suspended account keeps its session but reads as signed out, so every
    // guard in the codebase blocks it without needing to know about suspension.
    if (!user || user.isSuspended) return null;

    return user;
  } catch {
    return null;
  }
}

/**
 * A verified phone number, required before booking: the host needs a number
 * they can actually call when a guest is late or lost.
 */
export async function requireVerifiedPhone(ctx: QueryCtx | MutationCtx) {
  const user = await getAuthenticatedAppUser(ctx);
  if (!user) throw new Error("Not authenticated");
  if (!user.phoneVerified) {
    throw new Error(
      "يلزم توثيق رقم الجوال قبل الحجز. / A verified phone number is required to book."
    );
  }
  return user;
}
