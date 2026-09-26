/**
 * Arrow keys in a radio group, as a native radio set moves: down and the
 * arrow pointing forward step on, up and the one pointing back step back. In
 * a right-to-left page "forward" is left, so the arrow points where the
 * choice goes (the partner sign-in's onRadioKeys, as pure functions).
 */

/** +1, -1, or 0 for a key that does not move the choice. */
export function radioStep(key, rtl) {
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  const back = rtl ? 'ArrowRight' : 'ArrowLeft'
  if (key === forward || key === 'ArrowDown') return 1
  if (key === back || key === 'ArrowUp') return -1
  return 0
}

/** The value `step` places away from `current`, wrapping at either end. */
export function nextRadio(values, current, step) {
  const i = Math.max(0, values.indexOf(current))
  return values[(i + step + values.length) % values.length]
}
