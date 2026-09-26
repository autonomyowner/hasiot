import { useEffect, useState } from 'react'

// Every public listing (hotels, restaurants, attractions, events, tours) for
// the /explore page. Same plain-fetch approach as useHotels, for the same
// reason: a public query needs neither the Convex client nor a session, and
// the page must not pull the convex or better-auth chunks in.
//
// Returns null while loading and [] on any failure. Only listings with a photo
// are returned — a card without one is a card with a hole in it.
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

export function useListings() {
  const [listings, setListings] = useState(CONVEX_URL ? null : [])

  useEffect(() => {
    if (!CONVEX_URL) return
    const ctrl = new AbortController()
    fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'listings/queries:listListings', args: { limit: 300 }, format: 'json' }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((r) => {
        if (r.status !== 'success' || !Array.isArray(r.value)) throw new Error(r.errorMessage || 'bad response')
        setListings(r.value.filter((l) => l.images?.[0]))
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        console.warn('[explore] listings failed to load:', e)
        setListings([])
      })
    return () => ctrl.abort()
  }, [])

  return listings
}
