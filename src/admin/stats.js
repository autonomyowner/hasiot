import { api } from '../../convex/_generated/api'
import { useQuerySafe } from './useQuerySafe'

/**
 * The dashboard's numbers, subscribed once for the whole panel.
 *
 * The header's badges and the dashboard tab both read them. They used to call
 * `useQuery` separately, and the header's copy sat outside every error
 * boundary: when it failed (an expired session hitting requireAdmin, a backend
 * not yet deployed) the throw reached the root boundary and the whole panel
 * was replaced by the site's English error page. The shell now subscribes
 * here, without throwing, and hands `{ stats, error }` to both.
 */
export function useDashboardStats() {
  const { data, error } = useQuerySafe(api.admin.queries.getDashboardStats)
  return { stats: data, error }
}

/**
 * Every piece of waiting work, each in exactly one queue.
 *
 * Read from `stats.queues` (1.1.0). The old fields overlap — pendingBookings
 * includes the stays in awaitingOwner, and pendingBusinesses includes accounts
 * still waiting on their owner's document — which is how the dashboard came to
 * list pending stays twice and add them up twice. The fallback rebuilds the
 * queues from those fields without the overlap, for a panel that loads before
 * its backend has been deployed.
 */
export function queuesOf(stats) {
  if (!stats) return null
  if (stats.queues) return stats.queues
  const stayRequests = stats.awaitingOwner ?? 0
  return {
    content: stats.pendingContent ?? 0,
    services: stats.pendingServices ?? 0,
    accounts: stats.pendingBusinesses ?? 0,
    reports: stats.pendingReports ?? 0,
    stayRequests,
    serviceRequests: 0,
    slotBookings: Math.max((stats.pendingBookings ?? 0) - stayRequests, 0),
  }
}

/** The pending bookings of every kind: the bookings tab's badge. */
export const pendingBookingsOf = (queues) =>
  queues ? queues.stayRequests + queues.serviceRequests + queues.slotBookings : 0

/** All the waiting work, counted once. */
export function queueTotalOf(stats) {
  const queues = queuesOf(stats)
  if (!queues) return 0
  return stats.queueTotal ?? Object.values(queues).reduce((sum, n) => sum + n, 0)
}
