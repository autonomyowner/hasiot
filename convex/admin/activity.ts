import type { MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

/**
 * Append one row to the admin action log.
 *
 * `requireAdmin(ctx)` already returns the admin's user document, so every call
 * site has the actor to hand — pass it in rather than resolving the identity a
 * second time. The email is denormalised so the log still reads correctly after
 * an admin account is renamed or deleted.
 *
 * Logging must never be the reason an action fails: the write is awaited (it is
 * in the same transaction as the action itself, so it commits or rolls back with
 * it) but nothing here throws on its own.
 */
export async function logAdminAction(
  ctx: MutationCtx,
  admin: Doc<"users">,
  entry: {
    action: string;
    targetType: string;
    targetId?: string;
    summary?: string;
    details?: string;
  }
) {
  await ctx.db.insert("adminActivity", {
    adminId: admin._id,
    adminEmail: admin.email,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    // Keep the log rows small; these are labels, not copies of the document.
    summary: entry.summary ? entry.summary.slice(0, 200) : undefined,
    details: entry.details ? entry.details.slice(0, 500) : undefined,
    createdAt: Date.now(),
  });
}

/** Best-effort display name for a listing/service/user in the log. */
export function labelFor(
  doc:
    | { name_ar?: string; name_en?: string }
    | { title_ar?: string; title_en?: string }
    | { firstName?: string; lastName?: string; email?: string }
    | null
): string | undefined {
  if (!doc) return undefined;
  const d = doc as Record<string, string | undefined>;
  return (
    d.name_ar ||
    d.name_en ||
    d.title_ar ||
    d.title_en ||
    [d.firstName, d.lastName].filter(Boolean).join(" ").trim() ||
    d.email ||
    undefined
  );
}
