import { describe, expect, it } from "vitest";
import type { Lodging } from "@/types";
import { listingDetailItem, type DetailLabels } from "./listingDetail";

function lodging(overrides: Partial<Lodging> = {}): Lodging {
  return {
    id: "l1",
    name: "Oasis Inn",
    nameAr: "نزل الواحة",
    type: "hotel",
    city: "Al Ahsa",
    cityAr: "الأحساء",
    neighborhood: "Hofuf",
    neighborhoodAr: "Hofuf",
    priceRange: "",
    rating: 4.5,
    images: ["https://example.com/a.jpg"],
    amenities: ["wifi"],
    amenitiesAr: ["wifi-ar"],
    description: "Near the souq",
    descriptionAr: "قرب السوق",
    owner_id: "owner1",
    ...overrides,
  };
}

const labels: DetailLabels = {
  language: "en",
  typeLabel: (type) => `label:${type}`,
  perNight: "per night",
  formatPrice: (amount) => `${amount} SAR`,
};

describe("listingDetailItem", () => {
  it("offers a priced stay for booking, at its nightly rate", () => {
    const item = listingDetailItem(
      lodging({ pricePerNight: 450, maxGuests: 3, priceRange: "$$$" }),
      "hotel",
      labels
    );
    expect(item.badge).toBe("label:hotel");
    expect(item.badgeColor).toBeDefined();
    expect(item.priceLine).toBe("450 SAR per night");
    expect(item.bookable).toBe(true);
    expect(item.maxGuests).toBe(3);
  });

  it("shows an unpriced stay's band as a band, and does not offer to book it", () => {
    const item = listingDetailItem(lodging({ priceRange: "$$$" }), "hotel", labels);
    expect(item.priceLine).toBe("$$$");
    expect(item.bookable).toBe(false);
  });

  it("badges a stay by its kind", () => {
    expect(listingDetailItem(lodging({ type: "camp" }), "hotel", labels).badge).toBe(
      "label:camp"
    );
  });

  it("does not dress a restaurant up as a hotel", () => {
    // `toLodging` files every listing under a stay kind; the real type rides along.
    const item = listingDetailItem(
      lodging({ type: "hotel", priceRange: "$$", pricePerNight: 90, maxGuests: 4 }),
      "restaurant",
      labels
    );
    expect(item.badge).toBe("label:restaurant");
    expect(item.badgeColor).toBeUndefined();
    expect(item.priceLine).toBe("$$");
    expect(item.bookable).toBe(false);
    expect(item.maxGuests).toBeUndefined();
  });

  it("leaves the price out when there is none to show", () => {
    expect(listingDetailItem(lodging(), "attraction", labels).priceLine).toBeUndefined();
    expect(listingDetailItem(lodging(), "hotel", labels).priceLine).toBeUndefined();
  });

  it("speaks the viewer's language", () => {
    const item = listingDetailItem(lodging(), "attraction", { ...labels, language: "ar" });
    expect(item.title).toBe("نزل الواحة");
    expect(item.subtitle).toBe("الأحساء");
    expect(item.description).toBe("قرب السوق");
    expect(item.amenities).toEqual(["wifi-ar"]);
  });
});
