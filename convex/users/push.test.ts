import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, NOW, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import {
  MAX_DEVICES_PER_USER,
  PUSH_ERRORS,
  registerPushTokenForUser,
  unregisterPushTokenForUser,
} from "./push";

const TOKEN = "ExponentPushToken[abc123]";

async function user(t: TestT, over: Parameters<typeof seedUser>[1] = {}): Promise<Doc<"users">> {
  const id = await seedUser(t, over);
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

const register = (t: TestT, who: Doc<"users">, token: string, now = NOW, platform?: "ios" | "android") =>
  t.run((ctx) => registerPushTokenForUser(ctx, who, { token, platform }, now));

const devicesOf = (t: TestT, userId: Id<"users">) =>
  t.run((ctx) =>
    ctx.db
      .query("pushTokens")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect()
  );

describe("registerPushTokenForUser, rate", () => {
  it("allows twenty registrations a day, then refuses readably", async () => {
    // Registering moves a token to the caller. Unlimited, it would let someone
    // who learned tokens cycle them onto their own account at no cost.
    const t = makeT();
    const me = await user(t);
    for (let i = 0; i < 20; i++) await register(t, me, `ExponentPushToken[rate${i}]`);

    await expect(register(t, me, "ExponentPushToken[rate20]")).rejects.toSatisfy(
      (error: unknown) => error instanceof ConvexError && /limit/i.test(String(error.data))
    );
  });
});

describe("registerPushTokenForUser", () => {
  it("stores the device against the signed-in user", async () => {
    const t = makeT();
    const me = await user(t);

    expect(await register(t, me, TOKEN, NOW, "ios")).toEqual({ ok: true });

    expect(await devicesOf(t, me._id)).toMatchObject([
      { token: TOKEN, userId: me._id, platform: "ios", createdAt: NOW, updatedAt: NOW },
    ]);
  });

  it("accepts both spellings Expo has used, up to 200 characters inside the brackets", async () => {
    const t = makeT();
    const me = await user(t);

    for (const token of ["ExpoPushToken[xyz]", `ExponentPushToken[${"a".repeat(200)}]`]) {
      await expect(register(t, me, token)).resolves.toEqual({ ok: true });
    }
  });

  it("refuses anything that is not an Expo push token, in words a person can read", async () => {
    const t = makeT();
    const me = await user(t);

    for (const token of [
      "",
      "abc",
      "ExponentPushToken[]",
      `ExponentPushToken[${"a".repeat(201)}]`,
      "ExponentPushToken[abc]trailing",
      "ExponentPushToken[a]b]",
      "fcm:APA91bH",
    ]) {
      const caught = await register(t, me, token).catch((e: unknown) => e);
      expect(caught, token).toBeInstanceOf(ConvexError);
      expect((caught as ConvexError<string>).data).toBe("رمز الإشعارات غير صالح. / Invalid push token.");
      expect(PUSH_ERRORS.INVALID_TOKEN).toBe("رمز الإشعارات غير صالح. / Invalid push token.");
    }

    expect(await devicesOf(t, me._id)).toHaveLength(0);
  });

  it("refreshes a device registered again, rather than adding it twice", async () => {
    const t = makeT();
    const me = await user(t);

    await register(t, me, TOKEN, NOW, "android");
    await register(t, me, TOKEN, NOW + 5000);

    expect(await devicesOf(t, me._id)).toMatchObject([
      { token: TOKEN, createdAt: NOW, updatedAt: NOW + 5000, platform: "android" },
    ]);
  });

  it("moves a device to whoever signs in on it, so the last account stops getting its notices there", async () => {
    const t = makeT();
    const first = await user(t, { email: "first@example.com" });
    const second = await user(t, { email: "second@example.com" });

    await register(t, first, TOKEN, NOW);
    await register(t, second, TOKEN, NOW + 1000);

    expect(await devicesOf(t, first._id)).toHaveLength(0);
    expect(await devicesOf(t, second._id)).toMatchObject([{ token: TOKEN, userId: second._id }]);
    expect(await t.run((ctx) => ctx.db.query("pushTokens").collect())).toHaveLength(1);
  });

  it(`keeps each user's newest ${MAX_DEVICES_PER_USER} devices`, async () => {
    const t = makeT();
    const me = await user(t);
    const token = (i: number) => `ExponentPushToken[device-${i}]`;

    for (let i = 1; i <= 5; i++) await register(t, me, token(i), NOW + i);
    // Signing in again on the first phone makes it the newest…
    await register(t, me, token(1), NOW + 10);
    // …so the sixth device pushes out the second, not the first.
    await register(t, me, token(6), NOW + 11);

    const kept = (await devicesOf(t, me._id)).map((d) => d.token).sort();
    expect(kept).toEqual([token(1), token(3), token(4), token(5), token(6)].sort());
  });

  it("does not touch another user's devices when trimming", async () => {
    const t = makeT();
    const me = await user(t, { email: "me@example.com" });
    const other = await user(t, { email: "other@example.com" });

    await register(t, other, "ExponentPushToken[theirs]", NOW);
    for (let i = 1; i <= 6; i++) await register(t, me, `ExponentPushToken[mine-${i}]`, NOW + i);

    expect(await devicesOf(t, other._id)).toHaveLength(1);
    expect(await devicesOf(t, me._id)).toHaveLength(MAX_DEVICES_PER_USER);
  });
});

describe("unregisterPushTokenForUser", () => {
  it("removes the caller's own device", async () => {
    const t = makeT();
    const me = await user(t);
    await register(t, me, TOKEN);

    expect(await t.run((ctx) => unregisterPushTokenForUser(ctx, me, TOKEN))).toEqual({ ok: true });

    expect(await devicesOf(t, me._id)).toHaveLength(0);
  });

  it("leaves a device that now belongs to someone else", async () => {
    const t = makeT();
    const me = await user(t, { email: "me@example.com" });
    const other = await user(t, { email: "other@example.com" });
    await register(t, other, TOKEN);

    expect(await t.run((ctx) => unregisterPushTokenForUser(ctx, me, TOKEN))).toEqual({ ok: true });

    expect(await devicesOf(t, other._id)).toHaveLength(1);
  });

  it("is a no-op when signed out, or when the device is unknown", async () => {
    const t = makeT();
    const me = await user(t);
    await register(t, me, TOKEN);

    // Sign-out calls this first; an expired session must not turn that into an error.
    expect(await t.run((ctx) => unregisterPushTokenForUser(ctx, null, TOKEN))).toEqual({ ok: true });
    expect(await t.run((ctx) => unregisterPushTokenForUser(ctx, me, "ExponentPushToken[never]"))).toEqual({
      ok: true,
    });

    expect(await devicesOf(t, me._id)).toHaveLength(1);
  });
});
