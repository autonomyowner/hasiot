// Development-only fixture for the website's booking pages (/places, /services,
// /book, /trips). Run from the repo root:
//   node scripts/smoke/web-booking-fixture.mjs create
//       → prints the ids and accounts as JSON; the browser test drives the site
//         with them
//   node scripts/smoke/web-booking-fixture.mjs confirm <bookingId>
//       → the host (or provider) confirms a request, as from their inbox
//   node scripts/smoke/web-booking-fixture.mjs complete <YYYY-MM-DD>
//       → runs the nightly completion job as if it were that Riyadh date
//   node scripts/smoke/web-booking-fixture.mjs forget-phone <+number>
//       → records a number the browser signed up with, so cleanup deletes it
//   node scripts/smoke/web-booking-fixture.mjs cleanup
//       → deletes every account it made or was told about (their places,
//         services and bookings go with them)
//
// What it makes: an admin (email), an approved host with a priced hotel, an
// approved provider with an hourly service, and an email-only traveller with
// no phone — the account that takes the Saudi "type the number once" path.
// Development runs demo SMS, so any six digits sign a phone number in.
// Refuses to run unless .env.local points at a dev: deployment.
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE = path.join(os.tmpdir(), "hasio-web-booking-fixture.json");
const ORIGIN = "https://www.hasio.xyz"; // a trusted origin, as the other smoke scripts send

function readEnv(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^﻿/, "").trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const [k, ...rest] = line.split("=");
    out[k.trim()] = rest.join("=").split(" #")[0].trim();
  }
  return out;
}
const env = readEnv(".env.local");
const URL = env.VITE_CONVEX_URL;
const SITE = env.VITE_CONVEX_SITE_URL;
if (!env.CONVEX_DEPLOYMENT?.startsWith("dev:") || !URL || /hearty-ram-74/.test(URL)) {
  console.error("Refusing to run: .env.local must point at a development deployment.");
  process.exit(2);
}

// The CLI through its own entry file with node: on Windows npx is a .cmd shim,
// and a shell would re-quote the JSON arguments.
const CLI = path.join("node_modules", "convex", "bin", "main.js");
const run = (fn, args = {}) =>
  execFileSync(process.execPath, [CLI, "run", fn, JSON.stringify(args)], { encoding: "utf8" }).trim();

