import { useEffect, useState } from 'react'

// The hotels shown in the landing page's places rail, read live from the
// backend the app uses. Deliberately a plain fetch against Convex's HTTP query
// API rather than the Convex client: the landing page must not load the convex
// or better-auth chunks (see AuthedLayout.jsx), and a public query needs
// neither a socket nor a session.
//
// Returns null while loading and [] on any failure, so the caller can fall back
// to the static picture cards — the section must never render empty.
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

// Only what a card can show: a hotel without a nightly price or a photo would
// be a card with a hole in it.
const showable = (h) => typeof h.pricePerNight === 'number' && h.pricePerNight > 0 && h.images?.[0]

export function useHotels() {
  // No backend configured (a build without the env file): skip straight to
  // the fallback instead of setting state inside the effect.
  const [hotels, setHotels] = useState(CONVEX_URL ? null : [])

  useEffect(() => {
    if (!CONVEX_URL) return
    const ctrl = new AbortController()
    fetch(`${CONVEX_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'listings/queries:listListings', args: { type: 'hotel', limit: 24 }, format: 'json' }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((r) => {
        if (r.status !== 'success' || !Array.isArray(r.value)) throw new Error(r.errorMessage || 'bad response')
        setHotels(r.value.filter(showable))
      })
      .catch((e) => {
        if (e.name === 'AbortError') return
        console.warn('[hotels] falling back to picture cards:', e)
        setHotels([])
      })
    return () => ctrl.abort()
  }, [])

  return hotels
}
