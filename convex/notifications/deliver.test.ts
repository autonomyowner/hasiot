import { afterEach, describe, expect, it, vi } from "vitest";
import { internal } from "../_generated/api";
import {
  makeT,
  NOW,
  seedHotel,
  seedService,
  seedServiceBooking,
  seedStay,
  seedUser,
} from "../test.utils";
import type { TestT } from "../test.utils";
import type { Doc, Id } from "../_generated/dataModel";
import { emailInputFor } from "./deliver";

/**
 * Delivery talks to Expo and Resend over the network, so these tests fake
 * `fetch` at that boundary and assert what would have gone over the wire.
 */

const EXPO = "https://exp.host/--/api/v2/push/send";
const RESEND = "https://api.resend.com/emails";

type Call = { url: string; body: unknown };

function fakeNetwork(respond: (url: string) => Response | Promise<Response>): Call[] {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      return respond(url);
    })
  );
  return calls;
}

const ok = (json: unknown) => new Response(JSON.stringify(json), { status: 200 });
const pushedOk = (n: number) => ok({ data: Array.from({ length: n }, () => ({ status: "ok" })) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function recipient(t: TestT, over: { email?: string; language?: "ar" | "en" } = {}) {
  const userId = await seedUser(t, { email: over.email ?? "sara@example.com", firstName: "Sara" });
  if (over.language === "en") await t.run((ctx) => ctx.db.patch(userId, { preferredLanguage: "en" }));
  return userId;
}

function device(t: TestT, userId: Id<"users">, token: string) {
  return t.run((ctx) => ctx.db.insert("pushTokens", { token, userId, createdAt: NOW, updatedAt: NOW }));
}

function notice(t: TestT, userId: Id<"users">, over: Partial<Doc<"notifications">> = {}) {
  return t.run((ctx) =>
    ctx.db.insert("notifications", {
      userId,
      type: "booking.confirmed",
      title_en: "Booking confirmed",
      title_ar: "تم تأكيد حجزك",
      body_en: "Your tour is confirmed.",
      body_ar: "تم تأكيد جولتك.",
      data: { target: "booking" },
      createdAt: NOW,
      ...over,
    })
  );
}

const send = (t: TestT, notificationId: Id<"notifications">) =>
  t.action(internal.notifications.deliver.send, { notificationId });

const devicesLeft = (t: TestT) =>
  t.run(async (ctx) => (await ctx.db.query("pushTokens").collect()).map((d) => d.token));

describe("push", () => {
  it("goes to each of the recipient's devices, high priority, on the default channel", async () => {
    const t = makeT();
    const calls = fakeNetwork(() => pushedOk(2));
    const userId = await recipient(t, { language: "en" });
    await device(t, userId, "ExponentPushToken[one]");
    await device(t, userId, "ExponentPushToken[two]");
    // Someone else's phone never hears about this booking.
    await device(t, await recipient(t, { email: "other@example.com" }), "ExponentPushToken[other]");
    const notificationId = await notice(t, userId);

    await send(t, notificationId);

    expect(calls).toEqual([
      {
        url: EXPO,
        body: ["ExponentPushToken[one]", "ExponentPushToken[two]"].map((to) => ({
          to,
          title: "Booking confirmed",
          body: "Your tour is confirmed.",
          data: { target: "booking" },
          sound: "default",
          priority: "high",
          channelId: "default",
        })),
      },
    ]);
    expect((await t.run((ctx) => ctx.db.get(notificationId)))?.deliveredAt).toBeTypeOf("number");
  });

  it("speaks the recipient's language", async () => {
    const t = makeT();
    const calls = fakeNetwork(() => pushedOk(1));
    const userId = await recipient(t); // seeded as Arabic
    await device(t, userId, "ExponentPushToken[one]");

    await send(t, await notice(t, userId));

    expect(calls[0].body).toMatchObject([{ title: "تم تأكيد حجزك", body: "تم تأكيد جولتك." }]);
  });

  it("sends nothing to someone with no device", async () => {
    const t = makeT();
    const calls = fakeNetwork(() => pushedOk(0));
    const userId = await recipient(t);
    const notificationId = await notice(t, userId);

    await send(t, notificationId);

    expect(calls).toEqual([]);
    // The inbox row is the source of truth; it is still marked as handled.
    expect((await t.run((ctx) => ctx.db.get(notificationId)))?.deliveredAt).toBeTypeOf("number");
  });

  it("forgets a device Expo reports as gone, and keeps the rest", async () => {
    const t = makeT();
    fakeNetwork(() =>
      ok({ data: [{ status: "error", details: { error: "DeviceNotRegistered" } }, { status: "ok" }] })
    );
    const userId = await recipient(t);
    await device(t, userId, "ExponentPushToken[uninstalled]");
    await device(t, userId, "ExponentPushToken[alive]");

    await send(t, await notice(t, userId));

    expect(await devicesLeft(t)).toEqual(["ExponentPushToken[alive]"]);
  });

  it("keeps a device on any other push error", async () => {
    const t = makeT();
    fakeNetwork(() => ok({ data: [{ status: "error", details: { error: "MessageRateExceeded" } }] }));
    const userId = await recipient(t);
    await device(t, userId, "ExponentPushToken[busy]");

    await send(t, await notice(t, userId));

    expect(await devicesLeft(t)).toEqual(["ExponentPushToken[busy]"]);
  });

  it("never throws when the push service is down or refuses", async () => {
    for (const respond of [
      () => Promise.reject(new TypeError("fetch failed")),
      () => new Response("upstream error", { status: 502 }),
      () => new Response("not json", { status: 200 }),
    ]) {
      const t = makeT();
      fakeNetwork(respond);
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const userId = await recipient(t);
      await device(t, userId, "ExponentPushToken[one]");
      const notificationId = await notice(t, userId);

      await expect(send(t, notificationId)).resolves.toBeNull();

      // A failed push is not a failed notification: the booking change and
      // its inbox row stand, and nothing is retried into a double send.
      expect((await t.run((ctx) => ctx.db.get(notificationId)))?.deliveredAt).toBeTypeOf("number");
      expect(await devicesLeft(t)).toEqual(["ExponentPushToken[one]"]);
      errors.mockRestore();
    }
  });
});

describe("email", () => {
  async function serviceBooking(t: TestT, email: string) {
    const userId = await recipient(t, { email, language: "en" });
    const ownerId = await seedUser(t, { role: "service_provider", isApproved: true, email: "p@example.com" });
    const serviceId = await seedService(t, { ownerId, title_en: "Oasis day tour", title_ar: "جولة الواحة" });
    const bookingId = await seedServiceBooking(t, {
      userId,
      serviceId,
      ownerId,
      date: "2026-09-10",
      time: "09:00",
      status: "confirmed",
      confirmationCode: "HSO-TOUR2",
    });
    const notificationId = await notice(t, userId, { data: { bookingId, serviceId, target: "booking" } });
    return { userId, notificationId };
  }

  it("no longer needs a listing: a service booking is emailed with its service, day and time", async () => {
    const t = makeT();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const calls = fakeNetwork(() => ok({}));
    const { notificationId } = await serviceBooking(t, "sara@example.com");

    await send(t, notificationId);

    const emails = calls.filter((c) => c.url === RESEND);
    expect(emails).toHaveLength(1);
    const email = emails[0].body as { to: string[]; subject: string; text: string };
    expect(email.to).toEqual(["sara@example.com"]);
    expect(email.subject).toBe("Hasio — Booking confirmed");
    expect(email.text).toContain("Oasis day tour is confirmed on 2026-09-10 at 09:00. Code HSO-TOUR2.");
    expect(email.text).toContain("Time: 09:00");
    expect(email.text).toContain("Payment is made directly to the provider.");
  });

  it("still emails a stay as before", async () => {
    const t = makeT();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const calls = fakeNetwork(() => ok({}));
    const userId = await recipient(t, { language: "en" });
    const listingId = await seedHotel(t, { name_en: "Al Koot Heritage" });
    const bookingId = await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      status: "confirmed",
    });

    await send(t, await notice(t, userId, { data: { bookingId, listingId, target: "booking" } }));

    const [email] = calls.filter((c) => c.url === RESEND).map((c) => c.body as { text: string });
    expect(email.text).toContain("Place: Al Koot Heritage");
    expect(email.text).toContain("Payment is made directly at the property.");
  });

  it("never writes to a phone sign-up's placeholder address", async () => {
    const t = makeT();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const calls = fakeNetwork(() => ok({}));
    const { notificationId } = await serviceBooking(t, "966500000002@phone.hasio.xyz");

    await send(t, notificationId);

    expect(calls.filter((c) => c.url === RESEND)).toEqual([]);
  });

  it("sends none while no email provider is configured", async () => {
    const t = makeT();
    const calls = fakeNetwork(() => ok({}));
    const { notificationId } = await serviceBooking(t, "sara@example.com");

    await send(t, notificationId);

    expect(calls.filter((c) => c.url === RESEND)).toEqual([]);
  });

  it("links the traveller's email to their trip on the website", async () => {
    const t = makeT();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const calls = fakeNetwork(() => ok({}));
    const userId = await recipient(t, { language: "en" });
    const listingId = await seedHotel(t, { name_en: "Al Koot Heritage" });
    const bookingId = await seedStay(t, {
      userId,
      listingId,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
      status: "confirmed",
    });

    await send(
      t,
      await notice(t, userId, { data: { bookingId, listingId, audience: "tourist", target: "booking" } })
    );

    const [email] = calls.filter((c) => c.url === RESEND).map((c) => c.body as { text: string });
    expect(email.text).toContain(`View booking: https://hasio.net/trips/${bookingId}`);
  });

  it("emails the host a new request, with the payment line and a link to their inbox", async () => {
    // A host who works from the website has no push: without this email a
    // request made on the site can sit unseen until it expires.
    const t = makeT();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    vi.stubEnv("PUBLIC_SITE_URL", "https://staging.hasio.net/");
    const calls = fakeNetwork(() => ok({}));
    const hostId = await recipient(t, { email: "host@example.com", language: "en" });
    const guestId = await seedUser(t, { email: "guest@example.com", firstName: "Sara" });
    const listingId = await seedHotel(t, { ownerId: hostId, name_en: "Al Koot Heritage" });
    const bookingId = await seedStay(t, {
      userId: guestId,
      listingId,
      ownerId: hostId,
      checkIn: "2026-09-10",
      checkOut: "2026-09-12",
    });

    await send(
      t,
      await notice(t, hostId, {
        type: "booking.requested",
        title_en: "New booking request",
        data: { bookingId, listingId, audience: "owner", target: "host-inbox" },
      })
    );

    const emails = calls.filter((c) => c.url === RESEND).map((c) => c.body as { to: string[]; text: string });
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toEqual(["host@example.com"]);
    // The push says who is coming; the email must too.
    // (seedUser's default last name is "User".)
    expect(emails[0].text).toContain("Sara User requested 2 nights at Al Koot Heritage");
    expect(emails[0].text).toContain("The guest pays you at the property.");
    expect(emails[0].text).toContain(
      "Open your bookings: https://staging.hasio.net/partners/hotel/bookings"
    );
  });

  it("emails the provider when a traveller cancels", async () => {
    const t = makeT();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    const calls = fakeNetwork(() => ok({}));
    const travellerId = await recipient(t, { email: "sara@example.com" });
    const providerId = await seedUser(t, {
      role: "service_provider",
      isApproved: true,
      email: "guide@example.com",
    });
    const serviceId = await seedService(t, { ownerId: providerId, title_en: "Oasis day tour", title_ar: "جولة الواحة" });
    const bookingId = await seedServiceBooking(t, {
      userId: travellerId,
      serviceId,
      ownerId: providerId,
      date: "2026-09-10",
      status: "cancelled",
    });

    await send(
      t,
      await notice(t, providerId, {
        type: "booking.cancelled",
        data: { bookingId, serviceId, audience: "owner", target: "provider-inbox" },
      })
    );

    const [email] = calls.filter((c) => c.url === RESEND).map((c) => c.body as { to: string[]; text: string });
    expect(email.to).toEqual(["guide@example.com"]);
    expect(email.text).toContain("/partners/services/bookings");
  });

  it("never throws when the email provider fails", async () => {
    const t = makeT();
    vi.stubEnv("RESEND_API_KEY", "re_test");
    fakeNetwork(() => Promise.reject(new TypeError("fetch failed")));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { notificationId } = await serviceBooking(t, "sara@example.com");

    await expect(send(t, notificationId)).resolves.toBeNull();
    errors.mockRestore();
  });
});

