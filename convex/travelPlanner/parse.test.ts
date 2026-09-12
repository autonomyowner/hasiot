import { describe, expect, it } from "vitest";
import {
  asText,
  buildContextBlock,
  extractJsonObject,
  normaliseDestinations,
} from "./parse";

/**
 * The shape that broke production, kept faithful to a real reply.
 *
 * The model was cut off at max_tokens partway through `itinerary`, so the outer
 * object never closed. The last "}" in the text belongs to the final
 * destination — which is what the old greedy /\{[\s\S]*\}/ latched onto.
 */
const TRUNCATED_PLAN = `\`\`\`json
{
  "ready": true,
  "suggestedDestinations": [
    {"name": "Ithra", "name_ar": "إثراء", "type": "attraction", "description": "المعلم الثقافي الأول في المنطقة"},
    {"name": "Qatif Fish Market", "name_ar": "سوق السمك بالقطيف", "type": "attraction", "description": "أفضل سوق سمك في المنطقة، طازة يومية"}
  ],
  "itinerary": "**اليوم الأول - الدمام**\\n- الوصول إلى مطار المل`;

describe("extractJsonObject", () => {
  it("reads a bare object", () => {
    expect(extractJsonObject('{"ready": false, "message": "Which city?"}')).toEqual({
      ready: false,
      message: "Which city?",
    });
  });

  it("reads an object wrapped in a markdown fence", () => {
    const raw = '```json\n{"ready": false, "message": "When?"}\n```';
    expect(extractJsonObject(raw)).toEqual({ ready: false, message: "When?" });
  });

  it("reads an object with prose either side of it", () => {
    const raw = 'Sure! {"ready": false, "message": "How many of you?"} Hope that helps.';
    expect(extractJsonObject(raw)?.message).toBe("How many of you?");
  });

  it("returns null when the reply was cut off mid-plan", () => {
    expect(extractJsonObject(TRUNCATED_PLAN)).toBeNull();
  });

  it("does not mistake the last destination's brace for the end of the object", () => {
    // What the old greedy regex did: matched first "{" to last "}", which here
    // stops inside suggestedDestinations and throws away everything after it.
    const greedy = TRUNCATED_PLAN.match(/\{[\s\S]*\}/);
    expect(greedy).not.toBeNull();
    expect(greedy![0].length).toBeLessThan(TRUNCATED_PLAN.length * 0.9);
    expect(() => JSON.parse(greedy![0])).toThrow();

    // The balanced scan reports the truncation instead of parsing a fragment,
    // which is what lets the action show a retry rather than the raw reply.
    expect(extractJsonObject(TRUNCATED_PLAN)).toBeNull();
  });

  it("keeps braces that appear inside a string value", () => {
    const raw =
      '{"ready": true, "suggestedDestinations": [{"name": "X", "type": "hotel"}], "itinerary": "Day 1 {check in 15:00} then dinner", "travelTips": "Bring sunscreen"}';
    const parsed = extractJsonObject(raw);
    expect(parsed?.itinerary).toBe("Day 1 {check in 15:00} then dinner");
    expect(parsed?.travelTips).toBe("Bring sunscreen");
  });

  it("keeps escaped quotes inside a string value", () => {
    const raw = '{"ready": false, "message": "Do you mean the \\"old\\" souq?"}';
    expect(extractJsonObject(raw)?.message).toBe('Do you mean the "old" souq?');
  });

  it("handles an Arabic reply", () => {
    const raw = '{"ready": false, "message": "في أي مدينة ستقيم؟"}';
    expect(extractJsonObject(raw)?.message).toBe("في أي مدينة ستقيم؟");
  });

  it("returns null for prose with no object at all", () => {
    expect(extractJsonObject("I would start in Al Khobar.")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
  });

  it("finds the object even when the model wraps it in an array", () => {
    expect(extractJsonObject('[{"ready": false, "message": "Which city?"}]')).toEqual({
      ready: false,
      message: "Which city?",
    });
  });
});

describe("normaliseDestinations", () => {
  it("keeps a well-formed destination", () => {
    expect(
      normaliseDestinations([
        { name: "Ithra", name_ar: "إثراء", type: "attraction", description: "Culture" },
      ])
    ).toEqual([
      { name: "Ithra", name_ar: "إثراء", type: "attraction", description: "Culture" },
    ]);
  });

  it("defaults an unknown or missing type rather than letting storePlan throw", () => {
    const result = normaliseDestinations([
      { name: "Somewhere", type: "city" },
      { name: "Elsewhere" },
    ]);
    expect(result.map((d) => d.type)).toEqual(["attraction", "attraction"]);
  });

  it("accepts a bare string", () => {
    expect(normaliseDestinations(["Tarout Castle"])).toEqual([
      { name: "Tarout Castle", type: "attraction" },
    ]);
  });

  it("drops entries with no usable name and keeps the rest", () => {
    const result = normaliseDestinations([
      { type: "hotel" },
      { name: "   " },
      null,
      "",
      { name: "Le Meridien Al Khobar", type: "HOTEL" },
    ]);
    expect(result).toEqual([{ name: "Le Meridien Al Khobar", name_ar: undefined, type: "hotel", description: undefined }]);
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(normaliseDestinations(undefined)).toEqual([]);
    expect(normaliseDestinations("Ithra")).toEqual([]);
  });
});

describe("asText", () => {
  it("keeps non-empty strings and rejects everything else", () => {
    expect(asText("hello")).toBe("hello");
    expect(asText("   ")).toBeUndefined();
    expect(asText(undefined)).toBeUndefined();
    expect(asText(42)).toBeUndefined();
  });
});

describe("buildContextBlock", () => {
  const listing = {
    name_en: "Le Meridien Al Khobar",
    name_ar: "لو ميريديان الخبر",
    type: "hotel",
    city: "Al Khobar",
    address: "King Saud St",
    priceRange: "$$$",
    pricePerNight: 640,
    rating: 4.5,
  };

  it("lists each place with the exact name the model must copy", () => {
    const block = buildContextBlock([listing], []);
    expect(block).toContain("Le Meridien Al Khobar");
    expect(block).toContain("Al Khobar");
    expect(block).toContain("640 SAR/night");
    expect(block).toContain("4.5/5");
  });

  it("falls back to the price tier when there is no nightly rate", () => {
    const block = buildContextBlock([{ ...listing, pricePerNight: undefined }], []);
    expect(block).toContain("$$$");
    expect(block).not.toContain("SAR/night");
  });

  it("says outright when nothing is published, so the model stops implying bookings", () => {
    const block = buildContextBlock([], []);
    expect(block).toContain("None are published");
  });

  it("includes the team's notes and marks them as authoritative", () => {
    const block = buildContextBlock([listing], [
      { category: "tips", title: "Friday closures", content: "Souqs shut for prayer." },
    ]);
    expect(block).toContain("Friday closures");
    expect(block).toContain("Souqs shut for prayer.");
    expect(block).toContain("beat the general knowledge");
  });
});
