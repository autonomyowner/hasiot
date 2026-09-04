/**
 * Admin user search.
 *
 * Convex has no prefix or substring scan on a normal index — you get equality
 * and ranges. So "find the guest who called about booking HSO-7K3M2, all I have
 * is the last four digits of their number" needs a search index, and a search
 * index covers exactly one field. Hence a denormalised blob that every write to
 * a user row keeps current.
 */

export function buildSearchTextFrom(user: {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): string {
  return [user.email, user.phone, user.firstName, user.lastName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .toLowerCase();
}
