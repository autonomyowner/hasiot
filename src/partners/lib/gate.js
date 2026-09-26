/**
 * Where a partner belongs, from their session and users row alone.
 *
 * Pure so it is tested once and every page agrees. The server re-checks every
 * call; this only decides what to show.
 *
 * Approval wins over the document: an admin can approve an account directly,
 * and `accountRejectionReason` is cleared by a new upload (saveBusinessDocForUser),
 * so "rejected" only ever means the current document was turned down.
 */
export function partnerRoute({ isLoading, isAuthenticated, user, accountStatus }) {
  if (isLoading) return 'loading'
  if (!isAuthenticated) return 'login'
  // Signed in but the users query has not answered yet.
  if (user === undefined) return 'loading'
  // Signed in with no user: a suspended account reads exactly like a brand-new
  // one here (getAuthenticatedAppUser returns null for both), so ask which.
  if (!user) {
    if (accountStatus === undefined) return 'loading'
    if (accountStatus?.status === 'suspended') return 'suspended'
    return 'join'
  }

  const role = user.role
  if (role === 'admin') return 'admin'
  if (role === 'business_owner' || role === 'service_provider') {
    if (!user.isApproved) return 'verify'
    return role === 'business_owner' ? 'hotel' : 'services'
  }
  return 'join'
}

const PATHS = {
  login: '/partners',
  join: '/partners/join',
  verify: '/partners/verify',
  suspended: '/partners/suspended',
  hotel: '/partners/hotel',
  services: '/partners/services',
  admin: '/admin',
}

export function dashboardPath(route) {
  return PATHS[route] ?? '/partners'
}

/** A `?next=` worth following: a relative path inside the portal, nothing else. */
export function safeNext(next) {
  if (typeof next !== 'string') return null
  if (!next.startsWith('/partners')) return null
  if (next.startsWith('//') || next.includes('\\')) return null
  return next
}
