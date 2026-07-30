import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

// One-off support operation, runnable only via CLI/dashboard:
//   npx convex run admin/internalOps:setUserApproval '{"email":"...","isApproved":true}' --prod
// Used to pre-approve the App Store review demo account without going through /admin.
export const setUserApproval = internalMutation({
  args: {
    email: v.string(),
    isApproved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!user) {
      throw new Error(`No user with email ${args.email}`);
    }

    await ctx.db.patch(user._id, {
      isApproved: args.isApproved,
      updatedAt: Date.now(),
    });

    return { userId: user._id, role: user.role, isApproved: args.isApproved };
  },
});
