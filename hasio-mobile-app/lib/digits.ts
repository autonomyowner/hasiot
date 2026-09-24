/**
 * Digits as `Number()` and a `\d` regex understand them.
 *
 * An Arabic keyboard's number pad types Arabic-Indic digits (٠١٢…), which look
 * like numbers to the person typing and are nothing of the kind to JavaScript:
 * `Number("٤٥٠")` is NaN and `/\d/` does not match "٤". So a nightly price, a
 * guest count or a phone number typed the natural way in Arabic was rejected
 * as invalid, and a one-time code typed digit by digit simply did not appear —
 * the field strips non-digits as you type. Anything numeric the user types
 * goes through this first.
 *
 * Covers the Arabic-Indic digits, the Persian forms some keyboards emit, and
 * the Arabic decimal (٫) and thousands (٬) separators. Everything else passes
 * through untouched.
 */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, "");
}
