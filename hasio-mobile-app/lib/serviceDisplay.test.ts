import { describe, expect, it } from "vitest";
import { translations } from "@/constants/translations";
import { formatPrice } from "./currency";
import {
  firstBookableDate,
  filterServicesByQuery,
  formatServiceAmount,
  formatServicePrice,
  groupSizeLabel,
  localServicesFor,
  mergeById,
  peopleLabel,
  pickLanguage,
  presentServiceTypes,
  priceUnitLabel,
  quantityLabel,
  quantityRange,
  quoteBreakdown,
  riyadhClock,
  serviceFooterState,
  serviceTotalSar,
  serviceTypeLabelKey,
  SERVICE_TYPES,
  sortServicesForBrowse,
  startTimes,
} from "./serviceDisplay";

// Every "now" below is written in UTC, the way a phone in Sydney, Algiers or
// London hands it over. Riyadh is UTC+3 all year: 07:10Z is 10:10 there.
const at = (iso: string) => Date.parse(iso);
const RIYADH_1010 = at("2026-09-25T07:10:00Z");

describe("formatServicePrice", () => {
  // Written the way a stay's price is ("650 SAR per night", «650 ر.س في
  // الليلة»), because the Book tab shows the two side by side.
  it("prices each unit in English", () => {
    expect(formatServicePrice({ price: 150, priceUnit: "per_hour" }, "en")).toBe("150 SAR per hour");
    expect(formatServicePrice({ price: 150, priceUnit: "per_day" }, "en")).toBe("150 SAR per day");
    expect(formatServicePrice({ price: 150, priceUnit: "per_event" }, "en")).toBe("150 SAR per booking");
    expect(formatServicePrice({ price: 150, priceUnit: "fixed" }, "en")).toBe("150 SAR per booking");
  });

  it("prices each unit in Arabic, with Latin digits", () => {
    expect(formatServicePrice({ price: 150, priceUnit: "per_hour" }, "ar")).toBe("150 ر.س للساعة");
    expect(formatServicePrice({ price: 150, priceUnit: "per_day" }, "ar")).toBe("150 ر.س لليوم");
    expect(formatServicePrice({ price: 150, priceUnit: "per_event" }, "ar")).toBe("150 ر.س للحجز");
    expect(formatServicePrice({ price: 150, priceUnit: "fixed" }, "ar")).toBe("150 ر.س للحجز");
    expect(formatServicePrice({ price: 2500, priceUnit: "per_day" }, "ar")).not.toMatch(/[٠-٩]/);
  });

  it("uses the stays' riyal, not a second spelling of it", () => {
    const stay = (lang: "en" | "ar") =>
      formatPrice(650, "SAR", { sar: translations[lang].sar, usd: translations[lang].usd });
    expect(formatServiceAmount(650, "en")).toBe(stay("en"));
    expect(formatServiceAmount(650, "ar")).toBe(stay("ar"));
  });

  it("groups thousands", () => {
    expect(formatServicePrice({ price: 1500, priceUnit: "per_day" }, "en")).toBe("1,500 SAR per day");
    expect(formatServicePrice({ price: 1500, priceUnit: "per_day" }, "ar")).toBe("1,500 ر.س لليوم");
  });

  it("reads a missing or unknown unit as one price per booking, as the server does", () => {
    expect(formatServicePrice({ price: 300 }, "en")).toBe("300 SAR per booking");
    expect(formatServicePrice({ price: 300, priceUnit: "per_person" }, "ar")).toBe("300 ر.س للحجز");
  });

  it("says the price is on request when there is none to multiply", () => {
    expect(formatServicePrice({ priceUnit: "per_hour" }, "en")).toBe("Price on request");
    expect(formatServicePrice({ price: 0, priceUnit: "per_hour" }, "en")).toBe("Price on request");
    expect(formatServicePrice({}, "ar")).toBe("السعر عند التواصل");
  });

  it("shows dollars to a traveller who chose them", () => {
    expect(formatServicePrice({ price: 150, priceUnit: "per_hour" }, "en", "USD")).toBe("$40 per hour");
    expect(formatServicePrice({ price: 150, priceUnit: "per_hour" }, "ar", "USD")).toBe("$40 للساعة");
  });
});

