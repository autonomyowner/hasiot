#!/usr/bin/env node
/**
 * End-to-end check of bookable services against the DEVELOPMENT deployment.
 *
 *   node scripts/smoke/services-e2e.mjs            (from the repo root)
 *
 * It drives the real functions the app and the admin panel call, as three
 * real accounts: an admin (email), a service provider and a traveller (both
 * phone sign-ups — the development deployment runs SMS_PROVIDER=demo, where any
 * six digits verify, so no text is sent). It makes everything it uses and
 * deletes it all at the end, through the same account deletion the app offers.
 *
 * It refuses to run unless .env.local points at a `dev:` deployment: the steps
 * create and delete accounts, and a mistake here must never reach production.
 *
 * Three steps need internal functions, which only the CLI can call
 * (granting admin, and the nightly completion job with a chosen date). The
 * CLI is started through its own entry file with `node`, not through `npx`,
 * because on Windows `npx` is a .cmd shim that Node can only start through a
 * shell — and a shell would re-quote the JSON arguments.
 */
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const api = anyApi;
const ORIGIN = "https://www.hasio.xyz"; // what the app sends; Better Auth checks it against trustedOrigins

// --- environment -----------------------------------------------------------

function readEnvFile(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [key, ...rest] = line.split("=");
    out[key.trim()] = rest.join("=").split(" #")[0].trim();
  }
  return out;
}

const env = readEnvFile(".env.local");
const URL = env.VITE_CONVEX_URL;
const SITE = env.VITE_CONVEX_SITE_URL;
if (!env.CONVEX_DEPLOYMENT?.startsWith("dev:") || !URL || /hearty-ram-74/.test(URL)) {
  console.error("Refusing to run: .env.local must point at a development deployment.");
  process.exit(2);
}

