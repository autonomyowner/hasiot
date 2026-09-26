import { useCallback, useEffect, useState } from 'react'

/**
 * Public Convex queries over plain HTTP, for pages anyone can open.
 *
 * The landing page, /explore and the place and service pages must not load
 * the Convex client or Better Auth (CLAUDE.md, "Bundle & Code Splitting"): a
 * visitor who only browses would download both for nothing. A public query
 * needs neither — Convex answers `POST /api/query` for any function that does
 * not require a session — so these pages read the backend with `fetch`.
 * Signed-in pages (checkout, My trips) use the real client under AuthedLayout.
 */
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL

/**
 * Run one public query. Resolves the value; rejects with an Error whose
 * `data` is a ConvexError's payload — the "عربي / English" refusal the error
 * helpers read — and whose `message` is Convex's own text.
 */
export async function convexQuery(path, args = {}, { signal, url = CONVEX_URL } = {}) {
  if (!url) throw new Error('VITE_CONVEX_URL is not set')
  const res = await fetch(`${url}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
    signal,
  })
  if (!res.ok) throw new Error(`Convex query ${path} failed: HTTP ${res.status}`)
  const body = await res.json()
  if (body.status === 'success') return body.value
  const err = new Error(body.errorMessage || `Convex query ${path} failed`)
  if (body.errorData !== undefined) err.data = body.errorData
  // Convex refused the arguments themselves: an id that is malformed or from
  // another table — a link cut short, or a hand-edited one. To a visitor that
  // is "not found", never an error screen.
  if (/ArgumentValidationError/.test(body.errorMessage ?? '')) err.validation = true
  throw err
}

/**
 * A public query as React state: `{data, error, loading, stale, reload}`.
 *
 * Re-runs whenever the serialised `args` change; the request for the old
 * arguments is aborted, so an answer can never land for a choice the visitor
 * has already moved past. `debounceMs` waits for a pause (dates being clicked
 * through); `keepPrevious` keeps showing the last answer while the next one
 * loads, flagged `stale`, so a total fades instead of blinking out.
 *
 * `loading` is derived rather than stored — the state records which request
 * an answer belongs to, and a mismatch with the current one is "loading" —
 * so no state is set synchronously inside the effect.
 */
export function useConvexQuery(path, args, { skip = false, debounceMs = 0, keepPrevious = false } = {}) {
  const [tick, setTick] = useState(0)
  const argsKey = skip ? null : JSON.stringify(args ?? {})
  const key = argsKey === null ? null : `${tick}|${path}|${argsKey}`
  const [state, setState] = useState({ key: null, data: undefined, error: null })

  useEffect(() => {
    if (key === null) return undefined
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      convexQuery(path, JSON.parse(argsKey), { signal: ctrl.signal })
        .then((data) => setState({ key, data, error: null }))
        .catch((error) => {
          if (ctrl.signal.aborted) return
          setState({ key, data: undefined, error })
        })
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [key, path, argsKey, debounceMs])

  const reload = useCallback(() => setTick((n) => n + 1), [])

  if (key === null) return { data: undefined, error: null, loading: false, stale: false, reload }
  const fresh = state.key === key
  if (fresh) return { data: state.data, error: state.error, loading: false, stale: false, reload }
  const previous = keepPrevious && state.key !== null ? state.data : undefined
  return { data: previous, error: null, loading: true, stale: previous !== undefined, reload }
}
