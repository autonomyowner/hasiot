import { ConvexError } from "convex/values";
/**
 * Review rules, as pure functions.
 *
 * Separated from the mutations for the same reason the booking rules are:
 * `convex-test` cannot load the Better-Auth component, so anything reached
 * through `getAuthenticatedAppUser` is untestable. Everything worth asserting
 * lives here or in `service.ts`.
 */

/** Matches the mobile input's own limit, so the client never posts what this rejects. */
export const MAX_REVIEW_TEXT = 500;

/** Per user per day. Generous for a real guest, tight enough to blunt a bot. */
export const REVIEWS_PER_DAY = 10;

/**
 * How many reviews a rating is computed from.
 *
 * Every reader of a listing's score must use this same bound. `getSummary`
 * originally capped at 200 while `recomputeListingRating` collected all of
 * them, which meant that past 200 reviews the average shown above the reviews
 * and the star on the listing card were computed from different sets and
 * visibly disagreed on the same screen.
 *
 * A bound is needed at all because Convex fails a function past roughly 16k
 * document reads, so an unbounded `.collect()` would eventually break the
 * write path outright. Capping is the honest trade: beyond this many reviews a
 * listing's score stops moving, which is stable and explainable, where
 * disagreeing numbers are neither.
 */
export const MAX_RATED_REVIEWS = 500;

/** House style: Arabic then English, one string, as `convex/rateLimit.ts:47`. */
export const REVIEW_ERRORS = {
  RATING_RANGE: "التقييم يجب أن يكون من 1 إلى 5 نجوم. / Rating must be a whole number of stars, 1 to 5.",
  TEXT_TOO_LONG: `التعليق طويل جدًا. / Review text is limited to ${MAX_REVIEW_TEXT} characters.`,
  DUPLICATE: "لقد قيّمت هذا المكان من قبل. / You have already reviewed this place.",
  NOT_FOUND: "التقييم غير موجود. / Review not found.",
  NOT_YOURS: "لا يمكنك تعديل تقييم شخص آخر. / You can only change your own review.",
  LISTING_NOT_FOUND: "المكان غير موجود. / Place not found.",
} as const;

export interface RatingSummary {
  /** `null` when nobody has rated — never 0, which would read as one star. */
  average: number | null;
  count: number;
  /** Index 0 is one star, index 4 is five. */
  histogram: [number, number, number, number, number];
}

export function summariseRatings(ratings: number[]): RatingSummary {
  const histogram: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let total = 0;
  let count = 0;

  for (const rating of ratings) {
    // A stored value outside 1..5 predates validation or came from a repair
    // script. Skipping it keeps the histogram's buckets honest; counting it
    // would move an average nobody can explain.
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;
    histogram[rating - 1] += 1;
    total += rating;
    count += 1;
  }

  return {
    average: count === 0 ? null : Math.round((total / count) * 10) / 10,
    count,
    histogram,
  };
}

/**
 * Check a submitted review and return the text as it should be stored.
 *
 * Returns rather than mutating so the caller cannot forget to trim: the stored
 * value is whatever comes back from here.
 */
export function validateReviewInput(args: {
  rating: number;
  content?: string;
}): { content: string | undefined } {
  if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
    throw new ConvexError(REVIEW_ERRORS.RATING_RANGE);
  }

  const trimmed = args.content?.trim();
  if (trimmed && trimmed.length > MAX_REVIEW_TEXT) {
    throw new ConvexError(REVIEW_ERRORS.TEXT_TOO_LONG);
  }

  return { content: trimmed ? trimmed : undefined };
}
