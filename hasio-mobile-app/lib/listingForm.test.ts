import { describe, expect, it } from "vitest";
import { cityCoordinates } from "@/constants/cities";
import {
  accountReviewState,
  addPhotos,
  EMPTY_SERVICE_FORM,
  editedPlaceLocation,
  editedServiceArgs,
  editedStayLocation,
  firstError,
  isHHMM,
  isLive,
  isPlausibleEmail,
  isPlausiblePhone,
  isProvinceCity,
  isProvinceWideRegion,
  isWholeInRange,
  makeCover,
  newPlaceLocation,
  newServiceArgs,
  newStayLocation,
  normaliseTime,
  ownerStatusOf,
  parseWholeNumber,
  placeFormFromListing,
  sameValues,
  serviceFormFromService,
  serviceTypeLabelKey,
  splitList,
  stayFormFromListing,
  stayPricingArgs,
  validatePlaceForm,
  validateServiceForm,
  validateStayForm,
  withUploadedPhotos,
  type ServiceFormValues,
  type StayFormValues,
} from "./listingForm";

describe("editedStayLocation — what an edit may overwrite", () => {
  // A seeded hotel as its host's editor opens it: stored city "Hofuf" is
  // prefilled as "Al Ahsa", and its province-wide region is not prefilled.
  const seeded = { city: "Al Ahsa", neighborhood: "" };

  it("leaves the pin, address and region alone when only other fields changed", () => {
    expect(editedStayLocation(seeded, { city: "Al Ahsa", neighborhood: "" })).toEqual({
      address: undefined,
      region: undefined,
      coordinates: undefined,
    });
  });

  it("does not treat a stored alias as a move", () => {
    expect(editedStayLocation({ city: "Hofuf", neighborhood: "" }, seeded).coordinates).toBeUndefined();
  });

  it("moves the pin to the new city centre only when the city changes", () => {
    const moved = editedStayLocation(seeded, { city: "Dammam", neighborhood: "" });
    expect(moved.coordinates).toEqual(cityCoordinates("Dammam"));
    expect(moved.address).toBe("Dammam");
    expect(moved.region).toBeUndefined();
  });

  it("keeps a precise pin when only the neighbourhood changes", () => {
    const edited = editedStayLocation(seeded, { city: "Al Ahsa", neighborhood: "Al Khaldiya" });
    expect(edited.coordinates).toBeUndefined();
    expect(edited.address).toBe("Al Khaldiya");
    expect(edited.region).toBe("Al Khaldiya");
  });

  it("clears an emptied neighbourhood instead of silently keeping it", () => {
    const edited = editedStayLocation(
      { city: "Qatif", neighborhood: "Saihat" },
      { city: "Qatif", neighborhood: "  " }
    );
    expect(edited.region).toBe("");
    expect(edited.address).toBe("Qatif");
  });
});

describe("newStayLocation", () => {
  it("writes everything for a new listing, as before", () => {
    expect(newStayLocation({ city: "Jubail", neighborhood: "Al Fanateer" })).toEqual({
      address: "Al Fanateer",
      region: "Al Fanateer",
      coordinates: cityCoordinates("Jubail"),
    });
    expect(newStayLocation({ city: "Jubail", neighborhood: "" }).region).toBeUndefined();
  });
});

describe("destination location", () => {
  it("falls back to the city, not the place's own name", () => {
    expect(newPlaceLocation({ city: "Qatif", address: " " }).address).toBe("Qatif");
    expect(newPlaceLocation({ city: "Qatif", address: " " }).coordinates).toEqual(
      cityCoordinates("Qatif")
    );
  });

  it("keeps the stored pin unless the city changed", () => {
    expect(
      editedPlaceLocation({ city: "Mubarraz" }, { city: "Al Ahsa", address: "Near the fort" })
        .coordinates
    ).toBeUndefined();
    expect(
      editedPlaceLocation({ city: "Al Ahsa" }, { city: "Khafji", address: "" }).coordinates
    ).toEqual(cityCoordinates("Khafji"));
  });
});