async function authPost(p, body) {
  const res = await fetch(`${SITE}/api/auth${p}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${p} ${res.status} ${text}`);
  return JSON.parse(text);
}
async function client(sessionToken) {
  const res = await fetch(`${SITE}/api/auth/convex/token`, {
    headers: { Authorization: `Bearer ${sessionToken}`, Origin: ORIGIN },
  });
  if (!res.ok) throw new Error(`convex/token ${res.status} ${await res.text()}`);
  const { token } = await res.json();
  const c = new ConvexHttpClient(URL);
  c.setAuth(token);
  return c;
}
async function phoneSession(phone) {
  await authPost("/phone-number/send-otp", { phoneNumber: phone });
  const d = await authPost("/phone-number/verify", { phoneNumber: phone, code: "123456" });
  return d.token ?? d.session?.token;
}
// Algerian mobiles: the partner sign-in takes them on the "Another country" tab.
const dz = () => `+2135${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

const loadState = () => JSON.parse(fs.readFileSync(STATE, "utf8"));
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

async function approvedPartner(admin, role, firstName, lastName) {
  const phone = dz();
  const session = await phoneSession(phone);
  const c = await client(session);
  await c.mutation(api.users.mutations.setUserRole, { role, firstName, lastName });
  const uploadUrl = await c.mutation(api.users.mutations.generateUploadUrl, {});
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const { storageId } = await (await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: png })).json();
  await c.mutation(api.users.mutations.saveBusinessDoc, { fileId: storageId });
  const me = await c.query(api.users.queries.getCurrentUser, {});
  await admin.mutation(api.users.mutations.approveBusinessAccount, { userId: me._id });
  return { phone, session, c };
}

async function create() {
  if (fs.existsSync(STATE)) throw new Error(`A fixture already exists (${STATE}); run cleanup first.`);
  const stamp = Date.now().toString(36);
  const adminEmail = `web-fixture-admin-${stamp}@example.com`;
  const adminSession = (await authPost("/sign-up/email", { email: adminEmail, password: `Fx-${stamp}-pw!`, name: "Fixture Admin" })).token;
  run("admin/devTools:grantAdmin", { email: adminEmail });
  const admin = await client(adminSession);

  const host = await approvedPartner(admin, "business_owner", "Faisal", "Al Mulhim");
  const hotelId = await host.c.mutation(api.listings.mutations.submitListing, {
    type: "hotel",
    name_en: "Web Test Courtyard Hotel",
    name_ar: "فندق الفناء التجريبي",
    category: "hotel",
    description_en: "A quiet courtyard hotel ten minutes from Al Qaisariah souq.",
    description_ar: "فندق هادئ حول فناء داخلي على بعد عشر دقائق من سوق القيصرية.",
    address: "King Abdullah Rd, Hofuf",
    city: "Al Ahsa",
    coordinates: { lat: 25.3833, lng: 49.5864 },
    phone: host.phone,
    amenities: ["wifi", "parking", "breakfast", "prayer_room"],
    images: ["https://hasio.net/places/stays.webp", "https://hasio.net/places/heritage.webp"],
    pricePerNight: 400,
    currency: "SAR",
    maxGuests: 3,
    unitCount: 2,
    checkInTime: "15:00",
    checkOutTime: "12:00",
  });
  await admin.mutation(api.admin.mutations.approveContent, { id: hotelId });

  const provider = await approvedPartner(admin, "service_provider", "Noura", "Al Qahtani");
  const serviceId = await provider.c.mutation(api.services.mutations.submitService, {
    serviceType: "tour_guide",
    title_en: "Web test oasis walk",
    title_ar: "جولة تجريبية في الواحة",
    description_en: "Three hours through the palm groves with a local guide.",
    description_ar: "ثلاث ساعات بين بساتين النخيل مع مرشد من أهل المنطقة.",
    price: 150,
    priceUnit: "per_hour",
    maxGroupSize: 6,
    city: "Al Ahsa",
    languages: ["ar", "en"],
    contactPhone: provider.phone,
  });
  await admin.mutation(api.admin.mutations.approveService, { id: serviceId });

  // An email account with no phone: it signs in on the site with "Sign in with
  // email" and meets the phone step.
  const travellerEmail = `web-traveller-${stamp}@example.com`;
  const travellerPassword = `Tr-${stamp}-pw!`;
  const traveller = (await authPost("/sign-up/email", { email: travellerEmail, password: travellerPassword, name: "Maha Al Harbi" })).token;

  const state = {
    adminSession,
    sessions: [traveller, host.session, provider.session],
    webPhones: [],
    hotelId,
    serviceId,
    hostSession: host.session,
    providerSession: provider.session,
    travellerEmail,
    travellerPassword,
  };
  saveState(state);
  console.log(JSON.stringify({ hotelId, serviceId, travellerEmail, travellerPassword, hostPhone: host.phone, providerPhone: provider.phone }, null, 2));
}

async function confirm(bookingId) {
  const state = loadState();
  // Whichever of the two owns it; the other is refused.
  for (const session of [state.hostSession, state.providerSession]) {
    try {
      const c = await client(session);
      await c.mutation(api.bookings.mutations.confirmBooking, { bookingId });
      console.log("confirmed");
      return;
    } catch (e) {
      if (!/Not authorized/.test(String(e?.data ?? e?.message))) throw e;
    }
  }
  throw new Error("neither the host nor the provider owns that booking");
}

function complete(date) {
  // The nightly job, run for a chosen Riyadh date (see services-e2e.mjs).
  console.log(run("bookings/lifecycle:completeFinishedStays", { today: date }));
}

function forgetPhone(phone) {
  const state = loadState();
  state.webPhones.push(phone);
  saveState(state);
  console.log(`will delete ${phone} on cleanup`);
}

async function cleanup() {
  const state = loadState();
  const sessions = [];
  for (const phone of state.webPhones) {
    try {
      sessions.push(await phoneSession(phone));
    } catch (e) {
      console.log(`could not sign in ${phone}: ${e.message}`);
    }
  }
  // Travellers first: a host's deletion would cancel their bookings anyway.
  for (const s of [...sessions, ...state.sessions, state.adminSession]) {
    try {
      const c = await client(s);
      await c.mutation(api.users.mutations.deleteMyAccount, {});
      console.log("deleted an account");
    } catch (e) {
      console.log(`could not delete: ${e?.data ?? e?.message}`);
    }
  }
  fs.rmSync(STATE);
}

const [mode, arg] = process.argv.slice(2);
if (mode === "create") await create();
else if (mode === "confirm") await confirm(arg);
else if (mode === "complete") complete(arg);
else if (mode === "forget-phone") forgetPhone(arg);
else if (mode === "cleanup") await cleanup();
else console.log("usage: node scripts/smoke/web-booking-fixture.mjs create | confirm <bookingId> | complete <YYYY-MM-DD> | forget-phone <+number> | cleanup");
