import { describe, expect, it } from "vitest";
import { countForm, matchesQuery, normalizeForSearch, searchableText } from "./searchText";

describe("normalizeForSearch", () => {
  it("ignores case and the spacing around and inside a query", () => {
    expect(normalizeForSearch("  Al   Khobar ")).toBe("al khobar");
    expect(normalizeForSearch("")).toBe("");
  });

  it("reads every hamza form of alef as a plain alef", () => {
    expect(normalizeForSearch("الأحساء")).toBe("الاحساء");
    expect(normalizeForSearch("إبل")).toBe("ابل");
    expect(normalizeForSearch("آثار")).toBe("اثار");
  });

  it("reads taa marbuta as haa, and alef maqsura as yaa", () => {
    expect(normalizeForSearch("واحة")).toBe("واحه");
    expect(normalizeForSearch("مستشفى")).toBe("مستشفي");
  });

  it("drops the short vowels, shadda and tatweel", () => {
    // The marks are written as escapes: in source they are invisible.
    // fatha, kasra, fatha — then sukun, fatha — then shadda.
    expect(normalizeForSearch("مَدِينَة")).toBe("مدينه");
    expect(normalizeForSearch("قَهْوَة")).toBe("قهوه");
    expect(normalizeForSearch("القّارة")).toBe("القاره");
    // Tatweel, the stretching stroke some names are typed with.
    expect(normalizeForSearch("الـقـطـيف")).toBe("القطيف");
  });

  it("reads digits typed on an Arabic keyboard", () => {
    expect(normalizeForSearch("فندق ٥ نجوم")).toBe("فندق 5 نجوم");
  });

  it("folds Latin accents and the punctuation between words", () => {
    expect(normalizeForSearch("Café")).toBe("cafe");
    expect(normalizeForSearch("Al-Ahsa")).toBe("al ahsa");
    expect(normalizeForSearch("Qara'a")).toBe("qaraa");
    expect(normalizeForSearch("الخبر، الدمام")).toBe("الخبر الدمام");
  });
});

describe("matchesQuery", () => {
  const hotel = searchableText("Hilton Garden Inn", "هيلتون جاردن إن", "Al Khobar", "الخبر");

  it("finds a place by its name or its city, in either language", () => {
    expect(matchesQuery(hotel, normalizeForSearch("hilton"))).toBe(true);
    expect(matchesQuery(hotel, normalizeForSearch("Khobar"))).toBe(true);
    expect(matchesQuery(hotel, normalizeForSearch("الخبر"))).toBe(true);
    expect(matchesQuery(hotel, normalizeForSearch("هيلتون"))).toBe(true);
  });

  it("needs every word, in any order", () => {
    expect(matchesQuery(hotel, normalizeForSearch("khobar hilton"))).toBe(true);
    expect(matchesQuery(hotel, normalizeForSearch("hilton dammam"))).toBe(false);
  });

  it("matches Arabic typed without its hamza or its taa marbuta", () => {
    const oasis = searchableText("Al Ahsa Oasis", "واحة الأحساء");
    expect(matchesQuery(oasis, normalizeForSearch("واحه الاحساء"))).toBe(true);
    expect(matchesQuery(oasis, normalizeForSearch("احساء"))).toBe(true);
  });

  it("skips fields that are missing", () => {
    expect(searchableText("Hilton", undefined, "", null)).toBe("hilton");
  });

  it("matches everything when there is no query", () => {
    expect(matchesQuery(hotel, "")).toBe(true);
  });
});

describe("countForm", () => {
  it("has a singular and a plural in English", () => {
    expect(countForm(1, "en")).toBe("one");
    expect(countForm(0, "en")).toBe("many");
    expect(countForm(2, "en")).toBe("many");
    expect(countForm(21, "en")).toBe("many");
  });

  it("follows Arabic's own count forms", () => {
    // نتيجة واحدة، نتيجتان، ٣–١٠ نتائج، ١١ نتيجة فما فوق
    expect(countForm(1, "ar")).toBe("one");
    expect(countForm(2, "ar")).toBe("two");
    expect(countForm(3, "ar")).toBe("few");
    expect(countForm(10, "ar")).toBe("few");
    expect(countForm(11, "ar")).toBe("many");
    expect(countForm(99, "ar")).toBe("many");
  });

  it("reads the last two digits past a hundred, as Arabic does", () => {
    expect(countForm(100, "ar")).toBe("many");
    expect(countForm(102, "ar")).toBe("many");
    expect(countForm(103, "ar")).toBe("few");
    expect(countForm(110, "ar")).toBe("few");
    expect(countForm(111, "ar")).toBe("many");
  });
});