const CLI = path.join("node_modules", "convex", "bin", "main.js");
function convexRun(fn, args = {}) {
  const out = execFileSync(process.execPath, [CLI, "run", fn, JSON.stringify(args)], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return out.trim();
}

// --- auth ------------------------------------------------------------------

async function authPost(pathname, body) {
  const res = await fetch(`${SITE}/api/auth${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${pathname} → ${res.status} ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function clientFor(sessionToken) {
  const res = await fetch(`${SITE}/api/auth/convex/token`, {
    headers: { Authorization: `Bearer ${sessionToken}`, Origin: ORIGIN },
  });
  if (!res.ok) throw new Error(`convex/token → ${res.status} ${await res.text()}`);
  const { token } = await res.json();
  const client = new ConvexHttpClient(URL);
  client.setAuth(token);
  return client;
}

async function phoneAccount(phone) {
  await authPost("/phone-number/send-otp", { phoneNumber: phone });
  const data = await authPost("/phone-number/verify", { phoneNumber: phone, code: "123456" });
  return data.token ?? data.session?.token;
}

async function emailAccount(email, password, name) {
  const data = await authPost("/sign-up/email", { email, password, name });
  return data.token ?? data.session?.token;
}

// --- helpers ---------------------------------------------------------------

const RIYADH_MS = 3 * 60 * 60 * 1000;
const riyadhDate = (offsetDays = 0) =>
  new Date(Date.now() + RIYADH_MS + offsetDays * 86_400_000).toISOString().slice(0, 10);
const randomSaudiMobile = () =>
  `+96650${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

let step = 0;
function ok(label, detail = "") {
  step += 1;
  console.log(`OK ${String(step).padStart(2, "0")} ${label}${detail ? ` — ${detail}` : ""}`);
}
function expect(condition, label, detail) {
  if (!condition) throw new Error(`FAILED: ${label}${detail ? ` — ${detail}` : ""}`);
}
async function expectRefusal(promise, englishPart, label) {
  try {
    await promise;
  } catch (error) {
    const text = String(error?.data ?? error?.message ?? error);
    expect(text.includes(englishPart), label, `got: ${text}`);
    return;
  }
  throw new Error(`FAILED: ${label} — expected a refusal containing "${englishPart}"`);
}

// A 1x1 PNG, standing in for a business document.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

// --- the run ---------------------------------------------------------------

const stamp = Date.now().toString(36);
const cleanup = [];

async function main() {
  // Accounts
  const adminEmail = `smoke-admin-${stamp}@example.com`;
  const admin = await clientFor(await emailAccount(adminEmail, `Smoke-${stamp}-pw!`, "Smoke Admin"));
  cleanup.push(["admin", admin]);
  convexRun("admin/devTools:grantAdmin", { email: adminEmail });
  ok("admin account", adminEmail);

  const provider = await clientFor(await phoneAccount(randomSaudiMobile()));
  cleanup.push(["provider", provider]);
  await provider.mutation(api.users.mutations.setUserRole, {
    role: "service_provider",
    firstName: "Smoke",
    lastName: "Provider",
  });
  const uploadUrl = await provider.mutation(api.users.mutations.generateUploadUrl, {});
  const upload = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: TINY_PNG });
  const { storageId } = await upload.json();
  await provider.mutation(api.users.mutations.saveBusinessDoc, { fileId: storageId });
  const providerUser = await provider.query(api.users.queries.getCurrentUser, {});
  await admin.mutation(api.users.mutations.approveBusinessAccount, { userId: providerUser._id });
  ok("provider signed up, verified and approved");

  const tourist = await clientFor(await phoneAccount(randomSaudiMobile()));
  cleanup.push(["tourist", tourist]);
  const touristUser = await tourist.query(api.users.queries.getCurrentUser, {});
  expect(touristUser?.phoneVerified === true, "traveller phone verified");
  ok("traveller signed up by phone");

  // The provider posts a priced service; it is invisible until approved
  const serviceId = await provider.mutation(api.services.mutations.submitService, {
    serviceType: "tour_guide",
    title_en: `Smoke oasis walk ${stamp}`,
    title_ar: `جولة تجريبية في الواحة ${stamp}`,
    description_en: "A smoke-test service.",
    description_ar: "خدمة لاختبار النظام.",
    price: 150,
    priceUnit: "per_hour",
    maxGroupSize: 6,
    city: "Hofuf",
    languages: ["ar", "en"],
  });
  expect((await tourist.query(api.services.queries.getService, { serviceId })) === null, "pending service hidden");
  ok("service submitted, hidden while pending");

  await admin.mutation(api.admin.mutations.approveService, { id: serviceId });
  const providerNotes = await provider.query(api.notifications.queries.listMine, {});
  expect(
    providerNotes.some((n) => n.type === "service.approved" && n.data?.target === "my-services"),
    "provider told of approval"
  );
  ok("admin approved it, provider notified");

  // The traveller finds it, in both languages, by city
  const shown = await tourist.query(api.services.queries.getService, { serviceId });
  expect(shown?.bookable === true && shown.city === "Al Ahsa", "service public and bookable, city folded", JSON.stringify({ bookable: shown?.bookable, city: shown?.city }));
  const inCity = await tourist.query(api.services.queries.listServices, { city: "Al Ahsa" });
  expect(inCity.some((s) => s._id === serviceId), "listed under Al Ahsa");
  const arabic = await tourist.query(api.services.queries.searchServices, { searchQuery: `تجريبية ${stamp}` });
  expect(arabic.some((s) => s._id === serviceId), "found by its Arabic title");
  ok("traveller finds it by city and in Arabic");

  // Quote and book
  const date = riyadhDate(1);
  const quote = await tourist.query(api.bookings.queries.quoteService, {
    serviceId,
    date,
    time: "09:00",
    quantity: 3,
    partySize: 2,
  });
  expect(quote.ok && quote.quote.totalAmount === 450, "server quote 3h x 150", JSON.stringify(quote));
  ok("quote", `SAR ${quote.quote.totalAmount}`);

  await tourist.mutation(api.users.push.registerPushToken, {
    token: `ExponentPushToken[smoke-${stamp}]`,
    platform: "android",
  });
  ok("push token registered");

  const { bookingId, confirmationCode } = await tourist.mutation(api.bookings.mutations.createServiceBooking, {
    serviceId,
    date,
    time: "09:00",
    quantity: 3,
    partySize: 2,
    notes: "Smoke test",
  });
  ok("booking requested", confirmationCode);

  await expectRefusal(
    tourist.mutation(api.bookings.mutations.createServiceBooking, { serviceId, date, time: "10:00", quantity: 1 }),
    "already have an active request",
    "a second request for the same day is refused"
  );
  ok("duplicate refused");

  // The live 1.0.2 app must never see it; 1.1.0 must
  const legacy = await tourist.query(api.bookings.queries.getUserBookings, {});
  expect(!legacy.some((b) => b._id === bookingId), "hidden from the old app's list");
  expect((await tourist.query(api.bookings.queries.getBooking, { bookingId })) === null, "hidden from the old app's detail");
  const current = await tourist.query(api.bookings.queries.getUserBookings, { includeServices: true });
  const row = current.find((b) => b._id === bookingId);
  expect(row?.service?._id === serviceId, "1.1.0 list carries the service summary");
  ok("old app cannot see it, 1.1.0 can");

  // The provider's inbox, stats and notification
  const inbox = await provider.query(api.bookings.queries.getProviderBookings, {});
  expect(inbox.some((b) => b._id === bookingId), "in the provider inbox");
  const stats = await provider.query(api.bookings.queries.getProviderStats, {});
  expect(stats?.pending >= 1, "provider stats count it", JSON.stringify(stats));
  const requested = (await provider.query(api.notifications.queries.listMine, {})).find(
    (n) => n.type === "booking.requested" && n.data?.bookingId === bookingId
  );
  expect(requested?.data?.target === "provider-inbox", "request notification lands in the provider inbox");
  ok("provider inbox, stats and notification");

  await provider.mutation(api.bookings.mutations.confirmBooking, { bookingId });
  const confirmed = (await tourist.query(api.notifications.queries.listMine, {})).find(
    (n) => n.type === "booking.confirmed" && n.data?.bookingId === bookingId
  );
  expect(confirmed?.data?.target === "booking", "traveller told, tap opens the booking");
  ok("provider confirmed, traveller notified");

  // Admin sees and finds it
  const adminPage = await admin.query(api.admin.queries.adminListBookings, {
    paginationOpts: { numItems: 25, cursor: null },
    kind: "service",
  });
  expect(adminPage.page.some((b) => b._id === bookingId), "in the admin bookings list (services)");
  const byCode = await admin.query(api.admin.queries.adminSearchBookings, { search: confirmationCode.toLowerCase() });
  expect(byCode.some((b) => b._id === bookingId), "admin finds it by confirmation code");
  ok("admin lists and finds the booking");

  // The day passes: the nightly job completes it, the traveller rates it
  const detail = await tourist.query(api.bookings.queries.getBooking, { bookingId, includeServices: true });
  convexRun("bookings/lifecycle:completeFinishedStays", { today: detail.checkOut });
  const done = await tourist.query(api.bookings.queries.getBooking, { bookingId, includeServices: true });
  expect(done?.status === "completed", "completed by the nightly job", done?.status);
  const reviewable = await tourist.query(api.reviews.queries.listMyReviewableServices, {});
  expect(reviewable.some((r) => r.bookingId === bookingId), "offered for review");
  await tourist.mutation(api.reviews.mutations.addReview, {
    serviceId,
    bookingId,
    rating: 5,
    content: "Smoke test review",
  });
  const summary = await tourist.query(api.reviews.queries.getServiceSummary, { serviceId });
  const reviews = await tourist.query(api.reviews.queries.listForService, { serviceId });
  expect(summary.count === 1 && summary.average === 5 && reviews[0]?.isVerified === true, "verified review counted");
  ok("completed, rated, verified");

  // Moderation: a suspended service disappears, and comes back
  await admin.mutation(api.admin.mutations.suspendService, { serviceId, reason: "Smoke test" });
  expect((await tourist.query(api.services.queries.getService, { serviceId })) === null, "suspended service hidden");
  await admin.mutation(api.admin.mutations.reinstateService, { serviceId });
  expect((await tourist.query(api.services.queries.getService, { serviceId }))?._id === serviceId, "reinstated");
  ok("suspend and reinstate");
}

async function tidy() {
  // Delete the traveller and the provider first; the admin last, because a
  // failed run may still need it.
  for (const [who, client] of cleanup.reverse()) {
    try {
      await client.mutation(api.users.mutations.deleteMyAccount, {});
      console.log(`   deleted ${who}`);
    } catch (error) {
      console.log(`   could not delete ${who}: ${String(error?.data ?? error?.message ?? error)}`);
    }
  }
}

try {
  await main();
  console.log(`\nAll ${step} steps passed.`);
} catch (error) {
  console.error(`\n${String(error?.data ?? error?.message ?? error)}`);
  process.exitCode = 1;
} finally {
  await tidy();
}
