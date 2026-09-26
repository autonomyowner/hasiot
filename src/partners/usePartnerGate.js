import { createElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useCurrentUser } from '../hooks/useCurrentUser'
import { dashboardPath, partnerRoute } from './lib/gate'
import { PageSpinner } from './components/Ui'

/**
 * Keep each portal page for the partners it is for.
 *
 * `expected` is the route (or routes) this page serves. Anyone else is sent
 * where they belong — never shown an error: a hotel owner who opens the
 * provider dashboard lands on their own. A visitor with no session goes to
 * login with `?next=` so they come back here after the code.
 *
 * Plain .js with createElement, so fast refresh's one-component-per-file
 * rule has nothing to say about a hook module.
 *
 * Returns `{ route, user, guard }`; a page renders `guard` when it is set.
 */
/**
 * The portal route for whoever is here, shared by the gate, the layout and the
 * login page so they never disagree. The account-status query only runs in the
 * one case getCurrentUser cannot settle: a session with no user (new sign-up,
 * or a suspended account, which reads as null there).
 */
export function usePartnerRoute() {
  const { user, isLoading, isAuthenticated } = useCurrentUser()
  const needsStatus = !isLoading && isAuthenticated && user === null
  const accountStatus = useQuery(api.partners.queries.getAccountStatus, needsStatus ? {} : 'skip')
  const route = partnerRoute({ isLoading, isAuthenticated, user, accountStatus })
  return { route, user, isLoading, isAuthenticated, accountStatus }
}

export function usePartnerGate(expected) {
  const { route, user } = usePartnerRoute()
  const location = useLocation()
  const allowed = Array.isArray(expected) ? expected : [expected]

  let guard = null
  if (route === 'loading') {
    guard = createElement(PageSpinner)
  } else if (!allowed.includes(route)) {
    if (route === 'login') {
      const next = `${location.pathname}${location.search}`
      guard = createElement(Navigate, { to: `/partners?next=${encodeURIComponent(next)}`, replace: true })
    } else {
      guard = createElement(Navigate, { to: dashboardPath(route), replace: true })
    }
  }

  return { route, user, guard }
}

export default usePartnerGate