describe("formatServiceAmount", () => {
  it("writes a riyal amount the way the price line does", () => {
    expect(formatServiceAmount(450, "en")).toBe("450 SAR");
    expect(formatServiceAmount(450, "ar")).toBe("450 ر.س");
    expect(formatServiceAmount(450, "en", "USD")).toBe("$120");
  });
});

describe("priceUnitLabel", () => {
  it("names each unit in both languages", () => {
    expect(priceUnitLabel("per_hour", "en")).toBe("per hour");
    expect(priceUnitLabel("per_day", "en")).toBe("per day");
    expect(priceUnitLabel("per_event", "en")).toBe("per booking");
    expect(priceUnitLabel("fixed", "en")).toBe("per booking");
    expect(priceUnitLabel("per_hour", "ar")).toBe("للساعة");
    expect(priceUnitLabel("per_day", "ar")).toBe("لليوم");
    expect(priceUnitLabel("per_event", "ar")).toBe("للحجز");
    expect(priceUnitLabel("fixed", "ar")).toBe("للحجز");
    expect(priceUnitLabel(undefined, "en")).toBe("per booking");
  });
});

describe("riyadhClock", () => {
  it("reads the Riyadh wall clock from a UTC instant", () => {
    expect(riyadhClock(RIYADH_1010)).toEqual({ date: "2026-09-25", minutes: 610 });
  });

  it("has already turned the day in Riyadh while it is still yesterday in UTC", () => {
    // 22:30Z is 01:30 the next morning in Riyadh.
    expect(riyadhClock(at("2026-09-25T22:30:00Z"))).toEqual({ date: "2026-09-26", minutes: 90 });
  });
});

describe("startTimes", () => {
  it("offers today only from an hour after now: 10:10 in Riyadh starts at 11:30", () => {
    const times = startTimes("2026-09-25", RIYADH_1010);
    expect(times[0]).toBe("11:30");
    expect(times[times.length - 1]).toBe("23:00");
  });

  it("offers every half hour from 06:00 to 23:00 on a later day", () => {
    const times = startTimes("2026-09-26", RIYADH_1010);
    expect(times[0]).toBe("06:00");
    expect(times[1]).toBe("06:30");
    expect(times[times.length - 1]).toBe("23:00");
    expect(times).toHaveLength(35);
  });

  it("counts a start exactly an hour away as far enough", () => {
    expect(startTimes("2026-09-25", at("2026-09-25T07:30:00Z"))[0]).toBe("11:30");
    // …and one a second short of an hour as too close.
    expect(startTimes("2026-09-25", at("2026-09-25T07:30:01Z"))[0]).toBe("12:00");
  });

  it("leaves nothing for today once the last start is under an hour away", () => {
    expect(startTimes("2026-09-25", at("2026-09-25T19:00:00Z"))).toEqual(["23:00"]);
    expect(startTimes("2026-09-25", at("2026-09-25T19:10:00Z"))).toEqual([]);
  });

  it("decides 'today' by Riyadh's date, not the phone's", () => {
    // 22:30Z on the 25th: the 25th is over in Riyadh, and the 26th has begun.
    const now = at("2026-09-25T22:30:00Z");
    expect(startTimes("2026-09-25", now)).toEqual([]);
    expect(startTimes("2026-09-26", now)[0]).toBe("06:00");
  });

  it("offers nothing on a day that has passed", () => {
    expect(startTimes("2026-09-24", RIYADH_1010)).toEqual([]);
  });
});

describe("firstBookableDate", () => {
  it("is today while a start time is left today", () => {
    expect(firstBookableDate(RIYADH_1010)).toBe("2026-09-25");
  });

  it("is tomorrow once today has none left", () => {
    expect(firstBookableDate(at("2026-09-25T19:30:00Z"))).toBe("2026-09-26");
  });
});

