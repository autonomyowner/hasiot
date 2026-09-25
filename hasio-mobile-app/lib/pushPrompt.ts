/**
 * Ask for push permission at a moment the person can see why.
 *
 * Placeholder with the final signature, so the booking flows can call it while
 * the push work lands in parallel (plan: Task M3 replaces this body). Calling
 * it before then does nothing, which is also the correct behaviour on web and
 * whenever permission is already settled.
 *
 * `"guest"` after a traveller sends a booking request; `"host"` when a host or
 * provider opens their inbox or dashboard (design D14).
 */
export function maybeAskForPush(_context: "guest" | "host"): void {
  // Intentionally empty until the push prompt exists.
}
