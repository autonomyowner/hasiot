/**
 * Phone-first sign-up gives Better Auth a problem: its user model requires an
 * email, but a guest who signed in with a phone number never gave one. The
 * plugin fills the gap with a synthesised address on a domain that does not
 * accept mail.
 *
 * Everything that sends email must check `isPlaceholderEmail` first. These
 * addresses are not deliverable, and sending to them would burn the sending
 * domain's reputation on guaranteed bounces.
 */

export const PHONE_EMAIL_DOMAIN = "phone.hasio.xyz";

/** "+966501234567" -> "966501234567@phone.hasio.xyz" */
export function tempEmailForPhone(phone: string): string {
  return `${phone.replace(/^\+/, "")}@${PHONE_EMAIL_DOMAIN}`;
}

export function isPlaceholderEmail(email?: string | null): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith(`@${PHONE_EMAIL_DOMAIN}`);
}