describe("quantityRange", () => {
  it("asks for hours or days only when the unit is priced by them", () => {
    expect(quantityRange("per_hour")).toEqual({ unit: "hours", min: 1, max: 12 });
    expect(quantityRange("per_day")).toEqual({ unit: "days", min: 1, max: 14 });
    expect(quantityRange("per_event")).toBeNull();
    expect(quantityRange("fixed")).toBeNull();
    expect(quantityRange(undefined)).toBeNull();
  });
});

describe("quantityLabel", () => {
  it("counts hours and days in English", () => {
    expect(quantityLabel(1, "hours", "en")).toBe("1 hour");
    expect(quantityLabel(3, "hours", "en")).toBe("3 hours");
    expect(quantityLabel(1, "days", "en")).toBe("1 day");
    expect(quantityLabel(14, "days", "en")).toBe("14 days");
  });

  it("takes the singular, dual, plural and counted-singular forms in Arabic", () => {
    expect(quantityLabel(1, "hours", "ar")).toBe("ساعة واحدة");
    expect(quantityLabel(2, "hours", "ar")).toBe("ساعتان");
    expect(quantityLabel(3, "hours", "ar")).toBe("3 ساعات");
    expect(quantityLabel(11, "hours", "ar")).toBe("11 ساعة");
    expect(quantityLabel(1, "days", "ar")).toBe("يوم واحد");
    expect(quantityLabel(2, "days", "ar")).toBe("يومان");
    expect(quantityLabel(3, "days", "ar")).toBe("3 أيام");
    expect(quantityLabel(11, "days", "ar")).toBe("11 يومًا");
  });
});

describe("peopleLabel and groupSizeLabel", () => {
  it("counts people in both languages", () => {
    expect(peopleLabel(1, "en")).toBe("1 person");
    expect(peopleLabel(4, "en")).toBe("4 people");
    expect(peopleLabel(1, "ar")).toBe("شخص واحد");
    expect(peopleLabel(2, "ar")).toBe("شخصان");
    expect(peopleLabel(3, "ar")).toBe("3 أشخاص");
    expect(peopleLabel(11, "ar")).toBe("11 شخصًا");
  });

  it("says how many a service takes, after «حتى» in the case it governs", () => {
    expect(groupSizeLabel(1, "en")).toBe("Up to 1 person");
    expect(groupSizeLabel(20, "en")).toBe("Up to 20 people");
    expect(groupSizeLabel(1, "ar")).toBe("حتى شخص واحد");
    expect(groupSizeLabel(2, "ar")).toBe("حتى شخصين");
    expect(groupSizeLabel(5, "ar")).toBe("حتى 5 أشخاص");
    expect(groupSizeLabel(20, "ar")).toBe("حتى 20 شخصًا");
  });
});

describe("quoteBreakdown and serviceTotalSar", () => {
  const hourly = { quantity: 3, unitPrice: 150, totalAmount: 450, priceUnit: "per_hour" };

  it("shows what an hourly or daily total is made of", () => {
    expect(quoteBreakdown(hourly, "en")).toBe("3 hours × 150 SAR");
    expect(quoteBreakdown(hourly, "ar")).toBe("3 ساعات × 150 ر.س");
    expect(
      quoteBreakdown({ quantity: 2, unitPrice: 800, totalAmount: 1600, priceUnit: "per_day" }, "en")
    ).toBe("2 days × 800 SAR");
  });

  it("shows a one-off price as the price per booking", () => {
    expect(
      quoteBreakdown({ quantity: 1, unitPrice: 300, totalAmount: 300, priceUnit: "fixed" }, "en")
    ).toBe("300 SAR per booking");
  });

  it("leaves a riyal total exactly as the server priced it", () => {
    expect(serviceTotalSar(hourly, "SAR")).toBe(450);
  });

  it("makes a dollar total agree with the dollar rate shown beside it", () => {
    // 100 SAR is $27 as a rate, so three hours must read $81 — not the $80
    // that 300 SAR converts to on its own.
    const quote = { quantity: 3, unitPrice: 100, totalAmount: 300, priceUnit: "per_hour" };
    expect(quoteBreakdown(quote, "en", "USD")).toBe("3 hours × $27");
    expect(formatServiceAmount(serviceTotalSar(quote, "USD"), "en", "USD")).toBe("$81");
  });
});

