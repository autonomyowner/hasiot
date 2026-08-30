import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * Promote an existing user to admin from the command line:
 *
 *   npx convex run admin/devTools:grantAdmin '{"email":"owner@example.com"}'
 *   npx convex run admin/devTools:grantAdmin '{"email":"owner@example.com"}' --prod
 *
 * This is an internalMutation, so it is not callable by any client — only by
 * someone who already holds deploy credentials for the project, who could edit
 * the row in the dashboard anyway. It exists because "open the Convex dashboard
 * and change a field by hand" is an awkward step to hand to the owner, and a
 * typo there silently produces an account that cannot reach /admin.
 *
 * The user must already exist in the `users` table (they sign up first).
 */
export const grantAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error(
        `No user with email ${args.email}. They must sign in once before being made an admin.`
      );
    }

    await ctx.db.patch(user._id, { role: "admin", updatedAt: Date.now() });
    return { userId: user._id, email: user.email, role: "admin" };
  },
});

/**
 * The reverse, for when an admin leaves. Demotes to tourist rather than
 * deleting: their bookings, trips and favourites stay attached to the account.
 */
export const revokeAdmin = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) throw new Error(`No user with email ${args.email}.`);
    if (user.role !== "admin") throw new Error(`${args.email} is not an admin.`);

    await ctx.db.patch(user._id, { role: "tourist", updatedAt: Date.now() });
    return { userId: user._id, email: user.email, role: "tourist" };
  },
});

/** Who currently holds admin. Useful before revoking one. */
export const listAdmins = internalMutation({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .take(50);
    return admins.map((a) => ({ email: a.email, createdAt: a.createdAt }));
  },
});
