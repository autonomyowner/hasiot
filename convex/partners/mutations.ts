import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { getAuthenticatedAppUser } from "../auth";
import { AUTH_ERRORS } from "../lib/errors";
import { saveGuestNoteFor } from "./service";

/** A partner's private note and tags about one of their guests. Rules in ./service.ts. */
export const saveGuestNote = mutation({
  args: { guestId: v.id("users"), note: v.string(), tags: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedAppUser(ctx);
    if (!user) throw new ConvexError(AUTH_ERRORS.NOT_AUTHENTICATED);
    return await saveGuestNoteFor(ctx, user, args);
  },
});
