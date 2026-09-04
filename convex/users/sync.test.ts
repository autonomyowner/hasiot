import { describe, expect, it } from "vitest";
import { makeT, NOW, seedUser } from "../test.utils";
import { mirrorAuthUserUpdate, splitName, upsertUserFromAuth, type AuthUserDoc } from "./sync";

function authDoc(over: Partial<AuthUserDoc> = {}): AuthUserDoc {
  return {
    _id: "auth_1",
    email: "guest@example.com",
    name: "Sara Al Qahtani",
    phoneNumber: null,
    phoneNumberVerified: false,
    ...over,
  };
}

const PHONE = "+966501234567";
const phoneSignUp = authDoc({
  _id: "auth_phone",
  email: "966501234567@phone.hasio.xyz",
  // Better Auth is configured to use the phone number as the display name for
  // phone sign-ups, because it has nothing else to put there.
  name: PHONE,
  phoneNumber: PHONE,
  phoneNumberVerified: true,
});

describe("splitName", () => {
  it("splits a real name", () => {
    expect(splitName("Sara Al Qahtani")).toEqual({ firstName: "Sara", lastName: "Al Qahtani" });
    expect(splitName("Sara")).toEqual({ firstName: "Sara", lastName: undefined });
  });

  it("treats a phone number as no name at all", () => {
    // Otherwise "+966501234567" becomes the guest's first name everywhere.
    expect(splitName(PHONE, PHONE)).toEqual({});
    expect(splitName(PHONE)).toEqual({});
    expect(splitName("0501234567")).toEqual({});
  });

  it("treats blank input as no name", () => {
    expect(splitName(null)).toEqual({});
    expect(splitName("   ")).toEqual({});
  });
});

describe("upsertUserFromAuth", () => {
  it("creates a tourist row for a phone sign-up", async () => {
    const t = makeT();
    const id = await t.run((ctx) => upsertUserFromAuth(ctx, phoneSignUp, NOW));
    const user = await t.run((ctx) => ctx.db.get(id));

    expect(user).toMatchObject({
      authId: "auth_phone",
      email: "966501234567@phone.hasio.xyz",
      phone: PHONE,
      phoneVerified: true,
      role: "tourist",
      preferredLanguage: "ar",
    });
    expect(user?.firstName).toBeUndefined();
    expect(user?.lastName).toBeUndefined();
    expect(user?.searchText).toContain("966501234567");
  });

  it("is idempotent — a second auth event does not create a second row", async () => {
    const t = makeT();
    await t.run((ctx) => upsertUserFromAuth(ctx, phoneSignUp, NOW));
    await t.run((ctx) => upsertUserFromAuth(ctx, phoneSignUp, NOW + 1000));

    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
  });

  it("links a legacy email row rather than duplicating it", async () => {
    const t = makeT();
    // A row created before triggers existed: real email, no authId.
    const existing = await seedUser(t, { email: "old@example.com", firstName: "Fahad", lastName: "Al Ali" });

    const id = await t.run((ctx) =>
      upsertUserFromAuth(ctx, authDoc({ _id: "auth_legacy", email: "old@example.com", name: "Fahad Al Ali" }), NOW)
    );

    expect(id).toBe(existing);
    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].authId).toBe("auth_legacy");
  });

  it("does not overwrite a name the guest already set", async () => {
    const t = makeT();
    await seedUser(t, { email: "old@example.com", firstName: "Fahad", lastName: "Al Ali" });
    await t.run((ctx) =>
      upsertUserFromAuth(ctx, authDoc({ _id: "a", email: "old@example.com", name: "Something Else" }), NOW)
    );

    const [user] = await t.run((ctx) => ctx.db.query("users").collect());
    expect(user.firstName).toBe("Fahad");
    expect(user.lastName).toBe("Al Ali");
  });

  it("fills in a name when the row has none", async () => {
    const t = makeT();
    await t.run((ctx) =>
      ctx.db.insert("users", {
        email: "blank@example.com",
        role: "tourist",
        createdAt: NOW,
        updatedAt: NOW,
      })
    );
    await t.run((ctx) =>
      upsertUserFromAuth(ctx, authDoc({ _id: "a", email: "blank@example.com", name: "Nora Al Dosari" }), NOW)
    );

    const [user] = await t.run((ctx) => ctx.db.query("users").collect());
    expect(user.firstName).toBe("Nora");
    expect(user.lastName).toBe("Al Dosari");
  });

  it("never demotes an already verified phone", async () => {
    const t = makeT();
    await seedUser(t, { email: "v@example.com", phone: PHONE, phoneVerified: true, authId: "auth_v" });

    // A later auth event that carries no phone data at all.
    await t.run((ctx) =>
      upsertUserFromAuth(ctx, authDoc({ _id: "auth_v", email: "v@example.com", phoneNumber: null, phoneNumberVerified: false }), NOW)
    );

    const [user] = await t.run((ctx) => ctx.db.query("users").collect());
    expect(user.phoneVerified).toBe(true);
    expect(user.phone).toBe(PHONE);
  });

  it("prefers the authId match over the email match", async () => {
    const t = makeT();
    // Two rows: one linked by authId, one that merely shares the new email.
    const linked = await seedUser(t, { email: "linked@example.com", authId: "auth_x" });
    await seedUser(t, { email: "collide@example.com" });

    const id = await t.run((ctx) =>
      upsertUserFromAuth(ctx, authDoc({ _id: "auth_x", email: "collide@example.com" }), NOW)
    );
    expect(id).toBe(linked);
  });
});

