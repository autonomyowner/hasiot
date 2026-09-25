import { describe, expect, it } from "vitest";
import { makeT, NOW, seedHotel, seedService, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Id } from "../_generated/dataModel";
import { reportTarget } from "./queries";

async function reportOf(t: TestT, targetType: string, targetId: string, details?: string) {
  const reporter = await seedUser(t);
  const id = await t.run((ctx) =>
    ctx.db.insert("contentReports", {
      reporterId: reporter,
      targetType,
      targetId,
      reason: "inappropriate",
      details,
      status: "pending",
      createdAt: NOW,
    })
  );
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

describe("reportTarget", () => {
  it("shows a reported planner reply by its text, not as deleted content", async () => {
    // An AI message is not stored anywhere but in the report (contract 7:
    // details holds the message text), so there is nothing to look up. Without
    // this the panel labelled every such report "المحتوى محذوف".
    const t = makeT();
    const report = await reportOf(t, "ai_message", "msg-42", "Visit the beach at midnight, it is safe.");

    const target = await t.run((ctx) => reportTarget(ctx, report));

    expect(target).toEqual({ title: "Visit the beach at midnight, it is safe.", subtitle: "AI" });
  });

  it("says which place or service a reported review is about", async () => {
    const t = makeT();
    const author = await seedUser(t);
    const provider = await seedUser(t, { role: "service_provider", isApproved: true });
    const listingId = await seedHotel(t, { name_en: "Oasis Inn" });
    const serviceId = await seedService(t, { ownerId: provider, title_ar: "جولة الواحة" });
    const review = (target: { listingId?: Id<"listings">; serviceId?: Id<"services"> }) =>
      t.run((ctx) =>
        ctx.db.insert("reviews", { userId: author, ...target, rating: 1, content: "Awful", createdAt: NOW, updatedAt: NOW })
      );
    const ofPlace = await review({ listingId });
    const ofService = await review({ serviceId });

    const placeReport = await reportOf(t, "review", ofPlace);
    const serviceReport = await reportOf(t, "review", ofService);
    const place = await t.run((ctx) => reportTarget(ctx, placeReport));
    const service = await t.run((ctx) => reportTarget(ctx, serviceReport));

    expect(place).toMatchObject({
      title: "Awful",
      subtitle: "1/5",
      ownerId: author,
      reviewOf: { type: "listing", id: listingId, title: "فندق تجريبي" },
    });
    expect(service).toMatchObject({ reviewOf: { type: "service", id: serviceId, title: "جولة الواحة" } });
  });

  it("answers null when the reported thing is gone", async () => {
    const t = makeT();
    const listingId = await seedHotel(t);
    await t.run((ctx) => ctx.db.delete(listingId));
    const aboutGoneListing = await reportOf(t, "listing", listingId);
    const aboutNothing = await reportOf(t, "review", "not-an-id");

    expect(await t.run((ctx) => reportTarget(ctx, aboutGoneListing))).toBeNull();
    expect(await t.run((ctx) => reportTarget(ctx, aboutNothing))).toBeNull();
  });
});
