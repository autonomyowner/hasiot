import { useMemo } from 'react'
import { useQueries } from 'convex/react'
import { getFunctionName, makeFunctionReference } from 'convex/server'

/**
 * `useQuery`, except a failure comes back as a value instead of being thrown.
 *
 * `useQuery` throws a failed query during render, and the nearest error
 * boundary takes over. That is right for a tab's own list, but wrong for
 * something beside it — the admin header's counts, a detail drawer — and wrong
 * for any page that reads an id out of its URL: an email link cut short by a
 * mail client makes Convex refuse the argument, and a traveller should read
 * "not found", not the crash screen. `useQueries` reports errors as values;
 * this wraps it for one query.
 *
 * Returns `{ data, error }`: `data` is undefined while loading and on error.
 * Like `useQuery`, it subscribes once per function and argument set: `api.x.y`
 * is a new object on every access, so the memo is keyed on the function's name
 * and the serialised arguments, never on identity.
 *
 * Moved here from src/admin/ (which re-exports it) when the traveller pages
 * needed it too.
 */
export function useQuerySafe(query, args = {}) {
  const skip = args === 'skip'
  const name = getFunctionName(query)
  const argsKey = skip ? '' : JSON.stringify(args)

  const queries = useMemo(
    () => (skip ? {} : { value: { query: makeFunctionReference(name), args: JSON.parse(argsKey) } }),
    [skip, name, argsKey]
  )

  const result = useQueries(queries).value
  if (result instanceof Error) return { data: undefined, error: result }
  return { data: result, error: null }
}
