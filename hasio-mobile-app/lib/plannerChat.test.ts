import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types";
import {
  MAX_STORED_CHARS,
  MAX_STORED_MESSAGES,
  historyForModel,
  indexPlaces,
  matchPlaces,
  messagesToStore,
  normalisePlaceName,
  planText,
  settleRestoredChat,
} from "./plannerChat";

const at = "2026-09-24T10:00:00.000Z";

function user(id: string, text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, text, isUser: true, timestamp: at, ...extra };
}

function bot(id: string, text: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id, text, isUser: false, timestamp: at, ...extra };
}

describe("planText", () => {
  it("joins the parts the plan has, in the card's order", () => {
    expect(planText({ itinerary: "Day 1", tips: "Carry water", budget: "400 SAR" })).toBe(
      "Day 1\n\nCarry water\n\n400 SAR"
    );
    expect(planText({ itinerary: "Day 1", budget: "300 SAR" })).toBe("Day 1\n\n300 SAR");
  });
});

describe("historyForModel", () => {
  it("sends the conversation as alternating turns", () => {
    expect(historyForModel([user("1", "Hi"), bot("2", "Which city?")])).toEqual([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Which city?" },
    ]);
  });

  it("leaves out failed turns and the turn being sent", () => {
    const messages = [
      user("1", "Hi"),
      bot("2", "Which city?"),
      user("3", "Dammam", { failed: true }),
    ];
    const expected = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Which city?" },
    ];
    expect(historyForModel(messages)).toEqual(expected);
    expect(historyForModel([...messages.slice(0, 2), user("3", "Dammam")], "3")).toEqual(expected);
  });

  it("sends a plan as its text, not as the empty bubble text", () => {
    const plan = { itinerary: "Day 1", tips: "Water", budget: "400 SAR" };
    expect(historyForModel([user("1", "Plan it"), bot("2", "", { plan })])).toEqual([
      { role: "user", content: "Plan it" },
      { role: "assistant", content: "Day 1\n\nWater\n\n400 SAR" },
    ]);
  });

  it("starts with the guest even when the stored chat does not", () => {
    expect(historyForModel([bot("1", "Which city?"), user("2", "Khobar")])).toEqual([
      { role: "user", content: "Khobar" },
    ]);
  });
});

describe("messagesToStore", () => {
  const alternating = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      i % 2 === 0 ? user(String(i), "q") : bot(String(i), "a")
    );

  it("keeps the newest messages, up to the cap", () => {
    const kept = messagesToStore(alternating(50));
    expect(kept).toHaveLength(MAX_STORED_MESSAGES);
    expect(kept[0].id).toBe("10");
    expect(kept[kept.length - 1].id).toBe("49");
  });

  it("never opens on a reply whose question was trimmed away", () => {
    // The newest forty are 1..40, and 1 is a reply.
    const kept = messagesToStore(alternating(41));
    expect(kept[0].id).toBe("2");
    expect(kept).toHaveLength(39);
  });

  it("stops at the character budget", () => {
    const half = "x".repeat(MAX_STORED_CHARS / 2);
    const messages = [user("1", "q"), bot("2", half), user("3", "q"), bot("4", half)];
    expect(messagesToStore(messages).map((m) => m.id)).toEqual(["3", "4"]);
  });

  it("counts a plan by its parts", () => {
    const plan = { itinerary: "x".repeat(MAX_STORED_CHARS), tips: "t" };
    expect(messagesToStore([user("1", "q"), bot("2", "", { plan })])).toEqual([]);
  });
});

describe("settleRestoredChat", () => {
  it("marks a question left without an answer as failed", () => {
    const restored = settleRestoredChat([
      user("1", "Hi"),
      bot("2", "Which city?"),
      user("3", "Dammam"),
    ]);
    expect(restored[2]).toEqual(user("3", "Dammam", { failed: true }));
    expect(restored[0].failed).toBeUndefined();
  });

  it("leaves an answered chat alone", () => {
    const chat = [user("1", "Hi"), bot("2", "Which city?")];
    expect(settleRestoredChat(chat)).toEqual(chat);
  });

  it("survives whatever storage hands back", () => {
    expect(settleRestoredChat(undefined)).toEqual([]);
    expect(settleRestoredChat("nope")).toEqual([]);
    expect(settleRestoredChat([null, { id: 1 }, user("1", "Hi")])).toEqual([
      user("1", "Hi", { failed: true }),
    ]);
  });
});

describe("normalisePlaceName", () => {
  it("folds case, punctuation and spacing", () => {
    expect(normalisePlaceName("Al-Qarah  Mountain")).toBe("al qarah mountain");
    expect(normalisePlaceName("  Ibrahim Palace (Qasr Ibrahim) ")).toBe(
      "ibrahim palace qasr ibrahim"
    );
  });

  it("folds the Arabic letters that are written either way", () => {
    expect(normalisePlaceName("قصر إبراهيم")).toBe(normalisePlaceName("قصر ابراهيم"));
    expect(normalisePlaceName("جبل القارة")).toBe(normalisePlaceName("جبل القاره"));
    expect(normalisePlaceName("مَسْجِد")).toBe(normalisePlaceName("مسجد"));
  });
});

describe("matchPlaces", () => {
  const index = indexPlaces([
    { _id: "a", name_en: "Al-Qarah Mountain", name_ar: "جبل القارة" },
    { _id: "b", name_en: "Ibrahim Palace", name_ar: "قصر إبراهيم" },
    { _id: "c", name_en: "Hofuf Souq", name_ar: "سوق الهفوف" },
  ]);

  it("finds the listing behind each name, in the plan's order, once each", () => {
    const matched = matchPlaces(
      [{ name: "Ibrahim Palace" }, { name: "al qarah mountain" }, { name: "IBRAHIM PALACE" }],
      index
    );
    expect(matched.map((l) => l._id)).toEqual(["b", "a"]);
  });

  it("falls back to the Arabic name", () => {
    const matched = matchPlaces([{ name: "Qasr Ibrahim", nameAr: "قصر ابراهيم" }], index);
    expect(matched.map((l) => l._id)).toEqual(["b"]);
  });

  it("does not guess at a place with no listing", () => {
    expect(matchPlaces([{ name: "Hofuf" }, { name: "Half Moon Bay" }], index)).toEqual([]);
    expect(matchPlaces(undefined, index)).toEqual([]);
  });
});
