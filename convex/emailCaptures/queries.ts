import { query } from "../_generated/server";
import { requireAdmin } from "../auth";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    // Admin-only: this returns personal data. It was previously unguarded,
    // so any client could enumerate every captured email address.
    await requireAdmin(ctx);
    const emails = await ctx.db.query("emailCaptures").order("desc").take(500);
    return emails;
  },
});
