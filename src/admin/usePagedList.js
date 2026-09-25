import { useCallback, useLayoutEffect, useRef } from 'react'
import { usePaginatedQuery } from 'convex/react'

// How many empty pages in a row are followed automatically before the list
// stops and offers «متابعة البحث». Each one is a full server read, so a
// filter matching nothing in a large table should not quietly run on for ever.
const MAX_EMPTY_PAGES = 10

/**
 * `usePaginatedQuery` for the panel's tables, which never says "no results"
 * while more pages exist.
 *
 * A page can come back short, or empty, with more to come: Convex stops a
 * page at its read limit, and a city filter that folds old sub-areas (Hofuf
 * into Al Ahsa) trims a page after it was read. The tables used to show the
 * empty state for such a page — «لا توجد نتائج» over a list that did have
 * matches further on. So whenever the last page asked for (the first, or one
 * a click asked for) adds no rows and the server says more exist, the next
 * one is asked for at once.
 *
 * A layout effect, so the follow-up is requested before the browser paints:
 * the empty frame in between is never seen, and the list goes straight from
 * placeholder rows to results.
 *
 * `query` and `args` are as for usePaginatedQuery ('skip' included). Returns
 * `{ results, status, loadMore }`, where `loadMore()` takes no argument.
 */
export function usePagedList(query, args, pageSize) {
  const { results, status, loadMore } = usePaginatedQuery(query, args, {
    initialNumItems: pageSize,
  })

  // Rows on screen when a page was last asked for, how many empty pages have
  // followed, and which arguments that was for. Bookkeeping for the effect
  // below, never rendered.
  const argsKey = args === 'skip' ? 'skip' : JSON.stringify(args)
  const asked = useRef(null)

  const more = useCallback(() => {
    asked.current = { argsKey, rows: results.length, empty: 0 }
    loadMore(pageSize)
  }, [argsKey, results.length, loadMore, pageSize])

  useLayoutEffect(() => {
    if (status !== 'CanLoadMore') return
    const last = asked.current?.argsKey === argsKey
      ? asked.current
      : { argsKey, rows: 0, empty: 0 }

    // The page brought rows: nothing to chase until someone asks again.
    if (results.length > last.rows) {
      asked.current = null
      return
    }
    if (last.empty >= MAX_EMPTY_PAGES) return

    asked.current = { argsKey, rows: results.length, empty: last.empty + 1 }
    loadMore(pageSize)
  }, [argsKey, status, results.length, loadMore, pageSize])

  return { results, status, loadMore: more }
}
