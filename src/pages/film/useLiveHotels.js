import { useEffect, useState } from 'react'

// The film always shows the hotels live on hasio.net, the same list /explore
// shows, so it reads production even from a dev build (useHotels follows
// VITE_CONVEX_URL, which is the development deployment locally). A public
// query over a plain fetch: no Convex client, no session.
const PROD_CONVEX_URL = 'https://hearty-ram-74.eu-west-1.convex.cloud'

// A card needs a nightly price and a photo, the same rule the site applies.
const showable = (h) => typeof h.pricePerNight === 'number' && h.pricePerNight > 0 && h.images?.[0]

// One request per page load, shared by every scene: scenes mount and unmount as
// the film plays, and a fetch per mount would leave each one blank for a beat.
let request = null
let result = null
function load() {
  request ??= fetch(`${PROD_CONVEX_URL}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: 'listings/queries:listListings', args: { type: 'hotel', limit: 50 }, format: 'json' }),
  })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((r) => {
      if (r.status !== 'success' || !Array.isArray(r.value)) throw new Error(r.errorMessage || 'bad response')
      return (result = r.value.filter(showable))
    })
    .catch((e) => {
      console.warn('[film] live hotels unavailable, showing pictures:', e)
      return (result = [])
    })
  return request
}

// Returns null while loading and [] on failure, so a scene can fall back to pictures.
export function useLiveHotels() {
  const [hotels, setHotels] = useState(result)
  useEffect(() => {
    let live = true
    load().then((h) => { if (live) setHotels(h) })
    return () => { live = false }
  }, [])
  return hotels
}

// Start the request as soon as the film page loads, not when the first scene needs it.
export const preloadLiveHotels = load