describe("serviceFooterState", () => {
  const quote = { quantity: 2, unitPrice: 150, totalAmount: 300, priceUnit: "per_hour" };

  it("asks for the day first, then the start time", () => {
    expect(serviceFooterState({ date: null, time: null, quote: undefined, lastGood: null })).toEqual({
      kind: "idle",
      missing: "day",
    });
    expect(
      serviceFooterState({ date: "2026-09-26", time: null, quote: undefined, lastGood: null })
    ).toEqual({ kind: "idle", missing: "time" });
  });

  it("is loading while the first quote is on its way", () => {
    expect(
      serviceFooterState({ date: "2026-09-26", time: "09:00", quote: undefined, lastGood: null })
    ).toEqual({ kind: "loading" });
  });

  it("keeps the last total on screen, marked stale, while a new one is on its way", () => {
    expect(
      serviceFooterState({ date: "2026-09-26", time: "09:00", quote: undefined, lastGood: quote })
    ).toEqual({ kind: "total", stale: true, ...quote });
  });

  it("shows the server's total", () => {
    expect(
      serviceFooterState({ date: "2026-09-26", time: "09:00", quote: { ok: true, quote }, lastGood: null })
    ).toEqual({ kind: "total", stale: false, ...quote });
  });

  it("passes the server's refusal on", () => {
    const error = "وقت البدء مضى بالفعل. / That start time has already passed.";
    expect(
      serviceFooterState({
        date: "2026-09-26",
        time: "09:00",
        quote: { ok: false, error },
        lastGood: quote,
      })
    ).toEqual({ kind: "error", message: error });
  });
});

// Rows as the list sees them, cut down to what these functions read.
const row = (
  id: string,
  over: Partial<{
    bookable: boolean;
    rating: number;
    reviewCount: number;
    createdAt: number;
    serviceType: string;
    title: string;
    titleAr: string;
    city: string;
    languages: string[];
  }> = {}
) => ({
  id,
  bookable: false,
  rating: 0,
  reviewCount: 0,
  createdAt: 0,
  serviceType: "tour_guide",
  title: `Service ${id}`,
  titleAr: `خدمة ${id}`,
  city: "Dammam",
  languages: [] as string[],
  ...over,
});
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("sortServicesForBrowse", () => {
  it("puts what can be booked first, then the best rated, then the newest", () => {
    const sorted = sortServicesForBrowse([
      row("contact-only", { rating: 5, reviewCount: 9 }),
      row("bookable-new", { bookable: true, createdAt: 300 }),
      row("bookable-rated", { bookable: true, rating: 4.6, reviewCount: 12 }),
      row("bookable-old", { bookable: true, createdAt: 100 }),
    ]);
    expect(ids(sorted)).toEqual(["bookable-rated", "bookable-new", "bookable-old", "contact-only"]);
  });

  it("breaks a tie in rating on the number of reviews", () => {
    const sorted = sortServicesForBrowse([
      row("one-review", { bookable: true, rating: 5, reviewCount: 1 }),
      row("forty", { bookable: true, rating: 5, reviewCount: 40 }),
    ]);
    expect(ids(sorted)).toEqual(["forty", "one-review"]);
  });

  it("does not reorder the list it was given", () => {
    const input = [row("a"), row("b", { bookable: true })];
    sortServicesForBrowse(input);
    expect(ids(input)).toEqual(["a", "b"]);
  });
});

describe("localServicesFor", () => {
  it("takes at most ten, bookable first", () => {
    const rows = Array.from({ length: 14 }, (_, i) => row(`s${i}`, { bookable: i >= 10, createdAt: i }));
    const picked = localServicesFor(rows);
    expect(picked).toHaveLength(10);
    expect(ids(picked.slice(0, 4))).toEqual(["s13", "s12", "s11", "s10"]);
  });
});