describe("mirrorAuthUserUpdate", () => {
  it("carries phone verification onto the app row", async () => {
    const t = makeT();
    // The email account exists; the guest is now verifying a phone against it.
    await seedUser(t, { email: "guest@example.com", authId: "auth_1" });

    const before = authDoc();
    const after = authDoc({ phoneNumber: PHONE, phoneNumberVerified: true });
    await t.run((ctx) => mirrorAuthUserUpdate(ctx, after, before, NOW));

    const [user] = await t.run((ctx) => ctx.db.query("users").collect());
    expect(user.phone).toBe(PHONE);
    expect(user.phoneVerified).toBe(true);
    expect(user.searchText).toContain(PHONE);
  });

  it("does nothing when no mirrored field changed", async () => {
    const t = makeT();
    await seedUser(t, { email: "guest@example.com", authId: "auth_1" });
    const [before] = await t.run((ctx) => ctx.db.query("users").collect());

    // A session refresh bumps updatedAt on the auth user but changes nothing
    // this app cares about.
    await t.run((ctx) => mirrorAuthUserUpdate(ctx, authDoc(), authDoc(), NOW + 5000));

    const [after] = await t.run((ctx) => ctx.db.query("users").collect());
    expect(after.updatedAt).toBe(before.updatedAt);
  });

  it("follows an email change", async () => {
    const t = makeT();
    await seedUser(t, { email: "old@example.com", authId: "auth_1" });
    await t.run((ctx) =>
      mirrorAuthUserUpdate(ctx, authDoc({ email: "new@example.com" }), authDoc({ email: "old@example.com" }), NOW)
    );

    const [user] = await t.run((ctx) => ctx.db.query("users").collect());
    expect(user.email).toBe("new@example.com");
    expect(user.searchText).toContain("new@example.com");
  });

  it("creates the row when an update arrives for an account that never had one", async () => {
    const t = makeT();
    await t.run((ctx) =>
      mirrorAuthUserUpdate(ctx, authDoc({ phoneNumber: PHONE, phoneNumberVerified: true }), authDoc(), NOW)
    );

    const rows = await t.run((ctx) => ctx.db.query("users").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].phoneVerified).toBe(true);
  });
});
