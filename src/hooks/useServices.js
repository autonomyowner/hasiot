import { useEffect, useState } from 'react'
import { convexQuery } from '../lib/convexHttp'

// Every public service (guides, drivers, photographers…) for /explore, each
// row marked `bookable` by the server. A plain fetch like useListings, for the
// same reason: a public query needs neither the Convex client nor a session,
// and /explore must not pull the convex or better-auth chunks in.
//
// Returns null while loading and [] on any failure. The page shows its
// Services chip only for a non-empty list (design W2): until the first
// provider is live there is nothing to show, and a failed request must not
// leave a chip that opens onto nothing.
export function useServices() {
  const [services, setServices] = useState(null)

  useEffect(() => {
    const ctrl = new AbortController()
    convexQuery('services/queries:listServices', {}, { signal: ctrl.signal })
      .then((rows) => setServices(Array.isArray(rows) ? rows : []))
      .catch((e) => {
        if (ctrl.signal.aborted) return
        console.warn('[explore] services failed to load:', e)
        setServices([])
      })
    return () => ctrl.abort()
  }, [])

  return services
}
