import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { approveBusinessAccountRecord, rejectBusinessAccountRecord } from "./service";
import { pendingBusinessRows } from "./views";

async function admin(t: TestT): Promise<Doc<"users">> {
  const id = await seedUser(t, { role: "admin", email: "admin@hasio.test" });
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const activity = (t: TestT) => t.run((ctx) => ctx.db.query("adminActivity").collect());
const user = (t: TestT, id: Id<"users">) => t.run((ctx) => ctx.db.get(id));
const inboxOf = (t: TestT, userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db
      .query("notifications")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
  );

function refusedWith(text: string | RegExp) {
  return (error: unknown) =>
    error instanceof ConvexError &&
    (typeof text === "string" ? String(error.data) === text : text.test(String(error.data)));
}

/** A business account waiting in the queue, with or without its document. */
async function applicant(
  t: TestT,
  opts: { role?: string; withDocument?: boolean; rejected?: string } = {}
): Promise<Id<"users">> {
  const id = await seedUser(t, { role: opts.role ?? "business_owner", isApproved: false });
  if (opts.withDocument) {
    const fileId = await t.run((ctx) => ctx.storage.store(new Blob(["licence"])));
    await t.run((ctx) => ctx.db.patch(id, { cvFileId: fileId }));
  }
  if (opts.rejected) {
    await t.run((ctx) =>
      ctx.db.patch(id, { accountRejectionReason: opts.rejected, accountRejectedAt: NOW - 1000 })
    );
  }
  return id;
}

describe("rejectBusinessAccountRecord", () => {
  it("turns an account down with a reason the owner is sent", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await applicant(t, { withDocument: true });

    await t.run((ctx) => rejectBusinessAccountRecord(ctx, acting, id, "  Licence is expired  ", NOW));

    expect(await user(t, id)).toMatchObject({
      isApproved: false,
      accountRejectionReason: "Licence is expired",
      accountRejectedAt: NOW,
    });
    expect((await activity(t))[0]).toMatchObject({
      action: "account.reject",
      targetType: "user",
      targetId: id,
      details: "Licence is expired",
    });
    const [notice] = await inboxOf(t, id);
    expect(notice).toMatchObject({
      type: "account.rejected",
      title_en: "Your documents were not approved",
      data: { target: "verification" },
    });
    expect(notice.body_en).toContain("Reason: Licence is expired");
  });

  it("requires a reason, which is the only thing that tells the owner what to fix", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await applicant(t, { withDocument: true });

    await expect(
      t.run((ctx) => rejectBusinessAccountRecord(ctx, acting, id, "   ", NOW))
    ).rejects.toSatisfy(refusedWith("سبب الرفض مطلوب. / A rejection reason is required."));
    expect((await user(t, id))!.accountRejectionReason).toBeUndefined();
    expect(await activity(t)).toHaveLength(0);
  });

  it("refuses an account that is not a business account", async () => {
    const t = makeT();
    const acting = await admin(t);
    const tourist = await seedUser(t, { role: "tourist" });

    await expect(
      t.run((ctx) => rejectBusinessAccountRecord(ctx, acting, tourist, "No", NOW))
    ).rejects.toSatisfy(refusedWith(/not a business account/));
  });

  it("keeps the reason within bounds", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await applicant(t);

    await t.run((ctx) => rejectBusinessAccountRecord(ctx, acting, id, "x".repeat(900), NOW));

    expect((await user(t, id))!.accountRejectionReason).toHaveLength(500);
  });
});

describe("approveBusinessAccountRecord", () => {
  it("refuses an account that never uploaded a document", async () => {
    // Bulk approve already refused these; a single approve did not, so the
    // one check the queue exists for could be skipped by clicking once.
    const t = makeT();
    const acting = await admin(t);
    const id = await applicant(t);

    await expect(
      t.run((ctx) => approveBusinessAccountRecord(ctx, acting, id, {}, NOW))
    ).rejects.toSatisfy(
      refusedWith("لا يمكن اعتماد حساب بلا وثيقة. / An account cannot be approved without a document.")
    );
    expect((await user(t, id))!.isApproved).toBe(false);
  });

  it("approves, clears an earlier rejection, logs and tells the owner", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await applicant(t, { role: "service_provider", withDocument: true, rejected: "Blurry" });

    await t.run((ctx) => approveBusinessAccountRecord(ctx, acting, id, {}, NOW));

    const after = (await user(t, id))!;
    expect(after.isApproved).toBe(true);
    expect(after.accountRejectionReason).toBeUndefined();
    expect(after.accountRejectedAt).toBeUndefined();
    expect((await activity(t))[0]).toMatchObject({ action: "account.approve", targetId: id });
    const [notice] = await inboxOf(t, id);
    expect(notice).toMatchObject({
      type: "account.approved",
      title_en: "Your account is approved",
      data: { target: "verification" },
    });
  });

  it("marks a batch approval in the log", async () => {
    const t = makeT();
    const acting = await admin(t);
    const id = await applicant(t, { withDocument: true });

    await t.run((ctx) => approveBusinessAccountRecord(ctx, acting, id, { bulk: true }, NOW));

    expect((await activity(t))[0]).toMatchObject({ details: "ضمن إجراء جماعي" });
  });

  it("refuses a tourist and a missing account in words the panel can show", async () => {
    const t = makeT();
    const acting = await admin(t);
    const tourist = await seedUser(t);
    const gone = await seedUser(t, { role: "business_owner" });
    await t.run((ctx) => ctx.db.delete(gone));

    await expect(
      t.run((ctx) => approveBusinessAccountRecord(ctx, acting, tourist, {}, NOW))
    ).rejects.toSatisfy(refusedWith(/not a business account/));
    await expect(
      t.run((ctx) => approveBusinessAccountRecord(ctx, acting, gone, {}, NOW))
    ).rejects.toSatisfy(refusedWith("المستخدم غير موجود. / User not found."));
  });
});

describe("pendingBusinessRows", () => {
  it("says which accounts have a document and why an account was turned down", async () => {
    const t = makeT();
    const waiting = await applicant(t, { withDocument: true });
    const noDocument = await applicant(t, { role: "service_provider" });
    const rejected = await applicant(t, { withDocument: true, rejected: "Expired licence" });
    await seedUser(t, { role: "business_owner", isApproved: true }); // not pending

    const rows = await t.run((ctx) => pendingBusinessRows(ctx));
    const byId = new Map(rows.map((r) => [r._id, r]));

    expect(rows).toHaveLength(3);
    expect(byId.get(waiting)).toMatchObject({ hasDocument: true });
    expect(byId.get(waiting)!.accountRejectionReason).toBeUndefined();
    expect(byId.get(noDocument)).toMatchObject({ hasDocument: false, role: "service_provider" });
    expect(byId.get(rejected)).toMatchObject({
      hasDocument: true,
      accountRejectionReason: "Expired licence",
    });
  });
});