describe("stayFormFromListing — what the editor shows", () => {
  const seededHotel = {
    category: "luxury_hotel",
    name_en: "InterContinental Al Ahsa",
    name_ar: "إنتركونتيننتال الأحساء",
    city: "Hofuf",
    region: "Eastern Province",
    pricePerNight: 450,
  };

  it("does not offer the province as the neighbourhood", () => {
    const form = stayFormFromListing(seededHotel);
    expect(form.neighborhood).toBe("");
    expect(form.city).toBe("Al Ahsa");
  });

  it("keeps a real neighbourhood", () => {
    expect(stayFormFromListing({ ...seededHotel, region: "Al Khaldiya" }).neighborhood).toBe(
      "Al Khaldiya"
    );
  });

  it("leaves unset counts empty instead of writing the new-listing defaults", () => {
    const form = stayFormFromListing(seededHotel);
    expect(form.maxGuests).toBe("");
    expect(form.unitCount).toBe("");
    expect(form.pricePerNight).toBe("450");
    expect(stayFormFromListing({ ...seededHotel, maxGuests: 6, unitCount: 12 })).toMatchObject({
      maxGuests: "6",
      unitCount: "12",
    });
  });

  it("keeps a seeded category as it is", () => {
    expect(stayFormFromListing(seededHotel).type).toBe("luxury_hotel");
  });
});

describe("placeFormFromListing and serviceFormFromService", () => {
  it("fold the city and keep the stored address", () => {
    expect(
      placeFormFromListing({ category: "museum", city: "Mubarraz", address: "Mubarraz Center" })
    ).toMatchObject({ category: "museum", city: "Al Ahsa", address: "Mubarraz Center" });
  });

  it("joins a service's languages for its text field", () => {
    expect(
      serviceFormFromService({ serviceType: "tour_guide", languages: ["Arabic", "English"] })
        .languages
    ).toBe("Arabic, English");
  });
});

describe("isProvinceWideRegion", () => {
  it("recognises the province in either language", () => {
    expect(isProvinceWideRegion("Eastern Province")).toBe(true);
    expect(isProvinceWideRegion(" eastern region ")).toBe(true);
    expect(isProvinceWideRegion("المنطقة الشرقية")).toBe(true);
    expect(isProvinceWideRegion("الشرقية")).toBe(true);
  });

  it("leaves a real neighbourhood alone", () => {
    expect(isProvinceWideRegion("Al Khaldiya")).toBe(false);
    expect(isProvinceWideRegion("Eastern District")).toBe(false);
    expect(isProvinceWideRegion(undefined)).toBe(false);
    expect(isProvinceWideRegion("")).toBe(false);
  });
});

