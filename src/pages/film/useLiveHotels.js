import { useEffect, useState } from 'react'

// The film always shows the hotels live on hasio.net, the same list /explore
// shows, so it reads production even from a dev build (useHotels follows
// VITE_CONVEX_URL, which is the development deployment locally). A public
// query over a plain fetch: no Convex client, no session.
const PROD_CONVEX_URL = 'https://hearty-ram-74.eu-west-1.convex.cloud'

// A card needs a nightly price and a photo, the same rule the site applies.
const showable = (h) => typeof h.pricePerNight === 'number' && h.pricePerNight > 0 && h.images?.[0]

// Returns null while loading and [] on failure, so the scene can fall back to pictures.
export function useLiveHotels() {
  const [hotels, setHotels] = useState(null)

  useEffect(() => {
    const ctrl = new AbortController()
    fetch(`${PROD_CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'listings/queries:listListings', args: { type: 'hotel', limit: 50 }, format: 'json' }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((r) => {
        if (r.status !== 'success' || !Array.isArray(r.value)) throw new Error(r.errorMessage || 'bad response')
        setHotels(r.value.filter(showable))
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        console.warn('[film] live hotels unavailable, showing pictures:', e)
        setHotels([])
      })
    return () => ctrl.abort()
  }, [])

  return hotels
}
