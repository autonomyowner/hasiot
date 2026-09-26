import { afterEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { makeT, seedUser } from "../test.utils";
import type { TestT } from "../test.utils";
import type { Id } from "../_generated/dataModel";
import { CONTACT_PHONE_ERRORS, setContactPhoneForUser, withBookingReadiness } from "./contactPhone";

afterEach(() => {
  vi.unstubAllEnvs();
});

async function load(t: TestT, id: Id<"users">) {
  return (await t.run((ctx) => ctx.db.get(id)))!;
}

async function refusalOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return undefined;
  } catch (e) {
    if (e instanceof ConvexError) return e.data as string;
    throw e;
  }
}

function set(t: TestT, id: Id<"users">, phone: string) {
  return t.run(async (ctx) => setContactPhoneForUser(ctx, (await ctx.db.get(id))!, phone));
}

describe("setContactPhoneForUser", () => {
  it("stores a Saudi mobile unverified, and it becomes searchable", async () => {
    const t = makeT();
    const id = await seedUser(t, { email: "sara@gmail.com", firstName: "Sara" });

    expect(await set(t, id, "+966501234567")).toEqual({ phone: "+966501234567", phoneVerified: false });

    const user = await load(t, id);
    expect(user.phone).toBe("+966501234567");
    expect(user.phoneVerified).toBeFalsy();
    expect(user.searchText).toContain("966501234567");
  });

  it("lets the number be corrected while it is still unconfirmed", async () => {
    const t = makeT();
    const id = await seedUser(t);
    await set(t, id, "+966501234567");
    await set(t, id, "+966551112222");
    expect((await load(t, id)).phone).toBe("+966551112222");
  });

  it("refuses anything that is not a Saudi mobile", async () => {
    const t = makeT();
    const id = await seedUser(t);
    for (const bad of ["+213551234567", "0501234567", "+966131234567", ""]) {
      expect(await refusalOf(set(t, id, bad))).toBe(CONTACT_PHONE_ERRORS.INVALID_SAUDI_MOBILE);
    }
  });

  it("is closed once Saudi SMS works", async () => {
    vi.stubEnv("SAUDI_SMS_LIVE", "true");
    const t = makeT();
    const id = await seedUser(t);
    expect(await refusalOf(set(t, id, "+966501234567"))).toBe(CONTACT_PHONE_ERRORS.SMS_IS_LIVE);
  });

  it("never replaces a verified number with an unconfirmed one", async () => {
    const t = makeT();
    const id = await seedUser(t, { phone: "+966509999999", phoneVerified: true });
    expect(await refusalOf(set(t, id, "+966501234567"))).toBe(CONTACT_PHONE_ERRORS.ALREADY_VERIFIED);
    expect((await load(t, id)).phone).toBe("+966509999999");
  });

  it("is rate limited", async () => {
    const t = makeT();
    const id = await seedUser(t);
    for (let i = 0; i < 10; i++) await set(t, id, `+96650000000${i}`);
    expect(await refusalOf(set(t, id, "+966501234567"))).toMatch(/Daily limit reached/);
  });
});

describe("withBookingReadiness", () => {
  it("adds canBook from the phone rule", async () => {
    const t = makeT();
    const verified = await load(t, await seedUser(t, { phone: "+213551234567", phoneVerified: true }));
    const saudi = await load(t, await seedUser(t, { phone: "+966501234567" }));
    const none = await load(t, await seedUser(t));

    expect(withBookingReadiness(verified)!.canBook).toBe(true);
    expect(withBookingReadiness(saudi)!.canBook).toBe(true);
    expect(withBookingReadiness(none)!.canBook).toBe(false);
    expect(withBookingReadiness(null)).toBeNull();

    vi.stubEnv("SAUDI_SMS_LIVE", "true");
    expect(withBookingReadiness(saudi)!.canBook).toBe(false);
  });
});
