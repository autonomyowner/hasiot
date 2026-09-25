import { describe, expect, it } from "vitest";
import { notificationDataOf, routeForNotification } from "./notificationRoute";

describe("routeForNotification — rows that say where they go (1.1.0 and later)", () => {
  it("opens the booking for a guest's booking event", () => {
    expect(routeForNotification({ target: "booking", bookingId: "b1" }, "tourist")).toBe(
      "/bookings/b1"
    );
  });

  it("has nowhere to go for a booking target without a booking", () => {
    expect(routeForNotification({ target: "booking" }, "tourist")).toBeNull();
  });

  it("opens the host inbox and the provider inbox", () => {
    expect(routeForNotification({ target: "host-inbox", bookingId: "b1" }, "business_owner")).toBe(
      "/business/bookings"
    );
    expect(
      routeForNotification({ target: "provider-inbox", bookingId: "b1" }, "service_provider")
    ).toBe("/provider/bookings");
  });

  it("opens the owner's listings and services", () => {
    expect(routeForNotification({ target: "my-listings" }, "business_owner")).toBe(
      "/business/my-listings"
    );
    expect(routeForNotification({ target: "my-services" }, "service_provider")).toBe(
      "/provider/my-services"
    );
  });

  it("trusts the target over the role: the server knows whose booking it is", () => {
    // A host who also books stays gets both kinds; the target, not the role,
    // says which one this is.
    expect(routeForNotification({ target: "booking", bookingId: "b2" }, "business_owner")).toBe(
      "/bookings/b2"
    );
    expect(routeForNotification({ target: "host-inbox" }, undefined)).toBe("/business/bookings");
  });

  it("sends verification to the screen for the account's role", () => {
    expect(routeForNotification({ target: "verification" }, "business_owner")).toBe(
      "/business/verification"
    );
    expect(routeForNotification({ target: "verification" }, "service_provider")).toBe(
      "/provider/verification"
    );
  });

  it("has nowhere to go for verification when the role has no verification screen", () => {
    expect(routeForNotification({ target: "verification" }, "tourist")).toBeNull();
    expect(routeForNotification({ target: "verification" }, "admin")).toBeNull();
    // Still loading: the caller waits for the role rather than guessing.
    expect(routeForNotification({ target: "verification" }, undefined)).toBeNull();
  });
});

describe("routeForNotification — rows written before 1.1.0 (no target)", () => {
  it("sends a host's booking event to the host inbox, as the inbox always has", () => {
    expect(routeForNotification({ audience: "owner", bookingId: "b1" }, "business_owner")).toBe(
      "/business/bookings"
    );
  });

  it("sends a provider's to the provider inbox, not the host one", () => {
    expect(routeForNotification({ audience: "owner", bookingId: "b1" }, "service_provider")).toBe(
      "/provider/bookings"
    );
  });

  it("opens the booking for a guest, and for an owner with no inbox of their own", () => {
    expect(routeForNotification({ audience: "tourist", bookingId: "b1" }, "tourist")).toBe(
      "/bookings/b1"
    );
    expect(routeForNotification({ audience: "owner", bookingId: "b1" }, "tourist")).toBe(
      "/bookings/b1"
    );
  });

  it("has nowhere to go without a booking", () => {
    expect(routeForNotification({ audience: "tourist" }, "tourist")).toBeNull();
    expect(routeForNotification({}, "tourist")).toBeNull();
    expect(routeForNotification(undefined, "tourist")).toBeNull();
  });

  it("treats a target this version does not know like a row without one", () => {
    expect(routeForNotification({ target: "reviews", bookingId: "b9" }, "tourist")).toBe(
      "/bookings/b9"
    );
    expect(
      routeForNotification({ target: "something-new", audience: "owner" }, "business_owner")
    ).toBe("/business/bookings");
  });
});

describe("notificationDataOf", () => {
  it("keeps the string fields the router reads", () => {
    expect(
      notificationDataOf({ target: "booking", bookingId: "b1", audience: "tourist", listingId: "l1" })
    ).toEqual({ target: "booking", bookingId: "b1", audience: "tourist" });
  });

  it("drops fields that are not strings", () => {
    expect(notificationDataOf({ target: 7, bookingId: null, audience: "owner" })).toEqual({
      audience: "owner",
    });
  });

  it("reads a payload that arrived as a JSON string", () => {
    expect(
      notificationDataOf({ dataString: JSON.stringify({ target: "host-inbox", bookingId: "b3" }) })
    ).toEqual({ target: "host-inbox", bookingId: "b3" });
  });

  it("gives up on anything that is not an object", () => {
    expect(notificationDataOf(undefined)).toBeUndefined();
    expect(notificationDataOf(null)).toBeUndefined();
    expect(notificationDataOf("booking")).toBeUndefined();
    expect(notificationDataOf({ dataString: "{not json" })).toEqual({});
  });
});
