#!/usr/bin/env node
/**
 * Creates or updates the Hasio website voice agent on ElevenLabs.
 *
 *   node scripts/elevenlabs-agent.mjs          # create or update
 *   node scripts/elevenlabs-agent.mjs --show   # print current remote config
 *
 * Source of truth is docs/voice-agent/*.md, not the ElevenLabs dashboard — edit the
 * markdown and re-run this. Dashboard edits are overwritten on the next run.
 *
 * Reads ELEVENLABS_API_KEY from .env.local. That key is server-side only and must never
 * reach the browser; the site authenticates with the public agent id alone.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_PATH = resolve(root, ".env.local");
const PROMPT_PATH = resolve(root, "docs/voice-agent/system-prompt.md");
const KB_PATH = resolve(root, "docs/voice-agent/knowledge-base.md");

const AGENT_NAME = "أبشر — Hasio";
const VOICE_ID = "gVzwmdZzRgBrNjXaTmi5"; // Layan — Saudi female, professional. Male alt: UXEyt6rtmFO9w5hBhzq9 (Ahmad)
const FIRST_MESSAGE =
  "أهلاً، أنا أبشر من Hasio. Hi, I'm Absher from Hasio — ask me anything about Al-Ahsa, the app, or where we're taking this.";

const API = "https://api.elevenlabs.io/v1";

/* ---------- env ---------- */

function readEnv() {
  if (!existsSync(ENV_PATH)) fail(`.env.local not found at ${ENV_PATH}`);
  const env = {};
  for (const line of readFileSync(ENV_PATH, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  if (!env.ELEVENLABS_API_KEY) fail("ELEVENLABS_API_KEY missing from .env.local");
  return env;
}

function writeAgentId(id) {
  const src = readFileSync(ENV_PATH, "utf8");
  const next = src.match(/^VITE_ELEVENLABS_AGENT_ID=.*$/m)
    ? src.replace(/^VITE_ELEVENLABS_AGENT_ID=.*$/m, `VITE_ELEVENLABS_AGENT_ID=${id}`)
    : `${src.trimEnd()}\nVITE_ELEVENLABS_AGENT_ID=${id}\n`;
  writeFileSync(ENV_PATH, next);
}

function fail(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

/* ---------- prompt ---------- */

/** Everything after the first `---` fence is the agent prompt; above it is our notes. */
function readPrompt() {
  const raw = readFileSync(PROMPT_PATH, "utf8");
  const i = raw.indexOf("\n---\n");
  if (i === -1) fail("No `---` separator found in system-prompt.md");
  return raw.slice(i + 5).trim();
}

/* ---------- api ---------- */

async function call(key, path, { method = "GET", body, raw } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "xi-api-key": key, ...(raw ? {} : { "Content-Type": "application/json" }) },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  if (!res.ok) fail(`${method} ${path} → ${res.status}\n  ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

async function findAgent(key) {
  const list = await call(key, "/convai/agents?page_size=100");
  return (list.agents ?? []).find((a) => a.name === AGENT_NAME) ?? null;
}

/** Upload the knowledge base as a document, replacing any previous copy. */
async function syncKnowledgeBase(key) {
  const docName = "hasio-knowledge-base";
  const existing = await call(key, "/convai/knowledge-base?page_size=100");
  for (const doc of existing.documents ?? []) {
    if (doc.name === docName) {
      await call(key, `/convai/knowledge-base/${doc.id}`, { method: "DELETE" }).catch(() => {});
    }
  }

  const form = new FormData();
  form.append("name", docName);
  form.append(
    "file",
    new Blob([readFileSync(KB_PATH)], { type: "text/markdown" }),
    "knowledge-base.md",
  );
  const doc = await call(key, "/convai/knowledge-base/file", { method: "POST", raw: form });
  return doc.id;
}

function buildConfig(prompt, kbId) {
  return {
    name: AGENT_NAME,
    conversation_config: {
      agent: {
        prompt: {
          prompt,
          llm: "gemini-2.0-flash",
          temperature: 0.4,
          knowledge_base: kbId
            ? [{ type: "file", id: kbId, name: "hasio-knowledge-base", usage_mode: "auto" }]
            : [],
        },
        first_message: FIRST_MESSAGE,
        language: "ar",
      },
      tts: {
        voice_id: VOICE_ID,
        model_id: "eleven_flash_v2_5",
        stability: 0.4,
        similarity_boost: 0.75,
        speed: 1.0,
      },
      asr: { quality: "high" },
      turn: { turn_timeout: 8, mode: "turn" },
      conversation: { max_duration_seconds: 600, text_only: false },
      language_presets: {
        en: { overrides: { agent: { language: "en", first_message: FIRST_MESSAGE } } },
      },
    },
    platform_settings: {
      widget: { variant: "full", avatar: { type: "orb" } },
    },
  };
}

/* ---------- main ---------- */

const env = readEnv();
const key = env.ELEVENLABS_API_KEY;

if (process.argv.includes("--show")) {
  const found = await findAgent(key);
  if (!found) fail("No agent found. Run without --show to create it.");
  const full = await call(key, `/convai/agents/${found.agent_id}`);
  console.log(JSON.stringify(full, null, 2));
  process.exit(0);
}

console.log("  Uploading knowledge base…");
const kbId = await syncKnowledgeBase(key);
console.log(`  Knowledge base:   ${kbId}`);

const prompt = readPrompt();
console.log(`  Prompt:           ${prompt.length} chars`);

const config = buildConfig(prompt, kbId);
const existing = await findAgent(key);

let agentId;
if (existing) {
  agentId = existing.agent_id;
  await call(key, `/convai/agents/${agentId}`, { method: "PATCH", body: config });
  console.log(`  Updated agent:    ${agentId}`);
} else {
  const created = await call(key, "/convai/agents/create", { method: "POST", body: config });
  agentId = created.agent_id;
  console.log(`  Created agent:    ${agentId}`);
}

writeAgentId(agentId);
console.log(`\n  VITE_ELEVENLABS_AGENT_ID=${agentId}  → written to .env.local`);
console.log("  Add the same variable in Vercel before deploying.\n");