describe("filterServicesByQuery", () => {
  const rows = [
    row("guide", { title: "Heritage walks", titleAr: "جولات تراثية", city: "Hofuf" }),
    row("photo", { serviceType: "photographer", title: "Wedding shoots", titleAr: "تصوير أعراس" }),
    row("driver", {
      serviceType: "driver",
      title: "Airport runs",
      titleAr: "توصيل المطار",
      city: "Al Khobar",
      languages: ["Urdu", "English"],
    }),
  ];

  it("finds a service by its title in either language", () => {
    expect(ids(filterServicesByQuery(rows, "heritage"))).toEqual(["guide"]);
    expect(ids(filterServicesByQuery(rows, "أعراس"))).toEqual(["photo"]);
  });

  it("finds a service by what it is, in either language", () => {
    expect(ids(filterServicesByQuery(rows, "photographer"))).toEqual(["photo"]);
    expect(ids(filterServicesByQuery(rows, "مصور"))).toEqual(["photo"]);
  });

  it("finds a service by its city, through the sub-areas that fold into it", () => {
    // Stored as "Hofuf", which is Al Ahsa — typed without the hamza.
    expect(ids(filterServicesByQuery(rows, "الاحساء"))).toEqual(["guide"]);
    expect(ids(filterServicesByQuery(rows, "khobar"))).toEqual(["driver"]);
  });

  it("finds a service by a language it is offered in", () => {
    expect(ids(filterServicesByQuery(rows, "urdu"))).toEqual(["driver"]);
  });

  it("matches every word, in any order", () => {
    expect(ids(filterServicesByQuery(rows, "runs airport"))).toEqual(["driver"]);
    expect(filterServicesByQuery(rows, "airport wedding")).toEqual([]);
  });

  it("returns everything for an empty query", () => {
    expect(filterServicesByQuery(rows, "  ")).toHaveLength(3);
  });
});

describe("mergeById", () => {
  it("keeps each service once, in the order first found", () => {
    const merged = mergeById([row("a"), row("b")], [row("b"), row("c")]);
    expect(ids(merged)).toEqual(["a", "b", "c"]);
  });
});

describe("presentServiceTypes", () => {
  it("offers the types that are listed, in the app's order", () => {
    const rows = [row("1", { serviceType: "driver" }), row("2", { serviceType: "tour_guide" })];
    expect(presentServiceTypes(rows, "all")).toEqual(["tour_guide", "driver"]);
  });

  it("keeps the selected type on offer after its last service goes", () => {
    const rows = [row("1", { serviceType: "driver" })];
    expect(presentServiceTypes(rows, "catering")).toEqual(["driver", "catering"]);
  });

  it("ignores a stored type the app does not know", () => {
    expect(presentServiceTypes([row("1", { serviceType: "astrologer" })], "all")).toEqual([]);
  });
});

describe("pickLanguage", () => {
  it("gives the reader's language", () => {
    expect(pickLanguage("Heritage walks", "جولات تراثية", "en")).toBe("Heritage walks");
    expect(pickLanguage("Heritage walks", "جولات تراثية", "ar")).toBe("جولات تراثية");
  });

  it("falls back to the other language rather than showing nothing", () => {
    expect(pickLanguage("Airport runs", "  ", "ar")).toBe("Airport runs");
    expect(pickLanguage(undefined, "توصيل المطار", "en")).toBe("توصيل المطار");
    expect(pickLanguage(undefined, undefined, "en")).toBe("");
  });
});

describe("serviceTypeLabelKey", () => {
  it("has a label, in both languages, for all eight types", () => {
    expect(SERVICE_TYPES).toHaveLength(8);
    for (const type of SERVICE_TYPES) {
      const key = serviceTypeLabelKey(type);
      expect(translations.en[key]).toBeTruthy();
      expect(translations.ar[key]).toBeTruthy();
    }
    expect(serviceTypeLabelKey("tour_guide")).toBe("tourGuide");
    expect(serviceTypeLabelKey("equipment_rental")).toBe("equipmentRental");
  });

  it("files an unknown type under Other", () => {
    expect(serviceTypeLabelKey("astrologer")).toBe("otherService");
  });
});
