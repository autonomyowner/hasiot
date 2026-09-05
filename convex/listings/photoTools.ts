import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

/**
 * CLI-only helpers for putting real photographs onto seeded listings.
 *
 * The public `users/mutations:generateUploadUrl` requires a signed-in user and
 * a per-user rate limit, which is right for the app and useless from a terminal.
 * These are internal, so they can only be reached through `npx convex run`.
 *
 * The flow is three steps, because file bytes never pass through a mutation:
 *   1. generatePhotoUploadUrl  -> a signed URL
 *   2. POST the file to it     -> { storageId }
 *   3. attachListingImages     -> resolves storage ids to URLs and patches
 *
 * Storage URLs are permanent and served by Convex, so unlike the Unsplash links
 * the original seed used, they cannot 404 later when someone deletes a photo.
 */
export const generatePhotoUploadUrl = internalMutation({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/**
 * Replace a listing's images with the uploaded files, in the order given.
 * Index 0 becomes the cover, which is the only one a card ever shows.
 */
export const attachListingImages = internalMutation({
  args: {
    entries: v.array(
      v.object({
        name_en: v.string(),
        storageIds: v.array(v.id("_storage")),
      })
    ),
  },
  handler: async (ctx, args) => {
    const listings = await ctx.db.query("listings").collect();
    const byName = new Map(listings.map((l) => [l.name_en, l]));

    const attached: string[] = [];
    const notFound: string[] = [];

    for (const entry of args.entries) {
      const listing = byName.get(entry.name_en);
      if (!listing) {
        notFound.push(entry.name_en);
        continue;
      }

      const urls: string[] = [];
      for (const storageId of entry.storageIds) {
        const url = await ctx.storage.getUrl(storageId);
        if (url) urls.push(url);
      }
      if (urls.length === 0) continue;

      await ctx.db.patch(listing._id, { images: urls, updatedAt: Date.now() });
      attached.push(`${entry.name_en} (${urls.length})`);
    }

    return { attached, notFound };
  },
});

/**
 * Strip image URLs that no longer resolve.
 *
 * Five of the 64 Unsplash links baked into `seedImages.ts` now 404 — the
 * photographers withdrew them. Every one of the five sits at index 1, so the
 * covers still render and the breakage only shows when you swipe the gallery on
 * a detail sheet. Removing beats substituting: one real photo is better than one
 * real photo and one grey frame.
 */
export const dropDeadImages = internalMutation({
  args: { urls: v.array(v.string()) },
  handler: async (ctx, args) => {
    const dead = new Set(args.urls);
    const listings = await ctx.db.query("listings").collect();

    let cleaned = 0;
    let removed = 0;

    for (const listing of listings) {
      if (!listing.images?.length) continue;
      const kept = listing.images.filter((url) => !dead.has(url));
      if (kept.length === listing.images.length) continue;

      removed += listing.images.length - kept.length;
      await ctx.db.patch(listing._id, { images: kept, updatedAt: Date.now() });
      cleaned++;
    }

    return { cleaned, removed };
  },
});