describe("photos", () => {
  it("keeps the host's order when local picks are swapped for uploads", () => {
    const images = ["file:///new-cover.jpg", "https://cdn/a.jpg", "file:///b.jpg"];
    expect(withUploadedPhotos(images, ["https://up/1", "https://up/2"])).toEqual([
      "https://up/1",
      "https://cdn/a.jpg",
      "https://up/2",
    ]);
  });

  it("adds picks without repeats and stops at the limit", () => {
    expect(addPhotos(["a", "b"], ["b", "c", "c", "d", "e", "f"], 5)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
  });

  it("moves a photo to the front to make it the cover", () => {
    expect(makeCover(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    const same = ["a", "b"];
    expect(makeCover(same, "a")).toBe(same);
    expect(makeCover(same, "z")).toBe(same);
  });
});

describe("numbers and times", () => {
  it("reads Arabic-Indic digits and grouping", () => {
    expect(parseWholeNumber("٤٥٠")).toBe(450);
    expect(parseWholeNumber("12,500")).toBe(12500);
    expect(parseWholeNumber(" ")).toBeUndefined();
    expect(parseWholeNumber("4.5")).toBeNaN();
    expect(parseWholeNumber("abc")).toBeNaN();
  });

  it("checks whole numbers against a range", () => {
    expect(isWholeInRange(1, 1, 20)).toBe(true);
    expect(isWholeInRange(21, 1, 20)).toBe(false);
    expect(isWholeInRange(NaN, 1, 20)).toBe(false);
    expect(isWholeInRange(undefined, 1, 20)).toBe(false);
  });

  it("accepts a one-digit hour and Arabic digits", () => {
    expect(normaliseTime("9:00")).toBe("09:00");
    expect(normaliseTime("١٥:٠٠")).toBe("15:00");
    expect(isHHMM(normaliseTime("24:00"))).toBe(false);
    expect(isHHMM(normaliseTime("12:5"))).toBe(false);
  });
});

describe("text lists and contact details", () => {
  it("splits on both commas", () => {
    expect(splitList("Arabic، English, French,, English")).toEqual([
      "Arabic",
      "English",
      "French",
    ]);
  });

  it("checks contact details loosely", () => {
    expect(isPlausibleEmail("host@example.sa")).toBe(true);
    expect(isPlausibleEmail("host@example")).toBe(false);
    expect(isPlausiblePhone("+966 50 123 4567")).toBe(true);
    expect(isPlausiblePhone("٠٥٠١٢٣٤٥٦٧")).toBe(true);
    expect(isPlausiblePhone("12")).toBe(false);
  });
});

describe("review status", () => {
  it("treats a missing status as live", () => {
    expect(ownerStatusOf(undefined)).toBe("approved");
    expect(ownerStatusOf("suspended")).toBe("suspended");
    expect(isLive(undefined)).toBe(true);
    expect(isLive("pending")).toBe(false);
  });
});

describe("validation", () => {
  const stay: StayFormValues = {
    type: "hotel",
    name: "Palm Stay",
    nameAr: "إقامة النخيل",
    city: "Al Ahsa",
    neighborhood: "",
    priceRange: "",
    pricePerNight: "",
    maxGuests: "2",
    unitCount: "1",
    checkInTime: "15:00",
    checkOutTime: "12:00",
    description: "",
    descriptionAr: "",
    amenities: [],
    images: [],
  };

  it("passes a minimal stay", () => {
    expect(validateStayForm(stay)).toEqual({});
  });

  it("names each broken field, in the server's limits", () => {
    const errors = validateStayForm({
      ...stay,
      nameAr: " ",
      city: "",
      pricePerNight: "100001",
      unitCount: "501",
      checkInTime: "3pm",
    });
    expect(errors).toEqual({
      nameAr: "fieldRequired",
      city: "chooseCity",
      pricePerNight: "invalidPriceRange",
      unitCount: "invalidUnitCountRange",
      checkInTime: "invalidTime",
    });
    expect(firstError(errors, ["name", "nameAr", "city", "pricePerNight"] as const)).toBe("nameAr");
  });

  it("requires a city for a destination", () => {
    expect(
      validatePlaceForm({
        category: "historical",
        name: "Fort",
        nameAr: "قلعة",
        city: "",
        address: "",
        description: "",
        descriptionAr: "",
        images: [],
      })
    ).toEqual({ city: "chooseCity" });
  });

  it("checks a service's contact details only when given", () => {
    const service: ServiceFormValues = {
      serviceType: "driver",
      title: "Airport runs",
      titleAr: "توصيل المطار",
      description: "Day and night",
      descriptionAr: "ليلًا ونهارًا",
      city: "Dammam",
      price: "",
      priceUnit: "per_hour",
      maxGroupSize: "",
      availability: "",
      availabilityAr: "",
      contactPhone: "",
      contactEmail: "",
      languages: "",
      images: [],
    };
    expect(validateServiceForm(service)).toEqual({});
    expect(validateServiceForm({ ...service, contactPhone: "05", contactEmail: "x@" })).toEqual({
      contactPhone: "invalidContactPhone",
      contactEmail: "invalidEmail",
    });
  });
});

// A service as its provider fills the form in, ready to send.
const filledService: ServiceFormValues = {
  ...EMPTY_SERVICE_FORM,
  serviceType: "tour_guide",
  title: " Oasis walk ",
  titleAr: "جولة في الواحة",
  description: "Two hours through the palm groves",
  descriptionAr: "ساعتان بين بساتين النخيل",
  city: "Al Ahsa",
  priceUnit: "per_hour",
};

describe("the service form, filled from what is stored", () => {
  it("shows the price and group size, and the city under its canonical key", () => {
    expect(
      serviceFormFromService({
        serviceType: "tour_guide",
        city: "Hofuf",
        price: 150,
        priceUnit: "per_hour",
        maxGroupSize: 8,
      })
    ).toMatchObject({ price: "150", maxGroupSize: "8", city: "Al Ahsa", priceUnit: "per_hour" });
  });

  it("leaves an unset price and group size empty, and a city outside the province unchosen", () => {
    // Services posted before 1.1.0 have neither, and the old form sent no
    // city at all; a typed one may be anywhere.
    expect(serviceFormFromService({ serviceType: "driver", city: "Riyadh" })).toMatchObject({
      price: "",
      maxGroupSize: "",
      city: "",
    });
    expect(serviceFormFromService({ serviceType: "driver" }).city).toBe("");
  });

  it("files an unknown type under Other, and reads a missing unit as the server does", () => {
    const form = serviceFormFromService({ serviceType: "guide", priceUnit: "per_person" });
    expect(form.serviceType).toBe("other");
    // convex/services/logic.ts quotes an unknown or missing unit as a fixed
    // price, so the editor shows the unit travellers are actually charged by.
    expect(form.priceUnit).toBe("fixed");
    expect(serviceFormFromService({ serviceType: "driver" }).priceUnit).toBe("fixed");
  });

  it("opens a new service on a price per hour", () => {
    expect(EMPTY_SERVICE_FORM).toMatchObject({ priceUnit: "per_hour", price: "", city: "" });
  });
});

describe("validateServiceForm — price, group size and city", () => {
  it("passes a service with no price: it is listed with Contact instead of Book", () => {
    expect(validateServiceForm(filledService)).toEqual({});
  });

  it("requires one of the thirteen cities", () => {
    expect(validateServiceForm({ ...filledService, city: "" })).toEqual({
      city: "chooseServiceCity",
    });
    expect(validateServiceForm({ ...filledService, city: "Riyadh" })).toEqual({
      city: "chooseServiceCity",
    });
  });

  it("holds the price and group size to the server's limits", () => {
    expect(validateServiceForm({ ...filledService, price: "100001", maxGroupSize: "101" })).toEqual(
      { price: "invalidPriceRange", maxGroupSize: "invalidGroupSize" }
    );
    expect(validateServiceForm({ ...filledService, price: "0", maxGroupSize: "0" })).toEqual({
      price: "invalidPriceRange",
      maxGroupSize: "invalidGroupSize",
    });
    expect(validateServiceForm({ ...filledService, price: "12.5" })).toEqual({
      price: "invalidPriceRange",
    });
  });

  it("reads what an Arabic keypad types", () => {
    expect(validateServiceForm({ ...filledService, price: "١٥٠", maxGroupSize: "٨" })).toEqual({});
  });

  it("names the city among the fields in screen order", () => {
    const errors = validateServiceForm({ ...filledService, title: "", city: "" });
    expect(firstError(errors, ["title", "titleAr", "city"] as const)).toBe("title");
    expect(firstError({ city: "chooseServiceCity" }, ["title", "titleAr", "city"] as const)).toBe(
      "city"
    );
  });
});

describe("newServiceArgs — what a new service sends", () => {
  it("sends the price, group size and city as numbers and a key", () => {
    const args = newServiceArgs(
      { ...filledService, price: "١٥٠", maxGroupSize: "8", languages: "Arabic، English" },
      ["https://cdn/a.jpg"]
    );
    expect(args).toMatchObject({
      serviceType: "tour_guide",
      title_en: "Oasis walk",
      price: 150,
      maxGroupSize: 8,
      city: "Al Ahsa",
      priceUnit: "per_hour",
      languages: ["Arabic", "English"],
      images: ["https://cdn/a.jpg"],
    });
  });

  it("leaves out what is empty, a price included", () => {
    const args = newServiceArgs(filledService, []);
    expect(args.price).toBeUndefined();
    expect(args.maxGroupSize).toBeUndefined();
    expect(args.contactPhone).toBeUndefined();
    expect(args.languages).toBeUndefined();
    expect(args.images).toBeUndefined();
  });

  it("no longer sends the free-text price range, which cannot be multiplied", () => {
    expect(newServiceArgs(filledService, [])).not.toHaveProperty("priceRange");
  });
});

describe("editedServiceArgs — what an edit sends", () => {
  it("clears an emptied price and group size with null, which the server reads as remove", () => {
    // Omitting them would keep the old price: the server skips undefined.
    const args = editedServiceArgs({ ...filledService, price: " ", maxGroupSize: "" }, []);
    expect(args.price).toBeNull();
    expect(args.maxGroupSize).toBeNull();
  });

  it("sends a changed price and group size as numbers", () => {
    const args = editedServiceArgs({ ...filledService, price: "200", maxGroupSize: "12" }, []);
    expect(args.price).toBe(200);
    expect(args.maxGroupSize).toBe(12);
  });

  it("sends every text field, emptied ones as empty, so nothing is silently kept", () => {
    const args = editedServiceArgs({ ...filledService, contactPhone: "  ", languages: "" }, []);
    expect(args.contactPhone).toBe("");
    expect(args.languages).toEqual([]);
    expect(args.images).toEqual([]);
    expect(args.city).toBe("Al Ahsa");
  });
});

describe("stayPricingArgs — the booking fields a stay sends", () => {
  const blank = {
    pricePerNight: "",
    maxGuests: "",
    unitCount: "",
    checkInTime: "15:00",
    checkOutTime: "12:00",
  };

  it("sends no price for a new stay left unpriced", () => {
    expect(stayPricingArgs(blank, "create")).toEqual({
      pricePerNight: undefined,
      currency: undefined,
      maxGuests: undefined,
      unitCount: undefined,
      checkInTime: "15:00",
      checkOutTime: "12:00",
    });
  });

  it("clears a nightly price emptied in an edit with null, and sends no currency", () => {
    // The server skips undefined, so leaving the price out kept the old one —
    // and with it a stay the host meant to stop taking bookings for.
    const args = stayPricingArgs({ ...blank, pricePerNight: "  " }, "edit");
    expect(args).toHaveProperty("pricePerNight", null);
    expect(args.currency).toBeUndefined();
  });

  it("sends a typed price in whole riyals, from Arabic digits too", () => {
    expect(stayPricingArgs({ ...blank, pricePerNight: "٤٥٠" }, "edit")).toMatchObject({
      pricePerNight: 450,
      currency: "SAR",
    });
    expect(stayPricingArgs({ ...blank, pricePerNight: "1,200" }, "create")).toMatchObject({
      pricePerNight: 1200,
      currency: "SAR",
    });
  });

  it("never clears the capacity: an emptied guest cap or unit count keeps what is stored", () => {
    const args = stayPricingArgs({ ...blank, maxGuests: " ", unitCount: "" }, "edit");
    expect(args.maxGuests).toBeUndefined();
    expect(args.unitCount).toBeUndefined();
    expect(stayPricingArgs({ ...blank, maxGuests: "6", unitCount: "12" }, "edit")).toMatchObject({
      maxGuests: 6,
      unitCount: 12,
    });
  });

  it("normalises the times", () => {
    expect(
      stayPricingArgs({ ...blank, checkInTime: "9:00", checkOutTime: "١١:٠٠" }, "edit")
    ).toMatchObject({ checkInTime: "09:00", checkOutTime: "11:00" });
  });
});

describe("isProvinceCity", () => {
  it("accepts the thirteen keys exactly", () => {
    expect(isProvinceCity("Al Bayda")).toBe(true);
    expect(isProvinceCity(" Qatif ")).toBe(true);
    expect(isProvinceCity("Hofuf")).toBe(false);
    expect(isProvinceCity("Riyadh")).toBe(false);
    expect(isProvinceCity("")).toBe(false);
  });
});

describe("serviceTypeLabelKey", () => {
  it("names each type, and anything else as Other", () => {
    expect(serviceTypeLabelKey("tour_guide")).toBe("tourGuide");
    expect(serviceTypeLabelKey("equipment_rental")).toBe("equipmentRental");
    expect(serviceTypeLabelKey("other")).toBe("otherService");
    expect(serviceTypeLabelKey("guide")).toBe("otherService");
    expect(serviceTypeLabelKey(undefined)).toBe("otherService");
  });
});

describe("accountReviewState", () => {
  it("is approved once approved, whatever else is on file", () => {
    expect(
      accountReviewState({ isApproved: true, hasDocument: true, rejectionReason: "Blurry scan" })
    ).toBe("approved");
  });

  it("is rejected while a rejection reason stands, though the document is still on file", () => {
    // It used to read as "under review": the rejected document is kept.
    expect(
      accountReviewState({ isApproved: false, hasDocument: true, rejectionReason: "Blurry scan" })
    ).toBe("rejected");
  });

  it("is under review with a document and no rejection, and unverified without one", () => {
    expect(accountReviewState({ isApproved: false, hasDocument: true })).toBe("pending");
    expect(accountReviewState({ isApproved: false, hasDocument: false, rejectionReason: " " })).toBe(
      "unverified"
    );
  });
});

describe("sameValues", () => {
  it("compares form snapshots by value", () => {
    expect(sameValues({ a: "1", list: ["x"] }, { a: "1", list: ["x"] })).toBe(true);
    expect(sameValues({ a: "1", list: ["x"] }, { a: "1", list: [] })).toBe(false);
  });
});
