import { internalMutation } from "../_generated/server";

// One-time migration: set role="patient" on all existing users and remove clerkId
// Run with: npx convex run migrations:migrateUsersToRoles
export default internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    let migrated = 0;

    for (const user of users) {
      const updates: Record<string, unknown> = {};
      let needsUpdate = false;

      if (!(user as any).role) {
        updates.role = "patient";
        updates.updatedAt = Date.now();
        needsUpdate = true;
      }

      // Remove legacy clerkId field
      if ((user as any).clerkId) {
        updates.clerkId = undefined;
        needsUpdate = true;
      }

      if (needsUpdate) {
        await ctx.db.patch(user._id, updates);
        migrated++;
      }
    }

    return { total: users.length, migrated };
  },
});
