import { formatPhone } from '../../partners/lib/phone'

/**
 * Who is booking, as the checkout shows and saves it.
 *
 * A phone sign-up has no name and a made-up address (`<digits>@phone.hasio.xyz`,
 * convex/lib/contact.ts) that must never be shown to anyone: it is an
 * identifier, not a mailbox. A host must know who is arriving at the door, so
 * the checkout asks for a name when there is none (design W6).
 */

export const NAME_MAX = 60

const PLACEHOLDER_EMAIL = /@phone\.hasio\.xyz$/i

export function isPlaceholderEmail(email) {
  return typeof email === 'string' && PLACEHOLDER_EMAIL.test(email.trim())
}

export function displayName(user) {
  return [user?.firstName, user?.lastName]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ')
}

/** "Signed in as …": the name, else the phone, else a real email; null when none. */
export function accountLabel(user) {
  if (!user) return null
  const name = displayName(user)
  if (name) return { kind: 'name', text: name }
  if (user.phone) return { kind: 'phone', text: formatPhone(user.phone) }
  if (user.email && !isPlaceholderEmail(user.email)) return { kind: 'email', text: user.email.trim() }
  return null
}

export function needsName(user) {
  return !(typeof user?.firstName === 'string' && user.firstName.trim())
}

/**
 * One "Your name" field into the account's two: the first word is the first
 * name, the rest (if any) the last name. Null when it is empty or longer than
 * the field allows, so the form can say so.
 */
export function splitName(input) {
  const name = String(input ?? '').replace(/\s+/g, ' ').trim()
  if (!name || name.length > NAME_MAX) return null
  const space = name.indexOf(' ')
  if (space === -1) return { firstName: name }
  return { firstName: name.slice(0, space), lastName: name.slice(space + 1) }
}
