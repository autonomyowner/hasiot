import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { getAuthenticatedAppUser } from "../auth";
import { enforceRateLimit } from "../rateLimit";

// Per-user daily ceiling on moment creation. High enough that a real trip never
// hits it, low enough that a compromised session cannot fill storage.
const MOMENTS_PER_DAY = 100;

const MAX_NOTE_LENGTH = 500;
const MAX_LOCATION_LENGTH = 120;

export const createMoment = mutation({
  args: {
    storageId: v.id("_storage"),
    note: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Sign in to save moments");

    await enforceRateLimit(ctx, `moment:${user._id}`, MOMENTS_PER_DAY);

    const note = args.note?.trim().slice(0, MAX_NOTE_LENGTH) || undefined;
    const location =
      args.location?.trim().slice(0, MAX_LOCATION_LENGTH) || undefined;

    const momentId = await ctx.db.insert("moments", {
      userId: user._id,
      storageId: args.storageId,
      note,
      location,
      createdAt: Date.now(),
    });

    return { momentId };
  },
});

export const deleteMoment = mutation({
  args: { momentId: v.id("moments") },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new Error("Sign in to delete moments");

    const moment = await ctx.db.get(args.momentId);
    if (!moment) return { success: true };

    // Ownership check before anything is removed — a moment id is guessable in
    // principle, and these are private by definition.
    if (moment.userId !== user._id) {
      throw new Error("Not your moment");
    }

    // Storage first: if the row went first and this threw, the file would be
    // orphaned with nothing left pointing at it.
    await ctx.storage.delete(moment.storageId);
    await ctx.db.delete(moment._id);

    return { success: true };
  },
});
