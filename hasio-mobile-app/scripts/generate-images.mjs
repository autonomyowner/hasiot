/**
 * Generates brand imagery via OpenAI gpt-image-1 and compresses to WebP.
 * Usage: OPENAI_API_KEY=sk-... node scripts/generate-images.mjs [name ...]
 * Output: assets/images/generated/*.webp (target <= 100KB each)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "assets", "images", "generated");
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const STYLE =
  "Warm natural golden-hour light, earthy sand and deep green palette, photorealistic, no people close-up, no text, no watermark.";
const FLAT_STYLE =
  "Minimal flat vector illustration, warm sand (#E8DFD4) and deep green (#0D7A5F) palette on a soft cream background (#FAF7F2), simple shapes, generous negative space, no text.";

const IMAGES = [
  {
    name: "cat-lodging",
    size: "1024x1024",
    width: 800,
    prompt: `Traditional Saudi mud-brick heritage hotel courtyard nestled in a lush Al-Ahsa oasis palm grove, carved wooden doors, warm lanterns. ${STYLE}`,
  },
  {
    name: "cat-food",
    size: "1024x1024",
    width: 800,
    prompt: `Traditional Saudi feast on a brass tray: kabsa rice platter, fresh khalas dates, golden Arabic coffee dallah pot and small cups, rustic wooden table. ${STYLE}`,
  },
  {
    name: "cat-events",
    size: "1024x1024",
    width: 800,
    prompt: `Festive traditional Arabian souq at dusk in Al-Ahsa, glowing lanterns strung above market stalls, date festival atmosphere, warm bokeh crowd in distance. ${STYLE}`,
  },
  {
    name: "hero-oasis",
    size: "1536x1024",
    width: 1000,
    prompt: `Breathtaking aerial view of the Al-Ahsa oasis in Saudi Arabia at golden hour: a vast sea of green date palm groves meeting desert sand dunes, natural springs reflecting sunlight. ${STYLE}`,
  },
  {
    name: "hero-desert",
    size: "1536x1024",
    width: 1000,
    prompt: `Jabal Al-Qarah limestone cave mountain in Al-Ahsa Saudi Arabia at sunset, dramatic eroded rock formations, palm trees at the base, warm orange and sand tones. ${STYLE}`,
  },
  {
    name: "empty-moments",
    size: "1024x1024",
    width: 600,
    prompt: `A vintage camera resting beside a single palm frond and two dates. ${FLAT_STYLE}`,
  },
  {
    name: "empty-search",
    size: "1024x1024",
    width: 600,
    prompt: `A magnifying glass hovering over gentle desert sand dunes with a tiny palm tree. ${FLAT_STYLE}`,
  },
];

async function generate(img) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: img.prompt,
      size: img.size,
      quality: "medium",
      n: 1,
    }),
  });
  if (!res.ok) {
    throw new Error(`${img.name}: HTTP ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${img.name}: no b64_json in response`);
  return Buffer.from(b64, "base64");
}

async function compress(buf, img) {
  for (const quality of [80, 70, 58]) {
    const out = await sharp(buf)
      .resize({ width: img.width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    if (out.length <= 100 * 1024) return { out, quality };
  }
  const out = await sharp(buf)
    .resize({ width: Math.round(img.width * 0.8) })
    .webp({ quality: 55 })
    .toBuffer();
  return { out, quality: 55 };
}

const only = process.argv.slice(2);
fs.mkdirSync(OUT_DIR, { recursive: true });

let failed = 0;
for (const img of IMAGES) {
  if (only.length && !only.includes(img.name)) continue;
  const dest = path.join(OUT_DIR, `${img.name}.webp`);
  try {
    console.log(`Generating ${img.name} (${img.size})...`);
    const raw = await generate(img);
    const { out, quality } = await compress(raw, img);
    fs.writeFileSync(dest, out);
    console.log(
      `  -> ${img.name}.webp ${(out.length / 1024).toFixed(1)}KB (q${quality})`
    );
  } catch (err) {
    failed++;
    console.error(`  FAILED ${img.name}:`, err.message);
  }
}
process.exit(failed ? 1 : 0);
