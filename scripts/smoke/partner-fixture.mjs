// Development-only fixture for looking at the partner dashboards in a browser:
// an approved hotel partner with a priced hotel and a restaurant, an approved
// service provider with a priced service, and three travellers whose bookings
// cover pending / confirmed / declined. Run from the repo root:
//   node scripts/smoke/partner-fixture.mjs create   → prints the partners' phone numbers
//   node scripts/smoke/partner-fixture.mjs cleanup  → deletes every account it made
// Partners sign in at http://localhost:5173/partners → "Another country" → the
// printed +213 number → any six digits (development runs demo SMS).
// Refuses to run unless .env.local points at a dev: deployment.
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const STATE = path.join(os.tmpdir(), "hasio-partner-fixture.json");
const ORIGIN = "https://www.hasio.xyz";

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
if (!env.CONVEX_DEPLOYMENT?.startsWith("dev:") || /hearty-ram-74/.test(URL)) throw new Error("dev only");

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
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

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

async function traveller(firstName, lastName) {
  const phone = `+9665${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const session = await phoneSession(phone);
  const c = await client(session);
  await c.mutation(api.users.mutations.updateProfile, { firstName, lastName });
  return { phone, session, c };
}

async function create() {
  const stamp = Date.now().toString(36);
  const adminEmail = `partner-fixture-admin-${stamp}@example.com`;
  const adminSession = (await authPost("/sign-up/email", { email: adminEmail, password: `Fx-${stamp}-pw!`, name: "Fixture Admin" })).token;
  run("admin/devTools:grantAdmin", { email: adminEmail });
  const admin = await client(adminSession);

  // Hotel partner: a priced hotel with photos, and a restaurant.
  const host = await approvedPartner(admin, "business_owner", "Faisal", "Al Mulhim");
  const hotel = await host.c.mutation(api.listings.mutations.submitListing, {
    type: "hotel",
    name_en: "Palm Court Hotel",
    name_ar: "فندق ساحة النخيل",
    category: "hotel",
    description_en: "A quiet courtyard hotel ten minutes from Al Qaisariah souq.",
    description_ar: "فندق هادئ حول فناء داخلي على بعد عشر دقائق من سوق القيصرية.",
    address: "King Abdullah Rd, Hofuf",
    city: "Al Ahsa",
    coordinates: { lat: 25.3833, lng: 49.5864 },
    phone: host.phone,
    amenities: ["wifi", "parking", "breakfast"],
    images: ["https://hasio.net/places/stays.webp", "https://hasio.net/places/heritage.webp"],
    pricePerNight: 480,
    currency: "SAR",
    maxGuests: 3,
    unitCount: 12,
    checkInTime: "15:00",
    checkOutTime: "12:00",
  });
  const restaurant = await host.c.mutation(api.listings.mutations.submitListing, {
    type: "restaurant",
    name_en: "Oasis Table",
    name_ar: "مائدة الواحة",
    category: "restaurant",
    description_en: "Hasawi rice and dates, served in the garden.",
    description_ar: "رز حساوي وتمور تُقدَّم في الحديقة.",
    address: "Al Mubarraz",
    city: "Al Ahsa",
    coordinates: { lat: 25.41, lng: 49.58 },
    images: ["https://hasio.net/places/flavours.webp"],
  });
  await admin.mutation(api.admin.mutations.approveContent, { id: hotel });
  await admin.mutation(api.admin.mutations.approveContent, { id: restaurant });

  // Service provider with one priced service.
  const provider = await approvedPartner(admin, "service_provider", "Noura", "Al Qahtani");
  const service = await provider.c.mutation(api.services.mutations.submitService, {
    serviceType: "tour_guide",
    title_en: "Al Ahsa oasis walk",
    title_ar: "جولة في واحة الأحساء",
    description_en: "Three hours through the palm groves and Al Qarah, with a local guide.",
    description_ar: "ثلاث ساعات بين بساتين النخيل وجبل القارة مع مرشد من أهل المنطقة.",
    price: 150,
    priceUnit: "per_hour",
    maxGroupSize: 8,
    city: "Al Ahsa",
    languages: ["ar", "en"],
    contactPhone: provider.phone,
  });
  await admin.mutation(api.admin.mutations.approveService, { id: service });

  // Travellers and their bookings.
  const sara = await traveller("Sara", "Al Dossari");
  const omar = await traveller("Omar", "Haddad");
  const lina = await traveller("Lina", "Farouk");
  const b1 = await sara.c.mutation(api.bookings.mutations.createStayBooking, { listingId: hotel, checkIn: day(10), checkOut: day(13), guests: 2, notes: "Late arrival, around 11 pm." });
  const b2 = await omar.c.mutation(api.bookings.mutations.createStayBooking, { listingId: hotel, checkIn: day(20), checkOut: day(22), guests: 1 });
  const b3 = await lina.c.mutation(api.bookings.mutations.createStayBooking, { listingId: hotel, checkIn: day(5), checkOut: day(6), guests: 2 });
  await host.c.mutation(api.bookings.mutations.confirmBooking, { bookingId: b2.bookingId });
  await host.c.mutation(api.bookings.mutations.declineBooking, { bookingId: b3.bookingId, reason: "Fully booked that night." });
  const s1 = await sara.c.mutation(api.bookings.mutations.createServiceBooking, { serviceId: service, date: day(11), time: "16:00", quantity: 3, partySize: 2 });
  const s2 = await omar.c.mutation(api.bookings.mutations.createServiceBooking, { serviceId: service, date: day(21), time: "09:00", quantity: 2, partySize: 1 });
  await provider.c.mutation(api.bookings.mutations.confirmBooking, { bookingId: s2.bookingId });

  const state = {
    adminSession,
    sessions: [host.session, provider.session, sara.session, omar.session, lina.session],
    hostPhone: host.phone,
    providerPhone: provider.phone,
  };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ hostPhone: host.phone, providerPhone: provider.phone, bookings: [b1, s1].map((b) => b.bookingId) }, null, 2));
}

async function cleanup() {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  // Travellers first: a host cannot be deleted while a booking is open.
  for (const s of [...state.sessions].reverse().concat(state.adminSession)) {
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

const mode = process.argv[2];
if (mode === "create") await create();
else if (mode === "cleanup") await cleanup();
else console.log("usage: node scripts/smoke/partner-fixture.mjs create | cleanup");
