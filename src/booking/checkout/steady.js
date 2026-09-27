/**
 * The viewer a sign-in page should draw, given what useViewer says now and
 * the last answer it gave that was not 'loading'.
 *
 * Better Auth refetches the session whenever the tab becomes visible again,
 * and while it does, a signed-out session reads as pending
 * (better-auth/client/query.mjs: `isPending: data === null`) — so
 * useConvexAuth, and useViewer with it, says 'loading' for a moment. A page
 * that swapped its form for a skeleton then would unmount it and lose the
 * number and the code step, exactly when a traveller comes back from reading
 * the SMS. So once the viewer has settled, a later 'loading' keeps showing
 * the last settled answer until the next one arrives (the partner sign-in
 * guards the same moment with its `started` flag).
 */

export function steadyOf(viewer, remembered) {
  return viewer.state === 'loading' && remembered.state !== 'loading' ? remembered : viewer
}

const same = (a, b) => a === b || JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Whether `viewer` is a settled answer the page has not remembered yet.
 * Compared by content, not identity: the hook stores it during render, and
 * an object rebuilt on every render must not make that store run forever.
 */
export function shouldRemember(viewer, remembered) {
  if (viewer.state === 'loading') return false
  return viewer.state !== remembered.state || !same(viewer.user, remembered.user) || !same(viewer.config, remembered.config)
}
