import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc } from "../_generated/dataModel";
import { saveBusinessDocForUser } from "./mutations";

async function load(t: TestT, id: Doc<"users">["_id"]): Promise<Doc<"users">> {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

describe("saveBusinessDocForUser", () => {
  it("stores the new document and puts a turned-down account back in the queue", async () => {
    // A rejected owner's fix is a new document. Keeping the old rejection on
    // the account would show the queue a verdict on a file nobody has seen.
    const t = makeT();
    const id = await seedUser(t, { role: "business_owner", isApproved: false });
    await t.run((ctx) =>
      ctx.db.patch(id, { accountRejectionReason: "Expired licence", accountRejectedAt: NOW - 1000 })
    );
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["new licence"])));

    await t.run(async (ctx) => saveBusinessDocForUser(ctx, (await ctx.db.get(id))!, fileId, NOW));

    const after = await load(t, id);
    expect(after.cvFileId).toBe(fileId);
    expect(after.accountRejectionReason).toBeUndefined();
    expect(after.accountRejectedAt).toBeUndefined();
    expect(after.isApproved).toBe(false);
  });

  it("refuses a tourist in words the app can show", async () => {
    const t = makeT();
    const id = await seedUser(t, { role: "tourist" });
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["x"])));

    await expect(
      t.run(async (ctx) => saveBusinessDocForUser(ctx, (await ctx.db.get(id))!, fileId, NOW))
    ).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof ConvexError && /Only business accounts can upload documents/.test(String(error.data))
    );
  });
});
