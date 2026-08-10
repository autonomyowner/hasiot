import { query } from "../_generated/server";
import { getAuthenticatedAppUser } from "../auth";

// A generous ceiling rather than pagination: moments are personal and a user
// with more than this has an unusual account, not a broken screen.
const MAX_MOMENTS = 500;

/**
 * The signed-in user's own moments, newest first, with each storage id already
 * resolved to a URL so the client never has to round-trip per image.
 *
 * Returns [] rather than throwing when signed out — the Moments screen renders
 * a sign-in prompt in that state and an error would be noise.
 */
export const getMyMoments = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) return [];

    const rows = await ctx.db
      .query("moments")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(MAX_MOMENTS);

    const withUrls = await Promise.all(
      rows.map(async (row) => ({
        id: row._id,
        // A storage id whose file has been removed resolves to null. Carry that
        // through as null rather than dropping the row, so the moment's note
        // and date survive and the card can show its own placeholder.
        image_url: await ctx.storage.getUrl(row.storageId),
        note: row.note ?? null,
        location: row.location ?? null,
        created_at: new Date(row.createdAt).toISOString(),
      }))
    );

    return withUrls;
  },
});
