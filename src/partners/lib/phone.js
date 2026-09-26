/**
 * Phone numbers as partners type them — a port of the app's rules
 * (hasio-mobile-app/lib/phone.ts and lib/digits.ts). Both clients must agree:
 * the same person signs in on either, and the server accepts E.164 only
 * (phoneNumberValidator in convex/auth.ts).
 */

/**
 * An Arabic keyboard types ٠١٢…, which `Number()` and `\d` do not understand.
 * Folds those, the Persian forms, and the Arabic decimal/thousands separators.
 */
export function toLatinDigits(input) {
  return String(input ?? '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, '.')
    .replace(/٬/g, '')
}

const KSA_MOBILE = /^5\d{8}$/
const E164 = /^\+[1-9]\d{7,14}$/

/**
 * E.164, or null when it is not a number an SMS can reach.
 * Accepts 0501234567, 501234567, 966501234567, 00966501234567,
 * "+966 50 123 4567", and passes a valid international number through.
 */
export function normalizePhone(input) {
  const raw = toLatinDigits(input).trim()
  if (!raw) return null

  const cleaned = raw.replace(/[\s()\-.]/g, '')
  const withPlus = cleaned.startsWith('00') ? `+${cleaned.slice(2)}` : cleaned

  if (withPlus.startsWith('+')) return E164.test(withPlus) ? withPlus : null

  const digits = withPlus.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('966')) {
    const local = digits.slice(3)
    return KSA_MOBILE.test(local) ? `+966${local}` : null
  }
  if (digits.startsWith('0')) {
    const local = digits.slice(1)
    return KSA_MOBILE.test(local) ? `+966${local}` : null
  }
  if (KSA_MOBILE.test(digits)) return `+966${digits}`
  return null
}

/** "+966501234567" -> "+966 50 123 4567". Display only. */
export function formatPhone(phone) {
  if (!phone) return ''
  const m = /^\+966(5\d)(\d{3})(\d{4})$/.exec(phone)
  return m ? `+966 ${m[1]} ${m[2]} ${m[3]}` : phone
}
