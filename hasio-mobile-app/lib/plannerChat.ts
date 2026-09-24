import type { ChatMessage, ChatPlan, PlanDestination } from "@/types";

/**
 * The planner chat's rules that are not about drawing it: what the AI is sent,
 * what the device keeps, and which of a plan's places the app can open.
 *
 * Pure and kept out of the screen so each can be tested on its own — every one
 * of them started life as a bug in the screen.
 */

/** A finished plan as plain text, in the order the card shows it. */
export function planText(plan: ChatPlan): string {
  return [plan.itinerary, plan.tips, plan.budget].filter(Boolean).join("\n\n");
}

/** What a message contributes to the conversation, as text. */
export function messageContent(message: ChatMessage): string {
  return message.plan ? planText(message.plan) : message.text;
}

export interface ModelTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * The conversation so far, in the shape the planner action takes.
 *
 * Failed turns are left out. The AI never saw them, so sending them would put a
 * question in its history that it never answered — two guest turns in a row,
 * the first one hanging. `excludeId` is the turn being sent now: it goes up on
 * its own as `userInput`, and must not also appear here.
 *
 * The history also opens on the guest's side. The stored chat is trimmed from
 * the front, so it can begin with a reply whose question has gone, and the
 * model's API expects a conversation to start with the user.
 */
export function historyForModel(
  messages: readonly ChatMessage[],
  excludeId?: string
): ModelTurn[] {
  const turns: ModelTurn[] = [];
  for (const message of messages) {
    if (message.failed || message.id === excludeId) continue;
    const content = messageContent(message).trim();
    if (!content) continue;
    if (turns.length === 0 && !message.isUser) continue;
    turns.push({ role: message.isUser ? "user" : "assistant", content });
  }
  return turns;
}

/** How many messages the device keeps across a restart. */
export const MAX_STORED_MESSAGES = 40;

/**
 * And how much text, whichever runs out first.
 *
 * The whole app store is one AsyncStorage row, rewritten on every change to any
 * part of it — a heart, a language switch. A finished plan can run to tens of
 * thousands of characters, so forty of them would make every favourite tap
 * serialise the best part of a megabyte, and on Android a row that large can
 * fail to read back at all — taking the language, the guest's favourites and
 * the onboarding flag down with it.
 */
export const MAX_STORED_CHARS = 120_000;

function storedSize(message: ChatMessage): number {
  const plan = message.plan;
  if (!plan) return message.text.length;
  const places = (plan.destinations ?? []).reduce(
    (sum, place) => sum + place.name.length + (place.nameAr?.length ?? 0),
    0
  );
  return message.text.length + planText(plan).length + (plan.disclaimer?.length ?? 0) + places;
}

/**
 * The newest messages that fit, for writing to the device.
 *
 * Trimmed from the front, and then past any reply at the front whose question
 * did not make the cut, so a restored chat never opens on an answer to nothing.
 */
export function messagesToStore(messages: readonly ChatMessage[]): ChatMessage[] {
  let start = messages.length;
  let chars = 0;
  while (start > 0 && messages.length - start < MAX_STORED_MESSAGES) {
    const size = storedSize(messages[start - 1]);
    if (chars + size > MAX_STORED_CHARS) break;
    chars += size;
    start -= 1;
  }
  while (start < messages.length && !messages[start].isUser) start += 1;
  return messages.slice(start);
}

/**
 * A chat read back after a restart, with a question left hanging marked failed.
 *
 * Nothing can be in flight across a restart, so a guest turn with no reply
 * after it was cut off — the app was closed while it waited. Left as it was, it
 * would read as still pending with nothing pending, offer no way to resend it,
 * and ride along in the history as a question the AI never answered.
 */
export function settleRestoredChat(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  const restored = messages.filter(isChatMessage);
  const last = restored[restored.length - 1];
  if (last && last.isUser && !last.failed) {
    return [...restored.slice(0, -1), { ...last, failed: true }];
  }
  return restored;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;
  const m = value as Partial<ChatMessage>;
  return (
    typeof m.id === "string" &&
    typeof m.text === "string" &&
    typeof m.isUser === "boolean" &&
    typeof m.timestamp === "string"
  );
}

/** The fields place matching needs, so tests do not have to build whole documents. */
export interface NamedListing {
  _id: string;
  name_en: string;
  name_ar: string;
}

/**
 * A place name reduced to what two spellings of it share.
 *
 * The planner is told to copy a listing's English name exactly, and mostly
 * does — but "Al-Qarah" comes back as "Al Qarah", and in Arabic the hamza
 * seats, the taa marbuta and the alif maqsura are written either way by people
 * and models alike. Both sides go through this, so all that matters is that it
 * folds those differences and nothing else.
 */
export function normalisePlaceName(name: string): string {
  return (
    name
      .toLowerCase()
      // Tashkeel and tatweel: vowel marks and the stretching stroke.
      .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u0640]/g, "")
      // Alef with madda, hamza above, hamza below, wasla: a bare alef.
      .replace(/[آأإٱ]/g, "ا")
      // Taa marbuta as haa, alif maqsura as yaa.
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      // Everything that is not a letter or a digit separates words.
      .replace(/[^0-9a-zÀ-ɏء-ي٠-٩ٮ-ۓ]+/g, " ")
      .trim()
  );
}

/** Every listing under each of its names, for `matchPlaces`. */
export function indexPlaces<L extends NamedListing>(listings: readonly L[]): Map<string, L> {
  const index = new Map<string, L>();
  for (const listing of listings) {
    for (const name of [listing.name_en, listing.name_ar]) {
      const key = normalisePlaceName(name ?? "");
      if (key && !index.has(key)) index.set(key, listing);
    }
  }
  return index;
}

/**
 * The listings behind a plan's places, in the plan's order, each once.
 *
 * Only exact matches. The planner may also name a famous place the app has no
 * listing for, and a looser match would open the wrong place's page for it —
 * "Hofuf" is not "Hofuf Souq". A place with no listing simply gets no chip.
 */
export function matchPlaces<L extends NamedListing>(
  destinations: readonly PlanDestination[] | undefined,
  index: ReadonlyMap<string, L>
): L[] {
  if (!destinations?.length || index.size === 0) return [];
  const seen = new Set<string>();
  const matched: L[] = [];
  for (const destination of destinations) {
    for (const name of [destination.name, destination.nameAr]) {
      if (!name) continue;
      const listing = index.get(normalisePlaceName(name));
      if (!listing) continue;
      if (!seen.has(listing._id)) {
        seen.add(listing._id);
        matched.push(listing);
      }
      break;
    }
  }
  return matched;
}
