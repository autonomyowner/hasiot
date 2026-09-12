import { internalQuery } from "../_generated/server";
import { isPublicListing } from "../listings/queries";

/**
 * What the AI planner is allowed to know about the real app.
 *
 * Before this existed the planner was a pure text generator: every place it
 * recommended came from a hand-written list inside the system prompt, so it
 * named attractions the app has no page for, never mentioned the hotels it can
 * actually book, and invented opening hours for listings whose real hours sit
 * in `workingHours` two tables away. It also never read `travelKnowledge` —
 * the admin panel's knowledge-base tab wrote rows that nothing consumed.
 *
 * The caps below bound the prompt, not the tables. Production carries ~25
 * public listings, so nothing is dropped today; the slice is here so a growing
 * catalogue degrades by getting shorter rather than by blowing the context
 * window on every request.
 */
const MAX_LISTINGS = 150;
const MAX_KNOWLEDGE = 40;
const MAX_KNOWLEDGE_CHARS = 800;
const LISTING_SCAN = 1000;

export const getPlannerContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const scanned = await ctx.db.query("listings").take(LISTING_SCAN);

    // Only what the model needs to name a place and judge whether it fits.
    // Descriptions and image URLs are deliberately left out — they are the
    // bulk of a listing row and the model does not need them to recommend one.
    const listings = scanned
      .filter(isPublicListing)
      .slice(0, MAX_LISTINGS)
      .map((listing) => ({
        name_en: listing.name_en,
        name_ar: listing.name_ar,
        type: listing.type,
        city: listing.city,
        address: listing.address,
        priceRange: listing.priceRange,
        pricePerNight: listing.pricePerNight,
        rating: listing.rating,
      }));

    const knowledgeRows = await ctx.db
      .query("travelKnowledge")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(MAX_KNOWLEDGE);

    const knowledge = knowledgeRows.map((row) => ({
      category: row.category,
      title: row.title,
      content: row.content.slice(0, MAX_KNOWLEDGE_CHARS),
    }));

    return { listings, knowledge };
  },
});
