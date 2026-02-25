import { query } from "../_generated/server";

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const emails = await ctx.db.query("emailCaptures").order("desc").collect();
    return emails;
  },
});