describe("emailInputFor", () => {
  const serviceBooking = {
    kind: "service",
    date: "2026-09-10",
    time: "09:00",
    checkIn: "2026-09-10",
    checkOut: "2026-09-11",
    quantity: 3,
    priceUnit: "per_hour",
    partySize: 4,
    guests: 4,
    totalAmount: 450,
    currency: "SAR",
    confirmationCode: "HSO-TOUR2",
    declineReason: "Fully booked",
  } as Doc<"bookings">;
  const service = { title_en: "Oasis day tour", title_ar: "جولة الواحة" } as Doc<"services">;

  it("describes a service booking by its service, day, start time and quantity", () => {
    expect(emailInputFor(serviceBooking, null, service)).toEqual({
      kind: "service",
      listingName_en: "Oasis day tour",
      listingName_ar: "جولة الواحة",
      checkIn: "2026-09-10",
      startTime: "09:00",
      quantity: 3,
      priceUnit: "per_hour",
      guests: 4,
      totalAmount: 450,
      currency: "SAR",
      confirmationCode: "HSO-TOUR2",
      reason: "Fully booked",
      // The usual 48-hour deadline, so an expiry would say "within 48 hours".
      expiredAtStart: false,
    });
  });

  it("has nothing to say without the booked place or service", () => {
    expect(emailInputFor(serviceBooking, null, null)).toBeNull();
    expect(emailInputFor(null, null, null)).toBeNull();
  });

  it("names the guest when there is a name to give", () => {
    expect(emailInputFor(serviceBooking, null, service, { firstName: "Sara", lastName: "Al Qahtani" })?.guestName).toBe(
      "Sara Al Qahtani"
    );
    // A phone sign-up with no name reads "A guest", as in the push.
    expect(emailInputFor(serviceBooking, null, service, { firstName: undefined })?.guestName).toBeUndefined();
    expect(emailInputFor(serviceBooking, null, service, null)?.guestName).toBeUndefined();
  });
});
