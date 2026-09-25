// Development-only fixture for browser checks: a provider with an approved,
// priced service (and a second, unpriced one) that stay in place until
// `cleanup`. Run from the repo root:
//   node scripts/smoke/dev-fixture.mjs create   → writes %TEMP%/hasio-dev-fixture.json
//   node scripts/smoke/dev-fixture.mjs cleanup  → deletes the accounts it made
// Refuses to run unless .env.local points at a dev: deployment.
import { ConvexHttpClient } from "convex/browser";
import { anyApi as api } from "convex/server";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Holds development session tokens, so it lives outside the repository.
const STATE = path.join(os.tmpdir(), "hasio-dev-fixture.json");
const ORIGIN = "https://www.hasio.xyz";

function readEnv(file) {
  const out = {};
  for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.replace(/^\uFEFF/, "").trim();
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
const mobile = () => `+96650${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

async function create() {
  const stamp = Date.now().toString(36);
  const adminEmail = `fixture-admin-${stamp}@example.com`;
  const adminSession = (await authPost("/sign-up/email", { email: adminEmail, password: `Fx-${stamp}-pw!`, name: "Fixture Admin" })).token;
  run("admin/devTools:grantAdmin", { email: adminEmail });
  const admin = await client(adminSession);

  const providerPhone = mobile();
  const providerSession = await phoneSession(providerPhone);
  const provider = await client(providerSession);
  await provider.mutation(api.users.mutations.setUserRole, { role: "service_provider", firstName: "Noura", lastName: "Guide" });
  const uploadUrl = await provider.mutation(api.users.mutations.generateUploadUrl, {});
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const { storageId } = await (await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/png" }, body: png })).json();
  await provider.mutation(api.users.mutations.saveBusinessDoc, { fileId: storageId });
  const me = await provider.query(api.users.queries.getCurrentUser, {});
  await admin.mutation(api.users.mutations.approveBusinessAccount, { userId: me._id });

  const priced = await provider.mutation(api.services.mutations.submitService, {
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
    contactPhone: providerPhone,
  });
  const unpriced = await provider.mutation(api.services.mutations.submitService, {
    serviceType: "photographer",
    title_en: "Corniche photo session",
    title_ar: "جلسة تصوير على الكورنيش",
    description_en: "Golden-hour photos along the Khobar waterfront.",
    description_ar: "صور وقت الغروب على واجهة الخبر البحرية.",
    priceUnit: "fixed",
    city: "Al Khobar",
    contactPhone: providerPhone,
  });
  await admin.mutation(api.admin.mutations.approveService, { id: priced });
  await admin.mutation(api.admin.mutations.approveService, { id: unpriced });

  const state = { stamp, adminEmail, adminSession, providerSession, providerPhone, priced, unpriced };
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ adminEmail, providerPhone, priced, unpriced }, null, 2));
}

async function cleanup() {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  for (const key of ["providerSession", "adminSession"]) {
    try {
      const c = await client(state[key]);
      await c.mutation(api.users.mutations.deleteMyAccount, {});
      console.log(`deleted ${key}`);
    } catch (e) {
      console.log(`could not delete ${key}: ${e?.data ?? e?.message}`);
    }
  }
  fs.rmSync(STATE);
}

const mode = process.argv[2];
if (mode === "create") await create();
else if (mode === "cleanup") await cleanup();
else console.log("usage: node dev-fixture.mjs create|cleanup");
