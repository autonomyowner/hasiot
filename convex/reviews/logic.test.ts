import { describe, expect, it } from "vitest";
import { REVIEW_ERRORS, summariseRatings, validateReviewInput } from "./logic";

describe("summariseRatings", () => {
  it("reports nothing for a listing with no reviews", () => {
    // `null`, not 0: a listing nobody has rated has no score, and 0 would
    // render as a one-star place.
    expect(summariseRatings([])).toEqual({
      average: null,
      count: 0,
      histogram: [0, 0, 0, 0, 0],
    });
  });

  it("counts each star into its own bucket, one-indexed", () => {
    expect(summariseRatings([5, 5, 3, 1])).toEqual({
      average: 3.5,
      count: 4,
      histogram: [1, 0, 1, 0, 2],
    });
  });

  it("rounds the average to one decimal", () => {
    // 10/3 = 3.333…
    expect(summariseRatings([4, 3, 3]).average).toBe(3.3);
    // 11/3 = 3.666…
    expect(summariseRatings([4, 4, 3]).average).toBe(3.7);
  });

  it("ignores a rating outside 1..5 rather than skewing the histogram", () => {
    expect(summariseRatings([5, 0, 9, 4])).toEqual({
      average: 4.5,
      count: 2,
      histogram: [0, 0, 0, 1, 1],
    });
  });
});

describe("validateReviewInput", () => {
  it("accepts a whole star count with no text", () => {
    expect(() => validateReviewInput({ rating: 4 })).not.toThrow();
  });

  it("rejects a rating outside 1..5", () => {
    expect(() => validateReviewInput({ rating: 0 })).toThrow(REVIEW_ERRORS.RATING_RANGE);
    expect(() => validateReviewInput({ rating: 6 })).toThrow(REVIEW_ERRORS.RATING_RANGE);
  });

  it("rejects a fractional rating", () => {
    // The UI offers five whole stars; a fraction means a client built its own.
    expect(() => validateReviewInput({ rating: 4.5 })).toThrow(REVIEW_ERRORS.RATING_RANGE);
  });

  it("rejects text past the cap", () => {
    expect(() => validateReviewInput({ rating: 5, content: "x".repeat(501) })).toThrow(
      REVIEW_ERRORS.TEXT_TOO_LONG
    );
    expect(() => validateReviewInput({ rating: 5, content: "x".repeat(500) })).not.toThrow();
  });

  it("treats whitespace-only text as no text", () => {
    expect(validateReviewInput({ rating: 5, content: "   " })).toEqual({ content: undefined });
  });

  it("trims the text it keeps", () => {
    expect(validateReviewInput({ rating: 5, content: "  good  " })).toEqual({ content: "good" });
  });
});
