/**
 * Saudi phone numbers, in the shapes people actually type them.
 *
 * A guest asked for their number writes "0501234567" — that is what is printed
 * on their bank card and what they read out on the phone. The server only
 * accepts E.164, so the translation happens here rather than nagging them
 * about a format they have no reason to know.
 */

const KSA_MOBILE = /^5\d{8}$/;
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalise to E.164, or null if it is not a number we can send an SMS to.
 *
 * Accepts every common Saudi form:
 *   0501234567, 501234567, 966501234567, 00966501234567, +966 50 123 4567
 * and passes through a valid international number unchanged, so a visitor
 * with a Gulf number can still sign in.
 */
export function normalizeKsaPhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // Strip the separators people use for readability.
  const cleaned = raw.replace(/[\s()\-.]/g, "");

  // 00 is the international prefix used across the Gulf; + is its equivalent.
  const withPlus = cleaned.startsWith("00") ? `+${cleaned.slice(2)}` : cleaned;

  if (withPlus.startsWith("+")) {
    return E164.test(withPlus) ? withPlus : null;
  }

  const digits = withPlus.replace(/\D/g, "");
  if (!digits) return null;

  // 966501234567
  if (digits.startsWith("966")) {
    const local = digits.slice(3);
    return KSA_MOBILE.test(local) ? `+966${local}` : null;
  }

  // 0501234567 — the national trunk prefix is dropped in E.164.
  if (digits.startsWith("0")) {
    const local = digits.slice(1);
    return KSA_MOBILE.test(local) ? `+966${local}` : null;
  }

  // 501234567, which is what the input renders once a +966 prefix is shown.
  if (KSA_MOBILE.test(digits)) return `+966${digits}`;

  return null;
}

/** "+966501234567" -> "+966 50 123 4567". Grouped the way a Saudi number reads. */
export function formatPhoneForDisplay(phone?: string | null): string {
  if (!phone) return "";
  const match = /^\+966(5\d)(\d{3})(\d{4})$/.exec(phone);
  if (!match) return phone;
  return `+966 ${match[1]} ${match[2]} ${match[3]}`;
}

/**
 * Mirrors convex/lib/contact.ts. A phone sign-up has no real email, so the
 * profile screen shows their number instead of a synthesised address.
 */
export function isPlaceholderEmail(email?: string | null): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith("@phone.hasio.xyz");
}
