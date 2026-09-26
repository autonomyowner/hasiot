import { useConvexAuth, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

/**
 * Who is looking at a signed-in traveller page, as one of five states:
 * `loading`, `signed_out`, `suspended`, `no_account`, `active`.
 *
 * Read from the Convex client's own auth state rather than the Better Auth
 * session alone: right after a sign-in the session exists a moment before the
 * Convex client has its token, and in that moment every query answers as a
 * stranger — a page that trusted the session would flash "sign in" or bounce
 * to /login. `loading` holds until the client has settled either way.
 *
 * A signed-in person with no users row reads `null` from getCurrentUser for
 * two different reasons: a suspended account (getAuthenticatedAppUser hides
 * it) or a deleted one. getAccountStatus tells them apart, and is asked only
 * then. Only for pages under AuthedLayout.
 */
export function useViewer() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const user = useQuery(api.users.queries.getCurrentUser, isAuthenticated ? {} : 'skip')
  const needsStatus = isAuthenticated && user === null
  const account = useQuery(api.partners.queries.getAccountStatus, needsStatus ? {} : 'skip')
  const config = useQuery(api.config.queries.getPublicConfig, {})

  let state
  if (isLoading) state = 'loading'
  else if (!isAuthenticated) state = 'signed_out'
  else if (user === undefined) state = 'loading'
  else if (user) state = 'active'
  else if (account === undefined) state = 'loading'
  else if (account.status === 'suspended') state = 'suspended'
  else if (account.status === 'signed_out') state = 'signed_out'
  else state = 'no_account'

  return { state, user: user ?? null, config }
}

export default useViewer
