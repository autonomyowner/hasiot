import { useCallback, useEffect, useRef, useState } from 'react'

// Hotels for /explore's browse list, ten at a time from the backend's cursor
// pagination (listings/queries:listListingsPaginated) — plain fetch, no Convex
// client, same as useHotels. The server filters each page after reading it, so
// a page can come back short or even empty while more exist; callers keep
// asking until `done`, never until a page looks small.
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL
const PAGE = 10

export function useHotelPages() {
  const [items, setItems] = useState([])
  const [done, setDone] = useState(!CONVEX_URL)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  // Refs, not state, for what loadMore reads: an IntersectionObserver can call
  // it twice before React re-renders, and the second call must see the first.
  const cursor = useRef(null)
  const busy = useRef(false)

  const loadMore = useCallback(async () => {
    if (!CONVEX_URL || busy.current || done) return
    busy.current = true
    setLoading(true)
    setError(false)
    try {
      const r = await fetch(`${CONVEX_URL}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'listings/queries:listListingsPaginated',
          args: { type: 'hotel', paginationOpts: { numItems: PAGE, cursor: cursor.current } },
          format: 'json',
        }),
      })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const body = await r.json()
      if (body.status !== 'success') throw new Error(body.errorMessage || 'bad response')
      const { page, isDone, continueCursor } = body.value
      cursor.current = continueCursor
      setItems((prev) => {
        const seen = new Set(prev.map((h) => h._id))
        return [...prev, ...page.filter((h) => !seen.has(h._id))]
      })
      setDone(isDone)
    } catch (e) {
      console.warn('[explore] hotel page failed:', e)
      setError(true)
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [done])

  return { items, done, loading, error, loadMore }
}

// Calls `onVisible` whenever `ref` is within `margin` of the viewport. The
// observer is rebuilt when `key` changes (e.g. after each page lands): a fresh
// observer reports the sentinel's current state straight away, so a short page
// that leaves the sentinel on screen still triggers the next fetch — an
// existing observer would stay silent because nothing *changed*.
export function useSentinel(ref, onVisible, key, margin = '600px') {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(), { rootMargin: `${margin} 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, onVisible, key, margin])
}
