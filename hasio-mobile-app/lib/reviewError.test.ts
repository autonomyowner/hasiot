import { describe, expect, it } from "vitest";
import { translations } from "@/constants/translations";
import { getReviewErrorKey } from "./reviewError";

// The server's own strings, word for word: REVIEW_ERRORS in
// convex/reviews/logic.ts, AUTH_ERRORS in convex/lib/errors.ts, and the
// default message of enforceRateLimit in convex/rateLimit.ts.
const SERVER = {
  RATING_RANGE: "التقييم يجب أن يكون من 1 إلى 5 نجوم. / Rating must be a whole number of stars, 1 to 5.",
  TEXT_TOO_LONG: "التعليق طويل جدًا. / Review text is limited to 500 characters.",
  DUPLICATE: "لقد قيّمت هذا المكان من قبل. / You have already reviewed this place.",
  NOT_FOUND: "التقييم غير موجود. / Review not found.",
  NOT_YOURS: "لا يمكنك تعديل تقييم شخص آخر. / You can only change your own review.",
  LISTING_NOT_FOUND: "المكان غير موجود. / Place not found.",
  OWN_ITEM: "لا يمكنك تقييم مكانك أو خدمتك. / You cannot review your own place or service.",
  TARGET_REQUIRED: "اختر ما تريد تقييمه. / Choose what to review.",
  SERVICE_NOT_FOUND: "الخدمة غير موجودة. / Service not found.",
  DUPLICATE_SERVICE: "لقد قيّمت هذه الخدمة من قبل. / You have already reviewed this service.",
  DAILY_LIMIT: "لقد تجاوزت الحد المسموح لهذا اليوم. يرجى المحاولة غدًا. / Daily limit reached. Please try again tomorrow.",
  NOT_AUTHENTICATED_OLD: "Not authenticated",
  NOT_AUTHENTICATED_NEW: "يجب تسجيل الدخول أولاً. / You need to be signed in.",
} as const;

const convexError = (data: string) => ({ data });

describe("getReviewErrorKey", () => {
  it("names the refusals a place's review has always had", () => {
    expect(getReviewErrorKey(convexError(SERVER.DUPLICATE))).toBe("errorAlreadyReviewed");
    expect(getReviewErrorKey(convexError(SERVER.NOT_YOURS))).toBe("errorNotYourReview");
    expect(getReviewErrorKey(convexError(SERVER.NOT_FOUND))).toBe("errorReviewGone");
    expect(getReviewErrorKey(convexError(SERVER.LISTING_NOT_FOUND))).toBe("errorReviewGone");
    expect(getReviewErrorKey(convexError(SERVER.RATING_RANGE))).toBe("reviewNeedsStars");
    expect(getReviewErrorKey(convexError(SERVER.TEXT_TOO_LONG))).toBe("errorReviewTooLong");
  });

  it("tells an owner they cannot rate their own place or service", () => {
    expect(getReviewErrorKey(convexError(SERVER.OWN_ITEM))).toBe("errorRateOwnItem");
  });

  it("says a service was already rated, not a place", () => {
    expect(getReviewErrorKey(convexError(SERVER.DUPLICATE_SERVICE))).toBe("errorAlreadyReviewedService");
  });

  it("says a service that has gone is no longer available", () => {
    expect(getReviewErrorKey(convexError(SERVER.SERVICE_NOT_FOUND))).toBe("errorServiceUnavailable");
  });

  it("names the daily limit", () => {
    expect(getReviewErrorKey(convexError(SERVER.DAILY_LIMIT))).toBe("errorDailyPostLimit");
  });

  it("maps both sign-in refusals to the session having expired", () => {
    expect(getReviewErrorKey(convexError(SERVER.NOT_AUTHENTICATED_OLD))).toBe("errorSessionExpired");
    expect(getReviewErrorKey(convexError(SERVER.NOT_AUTHENTICATED_NEW))).toBe("errorSessionExpired");
  });

  it("falls back for what the app never sends, and for a redacted reason", () => {
    expect(getReviewErrorKey(convexError(SERVER.TARGET_REQUIRED))).toBe("pleaseTryAgain");
    expect(
      getReviewErrorKey(new Error("[CONVEX M(reviews/mutations:addReview)] [Request ID: 9] Server Error"))
    ).toBe("pleaseTryAgain");
    expect(getReviewErrorKey(undefined)).toBe("pleaseTryAgain");
  });

  it("only ever answers with a key both languages have", () => {
    for (const text of Object.values(SERVER)) {
      const key = getReviewErrorKey(convexError(text));
      expect(translations.en[key], key).toBeTruthy();
      expect(translations.ar[key], key).toBeTruthy();
    }
  });
});
