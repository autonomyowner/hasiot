import { describe, expect, it } from "vitest";
import { cityCoordinates } from "@/constants/cities";
import {
  addPhotos,
  editedPlaceLocation,
  editedStayLocation,
  firstError,
  isHHMM,
  isLive,
  isPlausibleEmail,
  isPlausiblePhone,
  isProvinceWideRegion,
  isWholeInRange,
  makeCover,
  newPlaceLocation,
  newStayLocation,
  normaliseTime,
  ownerStatusOf,
  parseWholeNumber,
  placeFormFromListing,
  sameValues,
  serviceFormFromService,
  splitList,
  stayFormFromListing,
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
      priceRange: "",
      priceUnit: "per_hour",
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

describe("sameValues", () => {
  it("compares form snapshots by value", () => {
    expect(sameValues({ a: "1", list: ["x"] }, { a: "1", list: ["x"] })).toBe(true);
    expect(sameValues({ a: "1", list: ["x"] }, { a: "1", list: [] })).toBe(false);
  });
});
