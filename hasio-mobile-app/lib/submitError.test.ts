import { describe, expect, it } from "vitest";
import { getSubmitErrorKey } from "./submitError";

/** A plain server Error as a development deployment delivers it. */
const convexDev = (message: string) =>
  new Error(
    `[CONVEX M(listings/mutations:submitListing)] [Request ID: 1a2b] Server Error\nUncaught Error: ${message}\n    at handler (../convex/listings/mutations.ts:311:11)`
  );

describe("getSubmitErrorKey", () => {
  it("reads a ConvexError's payload", () => {
    expect(getSubmitErrorKey({ data: "Not authenticated" })).toBe("errorSessionExpired");
    expect(
      getSubmitErrorKey({ data: "Your account must be approved before submitting listings" })
    ).toBe("errorNotApproved");
  });

  it("reads a plain error's message in development", () => {
    expect(getSubmitErrorKey(convexDev("Only service providers can submit services"))).toBe(
      "errorWrongRole"
    );
    expect(
      getSubmitErrorKey(convexDev("Business owners can post: hotel, restaurant, attraction, event"))
    ).toBe("errorWrongRole");
  });

  it("treats every way an upload fails as an upload failure", () => {
    expect(getSubmitErrorKey(new Error("Upload failed with status 500"))).toBe("errorUploadFailed");
    expect(getSubmitErrorKey(new Error("Upload succeeded but no storageId was returned"))).toBe(
      "errorUploadFailed"
    );
    expect(getSubmitErrorKey(new Error("Failed to get storage URL"))).toBe("errorUploadFailed");
  });

  it("treats a connection that never got through as an upload failure", () => {
    expect(getSubmitErrorKey(new Error("Network request failed"))).toBe("errorUploadFailed");
    expect(
      getSubmitErrorKey(new Error("The Internet connection appears to be offline."))
    ).toBe("errorUploadFailed");
    expect(getSubmitErrorKey(new Error("The request timed out."))).toBe("errorUploadFailed");
    expect(
      getSubmitErrorKey(
        new Error('Unable to resolve host "example.convex.cloud": No address associated with hostname')
      )
    ).toBe("errorUploadFailed");
  });

  it("names the daily limits rather than calling them an upload failure", () => {
    expect(
      getSubmitErrorKey(
        convexDev(
          "لقد وصلت إلى الحد اليومي لإضافة الأماكن. يرجى المحاولة غدًا. / You've reached today's limit for new listings. Please try again tomorrow."
        )
      )
    ).toBe("errorDailyPostLimit");
    expect(
      getSubmitErrorKey(convexDev("Daily upload limit reached. Please try again tomorrow."))
    ).toBe("errorDailyPostLimit");
  });

  it("says when what is being saved has gone", () => {
    expect(getSubmitErrorKey({ data: "Listing not found" })).toBe("editorNotFound");
    expect(getSubmitErrorKey({ data: "Not your listing" })).toBe("editorNotFound");
  });

  it("falls back when production has redacted the reason", () => {
    expect(
      getSubmitErrorKey(
        new Error("[CONVEX M(services/mutations:submitService)] [Request ID: 9] Server Error")
      )
    ).toBe("pleaseTryAgain");
    expect(getSubmitErrorKey(undefined)).toBe("pleaseTryAgain");
  });
});
