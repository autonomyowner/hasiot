import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedHotel, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc } from "../_generated/dataModel";
import { MAX_MESSAGE_ID, MAX_MESSAGE_TEXT, REPORT_ERRORS, reportContentForUser } from "./mutations";

async function reporter(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t);
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const report = (
  t: TestT,
  user: Doc<"users">,
  args: { targetType: string; targetId: string; reason: string; details?: string }
) => t.run((ctx) => reportContentForUser(ctx, user, args, NOW));

async function refusalOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    return String((error as ConvexError<string>).data);
  }
  throw new Error("expected a refusal");
}

describe("reporting a planner message", () => {
  it("records the message id and its text, which exist only on the traveller's phone", async () => {
    const t = makeT();
    const me = await reporter(t);

    const result = await report(t, me, {
      targetType: "ai_message",
      targetId: "msg-1727251200000-3",
      reason: "offensive",
      details: "The reply that was reported.",
    });

    expect(result).toMatchObject({ success: true, alreadyReported: false });
    expect(await t.run((ctx) => ctx.db.get(result.reportId))).toMatchObject({
      reporterId: me._id,
      targetType: "ai_message",
      targetId: "msg-1727251200000-3",
      reason: "offensive",
      details: "The reply that was reported.",
      status: "pending",
      createdAt: NOW,
    });
  });

  it(`keeps the first ${MAX_MESSAGE_TEXT} characters of a long message rather than refusing the report`, async () => {
    const t = makeT();
    const me = await reporter(t);

    // A full itinerary runs long; the report is still worth having.
    const { reportId } = await report(t, me, {
      targetType: "ai_message",
      targetId: "msg-2",
      reason: "other",
      details: "x".repeat(MAX_MESSAGE_TEXT + 500),
    });

    expect((await t.run((ctx) => ctx.db.get(reportId)))?.details).toHaveLength(MAX_MESSAGE_TEXT);
  });

  it(`refuses a message id that is empty or longer than ${MAX_MESSAGE_ID} characters`, async () => {
    const t = makeT();
    const me = await reporter(t);

    for (const targetId of ["", "   ", "m".repeat(MAX_MESSAGE_ID + 1)]) {
      expect(await refusalOf(report(t, me, { targetType: "ai_message", targetId, reason: "spam" }))).toBe(
        REPORT_ERRORS.INVALID_MESSAGE_ID
      );
    }
    await expect(
      report(t, me, { targetType: "ai_message", targetId: "m".repeat(MAX_MESSAGE_ID), reason: "spam" })
    ).resolves.toMatchObject({ success: true });
  });

  it("answers a repeat report of the same message with the first one", async () => {
    const t = makeT();
    const me = await reporter(t);
    const args = { targetType: "ai_message", targetId: "msg-3", reason: "spam" };

    const first = await report(t, me, args);
    const again = await report(t, me, args);

    expect(again).toEqual({ success: true, reportId: first.reportId, alreadyReported: true });
  });
});

describe("the other report targets", () => {
  it("still records a listing report as before, details untouched", async () => {
    const t = makeT();
    const me = await reporter(t);
    const listingId = await seedHotel(t);
    const details = "y".repeat(MAX_MESSAGE_TEXT + 10);

    const { reportId } = await report(t, me, { targetType: "listing", targetId: listingId, reason: "fraud", details });

    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({ targetType: "listing", details });
  });

  it("refuses an unknown target type or reason, readably", async () => {
    const t = makeT();
    const me = await reporter(t);

    expect(await refusalOf(report(t, me, { targetType: "moment", targetId: "x", reason: "spam" }))).toBe(
      REPORT_ERRORS.INVALID_TARGET
    );
    expect(await refusalOf(report(t, me, { targetType: "listing", targetId: "x", reason: "boring" }))).toBe(
      REPORT_ERRORS.INVALID_REASON
    );
  });

  it("keeps the daily limit on reports", async () => {
    const t = makeT();
    const me = await reporter(t);
    await t.run((ctx) =>
      ctx.db.insert("rateLimits", { key: `report:${me._id}`, windowStart: Date.now(), count: 20 })
    );

    expect(
      await refusalOf(report(t, me, { targetType: "ai_message", targetId: "msg-4", reason: "spam" }))
    ).toMatch(/today's reporting limit/);
  });
});
