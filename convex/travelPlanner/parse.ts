/**
 * Turning a model reply into something the app can render.
 *
 * Kept free of Convex imports so it can be unit-tested directly — the failure
 * this module exists to prevent is not reproducible through the action without
 * spending money at OpenRouter.
 */

export const DESTINATION_TYPES = ["hotel", "restaurant", "attraction", "event", "tour"];

export interface PlanDestination {
  name: string;
  name_ar?: string;
  type: string;
  description?: string;
}

/**
 * Pull one JSON object out of a model reply by matching braces.
 *
 * The model is asked for bare JSON and usually obliges, but it sometimes wraps
 * the object in a ```json fence or sets a sentence beside it, so the object has
 * to be found rather than assumed.
 *
 * Scanning for the *balanced* closing brace is the part that matters. The old
 * greedy /\{[\s\S]*\}/ ran from the first "{" to the LAST "}" in the string,
 * which in a reply cut off mid-plan is the brace closing the last destination —
 * it discarded two thirds of the text (measured against a real truncated reply:
 * 3,328 of 5,062 characters) and then failed to parse the fragment it had kept.
 * Tracking string state matters for the same reason: a "}" written inside an
 * itinerary must not end the scan.
 *
 * Returns null when there is no object, or when the object was never closed —
 * which is precisely the signal that the reply was truncated.
 */
export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      escaped = false;
      continue;
    }
    if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          // The slice starts at "{" and closes balanced, so this is an object
          // or it throws — there is no third outcome to guard against.
          return JSON.parse(raw.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

/**
 * `storePlan` validates `name` and `type` as required strings, so a single
 * malformed destination used to throw inside the mutation, unwind the whole
 * action and lose a plan the model had already finished writing. Coerce here
 * instead: drop the unusable entries and keep the rest.
 */
export function normaliseDestinations(value: unknown): PlanDestination[] {
  if (!Array.isArray(value)) return [];

  const cleaned: PlanDestination[] = [];
  for (const entry of value) {
    // The model occasionally emits a bare string instead of an object.
    if (typeof entry === "string") {
      if (entry.trim()) cleaned.push({ name: entry.trim(), type: "attraction" });
      continue;
    }
    if (!entry || typeof entry !== "object") continue;

    const dest = entry as Record<string, unknown>;
    const name = typeof dest.name === "string" ? dest.name.trim() : "";
    if (!name) continue;

    const type = typeof dest.type === "string" ? dest.type.trim().toLowerCase() : "";
    cleaned.push({
      name,
      name_ar: typeof dest.name_ar === "string" ? dest.name_ar : undefined,
      type: DESTINATION_TYPES.includes(type) ? type : "attraction",
      description: typeof dest.description === "string" ? dest.description : undefined,
    });
  }
  return cleaned;
}

export const asText = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

export interface PlannerListing {
  name_en: string;
  name_ar: string;
  type: string;
  city: string;
  address: string;
  priceRange?: string;
  pricePerNight?: number;
  rating?: number;
}

export interface PlannerNote {
  category: string;
  title: string;
  content: string;
}

/**
 * Renders the real catalogue and the team's notes into the system prompt.
 *
 * Kept to one line per listing on purpose: the model needs a name it can copy,
 * a city, and enough of a price signal to choose between two hotels. Anything
 * more is prompt weight paid on every single message of every conversation.
 */
export function buildContextBlock(
  listings: PlannerListing[],
  knowledge: PlannerNote[]
): string {
  const sections: string[] = [];

  if (listings.length > 0) {
    const lines = listings.map((listing) => {
      const bits = [
        `[${listing.type}] ${listing.name_en} (${listing.name_ar}) — ${listing.city}`,
      ];
      if (listing.pricePerNight) bits.push(`${listing.pricePerNight} SAR/night`);
      else if (listing.priceRange) bits.push(listing.priceRange);
      if (listing.rating) bits.push(`${listing.rating}/5`);
      return `- ${bits.join(" — ")}`;
    });
    sections.push(
      `## THE APP'S OWN LISTINGS (${listings.length})\n` +
        `These are the only places Hasio has a page for. Prefer them, and copy the English name exactly into "name".\n` +
        lines.join("\n")
    );
  } else {
    // Worth stating outright: with no catalogue the model would otherwise carry
    // on implying that every place it knows is bookable in the app.
    sections.push(
      `## THE APP'S OWN LISTINGS\n` +
        `None are published right now. Recommend places by name, and do not imply the app can open or book any of them.`
    );
  }

  if (knowledge.length > 0) {
    const notes = knowledge.map((note) => `### ${note.title} [${note.category}]\n${note.content}`);
    sections.push(
      `## NOTES FROM THE HASIO TEAM\n` +
        `These are curated and beat the general knowledge above wherever they disagree.\n` +
        notes.join("\n\n")
    );
  }

  return sections.join("\n\n");
}
