import { describe, expect, it } from "vitest";
import { bookingActionUrl, emailDeliveryOn, publicSiteUrl } from "./links";

describe("emailDeliveryOn", () => {
  it("is on only when a Resend key is set", () => {
    expect(emailDeliveryOn({})).toBe(false);
    expect(emailDeliveryOn({ RESEND_API_KEY: "" })).toBe(false);
    expect(emailDeliveryOn({ RESEND_API_KEY: "  " })).toBe(false);
    expect(emailDeliveryOn({ RESEND_API_KEY: "re_live_x" })).toBe(true);
  });
});

describe("publicSiteUrl", () => {
  it("is hasio.net unless the deployment says otherwise", () => {
    expect(publicSiteUrl({})).toBe("https://hasio.net");
    expect(publicSiteUrl({ PUBLIC_SITE_URL: "" })).toBe("https://hasio.net");
  });

  it("drops trailing slashes so paths join cleanly", () => {
    expect(publicSiteUrl({ PUBLIC_SITE_URL: "https://staging.hasio.net//" })).toBe(
      "https://staging.hasio.net"
    );
  });
});

describe("bookingActionUrl", () => {
  const base = "https://hasio.net";

  it("sends the traveller to their trip", () => {
    expect(bookingActionUrl("tourist", { _id: "b1", kind: "stay" }, base)).toBe(
      "https://hasio.net/trips/b1"
    );
    expect(bookingActionUrl("tourist", { _id: "b2", kind: "service", serviceId: "s1" }, base)).toBe(
      "https://hasio.net/trips/b2"
    );
  });

  it("sends a host to the place inbox and a provider to the service inbox", () => {
    expect(bookingActionUrl("owner", { _id: "b1", kind: "stay", listingId: "l1" }, base)).toBe(
      "https://hasio.net/partners/hotel/bookings"
    );
    expect(bookingActionUrl("owner", { _id: "b2", kind: "service", serviceId: "s1" }, base)).toBe(
      "https://hasio.net/partners/services/bookings"
    );
  });

  it("treats any booking with a service as a service booking", () => {
    // A legacy row may carry no kind; the service id is what decides the inbox.
    expect(bookingActionUrl("owner", { _id: "b3", serviceId: "s1" }, base)).toBe(
      "https://hasio.net/partners/services/bookings"
    );
  });
});
